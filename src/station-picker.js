import { searchStations, stationSearch } from "fuzzy-stations";
import { getHomeStation, getRecentStations, getWorkStation, rememberStation } from "./station-memory.js";
import { setSheetOrigin } from "./sheet-motion.js";
import {
  formatDistance,
  getCachedPosition,
  nearestStations,
  requestUserPosition,
} from "./nearest-stations.js";
import { STADIUMS, searchStadiums } from "./stadiums.js";

const STADIUM_GROUP = "Euro 2028 stadiums";

function stadiumEntry(stadium) {
  const station = stationSearch.findByCrs(stadium.crs);
  if (!station?.nlc) return null;
  const meta = [`Nearest station: ${station.name}`];
  if (!station.name.startsWith(stadium.city)) meta.push(stadium.city);
  if (stadium.uefaName !== stadium.name) meta.push(`“${stadium.uefaName}” at Euro 2028`);
  return { group: STADIUM_GROUP, station, stadium, meta: meta.join(" · ") };
}

function stadiumIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" fill="currentColor"/>
    <path d="M12 8.2V3.2M15.6 10.8l4.6-1.6M14.2 15l2.9 4M9.8 15l-2.9 4M8.4 10.8L3.8 9.2" stroke="currentColor" stroke-width="1.4"/>
  </svg>`;
}

function savedIcon(kind) {
  const path =
    kind === "home"
      ? '<path d="M4 11 12 4.5 20 11v8a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>'
      : '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17"/>';
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export function attachStationPicker(input, hidden, { initialCrs, stadiums = false, sheet = false, savedPlaces = true } = {}) {
  const includeStadiums = () => (typeof stadiums === "function" ? stadiums() : Boolean(stadiums));
  const includeSavedPlaces = () => (typeof savedPlaces === "function" ? savedPlaces() : Boolean(savedPlaces));
  const list = document.createElement("ul");
  list.id = `${input.id}-suggestions`;
  list.className = "station-suggestions";
  list.hidden = true;
  list.tabIndex = -1;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Station suggestions");
  input.parentElement.appendChild(list);
  const field = input.closest(".station-field");
  const pairEntry = sheet && field ? { input, hidden, field, list, suppressBlur: false, standIn: null, row: null } : null;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-autocomplete", "list");

  let items = [];
  let activeIndex = -1;
  let mode = "browse"; // browse | search
  let nearestStatus = "idle"; // idle | loading | ready | denied | unsupported
  let replaceOnType = Boolean(hidden.value);

  if (initialCrs) {
    const station = stationSearch.findByCrs(initialCrs);
    if (station?.nlc) {
      input.value = station.name;
      hidden.value = station.nlc;
    }
  }

  function close() {
    list.hidden = true;
    list.innerHTML = "";
    list.classList.remove("is-keyboard");
    items = [];
    activeIndex = -1;
    input.setAttribute("aria-expanded", "false");
  }

  function select(entry) {
    const station = entry?.station;
    if (!station?.nlc) return;
    input.value = entry.stadium ? entry.stadium.name : station.name;
    hidden.value = station.nlc;
    if (entry.stadium) input.dataset.stadium = entry.stadium.id;
    else delete input.dataset.stadium;
    rememberStation(station);
    replaceOnType = true;
    close();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (pairEntry && pairState !== "closed") afterPairSelect(pairEntry);
    else if (pairEntry) maybeFocusWhen();
  }

  function highlight() {
    const options = [...list.querySelectorAll('[role="option"]')];
    options.forEach((item, index) => {
      item.setAttribute("aria-selected", String(index === activeIndex));
    });
    options[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  function render() {
    if (pairEntry && pairState !== "open" && prefersMobileSheet()) {
      close();
      return;
    }
    list.innerHTML = "";
    list.classList.toggle("is-searching", mode === "search");
    let optionIndex = 0;

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "suggestion-empty";
      empty.setAttribute("role", "presentation");
      empty.textContent =
        mode === "browse"
          ? nearestStatus === "loading"
            ? "Finding stations near you…"
            : includeSavedPlaces()
              ? "No saved or nearby stations yet. Start typing to search."
              : "No nearby stations yet. Start typing to search."
          : "No matching stations";
      list.appendChild(empty);
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }

    let lastGroup = null;
    let savedRow = null;
    for (const entry of items) {
      if (entry.group && entry.group !== lastGroup) {
        lastGroup = entry.group;
        const heading = document.createElement("li");
        heading.className = "suggestion-group";
        heading.setAttribute("role", "presentation");
        heading.textContent = entry.group;
        list.appendChild(heading);
      }
      if (entry.saved && !savedRow) {
        savedRow = document.createElement("li");
        savedRow.className = "suggestion-saved-row";
        savedRow.setAttribute("role", "presentation");
        list.appendChild(savedRow);
      }

      const item = document.createElement(entry.saved ? "div" : "li");
      const index = optionIndex++;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === activeIndex));
      item.dataset.index = String(index);
      if (entry.stadium) item.classList.add("is-stadium");
      if (entry.saved) {
        item.classList.add("suggestion-saved");
        item.innerHTML = `
          <span class="suggestion-pin">${savedIcon(entry.saved)}</span>
          <span class="suggestion-copy">
            <span class="suggestion-saved-label">${entry.badge}</span>
            <span class="suggestion-name">${entry.station.name}</span>
          </span>
        `;
      } else {
        item.innerHTML = `
          <span class="suggestion-pin">${entry.stadium ? stadiumIcon() : entry.badge || entry.station.crs || ""}</span>
          <span class="suggestion-copy">
            <span class="suggestion-name">${entry.stadium ? entry.stadium.name : entry.station.name}</span>
            ${entry.meta ? `<span class="suggestion-meta">${entry.meta}</span>` : ""}
          </span>
        `;
      }
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const inSheet = pairEntry && pairState === "open";
        select(entry);
        if (inSheet && pairState !== "open") swallowGhostClick();
      });
      (entry.saved ? savedRow : list).appendChild(item);
    }

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function buildBrowseItems(nearest = []) {
    const entries = [];
    const used = new Set();

    const push = (group, station, badge, meta, saved) => {
      if (!station?.nlc || used.has(station.nlc)) return;
      used.add(station.nlc);
      entries.push({ group, station, badge, meta, saved });
    };

    if (includeSavedPlaces()) {
      const home = getHomeStation();
      const work = getWorkStation();
      if (home) push("Saved places", home, "Home", null, "home");
      if (work) push("Saved places", work, "Work", null, "work");
    }

    if (includeStadiums()) entries.push(...STADIUMS.map(stadiumEntry).filter(Boolean));

    for (const item of nearest) {
      push("Nearest", item.station, item.station.crs, formatDistance(item.km));
    }

    for (const station of getRecentStations()) {
      push("Recent", station, station.crs);
    }

    return entries;
  }

  async function showBrowse() {
    mode = "browse";
    list.classList.remove("is-keyboard");
    const cached = getCachedPosition();
    items = buildBrowseItems(cached ? nearestStations(cached) : []);
    activeIndex = items.length ? 0 : -1;
    nearestStatus = cached ? "ready" : "loading";
    render();
    if (!cached) {
      const locating = document.createElement("li");
      locating.className = "suggestion-note";
      locating.setAttribute("role", "presentation");
      locating.textContent = "Looking for nearest stations…";
      list.appendChild(locating);
    }

    if (cached) return;

    try {
      nearestStatus = "loading";
      render();
      const position = await requestUserPosition();
      if (mode !== "browse" || document.activeElement !== input) return;
      nearestStatus = "ready";
      items = buildBrowseItems(nearestStations(position));
      activeIndex = items.length ? 0 : -1;
      render();
    } catch {
      if (mode !== "browse" || document.activeElement !== input) return;
      nearestStatus = navigator.geolocation ? "denied" : "unsupported";
      items = buildBrowseItems([]);
      if (!items.length) {
        render();
        return;
      }
      activeIndex = 0;
      render();
      const note = document.createElement("li");
      note.className = "suggestion-note";
      note.setAttribute("role", "presentation");
      note.textContent =
        nearestStatus === "unsupported"
          ? "Location is not available in this browser."
          : "Location permission needed for nearest stations.";
      list.appendChild(note);
    }
  }

  function search(query) {
    const trimmed = query.trim();
    if (!trimmed) {
      showBrowse();
      return;
    }
    mode = "search";
    nearestStatus = "idle";
    const stadiumItems = includeStadiums() ? searchStadiums(trimmed).map(stadiumEntry).filter(Boolean) : [];
    const stationItems = searchStations(trimmed, { limit: 8 })
      .filter((result) => result.station.nlc)
      .map((result) => ({
        station: result.station,
        badge: result.station.crs,
        group: stadiumItems.length ? "Stations" : null,
        meta: null,
      }));
    items = [...stadiumItems, ...stationItems];
    activeIndex = items.length ? 0 : -1;
    render();
  }

  const clearBtn = field?.querySelector(".station-field-clear");
  clearBtn?.addEventListener("pointerdown", (event) => event.preventDefault());
  clearBtn?.addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
  });

  function startFreshSearch() {
    replaceOnType = false;
    input.value = "";
    hidden.value = "";
    delete input.dataset.stadium;
    if (pairEntry) syncStandIn(pairEntry);
  }

  input.addEventListener("input", () => {
    hidden.value = "";
    delete input.dataset.stadium;
    if (pairEntry) syncStandIn(pairEntry);
    search(input.value);
  });

  input.addEventListener("beforeinput", (event) => {
    const inserting =
      event.inputType === "insertText" ||
      event.inputType === "insertFromPaste" ||
      event.inputType === "insertFromDrop" ||
      event.inputType === "insertCompositionText";
    if (!inserting) return;
    if (replaceOnType && hidden.value) startFreshSearch();
    if (pairEntry && prefersMobileSheet() && pairState === "closed") openPairSheet(input);
  });

  input.addEventListener("focus", () => {
    if (pairEntry && pairState === "closing") {
      input.blur();
      return;
    }
    if (pairEntry && prefersMobileSheet() && pairState === "open") showPairList(pairEntry);
    replaceOnType = Boolean(hidden.value);
    if (pairState === "open" || !prefersMobileSheet()) search(input.value);
  });

  if (pairEntry && field) {
    field.addEventListener("click", () => {
      if (!prefersMobileSheet() || pairState !== "closed") return;
      openPairSheet(input);
    });
  }

  input.addEventListener("keydown", (event) => {
    if (pairEntry && prefersMobileSheet() && pairState === "closed" && event.key === "Enter") {
      event.preventDefault();
      openPairSheet(input);
      return;
    }
    if (replaceOnType && hidden.value && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      startFreshSearch();
      if (pairEntry && prefersMobileSheet() && pairState === "closed") openPairSheet(input);
    }
    if (event.key === "Escape" && pairEntry && pairState !== "closed") {
      event.preventDefault();
      closePairSheet();
      return;
    }
    if (list.hidden) return;
    const options = items;
    if (!options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const alreadyNavigating = list.classList.contains("is-keyboard") || list.classList.contains("is-searching");
      if (alreadyNavigating) {
        activeIndex = (activeIndex + 1) % options.length;
      } else {
        activeIndex = activeIndex < 0 ? 0 : activeIndex;
      }
      list.classList.add("is-keyboard");
      highlight();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + options.length) % options.length;
      list.classList.add("is-keyboard");
      highlight();
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(options[activeIndex]);
    } else if (event.key === "Escape") {
      close();
    }
  });

  input.addEventListener("blur", () => {
    if (pairEntry?.suppressBlur) {
      pairEntry.suppressBlur = false;
      close();
      return;
    }
    if (pairEntry && pairState !== "closed") return;
    const query = input.value.trim();
    if (!query) {
      input.value = "";
      hidden.value = "";
      close();
      return;
    }

    if (hidden.value) {
      close();
      return;
    }

    const byCrs = query.length === 3 ? stationSearch.findByCrs(query) : undefined;
    const fallback = byCrs?.nlc ? { station: byCrs } : items[activeIndex] || items[0];
    if (fallback?.station?.nlc) {
      select(fallback);
      return;
    }
    close();
  });

  if (pairEntry) {
    pairEntry.search = search;
    pairEntry.close = close;
    registerPairField(pairEntry);
  }
}

const pairFields = [];
let pairState = "closed";
let pairSheet = null;
let pairSwapHome = null;
let pairStartedOn = null;

function prefersMobileSheet() {
  return window.matchMedia("(max-width: 860px)").matches;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function registerPairField(entry) {
  pairFields.push(entry);
  ensurePairSheet();
  if (pairFields.length === 1) {
    window.addEventListener("resize", () => {
      if (pairState !== "closed" && !prefersMobileSheet()) closePairSheet({ immediate: true });
    });
    const swap = document.getElementById("swap-stations");
    swap?.addEventListener("click", () => {
      if (pairState === "closed") return;
      queueMicrotask(() => {
        for (const field of pairFields) syncStandIn(field);
        const active = pairFields.find((field) => field.input === document.activeElement) || pairFields[0];
        active?.search?.(active.input.value);
      });
    });
  }
}

function ensurePairSheet() {
  if (pairSheet) return pairSheet;
  const panel = document.createElement("div");
  panel.className = "search-panel station-sheet";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="panel-sheet-head">
      <div class="panel-sheet-copy">
        <h2 class="panel-sheet-title">Stations</h2>
      </div>
      <button type="button" class="panel-sheet-close" aria-label="Close">
        <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">
          <path d="M6 6l20 20M26 6 6 26" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
      </button>
    </header>
    <div class="panel-sheet-body station-sheet-body">
      <div class="station-sheet-pair"></div>
      <div class="station-sheet-results"></div>
    </div>
    <div class="panel-sheet-foot">
      <button type="button" class="when-done">Done</button>
    </div>
  `;
  const closeBtn = panel.querySelector(".panel-sheet-close");
  const doneBtn = panel.querySelector(".when-done");
  closeBtn.addEventListener("pointerdown", (event) => event.preventDefault());
  doneBtn.addEventListener("pointerdown", (event) => event.preventDefault());
  closeBtn.addEventListener("click", () => closePairSheet());
  doneBtn.addEventListener("click", () => closePairSheet());
  document.body.appendChild(panel);
  const highlight = document.createElement("span");
  highlight.className = "station-sheet-highlight";
  highlight.setAttribute("aria-hidden", "true");
  pairSheet = {
    panel,
    pair: panel.querySelector(".station-sheet-pair"),
    results: panel.querySelector(".station-sheet-results"),
    highlight,
  };
  return pairSheet;
}

function moveHighlight(row) {
  const { highlight } = pairSheet;
  if (!row?.isConnected) return;
  const instant = !highlight.classList.contains("is-placed");
  if (instant) highlight.style.transition = "none";
  highlight.style.transform = `translateY(${row.offsetTop}px)`;
  highlight.style.height = `${row.offsetHeight}px`;
  if (instant) {
    void highlight.offsetHeight;
    highlight.style.transition = "";
    highlight.classList.add("is-placed");
  }
}

function ensurePairRow(entry) {
  if (entry.row) return entry.row;
  const row = document.createElement("div");
  row.className = "station-sheet-field";
  if (entry.field.dataset.cell) row.dataset.cell = entry.field.dataset.cell;
  const label = document.createElement("span");
  label.className = "station-sheet-label";
  const name = entry.input.labels?.[0]?.textContent?.trim() || "station";
  label.textContent = name;
  const value = document.createElement("div");
  value.className = "station-sheet-value";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "station-sheet-clear";
  clear.setAttribute("aria-label", `Clear ${name}`);
  clear.hidden = true;
  clear.innerHTML =
    '<svg viewBox="0 0 32 32" width="14" height="14" aria-hidden="true"><path d="M6 6l20 20M26 6 6 26" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>';
  clear.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  clear.addEventListener("click", () => clearPairField(entry));
  value.append(clear);
  row.append(label, value);
  row.addEventListener("pointerdown", (event) => {
    if (event.target === entry.input || event.target.closest(".station-sheet-clear")) return;
    event.preventDefault();
    entry.input.focus();
  });
  entry.row = row;
  entry.valueRow = value;
  entry.clearBtn = clear;
  return row;
}

function clearPairField(entry) {
  entry.input.value = "";
  entry.input.dispatchEvent(new Event("input", { bubbles: true }));
  entry.input.dispatchEvent(new Event("change", { bubbles: true }));
  focusPairField(entry);
}

function syncStandIn(entry) {
  const typed = entry.input.value.trim();
  if (entry.standIn) {
    entry.standIn.textContent = typed || entry.input.placeholder;
    entry.standIn.classList.toggle("is-placeholder", !typed);
  }
  if (entry.clearBtn) entry.clearBtn.hidden = !typed;
}

function showPairList(entry) {
  if (!pairSheet) return;
  pairSheet.results.append(entry.list);
  for (const field of pairFields) {
    field.row?.classList.toggle("is-active", field === entry);
    if (field !== entry) field.list.hidden = true;
  }
  moveHighlight(entry.row);
}

function focusPairField(entry) {
  if (!entry) return;
  showPairList(entry);
  if (document.activeElement !== entry.input) entry.input.focus({ preventScroll: true });
  entry.search?.(entry.input.value);
  entry.input.select();
}

function afterPairSelect(entry) {
  syncStandIn(entry);
  showPairList(entry);
}

function maybeFocusWhen() {
  if (prefersMobileSheet()) return;
  const origin = pairFields.find((field) => field.input.id === "origin");
  const destination = pairFields.find((field) => field.input.id === "destination");
  if (origin?.hidden.value && destination?.hidden.value) focusWhenTrigger();
}

function focusWhenTrigger() {
  document.getElementById("outbound-trigger")?.focus({ preventScroll: true });
}

function openPairSheet(input) {
  if (!prefersMobileSheet()) return;
  const sheet = ensurePairSheet();
  const entry = pairFields.find((field) => field.input === input) || pairFields[0];
  if (!entry) return;
  if (pairState === "closed") {
    pairState = "open";
    pairStartedOn = entry;
    const swap = document.getElementById("swap-stations");
    if (swap && !pairSwapHome) pairSwapHome = { parent: swap.parentNode, next: swap.nextSibling };
    sheet.highlight.classList.remove("is-placed");
    sheet.pair.replaceChildren(sheet.highlight);
    for (const field of pairFields) {
      field.standIn = document.createElement("span");
      field.standIn.className = "station-sheet-standin";
      field.standIn.setAttribute("aria-hidden", "true");
      field.input.before(field.standIn);
      syncStandIn(field);
      const row = ensurePairRow(field);
      field.valueRow.insertBefore(field.input, field.clearBtn);
      syncStandIn(field);
      field.input.classList.add("station-sheet-query");
      sheet.pair.append(row);
    }
    if (swap) sheet.pair.append(swap);
    revealPairSheet(sheet.panel, entry.field);
  }
  focusPairField(entry);
}

function swallowGhostClick() {
  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    release();
  };
  const release = () => document.removeEventListener("click", stop, true);
  document.addEventListener("click", stop, true);
  window.setTimeout(release, 500);
}

function closePairSheet({ immediate = false, restoreFocus } = {}) {
  if (pairState === "closed" || !pairSheet) return;
  for (const field of pairFields) field.suppressBlur = true;
  const active = document.activeElement;
  if (pairFields.some((field) => field.input === active)) active.blur();
  const finish = () => {
    if (pairState === "closed") return;
    for (const field of pairFields) {
      field.close?.();
      field.suppressBlur = false;
      field.hidden.before(field.input);
      field.field.appendChild(field.list);
      field.input.classList.remove("station-sheet-query");
      field.row?.classList.remove("is-active");
      field.field.closest(".search-cell")?.classList.remove("is-active");
      field.standIn?.remove();
      field.standIn = null;
    }
    const swap = document.getElementById("swap-stations");
    if (swap && pairSwapHome?.parent) {
      if (pairSwapHome.next && pairSwapHome.next.parentNode === pairSwapHome.parent) {
        pairSwapHome.parent.insertBefore(swap, pairSwapHome.next);
      } else pairSwapHome.parent.appendChild(swap);
    }
    pairSwapHome = null;
    pairSheet.panel.hidden = true;
    pairSheet.panel.classList.remove("panel-sheet", "is-sheet-open");
    if (!document.querySelector(".search-panel.panel-sheet")) {
      document.body.classList.remove("is-panel-sheet-open");
    }
    document.querySelector(".search-bar")?.classList.remove("is-open");
    pairState = "closed";
    pairStartedOn = null;
    restoreFocus?.();
  };
  if (immediate || prefersReducedMotion() || !pairSheet.panel.classList.contains("is-sheet-open")) {
    finish();
    return;
  }
  pairState = "closing";
  const anchor = pairStartedOn?.field || pairFields[0]?.field;
  if (anchor) placePairSheet(pairSheet.panel, anchor);
  pairSheet.panel.classList.remove("is-sheet-open");
  const onEnd = (event) => {
    if (event.target !== pairSheet.panel || event.propertyName !== "clip-path") return;
    pairSheet.panel.removeEventListener("transitionend", onEnd);
    finish();
  };
  pairSheet.panel.addEventListener("transitionend", onEnd);
  window.setTimeout(finish, 420);
}

function placePairSheet(panel, anchor) {
  setSheetOrigin(panel, anchor.getBoundingClientRect());
}

function revealPairSheet(panel, anchor) {
  placePairSheet(panel, anchor);
  panel.style.transition = "none";
  document.body.classList.add("is-panel-sheet-open");
  panel.classList.add("panel-sheet");
  panel.classList.remove("is-sheet-open");
  panel.hidden = false;
  void panel.offsetWidth;
  panel.style.transition = "";
  if (prefersReducedMotion()) panel.classList.add("is-sheet-open");
  else requestAnimationFrame(() => panel.classList.add("is-sheet-open"));
}

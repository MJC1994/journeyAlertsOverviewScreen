import { searchStations, stationSearch } from "fuzzy-stations";
import { getHomeStation, getRecentStations, getWorkStation, rememberStation } from "./station-memory.js";
import {
  formatDistance,
  getCachedPosition,
  nearestStations,
  requestUserPosition,
} from "./nearest-stations.js";

export function attachStationPicker(input, hidden, { initialCrs } = {}) {
  const list = document.createElement("ul");
  list.id = `${input.id}-suggestions`;
  list.className = "station-suggestions";
  list.hidden = true;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Station suggestions");
  input.parentElement.appendChild(list);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-autocomplete", "list");

  let items = [];
  let activeIndex = -1;
  let mode = "browse"; // browse | search
  let nearestStatus = "idle"; // idle | loading | ready | denied | unsupported

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
    items = [];
    activeIndex = -1;
    input.setAttribute("aria-expanded", "false");
  }

  function select(station) {
    if (!station?.nlc) return;
    input.value = station.name;
    hidden.value = station.nlc;
    rememberStation(station);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }

  function highlight() {
    [...list.querySelectorAll('[role="option"]')].forEach((item, index) => {
      item.setAttribute("aria-selected", String(index === activeIndex));
    });
  }

  function render() {
    list.innerHTML = "";
    let optionIndex = 0;

    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "suggestion-empty";
      empty.setAttribute("role", "presentation");
      empty.textContent =
        mode === "browse"
          ? nearestStatus === "loading"
            ? "Finding stations near you…"
            : "No saved or nearby stations yet. Start typing to search."
          : "No matching stations";
      list.appendChild(empty);
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }

    let lastGroup = null;
    for (const entry of items) {
      if (entry.group && entry.group !== lastGroup) {
        lastGroup = entry.group;
        const heading = document.createElement("li");
        heading.className = "suggestion-group";
        heading.setAttribute("role", "presentation");
        heading.textContent = entry.group;
        list.appendChild(heading);
      }

      const item = document.createElement("li");
      const index = optionIndex++;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === activeIndex));
      item.dataset.index = String(index);
      item.innerHTML = `
        <span class="suggestion-pin">${entry.badge || entry.station.crs || ""}</span>
        <span class="suggestion-copy">
          <span class="suggestion-name">${entry.station.name}</span>
          ${entry.meta ? `<span class="suggestion-meta">${entry.meta}</span>` : ""}
        </span>
      `;
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        select(entry.station);
      });
      list.appendChild(item);
    }

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function buildBrowseItems(nearest = []) {
    const entries = [];
    const used = new Set();

    const push = (group, station, badge, meta) => {
      if (!station?.nlc || used.has(station.nlc)) return;
      used.add(station.nlc);
      entries.push({ group, station, badge, meta });
    };

    const home = getHomeStation();
    const work = getWorkStation();
    if (home) push("Saved places", home, "Home");
    if (work) push("Saved places", work, "Work");

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
    items = searchStations(trimmed, { limit: 8 })
      .filter((result) => result.station.nlc)
      .map((result) => ({
        station: result.station,
        badge: result.station.crs,
        group: null,
        meta: null,
      }));
    activeIndex = items.length ? 0 : -1;
    render();
  }

  input.addEventListener("input", () => {
    hidden.value = "";
    search(input.value);
  });

  input.addEventListener("focus", () => {
    search(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (list.hidden) return;
    const options = items;
    if (!options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % options.length;
      highlight();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + options.length) % options.length;
      highlight();
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(options[activeIndex].station);
    } else if (event.key === "Escape") {
      close();
    }
  });

  input.addEventListener("blur", () => {
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
    const fallback = byCrs?.nlc ? byCrs : items[activeIndex]?.station || items[0]?.station;
    if (fallback?.nlc) {
      select(fallback);
      return;
    }
    close();
  });
}

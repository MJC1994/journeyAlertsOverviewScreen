import { attachWhenPicker, isDefaultOutbound } from "./when-picker.js";
import { attachSeasonDatePicker } from "./season-start.js";
import { attachPillSwitch } from "./pill-switch.js";
import { railcardNames } from "./passengers.js";
import { ROVER_TICKETS, SEASON_RAILCARD } from "./config.js";

export function attachSearchChrome({
  form,
  whoTrigger,
  whenPanel,
  whoPanel,
  viaInput,
  avoidInput,
  viaNlc,
  avoidNlc,
  dateInput,
  timeInput,
  returnDateInput,
  returnTimeInput,
  whoSummary,
  passengers,
}) {
  const searchBar = document.getElementById("search-bar");
  const page = document.querySelector(".page");
  const ticketsMode = document.getElementById("mode-tickets");
  const seasonMode = document.getElementById("mode-season");
  const othersMode = document.getElementById("mode-others");
  const roverTrigger = document.getElementById("rover-trigger");
  const roverPanel = document.getElementById("rover-panel");
  const roverOptions = document.getElementById("rover-options");
  const roverProductInput = document.getElementById("rover-product");
  const roverSummary = document.getElementById("rover-summary");
  const outboundTrigger = document.getElementById("outbound-trigger");
  const returnSlot = document.getElementById("return-slot");
  const returnTrigger = document.getElementById("return-trigger");
  const returnClear = document.getElementById("return-clear");
  const addReturnTrigger = document.getElementById("add-return-trigger");
  const outboundSummary = document.getElementById("outbound-summary");
  const outboundTime = document.getElementById("outbound-time");
  const returnSummary = document.getElementById("return-summary");
  const returnTimeSummary = document.getElementById("return-time-summary");
  const whenTriggers = [outboundTrigger, returnTrigger, addReturnTrigger];
  const whoRailcards = document.getElementById("who-railcards");
  const originInput = document.getElementById("origin");
  const destinationInput = document.getElementById("destination");
  const originLabel = form.querySelector('label[for="origin"]');
  const destinationLabel = form.querySelector('label[for="destination"]');
  const originCrs = document.getElementById("origin-crs");
  const destinationCrs = document.getElementById("destination-crs");
  const swapStations = document.getElementById("swap-stations");
  const routeTrigger = document.getElementById("route-trigger");
  const routePanel = document.getElementById("route-panel");
  const routeChip = document.getElementById("route-chip");
  const routeChipLabel = document.getElementById("route-chip-label");
  const routeClear = document.getElementById("route-clear");
  const discountTrigger = document.getElementById("discount-trigger");
  const discountPanel = document.getElementById("discount-panel");
  const discountChip = document.getElementById("discount-chip");
  const discountChipLabel = document.getElementById("discount-chip-label");
  const discountClear = document.getElementById("discount-clear");
  const discountInput = document.getElementById("discount-code");
  const discountApply = document.getElementById("discount-apply");
  const discountStatus = document.getElementById("discount-status");
  const viaField = document.getElementById("via-field");
  const avoidField = document.getElementById("avoid-field");
  const viaModeBtn = document.getElementById("route-mode-via");
  const avoidModeBtn = document.getElementById("route-mode-avoid");
  const seasonStartTrigger = document.getElementById("season-start-trigger");
  const seasonStartPanel = document.getElementById("season-start-panel");
  const seasonStartInput = document.getElementById("season-start");
  const seasonStartSummary = document.getElementById("season-start-summary");
  const seasonUntilTrigger = document.getElementById("season-until-trigger");
  const seasonUntilPanel = document.getElementById("season-until-panel");
  const seasonUntilInput = document.getElementById("season-until");
  const seasonUntilSummary = document.getElementById("season-until-summary");
  const seasonWhoTrigger = document.getElementById("season-who-trigger");
  const seasonWhoPanel = document.getElementById("season-who-panel");
  const seasonWhoSummary = document.getElementById("season-who-summary");
  const seasonWhoRailcard = document.getElementById("season-who-railcard");
  const seasonPassengerInput = document.getElementById("season-passenger");
  const seasonAdultBtn = document.getElementById("season-adult");
  const seasonChildBtn = document.getElementById("season-child");
  const seasonRailcardInput = document.getElementById("season-railcard");
  const seasonRailcardRow = document.getElementById("season-railcard-row");
  const seasonLengths = document.getElementById("season-lengths");
  const customLengthInput = seasonLengths.querySelector("input[name='season-length'][value='custom']");
  const panels = [
    [outboundTrigger, whenPanel],
    [whoTrigger, whoPanel],
    [routeTrigger, routePanel],
    [discountTrigger, discountPanel],
    [seasonStartTrigger, seasonStartPanel],
    [seasonUntilTrigger, seasonUntilPanel],
    [seasonWhoTrigger, seasonWhoPanel],
    [roverTrigger, roverPanel],
  ];

  function clearTrigger(trigger) {
    trigger?.classList.remove("is-active", "is-open");
    chipFor(trigger)?.classList.remove("is-open");
    trigger?.setAttribute?.("aria-expanded", "false");
  }

  function isWhenTrigger(trigger) {
    return whenTriggers.includes(trigger);
  }

  const filterRow = document.querySelector(".filter-row");
  const searchActions = document.querySelector(".search-actions");
  let resultsView = "journeys";

  function chipFor(trigger) {
    return trigger.closest(".filter-chip");
  }

  const modePills = attachPillSwitch(document.querySelector(".mode-switch"));
  const seasonPassengerPills = attachPillSwitch(document.querySelector(".season-passenger"));
  const routeModePills = attachPillSwitch(document.querySelector(".route-mode"));

  function updateStationLabels() {
    originLabel.textContent = "From";
    destinationLabel.textContent = "To";
  }

  function closePanels(except) {
    for (const [trigger, panel] of panels) {
      if (panel === except) continue;
      if (isSheetPanel(panel) && !panel.hidden) {
        collapsePanelSheet(panel);
        continue;
      }
      panel.hidden = true;
      clearTrigger(trigger);
    }
    if (except !== whenPanel) {
      whenTriggers.forEach(clearTrigger);
    }
    if (except !== whenPanel && except !== whoPanel) {
      searchBar.classList.remove("is-open");
    }
    syncFilterRow(except);
  }

  const sheetPanels = new Set([whenPanel, whoPanel]);
  let sheetAnchor = null;
  let activeSheetPanel = null;

  function isSheetPanel(panel) {
    if (panel.classList.contains("panel-sheet")) return true;
    return sheetPanels.has(panel) && prefersMobileSheet();
  }

  function clearWhenDropdownPosition() {
    whenPanel.style.left = "";
    whenPanel.style.right = "";
    whenPanel.style.transform = "";
  }

  function placeWhenDropdown(trigger) {
    const shell = whenPanel.offsetParent;
    if (!shell) return;
    const shellRect = shell.getBoundingClientRect();
    const anchor = trigger.closest(".when-pair") || trigger;
    const anchorRect = anchor.getBoundingClientRect();
    const panelWidth = whenPanel.offsetWidth || Math.min(420, shellRect.width);
    let left = anchorRect.left - shellRect.left + anchorRect.width / 2 - panelWidth / 2;
    left = Math.max(0, Math.min(left, Math.max(0, shellRect.width - panelWidth)));
    whenPanel.style.left = `${left}px`;
    whenPanel.style.right = "auto";
    whenPanel.style.transform = "none";
  }

  function prefersMobileSheet() {
    return window.matchMedia("(max-width: 860px)").matches;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function setSheetOrigin(panel, trigger) {
    const rect = trigger.getBoundingClientRect();
    panel.style.setProperty("--sheet-t", `${Math.max(0, rect.top)}px`);
    panel.style.setProperty("--sheet-l", `${Math.max(0, rect.left)}px`);
    panel.style.setProperty("--sheet-w", `${Math.max(48, rect.width)}px`);
    panel.style.setProperty("--sheet-h", `${Math.max(48, rect.height)}px`);
    panel.style.setProperty("--sheet-radius", "28px");
  }

  function expandPanelSheet(panel, trigger) {
    // Measure before the sheet is shown. Reading layout after .panel-sheet is
    // applied paints the fallback (top/left 0, full viewport) and starts the
    // transition from the screen edge instead of the tapped control.
    const rect = trigger.getBoundingClientRect();
    if (panel === whenPanel) clearWhenDropdownPosition();
    if (activeSheetPanel && activeSheetPanel !== panel && !activeSheetPanel.hidden) {
      activeSheetPanel.hidden = true;
      activeSheetPanel.classList.remove("panel-sheet", "is-sheet-open");
      activeSheetPanel.style.transition = "";
    }
    activeSheetPanel = panel;
    sheetAnchor = trigger;
    document.body.classList.add("is-panel-sheet-open");
    panel.style.setProperty("--sheet-t", `${Math.max(0, rect.top)}px`);
    panel.style.setProperty("--sheet-l", `${Math.max(0, rect.left)}px`);
    panel.style.setProperty("--sheet-w", `${Math.max(48, rect.width)}px`);
    panel.style.setProperty("--sheet-h", `${Math.max(48, rect.height)}px`);
    panel.style.setProperty("--sheet-radius", "28px");
    panel.style.transition = "none";
    panel.classList.add("panel-sheet");
    panel.hidden = false;
    panel.classList.remove("is-sheet-open");
    void panel.offsetWidth;
    panel.style.transition = "";

    if (prefersReducedMotion()) {
      panel.classList.add("is-sheet-open");
      return;
    }

    requestAnimationFrame(() => {
      panel.classList.add("is-sheet-open");
    });
  }

  function collapsePanelSheet(panel = activeSheetPanel) {
    if (!panel) return;

    const clearSheetTriggers = () => {
      if (panel === whenPanel) whenTriggers.forEach(clearTrigger);
      else if (panel === whoPanel) clearTrigger(whoTrigger);
      else if (sheetAnchor) clearTrigger(sheetAnchor);
    };

    if (panel.hidden) {
      clearSheetTriggers();
      if (activeSheetPanel === panel) {
        document.body.classList.remove("is-panel-sheet-open");
        activeSheetPanel = null;
        sheetAnchor = null;
      }
      searchBar.classList.remove("is-open");
      syncFilterRow(null);
      return;
    }

    const fallbackAnchor = panel === whoPanel ? whoTrigger : outboundTrigger;
    const anchor = sheetAnchor?.isConnected ? sheetAnchor : fallbackAnchor;
    clearSheetTriggers();
    searchBar.classList.remove("is-open");
    syncFilterRow(null);
    if (activeSheetPanel === panel) {
      document.body.classList.remove("is-panel-sheet-open");
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      panel.hidden = true;
      panel.classList.remove("panel-sheet", "is-sheet-open");
      if (activeSheetPanel === panel) {
        activeSheetPanel = null;
        sheetAnchor = null;
      }
    };

    if (prefersReducedMotion() || !panel.classList.contains("is-sheet-open")) {
      finish();
      return;
    }

    setSheetOrigin(panel, anchor);
    panel.classList.remove("is-sheet-open");
    const onEnd = (event) => {
      if (event.target !== panel || event.propertyName !== "height") return;
      panel.removeEventListener("transitionend", onEnd);
      finish();
    };
    panel.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, 420);
  }

  function syncFilterRow(except) {
    filterRow.classList.toggle("is-dimmed", except === whenPanel || except === whoPanel);
  }

  function toggle(trigger, panel) {
    const open = panel.hidden;
    closePanels(open ? panel : null);
    panel.hidden = !open;
    if (isWhenTrigger(trigger)) {
      whenTriggers.forEach(clearTrigger);
    }
    trigger.classList.toggle("is-active", open);
    trigger.classList.toggle("is-open", open);
    chipFor(trigger)?.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", String(open));
    searchBar.classList.toggle(
      "is-open",
      open &&
        (isWhenTrigger(trigger) ||
          trigger === whoTrigger ||
          trigger === seasonStartTrigger ||
          trigger === seasonUntilTrigger ||
          trigger === seasonWhoTrigger ||
          trigger === roverTrigger),
    );
    filterRow.classList.toggle("is-dimmed", open && (isWhenTrigger(trigger) || trigger === whoTrigger));
    if (open && trigger === routeTrigger) {
      setRouteMode(avoidNlc.value && !viaNlc.value ? "avoid" : "via", { focus: true, preserve: true });
      requestAnimationFrame(() => routeModePills.refresh({ animate: false }));
    } else if (open && isWhenTrigger(trigger)) {
      whenPicker.refresh();
    } else if (open && trigger === seasonStartTrigger) {
      seasonStartPicker.refresh();
    } else if (open && trigger === seasonUntilTrigger) {
      seasonUntilPicker.refresh();
    } else if (open && trigger === seasonWhoTrigger) {
      requestAnimationFrame(() => seasonPassengerPills.refresh({ animate: false }));
    } else if (open) {
      panel.querySelector("input:not([type=hidden])")?.focus();
    }
  }

  function openWhen(leg) {
    const trigger =
      leg === "outbound" ? outboundTrigger : returnTrigger.hidden ? addReturnTrigger : returnTrigger;
    const closing = !whenPanel.hidden && trigger.classList.contains("is-open");
    if (!prefersMobileSheet()) {
      if (closing) {
        closePanels(null);
        clearWhenDropdownPosition();
        return;
      }
      closePanels(whenPanel);
      clearWhenDropdownPosition();
      whenTriggers.forEach(clearTrigger);
      trigger.classList.add("is-active", "is-open");
      trigger.setAttribute("aria-expanded", "true");
      whenPanel.hidden = false;
      placeWhenDropdown(trigger);
      searchBar.classList.add("is-open");
      filterRow.classList.add("is-dimmed");
      whenPicker.setFocus(leg === "outbound" ? "outbound" : "return");
      return;
    }
    if (closing) {
      collapsePanelSheet(whenPanel);
      return;
    }
    closePanels(whenPanel);
    whenTriggers.forEach(clearTrigger);
    trigger.classList.add("is-active", "is-open");
    trigger.setAttribute("aria-expanded", "true");
    searchBar.classList.add("is-open");
    filterRow.classList.add("is-dimmed");
    expandPanelSheet(whenPanel, trigger);
    whenPicker.setFocus(leg === "outbound" ? "outbound" : "return");
  }

  function openWho() {
    const closing = !whoPanel.hidden && whoTrigger.classList.contains("is-open");
    if (!prefersMobileSheet()) {
      if (closing) {
        closePanels(null);
        return;
      }
      closePanels(whoPanel);
      whoTrigger.classList.add("is-active", "is-open");
      whoTrigger.setAttribute("aria-expanded", "true");
      whoPanel.hidden = false;
      searchBar.classList.add("is-open");
      filterRow.classList.add("is-dimmed");
      return;
    }
    if (closing) {
      collapsePanelSheet(whoPanel);
      return;
    }
    closePanels(whoPanel);
    whoTrigger.classList.add("is-active", "is-open");
    whoTrigger.setAttribute("aria-expanded", "true");
    searchBar.classList.add("is-open");
    filterRow.classList.add("is-dimmed");
    expandPanelSheet(whoPanel, whoTrigger);
  }

  function openPanel(trigger, panel) {
    if (panel.hidden) toggle(trigger, panel);
  }

  function openFilterSheet(trigger, panel) {
    if (!prefersMobileSheet()) {
      toggle(trigger, panel);
      return;
    }
    const closing = !panel.hidden && trigger.classList.contains("is-open");
    if (closing) {
      collapsePanelSheet(panel);
      return;
    }
    closePanels(panel);
    trigger.classList.add("is-active", "is-open");
    chipFor(trigger)?.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    expandPanelSheet(panel, trigger);
    if (trigger === routeTrigger) {
      setRouteMode(avoidNlc.value && !viaNlc.value ? "avoid" : "via", { focus: true, preserve: true });
      requestAnimationFrame(() => routeModePills.refresh({ animate: false }));
      return;
    }
    requestAnimationFrame(() => panel.querySelector("input:not([type=hidden])")?.focus());
  }

  function setRouteMode(mode, { focus = false, preserve = false } = {}) {
    const via = mode === "via";
    viaModeBtn.setAttribute("aria-selected", String(via));
    avoidModeBtn.setAttribute("aria-selected", String(!via));
    viaField.hidden = !via;
    avoidField.hidden = via;
    if (!preserve) {
      if (via) clearStation(avoidInput, avoidNlc);
      else clearStation(viaInput, viaNlc);
      updateRouteChips();
    }
    if (focus) (via ? viaInput : avoidInput).focus();
  }

  function setSearchMode(mode) {
    const season = mode === "season";
    const others = mode === "others";
    ticketsMode.setAttribute("aria-selected", String(mode === "tickets"));
    seasonMode.setAttribute("aria-selected", String(season));
    othersMode.setAttribute("aria-selected", String(others));
    page.classList.toggle("is-season", season);
    page.classList.toggle("is-others", others);
    if (others) searchBar.appendChild(searchActions);
    else filterRow.appendChild(searchActions);
    updateStationLabels();
    updateSeasonStartSummary();
    updateSeasonUntilSummary();
    updateSeasonWhoSummary();
    syncCustomSeason();
    closePanels(null);
    requestAnimationFrame(() => modePills.refresh());
  }

  outboundTrigger.addEventListener("click", () => openWhen("outbound"));
  returnTrigger.addEventListener("click", () => openWhen("return"));
  addReturnTrigger.addEventListener("click", () => openWhen("return"));
  returnClear.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    whenPicker.setTripType("single");
  });
  whoTrigger.addEventListener("click", () => openWho());
  roverTrigger.addEventListener("click", () => toggle(roverTrigger, roverPanel));
  seasonStartTrigger.addEventListener("click", () => toggle(seasonStartTrigger, seasonStartPanel));
  seasonUntilTrigger.addEventListener("click", () => toggle(seasonUntilTrigger, seasonUntilPanel));
  seasonWhoTrigger.addEventListener("click", () => toggle(seasonWhoTrigger, seasonWhoPanel));
  routeTrigger.addEventListener("click", () => openFilterSheet(routeTrigger, routePanel));
  discountTrigger.addEventListener("click", () => openFilterSheet(discountTrigger, discountPanel));
  viaModeBtn.addEventListener("click", () => setRouteMode("via", { focus: true }));
  avoidModeBtn.addEventListener("click", () => setRouteMode("avoid", { focus: true }));
  ticketsMode.addEventListener("click", () => setSearchMode("tickets"));
  seasonMode.addEventListener("click", () => setSearchMode("season"));
  othersMode.addEventListener("click", () => setSearchMode("others"));
  seasonAdultBtn.addEventListener("click", () => setSeasonPassenger("adult"));
  seasonChildBtn.addEventListener("click", () => setSeasonPassenger("child"));
  seasonRailcardInput.addEventListener("change", updateSeasonWhoSummary);
  seasonLengths.addEventListener("change", () => {
    syncCustomSeason();
    form.dispatchEvent(new CustomEvent("season-lengths-change", { bubbles: true }));
  });
  seasonLengths.querySelector(".season-length-help")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  document.getElementById("search-tickets").addEventListener("click", (event) => {
    event.preventDefault();
    resultsView = "tickets";
    setSearchMode("tickets");
    form.requestSubmit();
  });
  form.querySelector(".search-submit")?.addEventListener("click", () => {
    resultsView = "journeys";
  });

  document.addEventListener("click", (event) => {
    if (event.composedPath().includes(form)) return;
    closePanels(null);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanels(null);
      clearWhenDropdownPosition();
    }
  });

  window.addEventListener("resize", () => {
    if (whenPanel.hidden || whenPanel.classList.contains("panel-sheet") || prefersMobileSheet()) return;
    const trigger = whenTriggers.find((item) => item.classList.contains("is-open")) || outboundTrigger;
    placeWhenDropdown(trigger);
  });

  const whenPicker = attachWhenPicker({
    dateInput,
    timeInput,
    returnDateInput,
    returnTimeInput,
    originInput,
    destinationInput,
    panel: whenPanel,
    onChange: () => {
      updateWhenSummary();
      syncWhenOpenTrigger();
    },
  });
  document.getElementById("when-done").addEventListener("click", () => {
    if (whenPanel.classList.contains("panel-sheet")) collapsePanelSheet(whenPanel);
    else {
      closePanels(null);
      clearWhenDropdownPosition();
    }
  });

  form.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-close-panel]");
    if (!closer || closer.id === "when-done") return;
    event.preventDefault();
    const sheet = closer.closest(".search-panel");
    if (sheet && !sheet.hidden && sheet.classList.contains("panel-sheet")) {
      collapsePanelSheet(sheet);
      return;
    }
    closePanels(null);
  });

  function syncWhenOpenTrigger() {
    if (whenPanel.hidden) return;
    whenTriggers.forEach(clearTrigger);
    const focus = whenPicker.focusLeg();
    const trigger =
      focus === "return" ? (returnTrigger.hidden ? addReturnTrigger : returnTrigger) : outboundTrigger;
    trigger.classList.add("is-active", "is-open");
    trigger.setAttribute("aria-expanded", "true");
  }
  const seasonStartPicker = attachSeasonDatePicker({
    input: seasonStartInput,
    panel: seasonStartPanel,
    onChange: () => {
      keepUntilAfterStart();
      updateSeasonStartSummary();
      updateSeasonUntilSummary();
      seasonUntilPicker.refresh();
      closePanels(null);
    },
  });
  const seasonUntilPicker = attachSeasonDatePicker({
    input: seasonUntilInput,
    panel: seasonUntilPanel,
    getMinDate: () => nextDay(seasonStartInput.value) || formatToday(),
    onChange: () => {
      updateSeasonUntilSummary();
      closePanels(null);
    },
  });

  viaInput.addEventListener("input", updateRouteChips);
  avoidInput.addEventListener("input", updateRouteChips);
  viaInput.addEventListener("change", () => {
    if (viaNlc.value) {
      clearStation(avoidInput, avoidNlc);
      updateRouteChips();
      closePanels(null);
      return;
    }
    updateRouteChips();
  });
  avoidInput.addEventListener("change", () => {
    if (avoidNlc.value) {
      clearStation(viaInput, viaNlc);
      updateRouteChips();
      closePanels(null);
      return;
    }
    updateRouteChips();
  });

  routeClear.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearStation(viaInput, viaNlc);
    clearStation(avoidInput, avoidNlc);
    setRouteMode("via", { preserve: true });
    updateRouteChips();
    closePanels(null);
  });

  let appliedDiscount = "";
  let discountAttempts = 0;
  let discountPending = false;

  function setDiscountStatus(message, kind) {
    discountStatus.hidden = !message;
    discountStatus.textContent = message || "";
    discountStatus.classList.toggle("is-error", kind === "error");
    discountStatus.classList.toggle("is-pending", kind === "pending");
  }

  function updateDiscountChip() {
    discountChipLabel.textContent = appliedDiscount
      ? `Discount Code: ${appliedDiscount}`
      : "+ Discount code";
    discountChip.classList.toggle("is-set", Boolean(appliedDiscount));
    discountClear.hidden = !appliedDiscount;
  }

  function mockDiscountCheck(code) {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        discountAttempts += 1;
        if (discountAttempts === 1) {
          reject(new Error("That discount code isn’t valid."));
          return;
        }
        resolve(code);
      }, 700);
    });
  }

  async function validateDiscount() {
    const code = discountInput.value.trim();
    if (discountPending) return;
    if (!code) {
      setDiscountStatus("Enter a discount code.", "error");
      return;
    }
    discountPending = true;
    discountInput.disabled = true;
    discountApply.disabled = true;
    setDiscountStatus("Checking code…", "pending");
    try {
      appliedDiscount = await mockDiscountCheck(code);
      discountInput.value = appliedDiscount;
      updateDiscountChip();
      setDiscountStatus("", "");
      closePanels(null);
    } catch (error) {
      appliedDiscount = "";
      updateDiscountChip();
      setDiscountStatus(error.message || "That discount code isn’t valid.", "error");
    } finally {
      discountPending = false;
      discountInput.disabled = false;
      discountApply.disabled = false;
      if (!discountPanel.hidden) discountInput.focus();
    }
  }

  discountInput.addEventListener("input", () => {
    if (discountPending) return;
    setDiscountStatus("", "");
  });
  discountInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    validateDiscount();
  });
  discountApply.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    validateDiscount();
  });
  discountClear.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    appliedDiscount = "";
    discountAttempts = 0;
    discountInput.value = "";
    setDiscountStatus("", "");
    updateDiscountChip();
    closePanels(null);
  });

  for (const input of [originInput, destinationInput]) {
    input.addEventListener("focus", () => {
      closePanels(null);
      searchBar.classList.add("is-open");
      input.closest(".search-cell")?.classList.add("is-active");
    });
    input.addEventListener("blur", () => {
      input.closest(".search-cell")?.classList.remove("is-active");
    });
  }

  originInput.addEventListener("change", () => {
    if (originCrs.value) advanceAfter(originInput);
  });
  destinationInput.addEventListener("change", () => {
    if (destinationCrs.value) advanceAfter(destinationInput);
  });

  function advanceAfter(input) {
    setTimeout(() => {
      if (input === originInput) {
        if (destinationCrs.value) return;
        destinationInput.focus();
        destinationInput.select();
        return;
      }
      const season = page.classList.contains("is-season");
      if (season ? seasonStartInput.value : dateInput.value) return;
      destinationInput.blur();
      originInput.closest(".search-cell")?.classList.remove("is-active");
      destinationInput.closest(".search-cell")?.classList.remove("is-active");
      for (const list of searchBar.querySelectorAll(".station-suggestions")) {
        list.hidden = true;
      }
      if (season) openPanel(seasonStartTrigger, seasonStartPanel);
      else openWhen("outbound");
    }, 50);
  }

  swapStations.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const name = originInput.value;
    const nlc = originCrs.value;
    originInput.value = destinationInput.value;
    originCrs.value = destinationCrs.value;
    destinationInput.value = name;
    destinationCrs.value = nlc;
    delete destinationInput.dataset.stadium;
    closePanels(null);
    for (const list of searchBar.querySelectorAll(".station-suggestions")) {
      list.hidden = true;
    }
  });

  function prettyDay(date) {
    if (!date) return "";
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(parsed);
  }

  function prettyWeekday(date) {
    if (!date) return "";
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(parsed);
  }

  function updateWhenSummary() {
    const dayOut = prettyWeekday(dateInput.value);
    const dayBack = prettyWeekday(returnDateInput.value);
    const openReturn = Boolean(document.getElementById("open-return")?.checked);
    const hasReturn = Boolean(dayBack && (openReturn || returnTimeInput.value));

    if (!dayOut || !timeInput.value) {
      outboundSummary.textContent = "Add date";
      outboundSummary.classList.add("is-placeholder");
      outboundTime.textContent = "";
      outboundTime.hidden = true;
    } else if (isDefaultOutbound(dateInput, timeInput)) {
      outboundSummary.classList.remove("is-placeholder");
      outboundSummary.textContent = "Today, Now";
      outboundTime.textContent = "";
      outboundTime.hidden = true;
    } else {
      outboundSummary.classList.remove("is-placeholder");
      outboundSummary.textContent = dayOut;
      outboundTime.textContent = timeInput.value;
      outboundTime.hidden = false;
    }

    if (hasReturn) {
      returnSlot.hidden = false;
      returnTrigger.hidden = false;
      addReturnTrigger.hidden = true;
      returnSummary.classList.remove("is-placeholder");
      if (openReturn) {
        returnSummary.textContent =
          dateInput.value === returnDateInput.value ? "Open Return" : `Open · ${dayBack}`;
        returnTimeSummary.textContent = "";
        returnTimeSummary.hidden = true;
      } else {
        returnSummary.textContent = dayBack;
        returnTimeSummary.textContent = returnTimeInput.value;
        returnTimeSummary.hidden = !returnTimeInput.value;
      }
    } else {
      returnSlot.hidden = true;
      returnTrigger.hidden = true;
      addReturnTrigger.hidden = false;
      returnSummary.textContent = "Add date";
      returnSummary.classList.add("is-placeholder");
      returnTimeSummary.textContent = "";
      returnTimeSummary.hidden = true;
    }
  }

  function updateWhoSummary() {
    const { adults, children } = passengers.passengerCounts();
    const codes = passengers.selectedCodes();
    const people = [
      adults ? `${adults} ${adults === 1 ? "adult" : "adults"}` : null,
      children ? `${children} ${children === 1 ? "child" : "children"}` : null,
    ].filter(Boolean);
    whoSummary.textContent = people.join(", ") || "Add travellers";
    whoSummary.classList.toggle("is-placeholder", !people.length);

    const names = railcardNames(codes);
    whoRailcards.textContent =
      names.length > 1 ? `${names.length} railcards` : names[0] || "No railcard";
    whoRailcards.classList.toggle("is-placeholder", !names.length);
  }

  function setSeasonPassenger(type) {
    const child = type === "child";
    seasonPassengerInput.value = child ? "child" : "adult";
    seasonAdultBtn.setAttribute("aria-selected", String(!child));
    seasonChildBtn.setAttribute("aria-selected", String(child));
    seasonRailcardRow.hidden = child;
    document.querySelector(".season-railcard-hint").hidden = child;
    if (child) seasonRailcardInput.checked = false;
    updateSeasonWhoSummary();
  }

  function updateSeasonStartSummary() {
    const day = prettyDay(seasonStartInput.value);
    const today = prettyDay(formatToday());
    if (!day) {
      seasonStartSummary.textContent = "Add date";
      seasonStartSummary.classList.add("is-placeholder");
      return;
    }
    seasonStartSummary.classList.remove("is-placeholder");
    seasonStartSummary.textContent = day === today ? "Today" : day;
  }

  function updateSeasonUntilSummary() {
    const day = prettyDay(seasonUntilInput.value);
    if (!day) {
      seasonUntilSummary.textContent = "Add date";
      seasonUntilSummary.classList.add("is-placeholder");
      return;
    }
    seasonUntilSummary.classList.remove("is-placeholder");
    seasonUntilSummary.textContent = day;
  }

  function nextDay(date) {
    const parsed = date ? new Date(`${date}T00:00:00`) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return "";
    parsed.setDate(parsed.getDate() + 1);
    return formatDateValue(parsed);
  }

  function formatDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function keepUntilAfterStart() {
    if (!seasonUntilInput.value || !seasonStartInput.value) return;
    const min = nextDay(seasonStartInput.value);
    if (min && seasonUntilInput.value < min) seasonUntilInput.value = min;
  }

  function syncCustomSeason() {
    const custom = Boolean(customLengthInput?.checked);
    page.classList.toggle("is-custom-season", custom);
    seasonUntilTrigger.hidden = !custom;
    if (!custom) {
      seasonUntilPanel.hidden = true;
      seasonUntilTrigger.classList.remove("is-active", "is-open");
      seasonUntilTrigger.setAttribute("aria-expanded", "false");
    }
  }

  function updateSeasonWhoSummary() {
    const child = seasonPassengerInput.value === "child";
    seasonWhoSummary.textContent = child ? "Child" : "Adult";
    const hasCard = !child && seasonRailcardInput.checked;
    seasonWhoRailcard.textContent = hasCard ? SEASON_RAILCARD.name : "No railcard";
    seasonWhoRailcard.classList.toggle("is-placeholder", !hasCard);
  }

  function formatToday() {
    return formatDateValue(new Date());
  }

  function roverProduct() {
    return ROVER_TICKETS.find((product) => product.id === roverProductInput.value) || ROVER_TICKETS[0];
  }

  function setRoverProduct(id) {
    const product = ROVER_TICKETS.find((item) => item.id === id) || ROVER_TICKETS[0];
    roverProductInput.value = product.id;
    roverSummary.textContent = product.name;
    for (const button of roverOptions.querySelectorAll("button")) {
      button.setAttribute("aria-selected", String(button.dataset.rover === product.id));
    }
  }

  function renderRoverOptions() {
    roverOptions.innerHTML = ROVER_TICKETS.map(
      (product) =>
        `<button type="button" role="option" data-rover="${product.id}">${product.name}</button>`,
    ).join("");
    roverOptions.addEventListener("click", (event) => {
      const button = event.target.closest("[data-rover]");
      if (!button) return;
      setRoverProduct(button.dataset.rover);
      closePanels(null);
    });
  }

  function roverSearchState() {
    const { adults, children } = passengers.passengerCounts();
    return {
      product: roverProduct(),
      startDate: seasonStartInput.value,
      adults,
      children,
      railcards: passengers.selectedCodes(),
    };
  }

  function selectedSeasonLengths() {
    return [...seasonLengths.querySelectorAll("input[name='season-length']:checked")].map((input) => input.value);
  }

  function seasonSearchState() {
    const child = seasonPassengerInput.value === "child";
    const durations = selectedSeasonLengths();
    const custom = durations.includes("custom");
    return {
      startDate: seasonStartInput.value,
      endDate: custom ? seasonUntilInput.value : "",
      adults: child ? 0 : 1,
      children: child ? 1 : 0,
      railcards: !child && seasonRailcardInput.checked ? [SEASON_RAILCARD.code] : [],
      durations,
    };
  }

  function clearStation(input, hidden) {
    input.value = "";
    hidden.value = "";
  }

  function updateRouteChips() {
    const viaLabel = viaNlc.value ? viaInput.value : "";
    const avoidLabel = avoidNlc.value ? avoidInput.value : "";
    const set = Boolean(viaLabel || avoidLabel);
    routeChipLabel.textContent = viaLabel
      ? `Via: ${viaLabel}`
      : avoidLabel
        ? `Avoid: ${avoidLabel}`
        : "Via/avoid";
    routeChip.classList.toggle("is-set", set);
    routeClear.hidden = !set;
  }

  if (!seasonStartInput.value) seasonStartInput.value = formatToday();
  renderRoverOptions();
  setRoverProduct(roverProductInput.value);
  updateWhenSummary();
  updateWhoSummary();
  updateSeasonStartSummary();
  updateSeasonUntilSummary();
  updateSeasonWhoSummary();
  syncCustomSeason();
  updateRouteChips();
  updateDiscountChip();
  updateStationLabels();
  whenPicker.refresh();
  seasonStartPicker.refresh();
  seasonUntilPicker.refresh();

  return {
    closePanels: () => closePanels(null),
    consumeResultsView() {
      const view = resultsView;
      resultsView = "journeys";
      return view;
    },
    updateWhenSummary() {
      updateWhenSummary();
      whenPicker.refresh();
    },
    tripType: () => whenPicker.tripType(),
    updateWhoSummary,
    updateRouteChips,
    seasonSearchState,
    roverSearchState,
    isSeasonMode: () => page.classList.contains("is-season"),
    isOthersMode: () => page.classList.contains("is-others"),
    updateSeasonStartSummary() {
      updateSeasonStartSummary();
      seasonStartPicker.refresh();
    },
    updateSeasonUntilSummary() {
      updateSeasonUntilSummary();
      seasonUntilPicker.refresh();
    },
  };
}

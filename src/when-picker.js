const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MODE_LABELS = { Depart: "Leaving at", Arrive: "Arriving by" };
const QUARTER_TIMES = quarterTimes();

export function attachWhenPicker({
  dateInput,
  timeInput,
  returnDateInput,
  returnTimeInput,
  originInput,
  destinationInput,
  panel,
  onChange,
}) {
  const monthLabel = panel.querySelector("#cal-month-label");
  const nextMonthLabel = panel.querySelector("#cal-month-label-next");
  const grids = [panel.querySelector("#calendar-grid"), panel.querySelector("#calendar-grid-next")];
  const outwardTime = panel.querySelector("#outward-time-value");
  const returnTime = panel.querySelector("#return-time-value");
  const outwardDateLabel = panel.querySelector("#outward-date-label");
  const returnDateLabel = panel.querySelector("#return-date-label");
  const sheetRoute = panel.querySelector("#when-sheet-route");
  const returnTimeBlock = panel.querySelector("#return-time-block");
  const outwardTimeBlock = panel.querySelector(".time-block:not(#return-time-block)");
  const returnPickers = panel.querySelector("#return-pickers");
  const hint = panel.querySelector("#when-hint");
  const outwardModeInput = panel.querySelector("#outward-mode");
  const returnModeInput = panel.querySelector("#return-mode");
  const outwardModeLabel = panel.querySelector("#outward-mode-label");
  const returnModeLabel = panel.querySelector("#return-mode-label");
  const openReturnInput = panel.querySelector("#open-return");
  const removeReturnBtn = panel.querySelector("#when-remove-return");
  const sheetEyebrow = panel.querySelector("#when-sheet-eyebrow");
  const sheetTitle = panel.querySelector("#when-sheet-title");

  let viewMonth = monthStart(parseDate(dateInput.value) || new Date());
  let oneWay = !returnDateInput.value;
  let focusLeg = "outbound";

  const pickers = [
    wireModePicker({
      trigger: panel.querySelector("#outward-mode-trigger"),
      menu: panel.querySelector("#outward-mode-menu"),
      input: outwardModeInput,
      label: outwardModeLabel,
    }),
    wireModePicker({
      trigger: panel.querySelector("#return-mode-trigger"),
      menu: panel.querySelector("#return-mode-menu"),
      input: returnModeInput,
      label: returnModeLabel,
    }),
    wireTimePicker({
      trigger: panel.querySelector("#outward-time-trigger"),
      menu: panel.querySelector("#outward-time-menu"),
      input: timeInput,
    }),
    wireTimePicker({
      trigger: panel.querySelector("#return-time-trigger"),
      menu: panel.querySelector("#return-time-menu"),
      input: returnTimeInput,
    }),
  ];

  panel.querySelector("#cal-prev").addEventListener("click", () => {
    viewMonth = shiftMonth(viewMonth, -1);
    render();
  });
  panel.querySelector("#cal-next").addEventListener("click", () => {
    viewMonth = shiftMonth(viewMonth, 1);
    render();
  });

  panel.addEventListener("click", (event) => {
    if (!event.target.closest(".mini-picker")) closePickers();
    const dayBtn = event.target.closest("[data-date]");
    if (dayBtn) chooseDate(dayBtn.dataset.date);
  });

  openReturnInput.addEventListener("change", () => {
    setTripType(openReturnInput.checked ? "open" : "return");
  });
  removeReturnBtn?.addEventListener("click", () => {
    setTripType("single");
    setFocus("outbound");
  });

  function setFocus(leg) {
    focusLeg = leg === "return" ? "return" : "outbound";
    if (focusLeg === "return" && oneWay) setTripType("return");
    const anchor = focusLeg === "return" ? returnDateInput.value || dateInput.value : dateInput.value;
    if (anchor) viewMonth = monthStart(parseDate(anchor) || new Date());
    closePickers();
    render();
  }

  function setTripType(type) {
    oneWay = type === "single";
    const open = type === "open";
    openReturnInput.checked = open;

    if (type === "single") {
      returnDateInput.value = "";
      returnTimeInput.value = "";
      focusLeg = "outbound";
    } else {
      ensureReturnStamp();
    }

    closePickers();
    notify();
  }

  function ensureReturnStamp() {
    if (!dateInput.value) return;
    if (returnDateInput.value && returnTimeInput.value) return;
    returnDateInput.value = dateInput.value;
    const outward = `${dateInput.value}T${timeInput.value || "12:00"}:00`;
    const moved = addMinutesToStamp(outward, 4 * 60);
    if (moved.slice(0, 10) === dateInput.value) {
      returnTimeInput.value = snapToQuarter(moved.slice(11, 16));
      return;
    }
    // Keep the outbound date when +4h would roll into the next day.
    returnTimeInput.value = "23:45";
    keepReturnValid();
  }

  function tripType() {
    if (oneWay) return "single";
    if (openReturnInput.checked) return "open";
    return "return";
  }

  function closePickers(except) {
    for (const picker of pickers) {
      if (picker === except) continue;
      picker.trigger.setAttribute("aria-expanded", "false");
      picker.menu.hidden = true;
    }
  }

  function openPicker(picker) {
    if (!picker || picker.trigger.closest("[hidden]")) return;
    closePickers();
    picker.menu.hidden = false;
    picker.trigger.setAttribute("aria-expanded", "true");
    placeMenu(picker.menu, picker.trigger);
    revealSelected(picker.menu, picker.input.value);
  }

  const followOpenMenu = () => {
    for (const picker of pickers) {
      if (picker.menu.hidden) continue;
      placeMenu(picker.menu, picker.trigger);
    }
  };
  panel.querySelector(".panel-sheet-body")?.addEventListener("scroll", followOpenMenu, { passive: true });
  window.addEventListener("resize", followOpenMenu);

  function pickerByTrigger(id) {
    return pickers.find((picker) => picker.trigger.id === id);
  }

  function wireModePicker({ trigger, menu, input, label }) {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closePickers();
      if (!willOpen) return;
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      placeMenu(menu, trigger);
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-mode]");
      if (!option) return;
      input.value = option.dataset.mode;
      closePickers();
      notify();
      const timeId = trigger.id === "outward-mode-trigger" ? "outward-time-trigger" : "return-time-trigger";
      openPicker(pickerByTrigger(timeId));
    });
    return { trigger, menu, input, label };
  }

  function wireTimePicker({ trigger, menu, input }) {
    menu.innerHTML = QUARTER_TIMES.map(
      (time) => `<li><button type="button" role="option" data-time="${time}">${time}</button></li>`,
    ).join("");
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closePickers();
      if (!willOpen) return;
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      placeMenu(menu, trigger);
      revealSelected(menu, input.value);
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-time]");
      if (!option) return;
      input.value = option.dataset.time;
      closePickers();
      keepReturnValid();
      notify();
      const hasReturn = Boolean(returnDateInput.value && returnTimeInput.value) && !oneWay && !openReturnInput.checked;
      if (input === timeInput && hasReturn) {
        openPicker(pickerByTrigger("return-time-trigger"));
      }
    });
    return { trigger, menu, input };
  }

  function chooseDate(iso) {
    const openReturn = !oneWay && openReturnInput.checked;

    if (focusLeg === "return" && !oneWay) {
      if (iso < dateInput.value) {
        dateInput.value = iso;
      } else {
        returnDateInput.value = iso;
      }
      if (openReturn) returnDateInput.value = dateInput.value;
      if (!returnTimeInput.value) returnTimeInput.value = timeInput.value;
      keepReturnValid();
      notify();
      return;
    }

    dateInput.value = iso;
    if (openReturn) {
      returnDateInput.value = iso;
      if (!returnTimeInput.value) returnTimeInput.value = timeInput.value;
    } else if (!oneWay && returnDateInput.value && returnDateInput.value < iso) {
      returnDateInput.value = "";
      returnTimeInput.value = "";
    }
    keepReturnValid();
    notify();
  }

  function keepReturnValid() {
    if (!dateInput.value || !timeInput.value || !returnDateInput.value || !returnTimeInput.value) return;
    const outward = `${dateInput.value}T${timeInput.value}:00`;
    const inbound = `${returnDateInput.value}T${returnTimeInput.value}:00`;
    if (inbound >= outward) return;
    const moved = addMinutesToStamp(outward, 4 * 60);
    returnDateInput.value = moved.slice(0, 10);
    returnTimeInput.value = snapToQuarter(moved.slice(11, 16));
  }

  function notify() {
    for (const input of [dateInput, timeInput, returnDateInput, returnTimeInput]) {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    render();
    onChange?.();
  }

  function render() {
    monthLabel.textContent = monthTitle(viewMonth);
    nextMonthLabel.textContent = monthTitle(shiftMonth(viewMonth, 1));
    renderMonth(grids[0], viewMonth);
    renderMonth(grids[1], shiftMonth(viewMonth, 1));

    timeInput.value = snapToQuarter(timeInput.value);
    if (oneWay) {
      returnTimeInput.value = "";
    } else {
      if (!returnTimeInput.value) returnTimeInput.value = timeInput.value;
      returnTimeInput.value = snapToQuarter(returnTimeInput.value);
    }
    if (!outwardModeInput.value) outwardModeInput.value = "Depart";
    if (!returnModeInput.value) returnModeInput.value = "Depart";

    outwardTime.textContent = formatDisplayTime(timeInput.value);
    returnTime.textContent = formatDisplayTime(returnTimeInput.value || timeInput.value);
    const openReturn = !oneWay && openReturnInput.checked;
    const fromName = originInput?.value?.trim() || "";
    const toName = destinationInput?.value?.trim() || "";
    outwardDateLabel.textContent = formatWeekdayDate(dateInput.value);
    returnDateLabel.textContent = openReturn ? "Open return" : formatWeekdayDate(returnDateInput.value);
    returnDateLabel.hidden = oneWay || (!openReturn && !returnDateInput.value);
    outwardModeLabel.textContent = MODE_LABELS[outwardModeInput.value] || MODE_LABELS.Depart;
    returnModeLabel.textContent = MODE_LABELS[returnModeInput.value] || MODE_LABELS.Depart;
    syncOptions(panel.querySelector("#outward-mode-menu"), "mode", outwardModeInput.value);
    syncOptions(panel.querySelector("#return-mode-menu"), "mode", returnModeInput.value);
    syncOptions(panel.querySelector("#outward-time-menu"), "time", timeInput.value);
    syncOptions(panel.querySelector("#return-time-menu"), "time", returnTimeInput.value);

    const hasReturn = Boolean(returnDateInput.value);
    const editingReturn = focusLeg === "return" && !oneWay;

    if (outwardTimeBlock) outwardTimeBlock.hidden = editingReturn;
    returnTimeBlock.hidden = !editingReturn;
    returnTimeBlock.classList.toggle("is-empty", oneWay);
    returnTimeBlock.classList.toggle("is-open-return", openReturn);
    returnPickers.hidden = oneWay || openReturn;
    hint.hidden = !editingReturn || oneWay || hasReturn || openReturn;
    if (removeReturnBtn) removeReturnBtn.hidden = !editingReturn || oneWay;
    if (sheetEyebrow && sheetTitle) {
      const outboundWhen = isDefaultOutbound(dateInput, timeInput)
        ? "Today, Now"
        : [formatWeekdayDate(dateInput.value), formatDisplayTime(timeInput.value)].filter(Boolean).join(" · ");
      const returnWhen = openReturn
        ? formatWeekdayDate(returnDateInput.value || dateInput.value) || "Open return"
        : [formatWeekdayDate(returnDateInput.value), formatDisplayTime(returnTimeInput.value)].filter(Boolean).join(" · ");
      if (sheetRoute) {
        sheetRoute.textContent =
          fromName && toName ? (editingReturn ? `${toName} → ${fromName}` : `${fromName} → ${toName}`) : "";
      }
      if (editingReturn) {
        sheetEyebrow.textContent = "Returning";
        sheetTitle.textContent = returnWhen || "Choose date/time";
      } else {
        sheetEyebrow.textContent = "Outbound";
        sheetTitle.textContent = outboundWhen || "Choose date/time";
      }
    }
    panel.classList.toggle("is-one-way", oneWay);
    panel.classList.toggle("is-open-return", openReturn);
    panel.classList.toggle("is-focus-return", editingReturn);
    panel.classList.toggle("is-focus-outbound", !editingReturn);

    const prev = panel.querySelector("#cal-prev");
    const todayMonth = monthStart(new Date());
    prev.disabled = viewMonth <= todayMonth;
  }

  function renderMonth(grid, month) {
    const start = dateInput.value;
    const end = returnDateInput.value;
    const today = formatISO(new Date());
    const first = monthStart(month);
    const lead = (first.getDay() + 6) % 7;
    const days = daysInMonth(first);
    const cells = [];
    const showRange = !oneWay && !openReturnInput.checked;

    for (let i = 0; i < lead; i += 1) cells.push(`<span class="cal-empty"></span>`);

    for (let day = 1; day <= days; day += 1) {
      const iso = formatISO(new Date(first.getFullYear(), first.getMonth(), day));
      const disabled = iso < today;
      const selected = iso === start || (showRange && iso === end);
      const inRange = Boolean(showRange && start && end && iso > start && iso < end);
      const isStart = Boolean(showRange && start && end && iso === start && start !== end);
      const isEnd = Boolean(showRange && start && end && iso === end && start !== end);
      const cellClass = [
        "cal-cell",
        inRange ? "is-in-range" : "",
        isStart ? "is-range-start" : "",
        isEnd ? "is-range-end" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const dayClass = [
        "cal-day",
        selected ? "is-selected" : "",
        iso === today ? "is-today" : "",
      ]
        .filter(Boolean)
        .join(" ");
      cells.push(
        `<div class="${cellClass}"><button type="button" class="${dayClass}" data-date="${iso}" ${disabled ? "disabled" : ""} aria-label="${iso}" aria-pressed="${selected}">${day}</button></div>`,
      );
    }

    grid.innerHTML = WEEKDAYS.map((day) => `<span class="cal-weekday">${day}</span>`).join("") + cells.join("");
  }

  function refresh() {
    if (dateInput.value) viewMonth = monthStart(parseDate(dateInput.value));
    closePickers();
    render();
  }

  refresh();
  return {
    refresh,
    setTripType,
    setFocus,
    tripType,
    focusLeg: () => focusLeg,
  };
}

function placeMenu(menu, trigger) {
  const gap = 6;
  const margin = 12;
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const openBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
  const room = Math.max(0, openBelow ? spaceBelow : spaceAbove);
  const width = rect.width;
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));
  menu.style.left = `${left}px`;
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${Math.min(320, room)}px`;
  if (openBelow) {
    menu.style.top = `${rect.bottom + gap}px`;
    menu.style.bottom = "auto";
  } else {
    menu.style.top = "auto";
    menu.style.bottom = `${window.innerHeight - rect.top + gap}px`;
  }
}

function revealSelected(menu, value) {
  const selected = menu.querySelector(`[data-time="${value}"]`);
  if (!selected) return;
  menu.scrollTop = selected.offsetTop - menu.clientHeight / 2 + selected.clientHeight / 2;
}

function syncOptions(menu, key, value) {
  if (!menu) return;
  for (const button of menu.querySelectorAll("button")) {
    const selected = button.dataset[key] === value;
    button.setAttribute("aria-selected", String(selected));
    button.classList.toggle("is-selected", selected);
  }
}

function quarterTimes() {
  const times = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return times;
}

export function isDefaultOutbound(dateInput, timeInput) {
  const date = dateInput?.dataset.defaultValue;
  const time = timeInput?.dataset.defaultValue;
  return Boolean(date && time && dateInput.value === date && timeInput.value === time);
}

export function snapToQuarter(hhmm) {
  if (!hhmm) return "12:00";
  const [hoursPart, minutesPart] = hhmm.split(":");
  let hours = Number(hoursPart) || 0;
  let minutes = Math.round((Number(minutesPart) || 0) / 15) * 15;
  if (minutes === 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function monthTitle(date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayTime(value) {
  if (!value) return "—";
  return value;
}

function formatWeekdayDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parsed);
}

function addMinutesToStamp(stamp, delta) {
  const date = new Date(stamp);
  date.setMinutes(date.getMinutes() + delta);
  const iso = formatISO(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${iso}T${hours}:${minutes}:00`;
}

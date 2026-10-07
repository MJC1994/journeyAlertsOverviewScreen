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
  const outwardTime = panel.querySelector("#outward-time-trigger");
  const returnTime = panel.querySelector("#return-time-trigger");
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
  let calendarCursor = dateInput.value || formatISO(new Date());
  let moveCalendarFocus = false;

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
      nativeInput: panel.querySelector("#outward-time-native"),
      input: timeInput,
      getDate: () => dateInput.value,
    }),
    wireTimePicker({
      trigger: panel.querySelector("#return-time-trigger"),
      menu: panel.querySelector("#return-time-menu"),
      nativeInput: panel.querySelector("#return-time-native"),
      input: returnTimeInput,
      getDate: () => returnDateInput.value,
    }),
  ];

  panel.querySelector("#cal-prev").addEventListener("click", () => shiftView(-1));
  panel.querySelector("#cal-next").addEventListener("click", () => shiftView(1));
  panel.querySelector(".calendar-shell")?.addEventListener("keydown", onCalendarKeydown);

  panel.addEventListener("click", (event) => {
    if (!event.target.closest(".mini-picker")) closePickers();
    const dayBtn = event.target.closest("[data-date]");
    if (dayBtn) chooseDate(dayBtn.dataset.date);
  });

  openReturnInput.addEventListener("change", () => {
    setTripType(openReturnInput.checked ? "open" : "return");
  });
  removeReturnBtn?.addEventListener("click", () => setTripType("single"));

  function setFocus(leg) {
    focusLeg = leg === "return" ? "return" : "outbound";
    if (focusLeg === "return" && oneWay) setTripType("return");
    const anchor = focusLeg === "return" ? returnDateInput.value || dateInput.value : dateInput.value;
    if (anchor) viewMonth = monthStart(parseDate(anchor) || new Date());
    calendarCursor = anchor || calendarCursor;
    moveCalendarFocus = true;
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
      if (picker.trigger === except?.trigger) continue;
      picker.trigger.setAttribute("aria-expanded", "false");
      picker.menu.hidden = true;
      picker.restore?.();
    }
  }

  function menuOptions(menu) {
    return [...menu.querySelectorAll('[role="option"]')].filter(
      (option) => option.getAttribute("aria-disabled") !== "true",
    );
  }

  function focusMenuValue(menu, value, key) {
    const options = menuOptions(menu);
    const selected = options.find((option) => option.dataset[key] === value) || options[0];
    selected?.focus();
    if (selected && key === "time") {
      menu.scrollTop = selected.offsetTop - menu.clientHeight / 2 + selected.clientHeight / 2;
    }
  }

  function openPicker(picker) {
    if (!picker || picker.trigger.closest("[hidden]")) return;
    closePickers();
    picker.menu.hidden = false;
    picker.trigger.setAttribute("aria-expanded", "true");
    placeMenu(picker.menu, picker.trigger);
    focusMenuValue(picker.menu, picker.input.value, picker.key);
  }

  const followOpenMenu = () => {
    for (const picker of pickers) {
      if (picker.menu.hidden) continue;
      placeMenu(picker.menu, picker.trigger);
    }
  };
  panel.querySelector(".panel-sheet-body")?.addEventListener("scroll", followOpenMenu, { passive: true });
  window.addEventListener("resize", followOpenMenu);

  function wireListbox({ trigger, menu, input, key, onSelect, onOpen }) {
    const toggle = (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closePickers();
      if (!willOpen) {
        trigger.focus();
        return;
      }
      onOpen?.();
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      placeMenu(menu, trigger);
      focusMenuValue(menu, input.value, key);
    };
    trigger.addEventListener("click", toggle);
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      if (menu.hidden) toggle(event);
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[role='option']");
      if (!option || option.getAttribute("aria-disabled") === "true") return;
      onSelect(option);
    });
    menu.addEventListener("keydown", (event) => {
      const options = menuOptions(menu);
      const current = options.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        options[Math.max(0, Math.min(options.length - 1, next))]?.focus();
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        options[0]?.focus();
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        options[options.length - 1]?.focus();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (current >= 0) onSelect(options[current]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePickers();
        trigger.focus();
        return;
      }
      if (event.key === "Tab") {
        closePickers();
      }
    });
    return { trigger, menu, input, key };
  }

  function wireModePicker({ trigger, menu, input, label }) {
    return wireListbox({
      trigger,
      menu,
      input,
      key: "mode",
      onSelect: (option) => {
        input.value = option.dataset.mode;
        closePickers();
        notify();
        trigger.focus();
      },
    });
  }

  function wireTimePicker({ trigger, menu, input, nativeInput, getDate }) {
    menu.innerHTML = QUARTER_TIMES.map(
      (time) =>
        `<li role="option" id="${menu.id}-${time.replace(":", "")}" data-time="${time}" tabindex="-1">${time}</li>`,
    ).join("");

    const picker = wireListbox({
      trigger,
      menu,
      input,
      key: "time",
      onOpen: () => {
        const date = getDate?.() || "";
        const next = clampTimeToSoonest(date, input.value);
        if (next !== input.value) {
          input.value = next;
          keepReturnValid();
          notify();
        } else {
          syncTimeAvailability(menu, nativeInput, date);
        }
      },
      onSelect: (option) => {
        if (option.getAttribute("aria-disabled") === "true") return;
        input.value = clampTimeToSoonest(getDate?.() || "", option.dataset.time);
        closePickers();
        keepReturnValid();
        notify();
        trigger.focus();
      },
    });
    menu.addEventListener("mousedown", (event) => event.preventDefault());
    nativeInput?.addEventListener("change", () => {
      const next = clampTimeToSoonest(getDate?.() || "", nativeInput.value);
      if (!next) return;
      input.value = next;
      if (nativeInput.value !== next) nativeInput.value = next;
      keepReturnValid();
      notify();
    });
    return picker;
  }

  function chooseDate(iso) {
    const openReturn = !oneWay && openReturnInput.checked;

    calendarCursor = iso;
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

    calendarCursor = iso;
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
    const before = `${timeInput.value}|${returnDateInput.value}|${returnTimeInput.value}`;
    timeInput.value = clampTimeToSoonest(dateInput.value, timeInput.value);
    if (oneWay) {
      returnTimeInput.value = "";
    } else {
      if (!returnTimeInput.value) returnTimeInput.value = timeInput.value;
      returnTimeInput.value = clampTimeToSoonest(returnDateInput.value, returnTimeInput.value);
      keepReturnValid();
    }
    const adjusted = `${timeInput.value}|${returnDateInput.value}|${returnTimeInput.value}` !== before;

    monthLabel.textContent = monthTitle(viewMonth);
    nextMonthLabel.textContent = monthTitle(shiftMonth(viewMonth, 1));
    renderMonth(grids[0], viewMonth);
    renderMonth(grids[1], shiftMonth(viewMonth, 1));
    if (!outwardModeInput.value) outwardModeInput.value = "Depart";
    if (!returnModeInput.value) returnModeInput.value = "Depart";

    paintTimeControl(outwardTime, panel.querySelector("#outward-time-native"), timeInput.value);
    paintTimeControl(
      returnTime,
      panel.querySelector("#return-time-native"),
      oneWay ? "" : returnTimeInput.value || timeInput.value,
    );
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
    syncTimeAvailability(
      panel.querySelector("#outward-time-menu"),
      panel.querySelector("#outward-time-native"),
      dateInput.value,
    );
    syncTimeAvailability(
      panel.querySelector("#return-time-menu"),
      panel.querySelector("#return-time-native"),
      returnDateInput.value,
    );
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
      const sheetWhen = (date, time) => {
        if (!date) return "";
        const todayNow = isTodayDate(date) && isNowTime(time, timeInput);
        return [formatWeekdayDate(date), todayNow ? "Now" : time].filter(Boolean).join(" · ");
      };
      const outboundWhen = sheetWhen(dateInput.value, timeInput.value);
      const returnWhen = openReturn
        ? formatWeekdayDate(returnDateInput.value || dateInput.value) || "Open return"
        : sheetWhen(returnDateInput.value, returnTimeInput.value);
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
    syncCalendarTab(moveCalendarFocus);
    moveCalendarFocus = false;
    if (adjusted) onChange?.();
  }

  function calendarDays() {
    return [...panel.querySelectorAll(".cal-day:not(:disabled)")];
  }

  function preferredCalendarDate() {
    const selected = focusLeg === "return" && returnDateInput.value ? returnDateInput.value : dateInput.value;
    return calendarCursor || selected || formatISO(new Date());
  }

  function setCalendarTabStop(iso) {
    const days = calendarDays();
    const match = days.find((day) => day.dataset.date === iso) || days[0];
    for (const day of panel.querySelectorAll(".cal-day")) day.tabIndex = -1;
    if (!match) return null;
    match.tabIndex = 0;
    calendarCursor = match.dataset.date;
    return match;
  }

  function syncCalendarTab(moveFocus) {
    const restore = moveFocus || document.activeElement?.classList?.contains("cal-day");
    const button = setCalendarTabStop(preferredCalendarDate());
    if (restore && button) button.focus({ preventScroll: !moveFocus });
  }

  function focusDate() {
    const button = setCalendarTabStop(preferredCalendarDate());
    button?.focus();
  }

  function shiftView(count) {
    const next = shiftMonth(viewMonth, count);
    const todayMonth = monthStart(new Date());
    if (next < todayMonth) return;
    viewMonth = next;
    const cursor = parseDate(calendarCursor);
    if (cursor) {
      calendarCursor = formatISO(new Date(cursor.getFullYear(), cursor.getMonth() + count, cursor.getDate()));
    }
    const hadFocus = document.activeElement?.classList?.contains("cal-day");
    render();
    if (hadFocus) focusDate();
  }

  function moveCalendar(days) {
    const from = parseDate(preferredCalendarDate());
    if (!from) return;
    const next = new Date(from);
    next.setDate(next.getDate() + days);
    const iso = formatISO(next);
    if (iso < formatISO(new Date())) return;
    calendarCursor = iso;
    if (!panel.querySelector(`.cal-day[data-date="${iso}"]`)) {
      viewMonth = monthStart(next);
      moveCalendarFocus = true;
      render();
      return;
    }
    setCalendarTabStop(iso)?.focus();
  }

  function onCalendarKeydown(event) {
    if (!event.target.classList.contains("cal-day")) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (step) {
      event.preventDefault();
      moveCalendar(step);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      const from = parseDate(calendarCursor);
      if (from) moveCalendar(-((from.getDay() + 6) % 7));
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      const from = parseDate(calendarCursor);
      if (from) moveCalendar(6 - ((from.getDay() + 6) % 7));
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      shiftView(-1);
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      shiftView(1);
    }
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
      const spoken = [formatSpokenDate(iso), iso === today ? "today" : "", selected ? "selected" : ""]
        .filter(Boolean)
        .join(", ");
      cells.push(
        `<div class="${cellClass}"><button type="button" class="${dayClass}" data-date="${iso}" tabindex="-1" ${disabled ? "disabled" : ""} aria-label="${spoken}" aria-pressed="${selected}" ${iso === today ? 'aria-current="date"' : ""}>${day}</button></div>`,
      );
    }

    grid.innerHTML = WEEKDAYS.map((day) => `<span class="cal-weekday" aria-hidden="true">${day}</span>`).join("") + cells.join("");
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
    focusDate,
    tripType,
    focusLeg: () => focusLeg,
  };
}

function layoutShift() {
  const viewport = window.visualViewport;
  if (!viewport || viewport.offsetTop === 0) return 0;
  const sheet = document.querySelector(".search-panel.panel-sheet:not([hidden])");
  const origin = sheet?.getBoundingClientRect().top ?? 0;
  return Math.abs(origin + viewport.offsetTop) + 1 < Math.abs(origin) ? viewport.offsetTop : 0;
}

function visibleFrame() {
  const viewport = window.visualViewport;
  const height = viewport?.height ?? window.innerHeight;
  const width = viewport?.width ?? window.innerWidth;
  const top = viewport?.offsetTop ?? 0;
  const left = viewport?.offsetLeft ?? 0;
  return {
    top,
    left,
    bottom: top + height,
    right: left + width,
    keyboard: Math.max(0, window.innerHeight - top - height),
  };
}

function placeMenu(menu, trigger) {
  const gap = 6;
  const margin = 12;
  const frame = visibleFrame();
  const shift = layoutShift();
  const rect = trigger.getBoundingClientRect();
  const triggerTop = rect.top + shift;
  const triggerBottom = rect.bottom + shift;
  const triggerLeft = rect.left + (shift ? frame.left : 0);
  const spaceBelow = frame.bottom - triggerBottom - gap - margin;
  const spaceAbove = triggerTop - frame.top - gap - margin;
  const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
  const width = Math.max(rect.width, 108);
  const left = Math.min(
    Math.max(frame.left + margin, triggerLeft),
    Math.max(frame.left + margin, frame.right - width - margin),
  );
  menu.style.left = `${left}px`;
  menu.style.width = `${width}px`;
  const room = Math.min(320, Math.max(0, openBelow ? spaceBelow : spaceAbove));
  if (room >= 140) {
    menu.style.maxHeight = `${room}px`;
    menu.style.bottom = "auto";
    menu.style.top = openBelow ? `${triggerBottom + gap}px` : `${Math.max(frame.top + margin, triggerTop - gap - room)}px`;
    return;
  }
  const height = Math.min(320, Math.max(160, (frame.bottom - frame.top) * 0.5));
  menu.style.maxHeight = `${height}px`;
  menu.style.top = `${Math.max(frame.top + margin, frame.bottom - margin - height)}px`;
  menu.style.bottom = "auto";
}

function syncOptions(menu, key, value) {
  if (!menu) return;
  for (const button of menu.querySelectorAll("[role='option']")) {
    const selected = button.dataset[key] === value;
    button.setAttribute("aria-selected", String(selected));
    button.classList.toggle("is-selected", selected);
  }
}

function syncTimeAvailability(menu, nativeInput, date) {
  const soonest = isTodayDate(date) ? soonestSearchTime() : "";
  if (menu) {
    for (const option of menu.querySelectorAll("[role='option']")) {
      const disabled = Boolean(soonest && option.dataset.time < soonest);
      option.setAttribute("aria-disabled", String(disabled));
      option.classList.toggle("is-disabled", disabled);
    }
  }
  if (!nativeInput) return;
  if (soonest) nativeInput.min = soonest;
  else nativeInput.removeAttribute("min");
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

export function isTodayDate(value) {
  return Boolean(value && value === formatISO(new Date()));
}

export function isNowTime(value, timeInput) {
  const now = timeInput?.dataset.defaultValue;
  return Boolean(value && now && value === now);
}

export function formatWhenDate(value) {
  if (!value) return "";
  return isTodayDate(value) ? "Today" : formatWeekdayDate(value);
}

export function formatWhenTime(value, timeInput) {
  if (!value) return "";
  return isNowTime(value, timeInput) ? "Now" : value;
}

export function isDefaultOutbound(dateInput, timeInput) {
  return isTodayDate(dateInput?.value) && isNowTime(timeInput?.value, timeInput);
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

export function soonestSearchTime(from = new Date()) {
  const slot = 15 * 60 * 1000;
  const next = new Date(Math.ceil(from.getTime() / slot) * slot);
  if (formatISO(next) !== formatISO(from)) return "23:45";
  return formatClock(next);
}

function clampTimeToSoonest(date, time) {
  const snapped = snapToQuarter(time);
  if (!isTodayDate(date)) return snapped;
  const soonest = soonestSearchTime();
  return snapped < soonest ? soonest : snapped;
}

function formatClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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

function paintTimeControl(trigger, nativeInput, value) {
  const label = trigger?.querySelector(".mini-picker-time-label");
  if (label) label.textContent = formatDisplayTime(value);
  if (!nativeInput || document.activeElement === nativeInput) return;
  nativeInput.value = value || "";
}

function formatSpokenDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
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

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
      input: timeInput,
    }),
    wireTimePicker({
      trigger: panel.querySelector("#return-time-trigger"),
      menu: panel.querySelector("#return-time-menu"),
      input: returnTimeInput,
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
    return [...menu.querySelectorAll('[role="option"]')];
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

  function wireListbox({ trigger, menu, input, key, onSelect }) {
    const toggle = (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closePickers();
      if (!willOpen) {
        trigger.focus();
        return;
      }
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
      if (!option) return;
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

  function wireTimePicker({ trigger, menu, input }) {
    menu.innerHTML = QUARTER_TIMES.map(
      (time) =>
        `<li role="option" id="${menu.id}-${time.replace(":", "")}" data-time="${time}">${time}</li>`,
    ).join("");

    let typed = "";
    let activeTime = input.value;
    let syncing = false;

    const visibleOptions = () => menuOptions(menu).filter((option) => !option.hidden);

    const setDisplay = (value) => {
      syncing = true;
      trigger.value = value;
      syncing = false;
    };

    const setOpen = (open) => {
      menu.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) placeMenu(menu, trigger);
      else trigger.removeAttribute("aria-activedescendant");
    };

    const setActive = (time) => {
      const options = visibleOptions();
      const match = options.find((option) => option.dataset.time === time) || options[0];
      activeTime = match?.dataset.time || "";
      for (const option of menuOptions(menu)) {
        const active = option === match;
        option.classList.toggle("is-active", active);
        option.classList.toggle("is-selected", option.dataset.time === input.value);
        option.setAttribute("aria-selected", String(active));
      }
      if (match) {
        trigger.setAttribute("aria-activedescendant", match.id);
        match.scrollIntoView({ block: "nearest" });
      } else {
        trigger.removeAttribute("aria-activedescendant");
      }
    };

    const applyFilter = (query) => {
      const matches = matchingTimes(query);
      const list = matches.length ? matches : QUARTER_TIMES;
      for (const option of menuOptions(menu)) {
        option.hidden = Boolean(query) && matches.length > 0 && !matches.includes(option.dataset.time);
      }
      const guessed = parseTypedTime(query);
      setActive(guessed && list.includes(guessed) ? guessed : list[0] || input.value);
    };

    const commit = (time = activeTime || parseTypedTime(trigger.value)) => {
      const next = snapToQuarter(time || input.value);
      typed = "";
      input.value = next;
      setDisplay(formatDisplayTime(next));
      setOpen(false);
      applyFilter("");
      syncOptions(menu, "time", next);
      keepReturnValid();
      notify();
      trigger.focus();
    };

    const restore = () => {
      typed = "";
      setDisplay(formatDisplayTime(input.value));
      setOpen(false);
      applyFilter("");
      syncOptions(menu, "time", input.value);
    };

    const open = (query = "") => {
      closePickers({ trigger, menu, input, key: "time" });
      typed = query.replace(/\D/g, "");
      if (typed) setDisplay(formatTypedTime(typed));
      setOpen(true);
      applyFilter(typed);
      if (!typed) setActive(snapToQuarter(input.value));
    };

    trigger.addEventListener("click", () => {
      if (menu.hidden) open();
    });

    trigger.addEventListener("focus", () => {
      trigger.select();
    });

    trigger.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (menu.contains(document.activeElement) || document.activeElement === trigger) return;
        if (!menu.hidden) commit();
      }, 0);
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (menu.hidden) open();
        const options = visibleOptions();
        if (!options.length) return;
        const current = options.findIndex((option) => option.dataset.time === activeTime);
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        const option = options[Math.max(0, Math.min(options.length - 1, next))];
        setActive(option.dataset.time);
        setDisplay(option.dataset.time);
        typed = option.dataset.time.replace(":", "");
        return;
      }
      if (event.key === "PageDown" || event.key === "PageUp") {
        event.preventDefault();
        if (menu.hidden) open();
        const options = visibleOptions();
        if (!options.length) return;
        const current = Math.max(0, options.findIndex((option) => option.dataset.time === activeTime));
        const next = current + (event.key === "PageDown" ? 4 : -4);
        const option = options[Math.max(0, Math.min(options.length - 1, next))];
        setActive(option.dataset.time);
        setDisplay(option.dataset.time);
        typed = option.dataset.time.replace(":", "");
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        if (menu.hidden) return;
        event.preventDefault();
        const options = visibleOptions();
        const option = event.key === "Home" ? options[0] : options[options.length - 1];
        if (!option) return;
        setActive(option.dataset.time);
        setDisplay(option.dataset.time);
        typed = option.dataset.time.replace(":", "");
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (menu.hidden) open();
        else commit();
        return;
      }
      if (event.key === "Escape") {
        if (menu.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        restore();
        return;
      }
      if (event.key === "Tab") {
        if (!menu.hidden) commit();
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        const next = event.key === "Backspace" ? typed.slice(0, -1) : "";
        typed = next;
        setDisplay(formatTypedTime(typed));
        event.preventDefault();
        if (menu.hidden) open(typed);
        else applyFilter(typed);
        return;
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        typed = `${typed}${event.key}`.replace(/\D/g, "").slice(0, 4);
        setDisplay(formatTypedTime(typed));
        if (menu.hidden) open(typed);
        else applyFilter(typed);
      }
    });

    trigger.addEventListener("input", () => {
      if (syncing) return;
      typed = trigger.value.replace(/\D/g, "").slice(0, 4);
      const formatted = formatTypedTime(typed);
      if (trigger.value !== formatted) setDisplay(formatted);
      if (menu.hidden) open(typed);
      else applyFilter(typed);
    });

    menu.addEventListener("mousedown", (event) => event.preventDefault());
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[role='option']");
      if (!option || option.hidden) return;
      commit(option.dataset.time);
    });

    return { trigger, menu, input, key: "time", restore };
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

    if (document.activeElement !== outwardTime) outwardTime.value = formatDisplayTime(timeInput.value);
    if (document.activeElement !== returnTime) {
      returnTime.value = formatDisplayTime(returnTimeInput.value || timeInput.value);
    }
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

function syncOptions(menu, key, value) {
  if (!menu) return;
  for (const button of menu.querySelectorAll("[role='option']")) {
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

function formatTypedTime(digits) {
  const clean = String(digits || "").replace(/\D/g, "").slice(0, 4);
  if (clean.length <= 2) return clean;
  return `${clean.slice(0, 2)}:${clean.slice(2)}`;
}

function matchingTimes(query) {
  const digits = String(query || "").replace(/\D/g, "");
  if (!digits) return QUARTER_TIMES;
  return QUARTER_TIMES.filter((time) => time.replace(":", "").startsWith(digits));
}

function parseTypedTime(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (!digits) return null;
  const four = digits.length <= 2 ? `${digits.padStart(2, "0")}00` : digits.length === 3 ? `${digits}0` : digits;
  const hours = Number(four.slice(0, 2));
  const minutes = Number(four.slice(2, 4));
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null;
  return snapToQuarter(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
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

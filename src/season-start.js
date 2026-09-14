const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function attachSeasonStartPicker(options) {
  return attachSeasonDatePicker(options);
}

export function attachSeasonDatePicker({ input, panel, onChange, getMinDate }) {
  const monthLabel = panel.querySelector("[data-cal-month]");
  const nextMonthLabel = panel.querySelector("[data-cal-month-next]");
  const grids = [panel.querySelector("[data-cal-grid]"), panel.querySelector("[data-cal-grid-next]")];
  let viewMonth = monthStart(parseDate(input.value) || new Date());

  panel.querySelector("[data-cal-prev]").addEventListener("click", () => {
    viewMonth = shiftMonth(viewMonth, -1);
    render();
  });
  panel.querySelector("[data-cal-next]").addEventListener("click", () => {
    viewMonth = shiftMonth(viewMonth, 1);
    render();
  });
  panel.addEventListener("click", (event) => {
    const dayBtn = event.target.closest("[data-date]");
    if (!dayBtn) return;
    input.value = dayBtn.dataset.date;
    render();
    onChange?.();
  });

  function minIso() {
    return getMinDate?.() || formatISO(new Date());
  }

  function render() {
    monthLabel.textContent = monthTitle(viewMonth);
    nextMonthLabel.textContent = monthTitle(shiftMonth(viewMonth, 1));
    renderMonth(grids[0], viewMonth);
    renderMonth(grids[1], shiftMonth(viewMonth, 1));
    const prev = panel.querySelector("[data-cal-prev]");
    prev.disabled = viewMonth <= monthStart(parseDate(minIso()) || new Date());
  }

  function renderMonth(grid, month) {
    const selected = input.value;
    const today = formatISO(new Date());
    const min = minIso();
    const first = monthStart(month);
    const lead = (first.getDay() + 6) % 7;
    const days = daysInMonth(first);
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(`<span class="cal-empty"></span>`);
    for (let day = 1; day <= days; day += 1) {
      const iso = formatISO(new Date(first.getFullYear(), first.getMonth(), day));
      const disabled = iso < min;
      const isSelected = iso === selected;
      const dayClass = ["cal-day", isSelected ? "is-selected" : "", iso === today ? "is-today" : ""]
        .filter(Boolean)
        .join(" ");
      cells.push(
        `<div class="cal-cell"><button type="button" class="${dayClass}" data-date="${iso}" ${disabled ? "disabled" : ""} aria-label="${iso}" aria-pressed="${isSelected}">${day}</button></div>`,
      );
    }
    grid.innerHTML = WEEKDAYS.map((day) => `<span class="cal-weekday">${day}</span>`).join("") + cells.join("");
  }

  function refresh() {
    if (input.value) viewMonth = monthStart(parseDate(input.value) || new Date());
    render();
  }

  refresh();
  return { refresh };
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

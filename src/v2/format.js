const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const TICKET_LABELS = {
  single: "Single",
  return: "Return",
  open: "Open return",
  season: "Season",
};

const LENGTH_LABELS = {
  flexi: "Flexi",
  weekly: "Weekly",
  monthly: "Monthly",
  annual: "Annual",
  custom: "Custom",
};

export function prettyWeekday(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return WEEKDAY.format(date);
}

export function ticketLabel(type) {
  return TICKET_LABELS[type] || type;
}

export function lengthLabels(codes) {
  return codes.map((code) => LENGTH_LABELS[code] || code).join(", ");
}

export function travellersLabel(state) {
  if (state.ticketType === "season") {
    const base = state.seasonPassenger === "child" ? "1 child" : "1 adult";
    return state.seasonRailcard ? `${base} · 16-17 Saver` : base;
  }
  const parts = [];
  if (state.adults) parts.push(`${state.adults} ${state.adults === 1 ? "adult" : "adults"}`);
  if (state.children) parts.push(`${state.children} ${state.children === 1 ? "child" : "children"}`);
  if (state.railcards.length) parts.push(`${state.railcards.length} railcard${state.railcards.length === 1 ? "" : "s"}`);
  return parts.join(", ") || "Add travellers";
}

export function modeLabel(mode) {
  return mode === "Arrive" ? "Arrive by" : "Leave at";
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function prettyDay(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return WEEKDAY.format(date);
}

export function ticketLabel(type) {
  return { single: "Single", return: "Return", open: "Open return", season: "Season" }[type] || type;
}

export function stripSummary(state) {
  const route =
    state.originName && state.destinationName
      ? `${shortName(state.originName)} → ${shortName(state.destinationName)}`
      : "Add stations";
  const when = state.ticketType === "season"
    ? prettyDay(state.seasonStart) || "Add start"
    : state.outwardDate
      ? `${prettyDay(state.outwardDate)} · ${state.outwardTime}`
      : "Add time";
  return {
    main: `${ticketLabel(state.ticketType)} · ${route}`,
    meta: when,
  };
}

function shortName(name) {
  return name.length > 16 ? `${name.slice(0, 14)}…` : name;
}

export function travellersLine(state) {
  if (state.ticketType === "season") {
    return state.seasonPassenger === "child" ? "1 child" : state.seasonRailcard ? "1 adult · 16-17 Saver" : "1 adult";
  }
  const bits = [];
  if (state.adults) bits.push(`${state.adults} adult${state.adults === 1 ? "" : "s"}`);
  if (state.children) bits.push(`${state.children} child${state.children === 1 ? "" : "ren"}`);
  if (state.railcards.length) bits.push(`${state.railcards.length} railcard${state.railcards.length === 1 ? "" : "s"}`);
  return bits.join(", ") || "Add travellers";
}

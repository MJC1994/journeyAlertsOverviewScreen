import { escapeHtml, formatPence } from "./format.js";

export function collectSeasonTickets(data, { durations } = {}) {
  const raw = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
  const links = data?.links && typeof data.links === "object" ? data.links : {};
  const selected = new Set(durations ?? ["flexi", "weekly", "monthly", "annual"]);
  const items = [];

  for (const entry of raw) {
    const fare = resolve(entry, links) || (typeof entry === "object" ? entry : null);
    if (!fare) continue;
    const ticket = resolve(fare.ticketType, links) ?? fare.ticketType ?? {};
    const route = resolve(fare.route, links) ?? fare.route ?? {};
    const firstTicket = fare.tickets?.[0] ?? {};
    const isFirstClass = Boolean(firstTicket.isFirstClass || ticket.isFirstClass || fare.isFirstClass);
    const name = ticket.name || fare.name || fare.description || fare.category || "Season ticket";
    items.push({
      name,
      fareClass: isFirstClass ? "First" : "Standard",
      route: typeof route === "string" ? route : route.name || "",
      duration: durationLabel(name, fare),
      totalPrice: fare.totalPrice ?? fare.price ?? ticket.price ?? null,
    });
  }

  const unique = new Map();
  for (const item of items) {
    const key = `${item.fareClass}|${item.name}|${item.route}|${item.totalPrice}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  const list = [...unique.values()]
    .filter((item) => selected.has(durationKey(item.duration)))
    .sort(compareSeason);
  return {
    Standard: list.filter((item) => item.fareClass === "Standard"),
    First: list.filter((item) => item.fareClass === "First"),
  };
}

export function countSeasonTickets(board) {
  return board.Standard.length + board.First.length;
}

export function renderSeasonBoard(board) {
  return `<div class="fare-board">
    <section class="fare-section">
      <h3>Season tickets</h3>
      <div class="fare-grid">
        ${renderColumn("Standard", board.Standard)}
        ${renderColumn("First class", board.First)}
      </div>
    </section>
  </div>`;
}

function renderColumn(title, fares) {
  const body = fares.length
    ? `<ul class="fare-list">${fares.map(renderRow).join("")}</ul>`
    : `<p class="fare-empty">None for this search.</p>`;
  return `<section class="fare-column">
    <h4>${escapeHtml(title)}</h4>
    ${body}
  </section>`;
}

function renderRow(fare) {
  const price = typeof fare.totalPrice === "number" ? formatPence(fare.totalPrice) : "";
  return `<li>
    <div class="fare-copy">
      <span class="fare-name">${escapeHtml(fare.name)}</span>
      ${fare.route ? `<span class="fare-route">${escapeHtml(fare.route)}</span>` : ""}
      ${fare.duration ? `<span class="fare-tag">${escapeHtml(fare.duration)}</span>` : ""}
    </div>
    <span class="fare-price">${escapeHtml(price)}</span>
  </li>`;
}

function durationLabel(name, fare) {
  const text = `${name} ${fare.category || ""} ${fare.duration || ""}`.toLowerCase();
  if (text.includes("flexi")) return "Flexi";
  if (text.includes("annual") || text.includes("yearly")) return "Annual";
  if (text.includes("month")) return "Monthly";
  if (text.includes("week")) return "Weekly";
  return fare.duration || "Custom";
}

function durationKey(duration) {
  if (duration === "Flexi") return "flexi";
  if (duration === "Weekly") return "weekly";
  if (duration === "Monthly") return "monthly";
  if (duration === "Annual") return "annual";
  return "custom";
}

function compareSeason(a, b) {
  const order = { Flexi: 0, Weekly: 1, Monthly: 2, Annual: 3, Custom: 4 };
  const duration = (order[a.duration] ?? 8) - (order[b.duration] ?? 8);
  if (duration) return duration;
  return (a.totalPrice ?? Number.POSITIVE_INFINITY) - (b.totalPrice ?? Number.POSITIVE_INFINITY) || a.name.localeCompare(b.name);
}

function resolve(ref, links) {
  if (!ref) return null;
  if (typeof ref === "object") return ref;
  return links[ref] ?? null;
}

import { escapeHtml, formatClock, formatPence } from "./format.js";

const CATEGORY_ORDER = {
  Anytime: 0,
  OffPeak: 1,
  SuperOffPeak: 2,
  Advance: 3,
};

export function collectRouteFares(groups) {
  const byKey = new Map();
  collectFromJourneys(byKey, groups?.outward, "outward");
  collectFromJourneys(byKey, groups?.inbound, "inbound");

  const list = [...byKey.values()].map(sortFareTimes).sort(compareFares);
  return {
    singles: {
      Standard: list.filter((fare) => fare.kind === "single" && fare.fareClass === "Standard"),
      First: list.filter((fare) => fare.kind === "single" && fare.fareClass === "First"),
    },
    returns: {
      Standard: list.filter((fare) => fare.kind === "return" && fare.fareClass === "Standard"),
      First: list.filter((fare) => fare.kind === "return" && fare.fareClass === "First"),
    },
  };
}

export function countFares(board) {
  return (
    board.singles.Standard.length +
    board.singles.First.length +
    board.returns.Standard.length +
    board.returns.First.length
  );
}

export function renderFareBoard(board) {
  return `<div class="fare-board">
    ${renderFareSection("Single", board.singles)}
    ${renderFareSection("Return", board.returns)}
  </div>`;
}

function renderFareSection(title, columns) {
  return `<section class="fare-section">
    <h3>${escapeHtml(title)}</h3>
    <div class="fare-grid">
      ${renderFareColumn("Standard", columns.Standard)}
      ${renderFareColumn("First class", columns.First)}
    </div>
  </section>`;
}

function renderFareColumn(title, fares) {
  const body = fares.length
    ? `<ul class="fare-list">${fares.map(renderFareRow).join("")}</ul>`
    : `<p class="fare-empty">None for this search.</p>`;
  return `<section class="fare-column">
    <h4>${escapeHtml(title)}</h4>
    ${body}
  </section>`;
}

function renderFareRow(fare) {
  const price = priceLabel(fare);
  return `<li>
    <div class="fare-copy">
      <span class="fare-name">${escapeHtml(fare.name)}</span>
      ${fare.route ? `<span class="fare-route">${escapeHtml(fare.route)}</span>` : ""}
      ${showCategory(fare) ? `<span class="fare-tag">${escapeHtml(categoryLabel(fare.category))}</span>` : ""}
    </div>
    <span class="fare-price">${escapeHtml(price)}</span>
    ${renderAvailability(fare)}
  </li>`;
}

function collectFromJourneys(byKey, journeys, direction) {
  for (const journey of journeys ?? []) {
    for (const fare of journey?.journeySequence?.fares ?? []) {
      const kind = fare.kind === "return" ? "return" : "single";
      const fareClass = fare.isFirstClass ? "First" : "Standard";
      const name = fare.description || "Ticket";
      const route = fare.route || "";
      const key = `${kind}|${fareClass}|${name}|${route}`;
      const price = typeof fare.totalPrice === "number" ? fare.totalPrice : null;
      let existing = byKey.get(key);
      if (!existing) {
        existing = {
          kind,
          fareClass,
          name,
          route,
          category: fare.category || "",
          minPrice: price,
          maxPrice: price,
          times: { outward: [], inbound: [] },
        };
        byKey.set(key, existing);
      } else if (price != null) {
        existing.minPrice = existing.minPrice == null ? price : Math.min(existing.minPrice, price);
        existing.maxPrice = existing.maxPrice == null ? price : Math.max(existing.maxPrice, price);
      }
      addFareTime(existing, direction, journey?.scheduledTime?.departure);
    }
  }
}

function addFareTime(fare, direction, stamp) {
  const clock = formatClock(stamp);
  if (!clock) return;
  const day = String(stamp).slice(0, 10);
  const times = fare.times[direction];
  if (times.some((time) => time.clock === clock && time.day === day)) return;
  times.push({ clock, day, stamp });
}

function sortFareTimes(fare) {
  fare.times.outward.sort(compareTimes);
  fare.times.inbound.sort(compareTimes);
  return fare;
}

function compareTimes(a, b) {
  return String(a.stamp).localeCompare(String(b.stamp));
}

function renderAvailability(fare) {
  const outward = fare.times?.outward ?? [];
  const inbound = fare.times?.inbound ?? [];
  if (!outward.length && !inbound.length) return "";

  if (outward.length && inbound.length) {
    return `<p class="fare-times">
      <span class="fare-times-label">Available on the</span>
      ${timeChips(outward)}
      <span class="fare-times-dir">outward</span>
      <span class="fare-times-sep" aria-hidden="true">·</span>
      ${timeChips(inbound)}
      <span class="fare-times-dir">return</span>
    </p>`;
  }

  return `<p class="fare-times">
    <span class="fare-times-label">Available on the</span>
    ${timeChips(outward.length ? outward : inbound)}
  </p>`;
}

function timeChips(times) {
  const showDates = new Set(times.map((time) => time.day)).size > 1;
  return times
    .map((time) => {
      const label = showDates ? `${shortDate(time.day)} ${time.clock}` : time.clock;
      return `<span class="fare-time">${escapeHtml(label)}</span>`;
    })
    .join("");
}

function shortDate(day) {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function priceLabel(fare) {
  if (fare.minPrice == null) return "";
  const min = formatPence(fare.minPrice);
  if (fare.maxPrice != null && fare.maxPrice !== fare.minPrice) return `from ${min}`;
  return min;
}

function categoryLabel(value) {
  if (!value) return "";
  if (value === "OffPeak") return "Off-Peak";
  if (value === "SuperOffPeak") return "Super Off-Peak";
  return value;
}

function showCategory(fare) {
  const category = categoryLabel(fare.category).toLowerCase();
  if (!category) return false;
  return !fare.name.toLowerCase().includes(category);
}

function compareFares(a, b) {
  const category = (CATEGORY_ORDER[a.category] ?? 8) - (CATEGORY_ORDER[b.category] ?? 8);
  if (category) return category;
  const price = (a.minPrice ?? Number.POSITIVE_INFINITY) - (b.minPrice ?? Number.POSITIVE_INFINITY);
  if (price) return price;
  return a.name.localeCompare(b.name) || a.route.localeCompare(b.route);
}

import { isSeason, needsReturn } from "./state.js";
import { lengthLabels, modeLabel, prettyWeekday, ticketLabel, travellersLabel } from "./format.js";

function chip({ id, label, value, panel, placeholder = false }) {
  const empty = placeholder || !value;
  return `<button type="button" class="itin-chip${empty ? " is-empty" : ""}" data-panel="${panel}" aria-label="Edit ${label}: ${value || "not set"}">
    <span class="itin-chip-label">${label}</span>
    <span class="itin-chip-value">${value || "Add"}</span>
  </button>`;
}

export function renderItinerary(state) {
  const route = state.originName && state.destinationName
    ? `${state.originName} → ${state.destinationName}`
    : "";

  let whenValue = "";
  if (isSeason(state)) {
    whenValue = state.seasonStart ? `From ${prettyWeekday(state.seasonStart)}` : "";
    if (state.seasonLengths.includes("custom") && state.seasonUntil) {
      whenValue += ` · until ${prettyWeekday(state.seasonUntil)}`;
    }
  } else if (state.outwardDate && state.outwardTime) {
    whenValue = `${prettyWeekday(state.outwardDate)} · ${modeLabel(state.outwardMode)} ${state.outwardTime}`;
    if (state.ticketType === "open") {
      whenValue += " · Open return";
    } else if (needsReturn(state) && state.returnDate && state.returnTime) {
      whenValue += ` · back ${prettyWeekday(state.returnDate)} ${state.returnTime}`;
    }
  }

  const chips = [
    chip({ label: "Ticket", value: ticketLabel(state.ticketType), panel: "ticket" }),
    chip({ label: "Route", value: route, panel: "route", placeholder: !route }),
    chip({
      label: isSeason(state) ? "Starts" : "When",
      value: whenValue,
      panel: "when",
      placeholder: !whenValue,
    }),
    chip({
      label: isSeason(state) ? "Passenger" : "Travellers",
      value: travellersLabel(state),
      panel: "travellers",
    }),
  ];

  if (isSeason(state)) {
    chips.push(
      chip({
        label: "Length",
        value: lengthLabels(state.seasonLengths),
        panel: "season-length",
        placeholder: !state.seasonLengths.length,
      }),
    );
  }

  const extras = [];
  if (state.viaName) extras.push(`Via ${state.viaName}`);
  if (state.avoidName) extras.push(`Avoid ${state.avoidName}`);
  if (state.discountApplied) extras.push(`Code ${state.discountCode}`);
  if (!isSeason(state) && (state.outwardMode === "Arrive" || state.returnMode === "Arrive")) {
    extras.push("Arrive-by times");
  }

  return `
    <div class="itin-chips" role="list">${chips.map((html) => `<div role="listitem">${html}</div>`).join("")}</div>
    ${
      extras.length
        ? `<ul class="itin-extras">${extras.map((item) => `<li>${item}</li>`).join("")}</ul>`
        : ""
    }
    <button type="button" class="itin-more" data-panel="more">More options</button>
  `;
}

export function attachItinerary(root, store, { onSearch }) {
  const body = root.querySelector("#itinerary-body");
  const hint = root.querySelector("#itinerary-hint");
  const searchBtn = root.querySelector("#search-btn");
  const toggle = root.querySelector("#itinerary-toggle");
  const card = root.querySelector("#itinerary-card");

  function paint(state) {
    body.innerHTML = renderItinerary(state);
    hint.textContent = state.activePanel
      ? `Editing: ${panelTitle(state.activePanel, state)}`
      : "";
    card.classList.toggle("is-expanded", state.itineraryExpanded);
    toggle.setAttribute("aria-expanded", String(state.itineraryExpanded));
    toggle.hidden = false;
  }

  body.addEventListener("click", (event) => {
    const target = event.target.closest("[data-panel]");
    if (!target) return;
    store.set({ activePanel: target.dataset.panel, itineraryExpanded: true });
    document.getElementById("question-panel")?.focus();
  });

  toggle.addEventListener("click", () => {
    const state = store.get();
    store.set({ itineraryExpanded: !state.itineraryExpanded });
  });

  searchBtn.addEventListener("click", () => onSearch());

  store.subscribe(paint);
  paint(store.get());
}

function panelTitle(id, state) {
  const map = {
    ticket: "Ticket type",
    route: "Route",
    when: isSeason(state) ? "Season dates" : "Travel times",
    travellers: isSeason(state) ? "Passenger" : "Travellers",
    "season-length": "Season length",
    more: "More options",
  };
  return map[id] || id;
}

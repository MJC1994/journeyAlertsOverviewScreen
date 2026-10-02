import { attachStationPicker } from "../station-picker.js";
import { PASSENGER_LIMITS, RAILCARDS, SEASON_RAILCARD } from "../config.js";
import { isSeason, needsReturn } from "./state.js";
import { modeLabel } from "./format.js";

const LENGTHS = [
  { id: "flexi", label: "Flexi season", hint: "8 days in 28" },
  { id: "weekly", label: "Weekly", hint: "7 consecutive days" },
  { id: "monthly", label: "Monthly", hint: "Calendar month" },
  { id: "annual", label: "Annual", hint: "12 months" },
  { id: "custom", label: "Custom", hint: "Pick an until date" },
];

export function renderQuestion(state) {
  switch (state.activePanel) {
    case "ticket":
      return ticketPanel(state);
    case "route":
      return routePanel(state);
    case "when":
      return whenPanel(state);
    case "travellers":
      return travellersPanel(state);
    case "season-length":
      return seasonLengthPanel(state);
    case "more":
      return morePanel(state);
    default:
      return ticketPanel(state);
  }
}

function heading(title, lead) {
  return `<header class="q-head">
    <h2 id="question-heading">${title}</h2>
    <p class="q-lead">${lead}</p>
  </header>`;
}

function ticketPanel(state) {
  const options = [
    { id: "single", title: "Single", sub: "One way, one date" },
    { id: "return", title: "Return", sub: "Out and back with set times" },
    { id: "open", title: "Open return", sub: "Flexible return within validity" },
    { id: "season", title: "Season", sub: "Unlimited travel for a period" },
  ];
  return `
    ${heading("What kind of ticket?", "Pick a type. You can change it any time from the itinerary.")}
    <div class="choice-grid" role="radiogroup" aria-labelledby="question-heading">
      ${options
        .map(
          (opt) => `<button type="button" class="choice-card" role="radio" data-ticket="${opt.id}" aria-checked="${state.ticketType === opt.id}">
            <span class="choice-title">${opt.title}</span>
            <span class="choice-sub">${opt.sub}</span>
          </button>`,
        )
        .join("")}
    </div>
    <div class="q-actions">
      <button type="button" class="q-next" data-next="route">Continue to route</button>
    </div>
  `;
}

function routePanel(state) {
  return `
    ${heading("Where are you travelling?", "Search stations by name. Swap ends with one tap.")}
    <div class="route-fields">
      <label class="field">
        <span class="field-label">From</span>
        <input id="v2-origin" type="text" autocomplete="off" value="${escapeAttr(state.originName)}" aria-autocomplete="list" />
        <input id="v2-origin-nlc" type="hidden" value="${escapeAttr(state.originNlc)}" />
      </label>
      <button type="button" class="route-swap" id="v2-swap" aria-label="Swap origin and destination">⇄</button>
      <label class="field">
        <span class="field-label">To</span>
        <input id="v2-destination" type="text" autocomplete="off" value="${escapeAttr(state.destinationName)}" aria-autocomplete="list" />
        <input id="v2-destination-nlc" type="hidden" value="${escapeAttr(state.destinationNlc)}" />
      </label>
    </div>
    <div class="q-actions">
      <button type="button" class="q-next" data-next="when">Continue to when</button>
    </div>
  `;
}

function whenPanel(state) {
  if (isSeason(state)) {
    return `
      ${heading("When should it start?", "Season tickets begin on your chosen date.")}
      <div class="field-row">
        <label class="field">
          <span class="field-label">Starting</span>
          <input id="v2-season-start" type="date" value="${escapeAttr(state.seasonStart)}" />
        </label>
        ${
          state.seasonLengths.includes("custom")
            ? `<label class="field">
                <span class="field-label">Until</span>
                <input id="v2-season-until" type="date" value="${escapeAttr(state.seasonUntil)}" min="${escapeAttr(state.seasonStart)}" />
              </label>`
            : ""
        }
      </div>
      <div class="q-actions">
        <button type="button" class="q-next" data-next="travellers">Continue to passenger</button>
      </div>
    `;
  }

  return `
    ${heading("When do you want to travel?", "Set outbound times. Return appears when your ticket needs it.")}
    <fieldset class="time-fieldset">
      <legend>Outbound</legend>
      <div class="field-row">
        <label class="field">
          <span class="field-label">Date</span>
          <input id="v2-out-date" type="date" value="${escapeAttr(state.outwardDate)}" />
        </label>
        <label class="field">
          <span class="field-label">Time</span>
          <input id="v2-out-time" type="time" step="900" value="${escapeAttr(state.outwardTime)}" />
        </label>
        <label class="field">
          <span class="field-label">Mode</span>
          <select id="v2-out-mode">
            <option value="Depart" ${state.outwardMode === "Depart" ? "selected" : ""}>${modeLabel("Depart")}</option>
            <option value="Arrive" ${state.outwardMode === "Arrive" ? "selected" : ""}>${modeLabel("Arrive")}</option>
          </select>
        </label>
      </div>
    </fieldset>
    ${
      state.ticketType === "open"
        ? `<p class="q-note">Open return: come back any time within the ticket’s validity. No fixed return time.</p>`
        : ""
    }
    ${
      needsReturn(state) && state.ticketType === "return"
        ? `<fieldset class="time-fieldset">
            <legend>Return</legend>
            <div class="field-row">
              <label class="field">
                <span class="field-label">Date</span>
                <input id="v2-ret-date" type="date" value="${escapeAttr(state.returnDate)}" min="${escapeAttr(state.outwardDate)}" />
              </label>
              <label class="field">
                <span class="field-label">Time</span>
                <input id="v2-ret-time" type="time" step="900" value="${escapeAttr(state.returnTime)}" />
              </label>
              <label class="field">
                <span class="field-label">Mode</span>
                <select id="v2-ret-mode">
                  <option value="Depart" ${state.returnMode === "Depart" ? "selected" : ""}>${modeLabel("Depart")}</option>
                  <option value="Arrive" ${state.returnMode === "Arrive" ? "selected" : ""}>${modeLabel("Arrive")}</option>
                </select>
              </label>
            </div>
          </fieldset>`
        : ""
    }
    <div class="q-actions">
      <button type="button" class="q-next" data-next="travellers">Continue to travellers</button>
    </div>
  `;
}

function travellersPanel(state) {
  if (isSeason(state)) {
    return `
      ${heading("Who is travelling?", "Season tickets are for one person.")}
      <div class="choice-grid choice-grid-2" role="radiogroup" aria-labelledby="question-heading">
        <button type="button" class="choice-card" role="radio" data-season-passenger="adult" aria-checked="${state.seasonPassenger === "adult"}">
          <span class="choice-title">Adult</span>
          <span class="choice-sub">16 or over</span>
        </button>
        <button type="button" class="choice-card" role="radio" data-season-passenger="child" aria-checked="${state.seasonPassenger === "child"}">
          <span class="choice-title">Child</span>
          <span class="choice-sub">5 to 15</span>
        </button>
      </div>
      ${
        state.seasonPassenger === "adult"
          ? `<label class="check-row">
              <input type="checkbox" id="v2-season-railcard" ${state.seasonRailcard ? "checked" : ""} />
              <span>Add ${SEASON_RAILCARD.name}</span>
            </label>`
          : ""
      }
      <div class="q-actions">
        <button type="button" class="q-next" data-next="season-length">Continue to length</button>
      </div>
    `;
  }

  return `
    ${heading("Who is travelling?", "Adjust counts, then add railcards if you have them.")}
    <div class="stepper-list">
      ${stepper("Adults", "adults", state.adults, PASSENGER_LIMITS.maxAdults)}
      ${stepper("Children", "children", state.children, PASSENGER_LIMITS.maxChildren)}
    </div>
    <div class="railcard-block">
      <p class="field-label">Railcards</p>
      <ul class="railcard-list" id="v2-railcards">
        ${state.railcards
          .map((code, index) => {
            const name = RAILCARDS.find((card) => card.code === code)?.name || code;
            return `<li>
              <span>${name}</span>
              <button type="button" data-remove-railcard="${index}" aria-label="Remove ${name}">Remove</button>
            </li>`;
          })
          .join("")}
      </ul>
      <label class="field">
        <span class="visually-hidden">Add railcard</span>
        <select id="v2-add-railcard">
          <option value="">Add a railcard</option>
          ${RAILCARDS.map((card) => `<option value="${card.code}">${card.name}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="q-actions">
      <button type="button" class="q-next" data-next="more">More options</button>
    </div>
  `;
}

function stepper(label, key, value, max) {
  return `<div class="stepper-row">
    <span class="stepper-label">${label}</span>
    <div class="stepper">
      <button type="button" data-step="${key}" data-delta="-1" aria-label="Fewer ${label.toLowerCase()}" ${value <= 0 ? "disabled" : ""}>−</button>
      <span aria-live="polite">${value}</span>
      <button type="button" data-step="${key}" data-delta="1" aria-label="More ${label.toLowerCase()}" ${value >= max ? "disabled" : ""}>+</button>
    </div>
  </div>`;
}

function seasonLengthPanel(state) {
  return `
    ${heading("How long do you need?", "Select every length you want to compare.")}
    <div class="length-list" role="group" aria-labelledby="question-heading">
      ${LENGTHS.map(
        (item) => `<label class="length-option">
          <input type="checkbox" data-length="${item.id}" ${state.seasonLengths.includes(item.id) ? "checked" : ""} />
          <span>
            <span class="choice-title">${item.label}</span>
            <span class="choice-sub">${item.hint}</span>
          </span>
        </label>`,
      ).join("")}
    </div>
    <div class="q-actions">
      <button type="button" class="q-next" data-next="more">More options</button>
    </div>
  `;
}

function morePanel(state) {
  return `
    ${heading("Fine-tune the search", "Optional. Skip these if you do not need them.")}
    ${
      isSeason(state)
        ? `<p class="q-note">Season searches use your route, start date, passenger, and lengths from the itinerary.</p>`
        : `<div class="field-row">
            <label class="field">
              <span class="field-label">Via station</span>
              <input id="v2-via" type="text" autocomplete="off" value="${escapeAttr(state.viaName)}" />
              <input id="v2-via-nlc" type="hidden" value="${escapeAttr(state.viaNlc)}" />
            </label>
            <label class="field">
              <span class="field-label">Avoid station</span>
              <input id="v2-avoid" type="text" autocomplete="off" value="${escapeAttr(state.avoidName)}" />
              <input id="v2-avoid-nlc" type="hidden" value="${escapeAttr(state.avoidNlc)}" />
            </label>
          </div>
          <label class="field">
            <span class="field-label">Discount code</span>
            <div class="discount-row">
              <input id="v2-discount" type="text" value="${escapeAttr(state.discountCode)}" autocomplete="off" />
              <button type="button" id="v2-apply-discount">${state.discountApplied ? "Applied" : "Apply"}</button>
            </div>
          </label>`
    }
    <div class="q-actions">
      <button type="button" class="q-next" data-next="ticket">Back to ticket type</button>
    </div>
  `;
}

export function hydrateQuestion(root, store) {
  const state = store.get();
  root.querySelectorAll(".station-suggestions").forEach((el) => el.remove());
  root.innerHTML = renderQuestion(state);

  root.querySelectorAll("[data-ticket]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ticketType = btn.dataset.ticket;
      const patch = { ticketType };
      if (ticketType === "season" && state.activePanel === "ticket") {
        patch.activePanel = "route";
      }
      store.set(patch);
    });
  });

  root.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => store.set({ activePanel: btn.dataset.next }));
  });

  const origin = root.querySelector("#v2-origin");
  const originNlc = root.querySelector("#v2-origin-nlc");
  const destination = root.querySelector("#v2-destination");
  const destinationNlc = root.querySelector("#v2-destination-nlc");
  if (origin && destination) {
    attachStationPicker(origin, originNlc);
    attachStationPicker(destination, destinationNlc, { stadiums: true });
    const syncRoute = () =>
      store.set({
        originName: origin.value,
        originNlc: originNlc.value,
        destinationName: destination.value,
        destinationNlc: destinationNlc.value,
      });
    origin.addEventListener("change", syncRoute);
    destination.addEventListener("change", syncRoute);
    root.querySelector("#v2-swap")?.addEventListener("click", () => {
      store.set({
        originName: destination.value,
        originNlc: destinationNlc.value,
        destinationName: origin.value,
        destinationNlc: originNlc.value,
      });
    });
  }

  bindValue(root, "#v2-out-date", "outwardDate", store);
  bindValue(root, "#v2-out-time", "outwardTime", store);
  bindValue(root, "#v2-out-mode", "outwardMode", store);
  bindValue(root, "#v2-ret-date", "returnDate", store);
  bindValue(root, "#v2-ret-time", "returnTime", store);
  bindValue(root, "#v2-ret-mode", "returnMode", store);
  bindValue(root, "#v2-season-start", "seasonStart", store);
  bindValue(root, "#v2-season-until", "seasonUntil", store);

  root.querySelectorAll("[data-season-passenger]").forEach((btn) => {
    btn.addEventListener("click", () => {
      store.set({
        seasonPassenger: btn.dataset.seasonPassenger,
        seasonRailcard: btn.dataset.seasonPassenger === "child" ? false : store.get().seasonRailcard,
      });
    });
  });
  root.querySelector("#v2-season-railcard")?.addEventListener("change", (event) => {
    store.set({ seasonRailcard: event.target.checked });
  });

  root.querySelectorAll("[data-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.step;
      const delta = Number(btn.dataset.delta);
      const current = store.get();
      const next = Math.max(0, current[key] + delta);
      const total = key === "adults" ? next + current.children : current.adults + next;
      if (total > PASSENGER_LIMITS.maxTotal) return;
      store.set({ [key]: next });
    });
  });

  root.querySelector("#v2-add-railcard")?.addEventListener("change", (event) => {
    const code = event.target.value;
    if (!code) return;
    const railcards = [...store.get().railcards, code];
    store.set({ railcards });
  });
  root.querySelectorAll("[data-remove-railcard]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.removeRailcard);
      const railcards = store.get().railcards.filter((_, i) => i !== index);
      store.set({ railcards });
    });
  });

  root.querySelectorAll("[data-length]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.length;
      const current = new Set(store.get().seasonLengths);
      if (input.checked) current.add(id);
      else current.delete(id);
      store.set({ seasonLengths: [...current] });
    });
  });

  const via = root.querySelector("#v2-via");
  const viaNlc = root.querySelector("#v2-via-nlc");
  const avoid = root.querySelector("#v2-avoid");
  const avoidNlc = root.querySelector("#v2-avoid-nlc");
  if (via && avoid) {
    attachStationPicker(via, viaNlc);
    attachStationPicker(avoid, avoidNlc);
    const sync = () =>
      store.set({
        viaName: via.value,
        viaNlc: viaNlc.value,
        avoidName: avoid.value,
        avoidNlc: avoidNlc.value,
      });
    via.addEventListener("change", sync);
    avoid.addEventListener("change", sync);
  }

  let discountAttempts = 0;
  root.querySelector("#v2-apply-discount")?.addEventListener("click", () => {
    const code = root.querySelector("#v2-discount")?.value.trim() || "";
    discountAttempts += 1;
    store.set({
      discountCode: code,
      discountApplied: Boolean(code) && discountAttempts >= 2,
    });
  });
  root.querySelector("#v2-discount")?.addEventListener("change", (event) => {
    store.set({ discountCode: event.target.value, discountApplied: false });
    discountAttempts = 0;
  });
}

function bindValue(root, selector, key, store) {
  const el = root.querySelector(selector);
  if (!el) return;
  el.addEventListener("change", () => store.set({ [key]: el.value }));
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

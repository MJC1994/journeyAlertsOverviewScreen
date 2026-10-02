import { attachStationPicker } from "../station-picker.js";
import { PASSENGER_LIMITS, RAILCARDS, SEASON_RAILCARD } from "../config.js";
import { isSeason, needsReturn, stepMeta } from "./state.js";
import { prettyDay, ticketLabel, travellersLine } from "./format.js";

const LENGTHS = [
  { id: "flexi", label: "Flexi", hint: "8 in 28 days" },
  { id: "weekly", label: "Weekly", hint: "7 days" },
  { id: "monthly", label: "Monthly", hint: "1 month" },
  { id: "annual", label: "Annual", hint: "12 months" },
  { id: "custom", label: "Custom", hint: "Pick until" },
];

export function renderStep(state) {
  const meta = stepMeta(state.step);
  switch (state.step) {
    case "ticket":
      return wrap(meta, ticketStep(state));
    case "route":
      return wrap(meta, routeStep(state));
    case "when":
      return wrap(meta, whenStep(state));
    case "travellers":
      return wrap(meta, travellersStep(state));
    case "length":
      return wrap(meta, lengthStep(state));
    case "extras":
      return wrap(meta, extrasStep(state));
    default:
      return wrap(meta, ticketStep(state));
  }
}

function wrap(meta, body) {
  return `<header class="step-head">
    <p class="step-kicker">${meta.label}</p>
    <h1 id="step-title">${meta.title}</h1>
  </header>${body}`;
}

function ticketStep(state) {
  const options = [
    { id: "single", title: "Single", sub: "One way" },
    { id: "return", title: "Return", sub: "Out and back" },
    { id: "open", title: "Open return", sub: "Flexible back" },
    { id: "season", title: "Season", sub: "Unlimited travel" },
  ];
  return `<div class="stack-choices" role="radiogroup" aria-labelledby="step-title">
    ${options
      .map(
        (opt) => `<button type="button" class="stack-choice" role="radio" data-ticket="${opt.id}" aria-checked="${state.ticketType === opt.id}">
        <span class="stack-choice-title">${opt.title}</span>
        <span class="stack-choice-sub">${opt.sub}</span>
      </button>`,
      )
      .join("")}
  </div>`;
}

function routeStep(state) {
  return `<div class="stack-fields">
    <label class="stack-field">
      <span>From</span>
      <input id="v3-origin" type="text" autocomplete="off" inputmode="search" value="${esc(state.originName)}" placeholder="Station or city" />
      <input id="v3-origin-nlc" type="hidden" value="${esc(state.originNlc)}" />
    </label>
    <button type="button" class="stack-swap" id="v3-swap" aria-label="Swap stations">Swap</button>
    <label class="stack-field">
      <span>To</span>
      <input id="v3-destination" type="text" autocomplete="off" inputmode="search" value="${esc(state.destinationName)}" placeholder="Station or city" />
      <input id="v3-destination-nlc" type="hidden" value="${esc(state.destinationNlc)}" />
    </label>
  </div>`;
}

function whenStep(state) {
  if (isSeason(state)) {
    return `<div class="stack-fields">
      <label class="stack-field">
        <span>Starts</span>
        <input id="v3-season-start" type="date" value="${esc(state.seasonStart)}" />
      </label>
      ${
        state.seasonLengths.includes("custom")
          ? `<label class="stack-field">
              <span>Until</span>
              <input id="v3-season-until" type="date" value="${esc(state.seasonUntil)}" min="${esc(state.seasonStart)}" />
            </label>`
          : `<p class="stack-hint">Custom length unlocks an until date on the next screens.</p>`
      }
    </div>`;
  }

  return `<div class="stack-fields">
    <fieldset class="stack-set">
      <legend>Outbound</legend>
      <label class="stack-field">
        <span>Date</span>
        <input id="v3-out-date" type="date" value="${esc(state.outwardDate)}" />
      </label>
      <label class="stack-field">
        <span>Time</span>
        <input id="v3-out-time" type="time" step="900" value="${esc(state.outwardTime)}" />
      </label>
      <label class="stack-field">
        <span>Mode</span>
        <select id="v3-out-mode">
          <option value="Depart" ${state.outwardMode === "Depart" ? "selected" : ""}>Leave at</option>
          <option value="Arrive" ${state.outwardMode === "Arrive" ? "selected" : ""}>Arrive by</option>
        </select>
      </label>
    </fieldset>
    ${
      state.ticketType === "open"
        ? `<p class="stack-hint">Open return — no fixed return time. Come back within the ticket validity.</p>`
        : ""
    }
    ${
      needsReturn(state)
        ? `<fieldset class="stack-set">
            <legend>Return</legend>
            <label class="stack-field">
              <span>Date</span>
              <input id="v3-ret-date" type="date" value="${esc(state.returnDate)}" min="${esc(state.outwardDate)}" />
            </label>
            <label class="stack-field">
              <span>Time</span>
              <input id="v3-ret-time" type="time" step="900" value="${esc(state.returnTime)}" />
            </label>
            <label class="stack-field">
              <span>Mode</span>
              <select id="v3-ret-mode">
                <option value="Depart" ${state.returnMode === "Depart" ? "selected" : ""}>Leave at</option>
                <option value="Arrive" ${state.returnMode === "Arrive" ? "selected" : ""}>Arrive by</option>
              </select>
            </label>
          </fieldset>`
        : ""
    }
  </div>`;
}

function travellersStep(state) {
  if (isSeason(state)) {
    return `<div class="stack-choices" role="radiogroup" aria-labelledby="step-title">
      <button type="button" class="stack-choice" role="radio" data-season-passenger="adult" aria-checked="${state.seasonPassenger === "adult"}">
        <span class="stack-choice-title">Adult</span>
        <span class="stack-choice-sub">16+</span>
      </button>
      <button type="button" class="stack-choice" role="radio" data-season-passenger="child" aria-checked="${state.seasonPassenger === "child"}">
        <span class="stack-choice-title">Child</span>
        <span class="stack-choice-sub">5–15</span>
      </button>
    </div>
    ${
      state.seasonPassenger === "adult"
        ? `<label class="stack-check">
            <input type="checkbox" id="v3-season-railcard" ${state.seasonRailcard ? "checked" : ""} />
            <span>${SEASON_RAILCARD.name}</span>
          </label>`
        : ""
    }`;
  }

  return `<div class="stack-fields">
    ${stepper("Adults", "adults", state.adults)}
    ${stepper("Children", "children", state.children)}
    <div class="rail-block">
      <p class="rail-label">Railcards</p>
      <ul class="rail-list">
        ${state.railcards
          .map((code, index) => {
            const name = RAILCARDS.find((c) => c.code === code)?.name || code;
            return `<li><span>${name}</span><button type="button" data-remove-rail="${index}" aria-label="Remove ${name}">Remove</button></li>`;
          })
          .join("")}
      </ul>
      <label class="stack-field">
        <span class="visually-hidden">Add railcard</span>
        <select id="v3-add-rail">
          <option value="">Add railcard</option>
          ${RAILCARDS.map((c) => `<option value="${c.code}">${c.name}</option>`).join("")}
        </select>
      </label>
    </div>
  </div>`;
}

function stepper(label, key, value) {
  return `<div class="stepper">
    <span>${label}</span>
    <div class="stepper-controls">
      <button type="button" data-step="${key}" data-delta="-1" aria-label="Fewer ${label}" ${value <= 0 ? "disabled" : ""}>−</button>
      <span aria-live="polite">${value}</span>
      <button type="button" data-step="${key}" data-delta="1" aria-label="More ${label}">+</button>
    </div>
  </div>`;
}

function lengthStep(state) {
  return `<div class="stack-choices length-choices" role="group" aria-labelledby="step-title">
    ${LENGTHS.map(
      (item) => `<label class="stack-check-card">
        <input type="checkbox" data-length="${item.id}" ${state.seasonLengths.includes(item.id) ? "checked" : ""} />
        <span>
          <span class="stack-choice-title">${item.label}</span>
          <span class="stack-choice-sub">${item.hint}</span>
        </span>
      </label>`,
    ).join("")}
  </div>`;
}

function extrasStep(state) {
  if (isSeason(state)) {
    return `<p class="stack-hint">You’re set. Open Review anytime, or search from the bar below.</p>
      <ul class="review-mini">
        <li><strong>Ticket</strong> ${ticketLabel(state.ticketType)}</li>
        <li><strong>Route</strong> ${esc(state.originName)} → ${esc(state.destinationName)}</li>
        <li><strong>Starts</strong> ${prettyDay(state.seasonStart)}</li>
        <li><strong>Who</strong> ${travellersLine(state)}</li>
        <li><strong>Length</strong> ${state.seasonLengths.join(", ")}</li>
      </ul>`;
  }
  return `<div class="stack-fields">
    <label class="stack-field">
      <span>Via (optional)</span>
      <input id="v3-via" type="text" autocomplete="off" value="${esc(state.viaName)}" placeholder="Station" />
      <input id="v3-via-nlc" type="hidden" value="${esc(state.viaNlc)}" />
    </label>
    <label class="stack-field">
      <span>Avoid (optional)</span>
      <input id="v3-avoid" type="text" autocomplete="off" value="${esc(state.avoidName)}" placeholder="Station" />
      <input id="v3-avoid-nlc" type="hidden" value="${esc(state.avoidNlc)}" />
    </label>
    <label class="stack-field">
      <span>Discount code</span>
      <div class="discount-row">
        <input id="v3-discount" type="text" value="${esc(state.discountCode)}" autocomplete="off" />
        <button type="button" id="v3-apply-discount">${state.discountApplied ? "Applied" : "Apply"}</button>
      </div>
    </label>
  </div>`;
}

export function renderReview(state) {
  const rows = [
    ["Ticket", ticketLabel(state.ticketType)],
    ["Route", `${state.originName || "—"} → ${state.destinationName || "—"}`],
  ];
  if (isSeason(state)) {
    rows.push(["Starts", prettyDay(state.seasonStart) || "—"]);
    if (state.seasonLengths.includes("custom") && state.seasonUntil) {
      rows.push(["Until", prettyDay(state.seasonUntil)]);
    }
    rows.push(["Passenger", travellersLine(state)]);
    rows.push(["Length", state.seasonLengths.join(", ") || "—"]);
  } else {
    rows.push([
      "Outbound",
      state.outwardDate ? `${prettyDay(state.outwardDate)} · ${state.outwardTime}` : "—",
    ]);
    if (state.ticketType === "open") rows.push(["Return", "Open"]);
    if (needsReturn(state)) {
      rows.push([
        "Return",
        state.returnDate ? `${prettyDay(state.returnDate)} · ${state.returnTime}` : "—",
      ]);
    }
    rows.push(["Travellers", travellersLine(state)]);
    if (state.viaName) rows.push(["Via", state.viaName]);
    if (state.avoidName) rows.push(["Avoid", state.avoidName]);
    if (state.discountApplied) rows.push(["Discount", state.discountCode]);
  }

  return `<ul class="review-list">
    ${rows
      .map(
        ([label, value], index) => `<li>
          <button type="button" class="review-jump" data-jump="${jumpFor(index, state, label)}">
            <span>${label}</span>
            <strong>${esc(value)}</strong>
          </button>
        </li>`,
      )
      .join("")}
  </ul>`;
}

function jumpFor(_index, state, label) {
  const map = {
    Ticket: "ticket",
    Route: "route",
    Starts: "when",
    Until: "when",
    Outbound: "when",
    Return: "when",
    Passenger: "travellers",
    Travellers: "travellers",
    Length: "length",
    Via: "extras",
    Avoid: "extras",
    Discount: "extras",
  };
  return map[label] || "ticket";
}

export function hydrateStep(root, store) {
  root.querySelectorAll(".station-suggestions").forEach((el) => el.remove());
  root.innerHTML = renderStep(store.get());
  const state = store.get();

  root.querySelectorAll("[data-ticket]").forEach((btn) => {
    btn.addEventListener("click", () => store.set({ ticketType: btn.dataset.ticket }));
  });

  const origin = root.querySelector("#v3-origin");
  const originNlc = root.querySelector("#v3-origin-nlc");
  const destination = root.querySelector("#v3-destination");
  const destinationNlc = root.querySelector("#v3-destination-nlc");
  if (origin && destination) {
    attachStationPicker(origin, originNlc);
    attachStationPicker(destination, destinationNlc, { stadiums: true });
    const sync = () =>
      store.set({
        originName: origin.value,
        originNlc: originNlc.value,
        destinationName: destination.value,
        destinationNlc: destinationNlc.value,
      });
    origin.addEventListener("change", sync);
    destination.addEventListener("change", sync);
    root.querySelector("#v3-swap")?.addEventListener("click", () => {
      store.set({
        originName: destination.value,
        originNlc: destinationNlc.value,
        destinationName: origin.value,
        destinationNlc: originNlc.value,
      });
    });
  }

  bind(root, "#v3-out-date", "outwardDate", store);
  bind(root, "#v3-out-time", "outwardTime", store);
  bind(root, "#v3-out-mode", "outwardMode", store);
  bind(root, "#v3-ret-date", "returnDate", store);
  bind(root, "#v3-ret-time", "returnTime", store);
  bind(root, "#v3-ret-mode", "returnMode", store);
  bind(root, "#v3-season-start", "seasonStart", store);
  bind(root, "#v3-season-until", "seasonUntil", store);

  root.querySelectorAll("[data-season-passenger]").forEach((btn) => {
    btn.addEventListener("click", () => {
      store.set({
        seasonPassenger: btn.dataset.seasonPassenger,
        seasonRailcard: btn.dataset.seasonPassenger === "child" ? false : store.get().seasonRailcard,
      });
    });
  });
  root.querySelector("#v3-season-railcard")?.addEventListener("change", (e) => {
    store.set({ seasonRailcard: e.target.checked });
  });

  root.querySelectorAll("[data-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.step;
      const delta = Number(btn.dataset.delta);
      const current = store.get();
      let next = Math.max(0, current[key] + delta);
      const total = key === "adults" ? next + current.children : current.adults + next;
      if (total > PASSENGER_LIMITS.maxTotal) return;
      store.set({ [key]: next });
    });
  });

  root.querySelector("#v3-add-rail")?.addEventListener("change", (e) => {
    const code = e.target.value;
    if (!code) return;
    store.set({ railcards: [...store.get().railcards, code] });
  });
  root.querySelectorAll("[data-remove-rail]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.removeRail);
      store.set({ railcards: store.get().railcards.filter((_, i) => i !== index) });
    });
  });

  root.querySelectorAll("[data-length]").forEach((input) => {
    input.addEventListener("change", () => {
      const set = new Set(store.get().seasonLengths);
      if (input.checked) set.add(input.dataset.length);
      else set.delete(input.dataset.length);
      store.set({ seasonLengths: [...set] });
    });
  });

  const via = root.querySelector("#v3-via");
  const viaNlc = root.querySelector("#v3-via-nlc");
  const avoid = root.querySelector("#v3-avoid");
  const avoidNlc = root.querySelector("#v3-avoid-nlc");
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

  let attempts = 0;
  root.querySelector("#v3-apply-discount")?.addEventListener("click", () => {
    const code = root.querySelector("#v3-discount")?.value.trim() || "";
    attempts += 1;
    store.set({ discountCode: code, discountApplied: Boolean(code) && attempts >= 2 });
  });
}

function bind(root, sel, key, store) {
  const el = root.querySelector(sel);
  if (!el) return;
  el.addEventListener("change", () => store.set({ [key]: el.value }));
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

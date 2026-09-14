import { stationSearch } from "fuzzy-stations";
import { createStore, stepOrder, stepMeta, validationErrors } from "./state.js";
import { stripSummary } from "./format.js";
import { hydrateStep, renderReview } from "./steps.js";

const DEMO = "Live search is disabled in this demo.";

const store = createStore();
const origin = stationSearch.findByCrs("LBG");
const destination = stationSearch.findByCrs("KNG");
store.set({
  originName: origin?.name || "London Bridge",
  originNlc: origin?.nlc || "",
  destinationName: destination?.name || "Kingston",
  destinationNlc: destination?.nlc || "",
});

const stepRoot = document.getElementById("step-root");
const progressDots = document.getElementById("progress-dots");
const progressLabel = document.getElementById("progress-label");
const tripStrip = document.getElementById("trip-strip");
const tripMain = document.getElementById("trip-strip-main");
const tripMeta = document.getElementById("trip-strip-meta");
const dockBack = document.getElementById("dock-back");
const dockPrimary = document.getElementById("dock-primary");
const toast = document.getElementById("toast");
const reviewSheet = document.getElementById("review-sheet");
const reviewBody = document.getElementById("review-body");
const sheetSearch = document.getElementById("sheet-search");

let renderKey = "";

function key(state) {
  return [
    state.step,
    state.ticketType,
    state.seasonLengths.join(","),
    state.seasonPassenger,
    state.seasonRailcard,
    state.adults,
    state.children,
    state.railcards.join(","),
    state.discountApplied,
    state.originName,
    state.destinationName,
  ].join("|");
}

function paintChrome(state) {
  const order = stepOrder(state);
  const index = Math.max(0, order.indexOf(state.step));
  progressDots.innerHTML = order
    .map((id, i) => {
      const current = i === index;
      const done = i < index;
      return `<li>
        <button type="button" class="dot${current ? " is-current" : ""}${done ? " is-done" : ""}" data-goto="${id}" ${current ? 'aria-current="step"' : ""} aria-label="${stepMeta(id).label}${current ? " (current)" : ""}"></button>
      </li>`;
    })
    .join("");
  progressLabel.textContent = `${index + 1} / ${order.length} · ${stepMeta(state.step).label}`;

  const summary = stripSummary(state);
  tripMain.textContent = summary.main;
  tripMeta.textContent = summary.meta;

  dockBack.disabled = index === 0;
  const last = index === order.length - 1;
  dockPrimary.textContent = last ? "Search" : "Continue";
}

function paintStep(state) {
  const nextKey = key(state);
  if (nextKey === renderKey) return;
  renderKey = nextKey;
  hydrateStep(stepRoot, store);
  stepRoot.focus({ preventScroll: true });
}

function go(delta) {
  const state = store.get();
  const order = stepOrder(state);
  const index = order.indexOf(state.step);
  const next = order[index + delta];
  if (!next) return;
  store.set({ step: next });
}

function runSearch() {
  const errors = validationErrors(store.get());
  if (errors.length) {
    setToast(errors[0], true);
    return;
  }
  setToast(DEMO, true);
  if (reviewSheet.open) reviewSheet.close();
}

function setToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", Boolean(isError));
  toast.setAttribute("role", isError ? "alert" : "status");
}

function openReview() {
  const state = store.get();
  reviewBody.innerHTML = renderReview(state);
  reviewSheet.showModal();
  tripStrip.setAttribute("aria-expanded", "true");
}

progressDots.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-goto]");
  if (!btn) return;
  store.set({ step: btn.dataset.goto });
});

dockBack.addEventListener("click", () => go(-1));
dockPrimary.addEventListener("click", () => {
  const state = store.get();
  const order = stepOrder(state);
  if (state.step === order[order.length - 1]) runSearch();
  else go(1);
});

tripStrip.addEventListener("click", () => openReview());
reviewSheet.addEventListener("close", () => tripStrip.setAttribute("aria-expanded", "false"));
sheetSearch.addEventListener("click", () => runSearch());
reviewBody.addEventListener("click", (event) => {
  const jump = event.target.closest("[data-jump]");
  if (!jump) return;
  store.set({ step: jump.dataset.jump });
  reviewSheet.close();
});

store.subscribe((state) => {
  // Keep step valid when ticket type changes
  const order = stepOrder(state);
  if (!order.includes(state.step)) {
    store.set({ step: order[0] });
    return;
  }
  paintChrome(state);
  paintStep(state);
});

paintChrome(store.get());
renderKey = "";
paintStep(store.get());

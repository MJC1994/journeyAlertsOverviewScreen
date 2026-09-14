import { createStore, validationErrors } from "./state.js";
import { attachItinerary } from "./overview.js";
import { hydrateQuestion } from "./panels.js";
import { stationSearch } from "fuzzy-stations";

const DEMO_SEARCH_MESSAGE = "Live search is disabled in this demo.";

const origin = stationSearch.findByCrs("LBG");
const destination = stationSearch.findByCrs("KNG");

const store = createStore();
store.set({
  originName: origin?.name || "London Bridge",
  originNlc: origin?.nlc || "",
  destinationName: destination?.name || "Kingston",
  destinationNlc: destination?.nlc || "",
});

const questionRoot = document.getElementById("question-root");
const statusEl = document.getElementById("status");

attachItinerary(document.querySelector(".v2-itinerary"), store, {
  onSearch() {
    const errors = validationErrors(store.get());
    if (errors.length) {
      setStatus(errors[0], true);
      return;
    }
    setStatus(DEMO_SEARCH_MESSAGE, true);
  },
});

let renderKey = "";
function questionKey(state) {
  return [
    state.activePanel,
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
    state.viaName,
    state.avoidName,
  ].join("|");
}

store.subscribe((state) => {
  const key = questionKey(state);
  if (key === renderKey) return;
  renderKey = key;
  hydrateQuestion(questionRoot, store);
});

renderKey = questionKey(store.get());
hydrateQuestion(questionRoot, store);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", Boolean(isError));
  statusEl.setAttribute("role", isError ? "alert" : "status");
}

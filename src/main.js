import { journeyPlanPayload, planJourneys } from "./api.js";
import { attachStationPicker } from "./station-picker.js";
import { extractJourneys, renderJourneyCard } from "./journey-card.js";
import { collectSeasonTickets, countSeasonTickets, renderSeasonBoard } from "./season-board.js";
import { renderRoverBoard } from "./rover-board.js";
import { attachPassengerControls, railcardNames } from "./passengers.js";
import { attachSearchChrome } from "./search-ui.js";
import { snapToQuarter } from "./when-picker.js";
import { stationSearch } from "fuzzy-stations";

const DEMO_SEARCH_MESSAGE = "Live search is disabled in this demo.";

const form = document.getElementById("journey-form");
const page = document.querySelector(".page");
const originInput = document.getElementById("origin");
const destinationInput = document.getElementById("destination");
const originCrs = document.getElementById("origin-crs");
const destinationCrs = document.getElementById("destination-crs");
const viaInput = document.getElementById("via");
const avoidInput = document.getElementById("avoid");
const viaNlc = document.getElementById("via-nlc");
const avoidNlc = document.getElementById("avoid-nlc");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const returnDateInput = document.getElementById("return-date");
const returnTimeInput = document.getElementById("return-time");
const outwardModeInput = document.getElementById("outward-mode");
const returnModeInput = document.getElementById("return-mode");
const adultsInput = document.getElementById("adults");
const childrenInput = document.getElementById("children");
const railcardList = document.getElementById("railcard-list");
const addRailcardButton = document.getElementById("add-railcard");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

let journeyGroups = { outward: [], inbound: [] };
let lastSeasonData = null;
let lastSeasonQuery = null;

attachStationPicker(originInput, originCrs);
attachStationPicker(destinationInput, destinationCrs);
attachStationPicker(viaInput, viaNlc);
attachStationPicker(avoidInput, avoidNlc);
const passengers = attachPassengerControls({
  adultsInput,
  childrenInput,
  listEl: railcardList,
  addButton: addRailcardButton,
  onChange: () => searchUi?.updateWhoSummary(),
});
const searchUi = attachSearchChrome({
  form,
  whoTrigger: document.getElementById("who-trigger"),
  whenPanel: document.getElementById("when-panel"),
  whoPanel: document.getElementById("who-panel"),
  viaInput,
  avoidInput,
  viaNlc,
  avoidNlc,
  dateInput,
  timeInput,
  returnDateInput,
  returnTimeInput,
  whoSummary: document.getElementById("who-summary"),
  passengers,
});

const now = new Date();
dateInput.value = formatDate(now);
timeInput.value = snapToQuarter(formatTime(now));
const returnAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
returnDateInput.value = formatDate(returnAt);
returnTimeInput.value = snapToQuarter(formatTime(returnAt));

dateInput.addEventListener("change", keepReturnAfterOutward);
timeInput.addEventListener("change", keepReturnAfterOutward);
searchUi.updateWhenSummary();
form.addEventListener("season-lengths-change", () => {
  if (!lastSeasonData || !searchUi.isSeasonMode()) return;
  renderSeasonResults(lastSeasonData, {
    ...lastSeasonQuery,
    ...searchUi.seasonSearchState(),
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (searchUi.isOthersMode()) {
    await searchRoverTickets();
    return;
  }

  if (!originCrs.value || !destinationCrs.value) {
    setStatus("Choose an origin and destination from the station list.", true);
    return;
  }

  if (searchUi.isSeasonMode()) {
    await searchSeasonTickets();
    return;
  }

  const viaError = optionalStationError(viaInput, viaNlc, "via");
  if (viaError) {
    setStatus(viaError, true);
    return;
  }
  const avoidError = optionalStationError(avoidInput, avoidNlc, "avoid");
  if (avoidError) {
    setStatus(avoidError, true);
    return;
  }
  if (viaNlc.value && viaNlc.value === avoidNlc.value) {
    setStatus("Via and avoid cannot be the same station.", true);
    return;
  }

  const outbound = searchWindow(dateInput.value, timeInput.value, outwardModeInput.value);
  if (!outbound) {
    setStatus("Choose an outward date and time.", true);
    return;
  }

  const hasReturnDate = Boolean(returnDateInput.value);
  const hasReturnTime = Boolean(returnTimeInput.value);
  const openReturn = Boolean(document.getElementById("open-return")?.checked);
  if (!openReturn && hasReturnDate !== hasReturnTime) {
    setStatus("Choose both a return date and time, or leave both blank for a one-way search.", true);
    return;
  }

  let inbound = null;
  if (!openReturn && hasReturnDate && hasReturnTime) {
    inbound = searchWindow(returnDateInput.value, returnTimeInput.value, returnModeInput.value);
    const outwardStamp = `${dateInput.value}T${timeInput.value}:00`;
    const returnStamp = `${returnDateInput.value}T${returnTimeInput.value}:00`;
    if (returnStamp < outwardStamp) {
      setStatus("Return time must be after the outward time.", true);
      return;
    }
  }

  const passengerError = passengers.validate();
  if (passengerError) {
    setStatus(passengerError, true);
    return;
  }

  const { adults, children } = passengers.passengerCounts();
  const railcards = passengers.selectedCodes();
  const payload = journeyPlanPayload({
    origin: originCrs.value,
    destination: destinationCrs.value,
    outward: outbound,
    inbound,
    openReturn,
    adults,
    children,
    railcards,
    via: viaNlc.value ? [viaNlc.value] : [],
    avoid: avoidNlc.value ? [avoidNlc.value] : [],
  });

  searchUi.closePanels();
  page.classList.remove("has-results");
  resultsEl.hidden = true;
  resultsEl.innerHTML = "";
  setStatus("Searching journeys…");

  try {
    const data = await planJourneys(payload);
    setStatus("");
    renderResults(data);
  } catch (error) {
    page.classList.remove("has-results");
    resultsEl.hidden = true;
    setStatus(error.message || "Journey search failed.", true);
  }
});

async function searchSeasonTickets() {
  const { startDate, endDate, adults, children, railcards, durations } = searchUi.seasonSearchState();
  if (!startDate) {
    setStatus("Choose a start date for the season ticket.", true);
    return;
  }
  if (durations.includes("custom") && !endDate) {
    setStatus("Choose an until date for the custom season ticket.", true);
    return;
  }
  if (durations.includes("custom") && endDate && endDate <= startDate) {
    setStatus("Until date must be after the start date.", true);
    return;
  }
  if (adults + children !== 1) {
    setStatus("Choose either an adult or a child passenger.", true);
    return;
  }

  searchUi.closePanels();
  page.classList.remove("has-results");
  resultsEl.hidden = true;
  setStatus(DEMO_SEARCH_MESSAGE, true);
}

async function searchRoverTickets() {
  const query = searchUi.roverSearchState();
  if (!query.product) {
    setStatus("Choose a rover ticket.", true);
    return;
  }
  if (!query.startDate) {
    setStatus("Choose a start date for the rover ticket.", true);
    return;
  }
  const passengerError = passengers.validate();
  if (passengerError) {
    setStatus(passengerError, true);
    return;
  }

  searchUi.closePanels();
  page.classList.add("has-results");
  setStatus("");
  resultsEl.hidden = false;
  resultsEl.innerHTML = [
    renderResultsIntro(
      { ...query, inbound: null, via: [], avoid: [] },
      { heading: query.product.name },
    ),
    renderRoverBoard({
      ...query,
      startDate: prettyDay(query.startDate) || query.startDate,
    }),
  ].join("");
}

function renderSeasonResults(data, query) {
  lastSeasonData = data;
  lastSeasonQuery = query;
  page.classList.add("has-results");
  const board = collectSeasonTickets(data, { durations: query.durations });
  const count = countSeasonTickets(board);
  resultsEl.hidden = false;
  resultsEl.innerHTML = [
    renderResultsIntro(
      { ...query, inbound: null, via: [], avoid: [] },
      {
        heading: count
          ? `${count} ${count === 1 ? "season ticket" : "season tickets"} to ${destinationLabel()}`
          : `No season tickets found to ${destinationLabel()}`,
      },
    ),
    count
      ? renderSeasonBoard(board)
      : `<p class="results-empty">${
          query.durations?.length
            ? "No season tickets match the selected lengths."
            : "No season tickets were returned for this search."
        }</p>`,
  ].join("");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function renderResults(data) {
  journeyGroups = extractJourneys(data);
  page.classList.add("has-results");
  resultsEl.hidden = false;
  if (!journeyGroups.outward.length && !journeyGroups.inbound.length) {
    resultsEl.innerHTML = `<p class="results-empty">No journeys found for this search.</p>`;
    return;
  }

  resultsEl.innerHTML = [
    renderJourneyGroup("Outward", journeyGroups.outward),
    renderJourneyGroup("Return", journeyGroups.inbound),
  ].join("");
}

function destinationLabel() {
  return destinationInput.value || stationNameFromNlc(destinationCrs.value);
}

function renderResultsIntro({ adults, children, railcards, via, avoid, inbound, startDate, endDate }, { heading } = {}) {
  const destination = destinationLabel();
  const count = journeyGroups.outward.length + journeyGroups.inbound.length;
  const party = passengerSummary(adults, children, railcards);
  const extras = [
    startDate && endDate
      ? `${prettyDay(startDate)} – ${prettyDay(endDate)}`
      : startDate
        ? `starting ${prettyDay(startDate)}`
        : null,
    via.length ? `via ${viaInput.value || stationNameFromNlc(via[0])}` : null,
    avoid.length ? `avoiding ${avoidInput.value || stationNameFromNlc(avoid[0])}` : null,
    startDate ? null : inbound ? "return" : "one-way",
  ].filter(Boolean);
  return `<header class="results-intro">
    <h2 class="results-heading">${escapeText(heading || `${count} ${count === 1 ? "journey" : "journeys"} to ${destination}`)}</h2>
    <p class="results-sub">${escapeText([party, ...extras].join(" · "))}</p>
  </header>`;
}

function stationNameFromNlc(nlc) {
  return stationSearch.findByNlc(String(nlc))?.name || stationLabel(nlc);
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderJourneyGroup(title, list) {
  if (!list.length) return "";
  return `<section class="journey-group">
    <h2>${title}</h2>
    <div class="journey-list">${list.map((journey) => renderJourneyCard(journey)).join("")}</div>
  </section>`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prettyDay(date) {
  if (!date) return "";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(parsed);
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addHours(value, hours) {
  const date = new Date(value);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return `${formatDate(date)}T${formatTime(date)}:00`;
}

function searchWindow(date, time, arriveDepart = "Depart") {
  if (!date || !time) return null;
  const selected = `${date}T${time}:00`;
  if (arriveDepart === "Arrive") {
    return {
      rangeStart: addHours(selected, -12),
      rangeEnd: selected,
      arriveDepart: "Arrive",
    };
  }
  return {
    rangeStart: selected,
    rangeEnd: addHours(selected, 12),
    arriveDepart: "Depart",
  };
}

function keepReturnAfterOutward() {
  if (!dateInput.value || !timeInput.value || !returnDateInput.value || !returnTimeInput.value) return;
  const outward = `${dateInput.value}T${timeInput.value}:00`;
  const inbound = `${returnDateInput.value}T${returnTimeInput.value}:00`;
  if (inbound >= outward) return;
  const moved = addHours(outward, 4);
  returnDateInput.value = moved.slice(0, 10);
  returnTimeInput.value = snapToQuarter(moved.slice(11, 16));
  searchUi.updateWhenSummary();
}

function stationLabel(nlc) {
  const station = stationSearch.findByNlc(String(nlc));
  return station?.crs || nlc;
}

function optionalStationError(input, hidden, label) {
  if (hidden.value) return null;
  if (input.value.trim()) return `Choose a ${label} station from the list, or clear it.`;
  return null;
}

function passengerSummary(adults, children, railcards) {
  const people = [
    adults ? `${adults} ${adults === 1 ? "adult" : "adults"}` : null,
    children ? `${children} ${children === 1 ? "child" : "children"}` : null,
  ].filter(Boolean);
  const cards = railcardNames(railcards);
  return [...people, ...cards].join(" · ");
}

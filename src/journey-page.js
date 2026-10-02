import {
  clockStamp,
  durationLabel,
  escapeHtml,
  renderClock,
  resolveClock,
  resolveStopClock,
  stationName,
} from "./format.js";
import { parseJourneyPath } from "./journey-url.js";
import { fetchService, fetchTubeJourney, fetchTubeStations } from "./api.js";
import { findOperator, operatorName } from "./operators.js";
import { stadiumByCrs, stadiumById } from "./stadiums.js";

const DEFAULT_STADIUM = stadiumById("villa-park");
const STADIUM_KEY = "stadium-handoff";
const TUBE_AFTER_TRAIN_MINUTES = 5;
const TUBE_BEFORE_TRAIN_MINUTES = 10;

const statusEl = document.getElementById("journey-status");
const detailEl = document.getElementById("journey-detail");
const stadiumToggle = document.getElementById("stadium-toggle");
const stepFreeSheet = document.getElementById("step-free-sheet");
const stepFreeNotes = new Map();
let stepFreeSeq = 0;

let journeyView = null;
const chosenStadium = stadiumById(new URLSearchParams(window.location.search).get("stadium"));

try {
  if (stadiumToggle) stadiumToggle.checked = localStorage.getItem(STADIUM_KEY) === "1";
} catch {
  // Storage can be blocked; the switch still works for this visit.
}
if (chosenStadium && stadiumToggle) stadiumToggle.checked = true;

stadiumToggle?.addEventListener("change", () => {
  try {
    localStorage.setItem(STADIUM_KEY, stadiumToggle.checked ? "1" : "0");
  } catch {
    // Ignore storage failures and keep the in-page toggle.
  }
  if (!journeyView) return;
  renderJourney(journeyView);
  loadStadiumWalk();
  if (stadiumToggle.checked) {
    detailEl.querySelector(".stadium-handoff")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

const legs = parseJourneyPath();

if (!legs.length) {
  setStatus("Choose a journey from search to see its trains.", true);
} else {
  loadJourney(legs);
}

async function loadJourney(legs) {
  setStatus("Loading live train details…");
  const services = await Promise.all(
    legs.map(async (leg) => {
      if (!leg.rid) return { leg, service: null, error: null };
      try {
        return { leg, service: await fetchService(leg.rid), error: null };
      } catch (error) {
        return { leg, service: null, error: error.message || "Could not load this service." };
      }
    }),
  );
  await attachTubeJourneys(services);

  const originName = stationName(legs[0].origin);
  const destinationName = stationName(legs[legs.length - 1].destination);
  const { depart, arrive, durationClock } = journeyClocks(services, legs);
  const duration = durationLabel(clockStamp(durationClock), clockStamp(arrive));
  const legCount = expandRides(services).length;
  const legsLabel = `${legCount} ${legCount === 1 ? "leg" : "legs"}`;
  const onTime = isJourneyOnTime(depart, arrive);
  document.title = `${originName} to ${destinationName}`;

  journeyView = {
    legs,
    services,
    originName,
    destinationName,
    destinationCrs: legs[legs.length - 1].destination,
    stadium: chosenStadium || stadiumByCrs(legs[legs.length - 1].destination) || DEFAULT_STADIUM,
    legsLabel,
    duration,
    durationClock,
    onTime,
    depart,
    arrive,
    stadiumWalk: null,
  };
  setStatus("");
  detailEl.hidden = false;
  loadStationWalks(journeyView);
  renderJourney(journeyView);
  loadStadiumWalk();
}

// Walks between stations (e.g. Waterloo to Waterloo East): fetch the real walking
// time, then time the walk from the previous arrival so the next change shows its wait.
async function loadStationWalks(view) {
  const walks = view.services
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.leg.mode === "walk");
  if (!walks.length) return;
  for (const { item } of walks) item.walk = { pending: true };

  let route;
  try {
    route = await import("./walk-route.js");
  } catch {
    for (const { item } of walks) item.walk = { failed: true };
    if (view === journeyView) renderJourney(view);
    return;
  }
  await Promise.all(
    walks.map(async ({ item, index }) => {
      const from = route.stationPoint(item.leg.origin);
      const to = route.stationPoint(item.leg.destination);
      try {
        if (!from || !to) throw new Error("No coordinates for this walk.");
        item.walk = await route.walkRoute(from, to);
        item.service = walkService(view.services, index, item.walk);
      } catch {
        item.walk = { failed: true };
      }
    }),
  );

  const { depart, arrive, durationClock } = journeyClocks(view.services, view.legs);
  Object.assign(view, {
    depart,
    arrive,
    durationClock,
    duration: durationLabel(clockStamp(durationClock), clockStamp(arrive)),
    onTime: isJourneyOnTime(depart, arrive),
  });
  if (view === journeyView) renderJourney(view);
}

function walkService(services, index, walk) {
  const { leg } = services[index];
  const after = clockStamp(neighborClock(services, index, -1, "arrive"));
  const before = clockStamp(neighborClock(services, index, 1, "depart"));
  const std = after || (before ? addMinutes(before, -walk.minutes) : null);
  if (!std) return null;
  return {
    locations: [
      { crs: leg.origin, locationName: stationName(leg.origin), std },
      { crs: leg.destination, locationName: stationName(leg.destination), sta: addMinutes(std, walk.minutes) },
    ],
  };
}

// Walking time from the final station to the stadium, fetched once per journey.
async function loadStadiumWalk() {
  const view = journeyView;
  if (!view || !stadiumEnabled() || view.stadiumWalk) return;
  view.stadiumWalk = { pending: true };
  try {
    const { stationPoint, walkRoute } = await import("./walk-route.js");
    const from = stationPoint(view.destinationCrs);
    if (!from) throw new Error("No coordinates for the arrival station.");
    view.stadiumWalk = await walkRoute(from, view.stadium.point);
  } catch {
    view.stadiumWalk = { failed: true };
  }
  if (view === journeyView) renderJourney(view);
}

function addMinutes(stamp, minutes) {
  const match = String(stamp || "").match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match.map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm + minutes)).toISOString().slice(0, 16) + ":00";
}

function stadiumArrival(arrive, walk) {
  if (!Number.isFinite(walk?.minutes)) return null;
  const stamp = addMinutes(clockStamp(arrive), walk.minutes);
  return stamp ? resolveClock({ scheduled: stamp }) : null;
}

function walkDetail(walk) {
  if (walk?.pending) return "Working out walking time…";
  if (!Number.isFinite(walk?.minutes)) return "";
  if (!Number.isFinite(walk.miles)) return `${walk.minutes} min`;
  const miles = walk.miles < 0.1 ? "less than 0.1 miles" : `${walk.miles.toFixed(1)} miles`;
  return `${walk.minutes} min · ${miles}`;
}

// Underground legs have no Darwin RID, so ask TfL for the rides, timed off the
// neighbouring train legs. Results are shaped like Darwin services.
// tfl-journey.js pulls in station coordinates, so load it only when needed.
async function attachTubeJourneys(services) {
  if (!services.some((item) => item.leg.mode === "metro")) return;
  const tfl = await import("./tfl-journey.js");
  for (const [index, item] of services.entries()) {
    if (item.leg.mode !== "metro") continue;
    try {
      const [from, to] = await Promise.all([
        tubePlace(tfl, item.leg.origin),
        tubePlace(tfl, item.leg.destination),
      ]);
      if (!from || !to) {
        item.error = "Live Underground times aren't available for this part of the journey.";
        continue;
      }
      const previous = clockStamp(neighborClock(services, index, -1, "arrive"));
      const next = clockStamp(neighborClock(services, index, 1, "depart"));
      const timeIs = previous || !next ? "Departing" : "Arriving";
      const when = previous
        ? tfl.tflDateTime(previous, TUBE_AFTER_TRAIN_MINUTES)
        : tfl.tflDateTime(next, -TUBE_BEFORE_TRAIN_MINUTES);
      const data = await fetchTubeJourney({ from, to, ...(when ?? {}), timeIs });
      const result = tfl.tubeJourney(data, item.leg, { timeIs });
      if (!result) {
        item.error = "TfL didn't return an Underground route for this part of the journey.";
        continue;
      }
      item.service = result.service;
      item.rides = result.rides;
    } catch (error) {
      item.error = error.message || "Could not load Underground times.";
    }
  }
}

// TfL routes cleanly between Tube station IDs; coordinates add street walks at each end.
async function tubePlace(tfl, crs) {
  const point = tfl.stationCoords(crs);
  if (!point) return null;
  try {
    return tfl.pickTubeStation(await fetchTubeStations(point), stationName(crs)) || point;
  } catch {
    return point;
  }
}

function expandRides(services) {
  return services.flatMap((item) => (item.rides?.length ? item.rides : [item]));
}

function placeName(leg, end) {
  return end === "origin" ? leg.originName || stationName(leg.origin) : leg.destinationName || stationName(leg.destination);
}

function renderJourney(view) {
  stepFreeNotes.clear();
  stepFreeSeq = 0;
  const { services, originName, destinationName, legsLabel, onTime, depart } = view;
  const stadium = stadiumEnabled() ? view.stadium : null;
  const headerDestination = stadium ? stadium.name : destinationName;
  const stadiumArrive = stadium ? stadiumArrival(view.arrive, view.stadiumWalk) : null;
  const arrive = stadiumArrive || view.arrive;
  const duration = stadiumArrive
    ? durationLabel(clockStamp(view.durationClock), clockStamp(stadiumArrive))
    : view.duration;
  document.title = `${originName} to ${headerDestination}`;
  detailEl.innerHTML = `
    <header class="journey-detail-head">
      <h1 class="journey-times">
        <span class="journey-end">
          <span class="journey-end-name">${escapeHtml(originName)}</span>
          ${renderClock(depart, { empty: "" })}
        </span>
        <span class="journey-times-arrow" aria-hidden="true">→</span>
        <span class="journey-end is-arrive">
          <span class="journey-end-name">${escapeHtml(headerDestination)}</span>
          ${renderClock(arrive, { empty: "" })}
        </span>
      </h1>
      ${onTime ? `<p class="clock-note">On time</p>` : ""}
      <p class="results-sub">${escapeHtml([legsLabel, duration].filter(Boolean).join(" · "))}</p>
    </header>
    ${renderItinerary(services, { stadium, destinationName, stadiumWalk: view.stadiumWalk, stadiumArrive })}
  `;
  syncAlertToggles();
}

function stadiumEnabled() {
  return Boolean(stadiumToggle?.checked);
}

function stationPlace(name) {
  return `${name} railway station`;
}

function stadiumMapsUrl(destinationName, stadium) {
  const params = new URLSearchParams({
    api: "1",
    origin: stationPlace(destinationName),
    destination: `${stadium.name}, ${stadium.city}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function arrivalStationLabel(services, destinationName) {
  const last = services[services.length - 1];
  if (!last) return destinationName;
  const stops = callingPoints(last.service, last.leg.origin, last.leg.destination);
  const alight = stops[stops.length - 1];
  return alight?.locationName || destinationName;
}

function renderItinerary(services, { stadium = null, destinationName = "", stadiumWalk = null, stadiumArrive = null } = {}) {
  const parts = expandRides(services);
  const train = parts
    .map((item, index) => {
      const isFirst = index === 0;
      const isLast = index === parts.length - 1 && !stadium;
      if (item.leg.mode === "walk") {
        return renderWalkLeg(item, parts, index, { isFirst, isLast });
      }
      const station = placeName(item.leg, "origin") || placeName(parts[index - 1].leg, "destination");
      const intro = isFirst
        ? renderServiceBreak(item)
        : renderServiceBreak(item, {
            title: `Change at ${station}`,
            wait: changeWait(parts[index - 1], item),
            icon: changeIcon(),
            isChange: true,
            stepFree: stepFreeForChange(parts[index - 1], item),
            stationName: station,
          });
      return `${intro}${renderLeg(item, { isFirst, isLast })}`;
    })
    .join("");
  return stadium ? `${train}${renderStadiumHandoff(parts, stadium, destinationName, stadiumWalk, stadiumArrive)}` : train;
}

function walkingMapsUrl(originPlace, destinationPlace) {
  const params = new URLSearchParams({
    api: "1",
    origin: originPlace,
    destination: destinationPlace,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function renderWalkLeg(item, services, index, { isFirst = false, isLast = false } = {}) {
  const from = placeName(item.leg, "origin");
  const to = placeName(item.leg, "destination");
  const changeTitle = isFirst
    ? ""
    : `Change at ${from || placeName(services[index - 1].leg, "destination")}`;
  const stops = callingPoints(item.service, item.leg.origin, item.leg.destination);
  return renderTransferLeg({
    title: `Walk to ${to}`,
    detail: walkDetail(item.walk || item.leg.walk),
    from,
    to,
    depart: stops.length ? stopClock(stops[0], "depart") : neighborClock(services, index, -1, "arrive"),
    arrive: stops.length > 1 ? stopClock(stops[stops.length - 1], "arrive") : null,
    href: walkingMapsUrl(item.leg.mapsOrigin || stationPlace(from), item.leg.mapsDestination || stationPlace(to)),
    fromMark: isFirst ? outlinePin() : `<span class="stop-dot"></span>`,
    toMark: isLast ? solidPin() : `<span class="stop-dot"></span>`,
    changeTitle,
    stepFree: changeTitle ? stepFreeForChange(services[index - 1], item) : null,
    stationName: from,
  });
}

function renderWalkStop(name, clock, mark) {
  return `<li class="calling-point is-call">
    <span class="calling-point-mark" aria-hidden="true">${mark}</span>
    <span class="calling-point-time">${clock ? renderClock(clock) : ""}</span>
    <span class="calling-point-copy">
      <span class="calling-point-name">${escapeHtml(name)}</span>
    </span>
  </li>`;
}

function neighborClock(services, index, step, kind) {
  const item = services[index + step];
  if (!item || item.leg.mode === "walk") return null;
  const stops = callingPoints(item.service, item.leg.origin, item.leg.destination);
  if (!stops.length) return null;
  const stop = kind === "arrive" ? stops[stops.length - 1] : stops[0];
  const clock = stopClock(stop, kind);
  return clock?.scheduledClock || clock?.liveClock ? clock : null;
}

function renderStadiumHandoff(services, stadium, destinationName, walk, arrive) {
  const from = arrivalStationLabel(services, destinationName);
  return `<div class="stadium-handoff">${renderTransferLeg({
    title: `Walk to ${stadium.name}`,
    detail: walkDetail(walk),
    from,
    to: stadium.name,
    depart: neighborClock(services, services.length, -1, "arrive"),
    arrive,
    href: stadiumMapsUrl(destinationName || from, stadium),
    fromMark: `<span class="stop-dot"></span>`,
    toMark: footballMark(),
    changeTitle: `Change at ${from}`,
    stepFree: stepFreeForChange(services[services.length - 1], null),
    stationName: from,
  })}</div>`;
}

function renderTransferLeg({ title, detail = "", from, to, depart, arrive, href, fromMark, toMark, changeTitle = "", stepFree = null, stationName = "" }) {
  return `<aside class="service-change">
    ${changeTitle ? renderChangeBreak({ title: changeTitle, icon: changeIcon(), stepFree, stationName }) : ""}
    <div class="service-change-next-row">
      <span class="service-change-icon" aria-hidden="true">${walkIcon()}</span>
      <div class="service-change-copy">
        <p class="service-change-next">${escapeHtml(title)}</p>
        ${detail ? `<p class="service-change-wait">${escapeHtml(detail)}</p>` : ""}
      </div>
    </div>
  </aside>
  <section class="service-leg">
    <ol class="calling-points">
      ${renderWalkStop(from, depart, fromMark)}
      <li class="calling-points-mid">
        <span class="calling-point-mark" aria-hidden="true"></span>
        <a class="calling-points-toggle" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
      </li>
      ${renderWalkStop(to, arrive, toMark)}
    </ol>
  </section>`;
}

function renderServiceBreak(item, { title, wait, icon, isChange = false, stepFree = null, stationName = "" } = {}) {
  const operator = serviceOperator(item);
  const { line, detail, platform } = describeService(item);
  return `<aside class="service-change">
    ${title ? renderChangeBreak({ title, wait, icon, isChange, stepFree, stationName }) : ""}
    <div class="service-change-next-row">
      <span class="service-change-icon" aria-hidden="true">${item.leg.mode === "metro" ? undergroundIcon() : trainIcon()}</span>
      <div class="service-change-copy">
        <p class="service-change-next">${escapeHtml(line)}</p>
        ${detail ? `<p class="service-change-wait">${escapeHtml(detail)}</p>` : ""}
      </div>
      ${operatorLogo(operator)}
      ${platform ? `<p class="service-change-platform">${escapeHtml(platform)}</p>` : ""}
    </div>
  </aside>`;
}

function renderChangeBreak({ title, wait = "", icon, isChange = true, stepFree = null, stationName = "" }) {
  return `<div class="service-change-break${isChange ? " is-change" : ""}">
    <span class="service-change-icon" aria-hidden="true">${icon}</span>
    <div class="service-change-break-copy">
      <h2>${escapeHtml(title)}</h2>
      ${wait ? `<p class="service-change-wait">${escapeHtml(wait)}</p>` : ""}
    </div>
    ${renderStepFreeChip(stepFree, stationName)}
  </div>`;
}

function stepFreeForChange(previous, next) {
  const nextStop = next && next.leg?.mode !== "walk" && next.leg?.mode !== "metro"
    ? stopByCrs(next.service, next.leg.origin)
    : null;
  const previousStop = previous && previous.leg?.mode !== "walk"
    ? stopByCrs(previous.service, previous.leg.destination)
    : null;
  return stepFreeFromStop(nextStop) || stepFreeFromStop(previousStop);
}

function stopByCrs(service, crs) {
  const code = String(crs || "").toUpperCase();
  if (!code) return null;
  return (service?.locations ?? []).find((stop) => String(stop.crs || "").toUpperCase() === code) || null;
}

function stepFreeFromStop(stop) {
  if (!stop) return null;
  const coverage = String(stop.stepFreeAccessCoverage || "").trim();
  const note = String(stop.stepFreeAccessNote || "").trim();
  if (!coverage && !note) return null;
  return { coverage, note };
}

function stepFreeCopy(coverage) {
  switch (coverage) {
    case "wholeStation":
      return { label: "Step-free", summary: "The whole station is step-free." };
    case "partialStation":
      return { label: "Partly step-free", summary: "Only part of the station is step-free." };
    case "noPartOfStation":
    case "noAccess":
    case "none":
      return { label: "No step-free access", summary: "No part of this station is step-free." };
    default:
      return { label: "Step-free information", summary: "" };
  }
}

function renderStepFreeChip(info, stationName) {
  if (!info) return "";
  const { label } = stepFreeCopy(info.coverage);
  const id = String(++stepFreeSeq);
  stepFreeNotes.set(id, info.note || "");
  return `<button type="button" class="step-free-chip" data-step-free="${id}" data-coverage="${escapeHtml(info.coverage)}" data-station="${escapeHtml(stationName)}" aria-label="${escapeHtml(`${label} at ${stationName}`)}">
    ${wheelchairIcon()}
    <span>${escapeHtml(label)}</span>
    ${infoIcon()}
  </button>`;
}

function wheelchairIcon() {
  return `<svg class="step-free-mark" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="8" cy="4.2" r="1.6" fill="currentColor"/>
    <circle cx="9.2" cy="16.4" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M6.4 8.4h5.1c.7 0 1.3.5 1.5 1.2l.6 2.4H9.2V8.4M14 12.2h3.4l1.5 3.4"/>
  </svg>`;
}

function infoIcon() {
  return `<svg class="step-free-info" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M12 11v5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="12" cy="7.6" r="1" fill="currentColor"/>
  </svg>`;
}

function stepFreeNoteHtml(note) {
  const source = String(note || "").trim();
  if (!source) return "";
  const doc = new DOMParser().parseFromString(source, "text/html");
  const blocks = [...doc.body.querySelectorAll("p")];
  const nodes = blocks.length ? blocks : [doc.body];
  return nodes
    .map((node) => {
      const html = [...node.childNodes].map((child) => {
        if (child.nodeType === Node.TEXT_NODE) return escapeHtml(child.textContent);
        if (child.nodeName === "A") {
          const href = child.getAttribute("href") || "";
          const label = escapeHtml(child.textContent);
          if (!/^https?:\/\//i.test(href)) return label;
          return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }
        return escapeHtml(child.textContent || "");
      }).join("").trim();
      return html ? `<p>${html}</p>` : "";
    })
    .join("");
}

function openStepFreeSheet(button) {
  if (!stepFreeSheet) return;
  const copy = stepFreeCopy(button.dataset.coverage || "");
  const note = stepFreeNoteHtml(stepFreeNotes.get(button.dataset.stepFree) || "");
  document.getElementById("step-free-sheet-title").textContent = button.dataset.station || "Step-free access";
  const status = document.getElementById("step-free-sheet-status");
  status.textContent = copy.summary;
  status.hidden = !copy.summary;
  const body = document.getElementById("step-free-sheet-body");
  body.innerHTML = note;
  body.hidden = !note;
  if (!stepFreeSheet.open) stepFreeSheet.showModal();
}

function describeService(item) {
  const operator = serviceOperator(item);
  const operatorLabel =
    operator?.name || operatorName(item.service?.operator) || (item.leg.mode === "metro" ? "London Underground" : "train");
  const destination = trainDestination(item);
  const tubeLine = item.service?.tubeSummary || "";
  const line = tubeLine || (destination ? `${operatorLabel} service to ${destination}` : `${operatorLabel} service`);
  const stops = callingPoints(item.service, item.leg.origin, item.leg.destination);
  const duration = stops.length
    ? durationLabel(clockStamp(stopClock(stops[0], "depart")), clockStamp(stopClock(stops[stops.length - 1], "arrive")))
    : "";
  const coaches = coachLabel(item.service);
  const platform = boardPlatform(stops[0]);
  const detail = [duration, coaches].filter(Boolean).join(" · ");
  return { line, detail, platform };
}

function coachLabel(service) {
  const count = Number(service?.length);
  if (!Number.isFinite(count) || count <= 0) return "";
  return `${count} ${count === 1 ? "coach" : "coaches"}`;
}

function boardPlatform(stop) {
  const platform = String(stop?.platform || "").trim();
  return platform ? `From platform ${platform}` : "";
}

function renderLeg({ leg, service, error }, { isFirst = false, isLast = false } = {}) {
  const bulletin = service?.bulletin || service?.delayReason || service?.cancelReason;
  const stops = callingPoints(service, leg.origin, leg.destination);

  return `<section class="service-leg">
    ${bulletin ? renderBulletin(bulletin) : ""}
    ${error ? `<p class="status error">${escapeHtml(error)}</p>` : ""}
    ${
      stops.length
        ? renderStops(stops, leg, { isFirst, isLast })
        : !error && leg.rid
          ? `<p class="results-empty">No calling points were returned for this train.</p>`
          : ""
    }
  </section>`;
}

function operatorLogo(operator) {
  if (!operator?.logo) return "";
  return `<img class="operator-logo" src="${escapeHtml(operator.logo)}" alt="${escapeHtml(operator.name)}" />`;
}

function serviceOperator({ leg, service }) {
  return findOperator({
    code: service?.operatorCode || service?.toc || service?.atocCode,
    name: service?.operator,
    mode: leg.mode,
  });
}

function trainDestination({ leg, service }) {
  const locations = service?.locations;
  if (Array.isArray(locations) && locations.length) {
    const last = locations[locations.length - 1];
    return stationName(last.crs) || last.locationName;
  }
  return stationName(leg.destination);
}

function changeWait(previous, next) {
  const previousStops = callingPoints(previous.service, previous.leg.origin, previous.leg.destination);
  const nextStops = callingPoints(next.service, next.leg.origin, next.leg.destination);
  const arrive = clockStamp(stopClock(previousStops[previousStops.length - 1], "arrive"));
  const depart = clockStamp(stopClock(nextStops[0], "depart"));
  const start = Date.parse(arrive);
  const end = Date.parse(depart);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 0) return "No time to change";
  if (minutes === 0) return "Less than 1 min to change";
  const wait = durationLabel(arrive, depart);
  return wait ? `${wait} to change` : null;
}

function renderStops(stops, leg, pins = {}) {
  if (stops.length < 2) {
    return `<ol class="calling-points">${stops.map((stop) => renderStop(stop, leg, pins)).join("")}</ol>`;
  }
  if (stops.length === 2) {
    return `<ol class="calling-points">
      ${renderStop(stops[0], leg, pins)}
      <li class="calling-points-mid" aria-hidden="true">
        <span class="calling-point-mark"></span>
        <span class="calling-points-toggle calling-points-spacer">Show 0 stops</span>
      </li>
      ${renderStop(stops[1], leg, pins)}
    </ol>`;
  }

  const board = stops[0];
  const alight = stops[stops.length - 1];
  const via = stops.slice(1, -1);
  const count = via.length;
  const label = `${count} ${count === 1 ? "stop" : "stops"}`;

  return `<ol class="calling-points">
    ${renderStop(board, leg, pins)}
    <li class="calling-points-mid">
      <span class="calling-point-mark" aria-hidden="true"></span>
      <button type="button" class="calling-points-toggle" aria-expanded="false" data-count="${count}">
        Show ${escapeHtml(label)}
      </button>
      <div class="calling-points-extra" aria-hidden="true">
        <ol class="calling-points-extra-inner">${via.map((stop) => renderStop(stop, leg, pins)).join("")}</ol>
      </div>
    </li>
    ${renderStop(alight, leg, pins)}
  </ol>`;
}

function renderStop(stop, leg, { isFirst = false, isLast = false } = {}) {
  const crs = String(stop.crs || "").toUpperCase();
  const isBoard = crs === leg.origin;
  const isAlight = crs === leg.destination;
  const clock = stopClock(stop, isAlight ? "arrive" : "depart");
  const platform = (isBoard || isAlight) && stop.platform ? `Plat ${stop.platform}` : "";
  const mark = isFirst && isBoard ? outlinePin() : isLast && isAlight ? solidPin() : `<span class="stop-dot"></span>`;
  return `<li class="calling-point${isBoard ? " is-board" : ""}${isAlight ? " is-alight" : ""}${isBoard || isAlight ? " is-call" : ""}">
    <span class="calling-point-mark" aria-hidden="true">${mark}</span>
    <span class="calling-point-time">${renderClock(clock, stop.untimed ? { empty: "" } : undefined)}</span>
    <span class="calling-point-copy">
      <span class="calling-point-name">${escapeHtml(stop.locationName || stationName(crs) || crs)}</span>
      ${platform ? `<span class="calling-point-meta">${escapeHtml(platform)}</span>` : ""}
    </span>
  </li>`;
}

function outlinePin() {
  return `<svg class="stop-pin" viewBox="0 0 24 24" focusable="false">
    <path fill="#fff" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 21.8s6.8-6.6 6.8-11.6a6.8 6.8 0 1 0-13.6 0c0 5 6.8 11.6 6.8 11.6z"/>
    <circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/>
  </svg>`;
}

function solidPin() {
  return `<svg class="stop-pin is-solid" viewBox="0 0 24 24" focusable="false">
    <path fill="currentColor" d="M12 21.8s6.8-6.6 6.8-11.6a6.8 6.8 0 1 0-13.6 0c0 5 6.8 11.6 6.8 11.6z"/>
    <circle cx="12" cy="10" r="2.5" fill="#fff"/>
  </svg>`;
}

function footballMark() {
  const patch = `<path d="M12 8V5.2"/><polygon points="12,5.2 8.58,2.71 9.88,-1.31 14.12,-1.31 15.42,2.71"/>`;
  const patches = [0, 72, 144, 216, 288].map((turn) => `<g transform="rotate(${turn} 12 12)">${patch}</g>`).join("");
  return `<svg class="stop-pin is-football" viewBox="0 0 24 24" focusable="false">
    <defs><clipPath id="football-clip"><circle cx="12" cy="12" r="9.6"/></clipPath></defs>
    <circle cx="12" cy="12" r="9.6" fill="#fff"/>
    <g clip-path="url(#football-clip)" fill="currentColor" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round">
      <polygon points="12,8 15.8,10.76 14.35,15.24 9.65,15.24 8.2,10.76"/>
      ${patches}
    </g>
    <circle cx="12" cy="12" r="9.6" fill="none" stroke="currentColor" stroke-width="1.6"/>
  </svg>`;
}

function changeIcon() {
  return `<svg class="stop-pin" viewBox="0 0 24 24" focusable="false">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3"/>
  </svg>`;
}

function walkIcon() {
  return `<svg class="stop-pin" viewBox="0 0 24 24" focusable="false">
    <circle cx="14" cy="4.2" r="1.7" fill="currentColor"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M13.2 8.2 10.2 12l2.4 1.1-1.5 6.4M12.6 13.1l2.8 1.5 1.4 5.2M10.4 12.2 7.2 14.2"/>
  </svg>`;
}

function undergroundIcon() {
  return `<svg class="stop-pin" viewBox="0 0 24 24" focusable="false">
    <circle cx="12" cy="12" r="7.6" fill="none" stroke="#dc241f" stroke-width="3.2"/>
    <rect x="1.5" y="10" width="21" height="4" fill="#0019a8"/>
  </svg>`;
}

function trainIcon() {
  return `<svg class="stop-pin" viewBox="0 0 24 24" focusable="false">
    <rect x="4" y="3" width="16" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 9h10M6 20h12M8 16v4M16 16v4"/>
    <circle cx="9" cy="13.5" r="1.2" fill="currentColor"/>
    <circle cx="15" cy="13.5" r="1.2" fill="currentColor"/>
  </svg>`;
}

function callingPoints(service, origin, destination) {
  const locations = service?.locations;
  if (!Array.isArray(locations) || !locations.length) return [];
  const from = locations.findIndex((stop) => String(stop.crs || "").toUpperCase() === origin);
  const to = locations.findIndex((stop) => String(stop.crs || "").toUpperCase() === destination);
  if (from >= 0 && to >= from) return locations.slice(from, to + 1);
  return locations;
}

function journeyClocks(services, legs) {
  const origin = legs[0].origin;
  const destination = legs[legs.length - 1].destination;
  let depart = resolveClock({});
  let arrive = resolveClock({});
  let durationClock = resolveClock({});

  for (const { leg, service } of services) {
    const stops = callingPoints(service, leg.origin, leg.destination);
    if (!stops.length) continue;
    if (!clockStamp(durationClock)) durationClock = stopClock(stops[0], "depart");
    const originStop = stops.find((stop) => String(stop.crs || "").toUpperCase() === origin);
    if (originStop && !clockStamp(depart)) depart = stopClock(originStop, "depart");
    const destinationStop = stops.find((stop) => String(stop.crs || "").toUpperCase() === destination);
    if (destinationStop) arrive = stopClock(destinationStop, "arrive");
  }

  if (!clockStamp(durationClock)) durationClock = depart;
  return { depart, arrive, durationClock: clockStamp(depart) ? depart : durationClock };
}

function stopClock(stop, kind) {
  const preferred = resolveStopClock(stop, kind);
  if (preferred.scheduledClock || preferred.liveClock) return preferred;
  return resolveStopClock(stop, kind === "arrive" ? "depart" : "arrive");
}

function isJourneyOnTime(depart, arrive) {
  const hasTime = Boolean(depart.scheduledClock || arrive.scheduledClock);
  return hasTime && !depart.late && !arrive.late;
}

function renderBulletin(text) {
  return `<button type="button" class="overview-alerts" aria-expanded="false">
    <span class="overview-alerts-text">${escapeHtml(text)}</span>
    <svg class="overview-alerts-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>`;
}

function syncAlertToggles() {
  for (const alert of detailEl.querySelectorAll(".overview-alerts:not(.is-open)")) {
    const text = alert.querySelector(".overview-alerts-text");
    const mark = alert.querySelector(".overview-alerts-mark");
    if (!text || !mark) continue;
    const overflows = text.scrollWidth > text.clientWidth + 1;
    mark.hidden = !overflows;
    alert.disabled = !overflows;
    if (overflows) alert.setAttribute("aria-expanded", "false");
    else alert.removeAttribute("aria-expanded");
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.hidden = !message;
  statusEl.classList.toggle("error", Boolean(isError));
}

window.addEventListener("resize", syncAlertToggles);

stepFreeSheet?.addEventListener("click", (event) => {
  if (event.target === stepFreeSheet || event.target.closest(".step-free-sheet-close")) stepFreeSheet.close();
});

detailEl.addEventListener("click", (event) => {
  const stepFree = event.target.closest("button.step-free-chip");
  if (stepFree) {
    openStepFreeSheet(stepFree);
    return;
  }
  const alert = event.target.closest("button.overview-alerts");
  if (alert && !alert.disabled) {
    const open = !alert.classList.contains("is-open");
    alert.classList.toggle("is-open", open);
    alert.querySelector(".overview-alerts-mark").hidden = false;
    alert.setAttribute("aria-expanded", String(open));
    return;
  }
  const button = event.target.closest("button.calling-points-toggle");
  if (!button) return;
  const row = button.closest(".calling-points-mid");
  if (!row) return;
  const open = !row.classList.contains("is-open");
  row.classList.toggle("is-open", open);
  button.setAttribute("aria-expanded", String(open));
  row.querySelector(".calling-points-extra")?.setAttribute("aria-hidden", String(!open));
  const count = Number(button.dataset.count) || 0;
  const label = `${count} ${count === 1 ? "stop" : "stops"}`;
  button.textContent = open ? `Hide ${label}` : `Show ${label}`;
});

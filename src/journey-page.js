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
import { fetchService } from "./api.js";
import { findOperator, operatorName } from "./operators.js";

const STADIUM_NAME = "Villa Park";
const STADIUM_QUERY = "Villa Park football stadium";
const STADIUM_KEY = "stadium-handoff";

const statusEl = document.getElementById("journey-status");
const detailEl = document.getElementById("journey-detail");
const stadiumToggle = document.getElementById("stadium-toggle");

let journeyView = null;

try {
  if (stadiumToggle) stadiumToggle.checked = localStorage.getItem(STADIUM_KEY) === "1";
} catch {
  // Storage can be blocked; the switch still works for this visit.
}

stadiumToggle?.addEventListener("change", () => {
  try {
    localStorage.setItem(STADIUM_KEY, stadiumToggle.checked ? "1" : "0");
  } catch {
    // Ignore storage failures and keep the in-page toggle.
  }
  if (!journeyView) return;
  renderJourney(journeyView);
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

  const originName = stationName(legs[0].origin);
  const destinationName = stationName(legs[legs.length - 1].destination);
  const { depart, arrive, durationClock } = journeyClocks(services, legs);
  const duration = durationLabel(clockStamp(durationClock), clockStamp(arrive));
  const legsLabel = `${legs.length} ${legs.length === 1 ? "leg" : "legs"}`;
  const onTime = isJourneyOnTime(depart, arrive);
  document.title = `${originName} to ${destinationName}`;

  journeyView = { services, originName, destinationName, legsLabel, duration, onTime, depart, arrive };
  setStatus("");
  detailEl.hidden = false;
  renderJourney(journeyView);
}

function renderJourney({ services, originName, destinationName, legsLabel, duration, onTime, depart, arrive }) {
  const stadium = stadiumEnabled();
  detailEl.innerHTML = `
    <header class="journey-detail-head">
      <h1 class="journey-times">
        <span class="journey-end">
          <span class="journey-end-name">${escapeHtml(originName)}</span>
          ${renderClock(depart, { empty: "" })}
        </span>
        <span class="journey-times-arrow" aria-hidden="true">→</span>
        <span class="journey-end is-arrive">
          <span class="journey-end-name">${escapeHtml(destinationName)}</span>
          ${renderClock(arrive, { empty: "" })}
        </span>
      </h1>
      ${onTime ? `<p class="clock-note">On time</p>` : ""}
      <p class="results-sub">${escapeHtml([legsLabel, duration].filter(Boolean).join(" · "))}</p>
    </header>
    ${renderItinerary(services, { stadium, destinationName })}
  `;
}

function stadiumEnabled() {
  return Boolean(stadiumToggle?.checked);
}

function stationPlace(name) {
  return `${name} railway station`;
}

function stadiumMapsUrl(destinationName) {
  const params = new URLSearchParams({
    api: "1",
    origin: stationPlace(destinationName),
    destination: STADIUM_QUERY,
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

function renderItinerary(services, { stadium = false, destinationName = "" } = {}) {
  const train = services
    .map((item, index) => {
      const intro =
        index === 0
          ? renderServiceBreak(item)
          : renderServiceBreak(item, {
              title: `Change at ${stationName(item.leg.origin) || stationName(services[index - 1].leg.destination)}`,
              wait: changeWait(services[index - 1], item),
              icon: changeIcon(),
              isChange: true,
            });
      const isLast = index === services.length - 1 && !stadium;
      return `${intro}${renderLeg(item, { isFirst: index === 0, isLast })}`;
    })
    .join("");
  return stadium ? `${train}${renderStadiumHandoff(services, destinationName)}` : train;
}

function renderStadiumHandoff(services, destinationName) {
  const from = arrivalStationLabel(services, destinationName);
  const href = stadiumMapsUrl(destinationName || from);
  return `<aside class="service-change stadium-handoff">
    <div class="service-change-break is-change">
      <span class="service-change-icon" aria-hidden="true">${walkIcon()}</span>
      <div class="service-change-break-copy">
        <h2>Get to the stadium</h2>
        <p class="service-change-wait">From ${escapeHtml(from)}</p>
      </div>
    </div>
    <a class="stadium-map-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
      <span class="service-change-icon" aria-hidden="true">${solidPin()}</span>
      <span class="service-change-copy">
        <span class="service-change-next">${escapeHtml(STADIUM_NAME)}</span>
      </span>
      <span class="stadium-map-cta">Open in Google Maps</span>
    </a>
  </aside>`;
}

function renderServiceBreak(item, { title, wait, icon, isChange = false } = {}) {
  const operator = serviceOperator(item);
  const { line, detail } = describeService(item);
  return `<aside class="service-change">
    ${
      title
        ? `<div class="service-change-break${isChange ? " is-change" : ""}">
      <span class="service-change-icon" aria-hidden="true">${icon}</span>
      <div class="service-change-break-copy">
        <h2>${escapeHtml(title)}</h2>
        ${wait ? `<p class="service-change-wait">${escapeHtml(wait)}</p>` : ""}
      </div>
    </div>`
        : ""
    }
    <div class="service-change-next-row">
      <span class="service-change-icon" aria-hidden="true">${trainIcon()}</span>
      <div class="service-change-copy">
        <p class="service-change-next">${escapeHtml(line)}</p>
        ${detail ? `<p class="service-change-wait">${escapeHtml(detail)}</p>` : ""}
      </div>
      ${operatorLogo(operator)}
    </div>
  </aside>`;
}

function describeService(item) {
  const operator = serviceOperator(item);
  const operatorLabel =
    operator?.name || operatorName(item.service?.operator) || (item.leg.mode === "metro" ? "London Underground" : "train");
  const destination = trainDestination(item);
  const line = destination ? `${operatorLabel} service to ${destination}` : `${operatorLabel} service`;
  const stops = callingPoints(item.service, item.leg.origin, item.leg.destination);
  const duration = stops.length
    ? durationLabel(clockStamp(stopClock(stops[0], "depart")), clockStamp(stopClock(stops[stops.length - 1], "arrive")))
    : "";
  const coaches = coachLabel(item.service);
  const fromPlat = boardPlatform(stops[0]);
  const detail = [duration, coaches, fromPlat].filter(Boolean).join(" · ");
  return { line, detail };
}

function coachLabel(service) {
  const count = Number(service?.length);
  if (!Number.isFinite(count) || count <= 0) return "";
  return `${count} ${count === 1 ? "coach" : "coaches"}`;
}

function boardPlatform(stop) {
  const platform = String(stop?.platform || "").trim();
  return platform ? `From plat ${platform}` : "";
}

function renderLeg({ leg, service, error }, { isFirst = false, isLast = false } = {}) {
  const bulletin = service?.bulletin || service?.delayReason || service?.cancelReason;
  const stops = callingPoints(service, leg.origin, leg.destination);

  return `<section class="service-leg">
    ${bulletin ? `<p class="overview-alerts">${escapeHtml(bulletin)}</p>` : ""}
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
  if (stops.length <= 2) {
    return `<ol class="calling-points">${stops.map((stop) => renderStop(stop, leg, pins)).join("")}</ol>`;
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
    <span class="calling-point-time">${renderClock(clock)}</span>
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

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.hidden = !message;
  statusEl.classList.toggle("error", Boolean(isError));
}

detailEl.addEventListener("click", (event) => {
  const button = event.target.closest(".calling-points-toggle");
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

import { crsCode, durationLabel, escapeHtml, formatClock, stationName, timesDiffer } from "./format.js";
import { normalizeJpResponse } from "./jp-journey.js";

export function renderJourneyCard(journey, index = 0, direction = "outward") {
  const origin = stationName(journey.origin);
  const destination = stationName(journey.destination);
  const std = journey.scheduledTime?.departure;
  const sta = journey.scheduledTime?.arrival;
  const legs = journey.journeySequence?.legs ?? [];
  const firstLeg = legs.find((leg) => leg.mode === "TRAIN") || legs[0];
  const lastLeg = [...legs].reverse().find((leg) => leg.mode === "TRAIN") || legs[legs.length - 1];
  const ets = journey.realTime?.departure || firstLeg?.realTime?.departure;
  const eta = journey.realTime?.arrival || lastLeg?.realTime?.arrival;
  const showEstimated = Boolean(eta) && (timesDiffer(eta, sta) || timesDiffer(ets, std));
  const duration = durationLabel(std, sta);
  const trainCount = legs.filter((leg) => leg.mode === "TRAIN").length;
  const changeCount = Number.isFinite(journey.changes) ? journey.changes : Math.max(0, trainCount - 1);
  const changes = changeCount === 0 ? "Direct" : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`;

  const estimatedRow = showEstimated
    ? `<div class="estimated">${escapeHtml(formatClock(ets) || "—")} → ${escapeHtml(formatClock(eta))}</div>`
    : "";

  const originCode = (crsCode(journey.origin) || origin).slice(0, 3).toUpperCase();
  const destinationCode = (crsCode(journey.destination) || destination).slice(0, 3).toUpperCase();

  return `<button type="button" class="journey-card" data-index="${index}" data-direction="${escapeHtml(direction)}">
    <div class="journey-cover" aria-hidden="true">
      <span class="cover-code">${escapeHtml(originCode)}</span>
      <span class="cover-line"></span>
      <span class="cover-code">${escapeHtml(destinationCode)}</span>
    </div>
    <div class="journey-card-body">
      <div class="journey-times">
        <div class="${showEstimated ? "scheduled replaced" : "scheduled"}">${escapeHtml(formatClock(std))} – ${escapeHtml(formatClock(sta))}</div>
        ${estimatedRow}
      </div>
      <div class="journey-od">${escapeHtml(origin)} to ${escapeHtml(destination)}</div>
      <div class="journey-stats">
        <span>${escapeHtml(changes)}</span>
      </div>
    </div>
    <div class="journey-card-meta">
      <span>${escapeHtml(duration || "")}</span>
      <span class="journey-card-arrow">→</span>
    </div>
  </button>`;
}

export function extractJourneys(data) {
  if (!data || typeof data !== "object") return { outward: [], inbound: [] };
  const fromJp = normalizeJpResponse(data);
  if (fromJp.outward.length || fromJp.inbound.length) return fromJp;
  const fallback = Array.isArray(data.outwardJourney)
    ? data.outwardJourney
    : Array.isArray(data.journeys)
      ? data.journeys
      : Array.isArray(data.results)
        ? data.results
        : [];
  return { outward: fallback, inbound: [] };
}

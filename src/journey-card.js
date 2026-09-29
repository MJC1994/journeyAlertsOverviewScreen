import { clockStamp, durationLabel, escapeHtml, renderClock, resolveClock, stationName } from "./format.js";
import { normalizeJpResponse } from "./jp-journey.js";
import { journeyHref } from "./journey-url.js";

export function renderJourneyCard(journey) {
  const origin = stationName(journey.origin);
  const destination = stationName(journey.destination);
  const depart = resolveClock({
    scheduled: journey.scheduledTime?.departure,
    estimated: journey.realTime?.departure,
  });
  const arrive = resolveClock({
    scheduled: journey.scheduledTime?.arrival,
    estimated: journey.realTime?.arrival,
  });
  const duration = durationLabel(clockStamp(depart), clockStamp(arrive));
  const legs = journey.journeySequence?.legs ?? [];
  const trainCount = legs.filter((leg) => leg.mode === "TRAIN").length;
  const changeCount = Number.isFinite(journey.changes) ? journey.changes : Math.max(0, trainCount - 1);
  const changes = changeCount === 0 ? "Direct" : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`;
  const href = journeyHref(journey);
  const tag = href ? "a" : "div";
  const attrs = href
    ? `href="${escapeHtml(href)}"`
    : `role="group"`;
  const onTime = Boolean(depart.scheduledClock || arrive.scheduledClock) && !depart.late && !arrive.late;

  return `<${tag} class="journey-row" ${attrs}>
    <span class="journey-row-route">
      <span class="journey-row-station">${escapeHtml(origin)}</span>
      <span class="journey-row-arrow" aria-hidden="true">→</span>
      <span class="journey-row-station">${escapeHtml(destination)}</span>
    </span>
    <span class="journey-row-times">
      ${renderClock(depart)}
      <span class="journey-row-arrow" aria-hidden="true">–</span>
      ${renderClock(arrive)}
    </span>
    ${onTime ? `<span class="clock-note">On time</span>` : ""}
    <span class="journey-row-meta">
      <span>${escapeHtml(changes)}</span>
      ${duration ? `<span>${escapeHtml(duration)}</span>` : ""}
    </span>
  </${tag}>`;
}

export function extractJourneys(data) {
  if (!data || typeof data !== "object") return { outward: [], inbound: [] };
  const fromJp = normalizeJpResponse(data);
  if (fromJp.outward.length || fromJp.inbound.length) return fromJp;
  if (Array.isArray(data.outward) || Array.isArray(data.inbound)) {
    return {
      outward: data.outward ?? [],
      inbound: data.inbound ?? [],
    };
  }
  const fallback = Array.isArray(data.outwardJourney)
    ? data.outwardJourney
    : Array.isArray(data.journeys)
      ? data.journeys
      : Array.isArray(data.results)
        ? data.results
        : [];
  return { outward: fallback, inbound: data.inboundJourney ?? [] };
}

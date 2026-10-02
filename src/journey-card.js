import { clockStamp, durationLabel, escapeHtml, renderClock, resolveClock, stationName } from "./format.js";
import { normalizeJpResponse } from "./jp-journey.js";
import { journeyHref } from "./journey-url.js";

export function renderJourneyCard(journey, { stadium = "" } = {}) {
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
  const href = journeyHref(journey, { stadium });
  const tag = href ? "a" : "div";
  const attrs = href
    ? `href="${escapeHtml(href)}"`
    : `role="group"`;
  const onTime = Boolean(depart.scheduledClock || arrive.scheduledClock) && !depart.late && !arrive.late;

  return `<${tag} class="journey-row" ${attrs}>
    <span class="journey-row-main">
      <span class="journey-row-times">
        ${renderClock(depart)}
        <span class="journey-row-arrow" aria-hidden="true">–</span>
        ${renderClock(arrive)}
      </span>
      <span class="journey-row-route">
        <span class="journey-row-station">${escapeHtml(origin)}</span>
        <span class="journey-row-arrow" aria-hidden="true">→</span>
        <span class="journey-row-station">${escapeHtml(destination)}</span>
      </span>
      <span class="journey-row-meta">
        ${onTime ? `<span class="journey-row-status">On time</span>` : ""}
        <span>${escapeHtml(changes)}</span>
        ${duration ? `<span>${escapeHtml(duration)}</span>` : ""}
      </span>
    </span>
    ${href ? `<span class="journey-row-cta">
      <span class="journey-row-cta-label">View journey</span>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>` : ""}
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

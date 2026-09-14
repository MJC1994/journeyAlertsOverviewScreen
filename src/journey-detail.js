import {
  crsCode,
  durationLabel,
  escapeHtml,
  formatClock,
  formatPence,
  htmlToText,
  knownValue,
  stationName,
  timesDiffer,
} from "./format.js";

export function renderJourneyOverview(journey, { services = {}, loading = false } = {}) {
  const journeyEnds = {
    origin: crsCode(journey.origin),
    destination: crsCode(journey.destination),
  };
  const legs = journey.journeySequence?.legs ?? [];
  const items = buildItinerary(legs, services, loading);
  const leftoverBulletins = attachBulletins(items, journey.journeySequence?.serviceBulletins ?? []);
  const stops = items.filter((item) => item.type === "stop");
  const firstLeg = legs.find((leg) => isTrain(leg)) || legs[0];
  const lastLeg = [...legs].reverse().find((leg) => isTrain(leg)) || legs[legs.length - 1];
  const std = journey.scheduledTime?.departure;
  const sta = journey.scheduledTime?.arrival;
  const ets = journey.realTime?.departure || firstLeg?.realTime?.departure;
  const eta = journey.realTime?.arrival || lastLeg?.realTime?.arrival;
  const duration = durationLabel(std, sta);
  const trainCount = legs.filter(isTrain).length;
  const changes = Number.isFinite(journey.changes) ? journey.changes : Math.max(0, trainCount - 1);
  const changeLabel = changes === 0 ? "Direct" : `${changes} ${changes === 1 ? "change" : "changes"}`;
  const status = formatStatus(journey.realtimeClassification);
  const fares = journey.journeySequence?.fares ?? [];
  const path = stops.map((stop) => stop.name).join(" → ");

  return `<section class="overview">
    <header class="overview-summary">
      <h3>${escapeHtml(path || `${stationName(journey.origin)} → ${stationName(journey.destination)}`)}</h3>
      <div class="overview-times">
        ${renderTimePair(std, ets)}
        <span class="overview-arrow">→</span>
        ${renderTimePair(sta, eta)}
      </div>
      <p class="overview-meta">${escapeHtml([duration, changeLabel, status].filter(Boolean).join(" · "))}</p>
    </header>
    ${leftoverBulletins.length ? `<ul class="overview-alerts">${leftoverBulletins.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>` : ""}
    <ol class="itinerary">${items.map((item) => renderItineraryItem(item, journeyEnds)).join("")}</ol>
    ${fares.length ? renderFares(fares) : ""}
  </section>`;
}

function buildItinerary(legs, services, loading) {
  const items = [];
  for (const leg of legs) {
    const service = services[leg.trainRID];
    const board = locationFor(leg.board, service);
    const alight = locationFor(leg.alight, service);
    items.push(makeStop(stopFromLeg(leg, board, "depart")));
    items.push(linkFromLeg(leg, service, loading));
    items.push(makeStop(stopFromLeg(leg, alight, "arrive")));
  }
  return mergeStops(items);
}

function stopFromLeg(leg, location, kind) {
  const station = kind === "depart" ? leg.board : leg.alight;
  const scheduled = kind === "depart"
    ? location?.std || leg.scheduledTime?.departure
    : location?.sta || leg.scheduledTime?.arrival;
  const live = kind === "depart"
    ? location?.atd || location?.etd || leg.realTime?.departure
    : location?.ata || location?.eta || leg.realTime?.arrival;
  const platform = location?.platform || (kind === "depart" ? leg.originPlatform : leg.destinationPlatform);
  const alerts = [htmlToText(station?.nreAlert)].filter(Boolean);
  return {
    crs: crsCode(station),
    name: stationName(station) || location?.locationName,
    platform,
    location,
    ojp: station,
    bulletins: alerts,
    [kind]: { scheduled, live },
  };
}

function linkFromLeg(leg, service, loading) {
  if (leg.mode === "WALK") return { type: "walk", leg };
  if (leg.mode === "METRO") return { type: "metro", leg };
  return {
    type: "train",
    leg,
    service,
    loading: Boolean(leg.trainRID) && loading && !service,
  };
}

function makeStop(stop) {
  return { type: "stop", bulletins: stop.bulletins ?? [], ...stop };
}

function attachBulletins(items, bulletins) {
  const stops = items.filter((item) => item.type === "stop");
  const leftover = [];
  for (const bulletin of bulletins) {
    const text = bulletinText(bulletin);
    if (!text) continue;
    const stop = matchBulletinToStop(bulletin, text, stops);
    if (!stop) {
      leftover.push(text);
      continue;
    }
    if (!stop.bulletins.includes(text)) stop.bulletins.push(text);
  }
  return leftover;
}

function matchBulletinToStop(bulletin, text, stops) {
  const crs = crsCode(bulletin.crs || bulletin.stationCrs || bulletin.locationCrs || bulletin.station);
  if (crs) {
    const byCrs = stops.find((stop) => stop.crs === crs);
    if (byCrs) return byCrs;
  }

  const haystack = text.toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const stop of stops) {
    for (const alias of stopAliases(stop)) {
      if (alias.length > bestLen && textMentions(haystack, alias)) {
        best = stop;
        bestLen = alias.length;
      }
    }
  }
  return best;
}

function stopAliases(stop) {
  const aliases = new Set();
  const name = String(stop.name || "").trim();
  if (name) {
    aliases.add(name.toLowerCase());
    aliases.add(name.replace(/^London\s+/i, "").toLowerCase());
  }
  if (stop.crs) aliases.add(String(stop.crs).toLowerCase());
  return [...aliases].filter((alias) => alias.length >= 3);
}

function textMentions(haystack, alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

function mergeStops(items) {
  const merged = [];
  for (const item of items) {
    const prev = merged[merged.length - 1];
    if (item.type === "stop" && prev?.type === "stop" && prev.crs && prev.crs === item.crs) {
      merged[merged.length - 1] = {
        ...prev,
        ...item,
        arrive: prev.arrive || item.arrive,
        depart: item.depart || prev.depart,
        platform: item.platform || prev.platform,
        location: item.location || prev.location,
        ojp: item.ojp || prev.ojp,
        bulletins: [...new Set([...(prev.bulletins || []), ...(item.bulletins || [])])],
      };
      continue;
    }
    merged.push(item);
  }
  return merged;
}

function locationFor(station, service) {
  const code = crsCode(station);
  return (service?.locations ?? []).find((location) => location.crs === code);
}

function renderItineraryItem(item, journeyEnds) {
  if (item.type === "stop") return renderItineraryStop(item, journeyEnds);
  if (item.type === "walk" || item.type === "metro") return renderTransferLink(item);
  return renderTrainLink(item);
}

function renderItineraryStop(stop, journeyEnds) {
  const platform = stop.platform ? `Plat ${stop.platform}` : "";
  const role = stop.arrive && stop.depart ? "Change" : stop.depart ? "Board" : stop.arrive ? "Alight" : "";
  const coverage = isJourneyEnd(stop.crs, journeyEnds)
    ? stop.location?.stepFreeAccessCoverage || stop.ojp?.stepFreeAccessCoverage
    : "";
  const note = isJourneyEnd(stop.crs, journeyEnds)
    ? stop.location?.stepFreeAccessNote || stop.ojp?.stepFreeAccessNote
    : "";
  return `<li class="itinerary-stop">
    <div class="stop-times">${renderStopTimes(stop)}</div>
    <div class="itinerary-spine" aria-hidden="true"><span class="itinerary-marker"></span></div>
    <div class="itinerary-stop-body">
      <div class="itinerary-stop-card">
        <p class="stop-name">${escapeHtml(stop.name)}</p>
        ${role || platform ? `<p class="stop-meta">${escapeHtml([role, platform].filter(Boolean).join(" · "))}</p>` : ""}
        ${renderStepFree(coverage, note)}
      </div>
      ${renderStopBulletins(stop)}
    </div>
  </li>`;
}

function renderStopBulletins(stop) {
  const bulletins = stop.bulletins ?? [];
  if (!bulletins.length) return "";
  return `<ul class="stop-alerts">${bulletins.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>`;
}

function renderStopTimes(stop) {
  const arrive = hasClock(stop.arrive) ? renderTimePair(stop.arrive.scheduled, stop.arrive.live) : "";
  const depart = hasClock(stop.depart) ? renderTimePair(stop.depart.scheduled, stop.depart.live) : "";
  if (arrive && depart) return `${arrive}${depart}`;
  return arrive || depart || `<span class="time">—</span>`;
}

function hasClock(slot) {
  return Boolean(slot && (slot.scheduled || slot.live));
}

function renderTransferLink(item) {
  const { leg, type } = item;
  const duration = Number.isFinite(leg.transferTime)
    ? `${leg.transferTime} min`
    : durationLabel(leg.scheduledTime?.departure, leg.scheduledTime?.arrival);
  const title = type === "metro"
    ? [leg.operator?.name || "Tube", duration].filter(Boolean).join(" · ")
    : `Walk · ${duration || "Walk"}`;
  return `<li class="itinerary-link ${type}">
    <div class="stop-times" aria-hidden="true"></div>
    <div class="itinerary-spine" aria-hidden="true"></div>
    <p class="link-title">${escapeHtml(title)}</p>
  </li>`;
}

function renderTrainLink(item) {
  const { leg, service, loading } = item;
  const operator = service?.operator || leg.operator?.name || modeLabel(leg.mode);
  const duration = durationLabel(leg.scheduledTime?.departure, leg.scheduledTime?.arrival);
  const bits = [
    operator,
    duration,
    service?.length ? `${service.length} coaches` : null,
    formatStatus(leg.realtimeClassification),
    service?.delayReason,
    service?.cancelReason,
  ].filter(Boolean);
  const bulletin = bulletinText(service?.bulletin);
  const status = loading
    ? `<p class="leg-detail">Loading train details…</p>`
    : service?.error
      ? `<p class="leg-detail error">${escapeHtml(service.error)}</p>`
      : "";

  return `<li class="itinerary-link train">
    <div class="stop-times" aria-hidden="true"></div>
    <div class="itinerary-spine" aria-hidden="true"></div>
    <div class="link-card">
      <p class="link-title">${escapeHtml(bits.join(" · "))}</p>
      ${bulletin ? `<p class="overview-alerts">${escapeHtml(bulletin)}</p>` : ""}
      ${status}
      ${service && !service.error ? renderFormation(leg, service) : ""}
    </div>
  </li>`;
}

function renderFormation(leg, service) {
  const board = crsCode(leg.board);
  const origin = (service.locations ?? []).find((location) => location.crs === board) || service.locations?.[0];
  const coaches = origin?.coaches ?? [];
  if (!coaches.length) return "";

  const exit = origin.exitSide ? `Exit ${String(origin.exitSide).toLowerCase()}` : null;

  return `<section class="formation">
    <ol class="coaches">${coaches.map(renderCoach).join("")}</ol>
    ${exit ? `<p class="formation-meta">${escapeHtml(exit)}</p>` : ""}
  </section>`;
}

function renderCoach(coach) {
  const features = coachFeatures(coach);
  const firstClass = isFirstClass(coach.coachClass);
  const accessible = features.some((feature) => /accessible toilet/i.test(feature));
  return `<li class="coach${firstClass ? " first-class" : ""}${accessible ? " accessible" : ""}">
    <span class="coach-id">${escapeHtml(String(coach.number || "?"))}</span>
    ${firstClass ? `<span class="coach-feature">First</span>` : ""}
    ${features.map((feature) => `<span class="coach-feature">${escapeHtml(feature)}</span>`).join("")}
  </li>`;
}

function isFirstClass(coachClass) {
  const value = String(knownValue(coachClass) || "");
  return /^first/i.test(value);
}

function coachFeatures(coach) {
  const features = [];
  const toilet = formatToilet(coach.toilet);
  if (toilet) features.push(toilet);

  if (knownValue(coach.isQuietCoach) === true) features.push("Quiet");

  const bikes = knownValue(coach.bikeSpaces);
  if (typeof bikes === "number" && bikes > 0) {
    features.push(bikes === 1 ? "1 bike" : `${bikes} bikes`);
  }

  const wheelchairs = knownValue(coach.wChairSpaces);
  if (typeof wheelchairs === "number" && wheelchairs > 0) {
    features.push(wheelchairs === 1 ? "1 wheelchair" : `${wheelchairs} wheelchairs`);
  }

  const loading = formatLoading(coach.loading);
  if (loading) features.push(loading);

  return features;
}

function formatToilet(toilet) {
  if (!toilet) return null;
  const type = knownValue(typeof toilet === "object" ? toilet.type : toilet);
  const status = typeof toilet === "object" ? knownValue(toilet.status) : null;
  if (!type && !status) return null;
  const label = type ? `${type} toilet` : "Toilet";
  if (!status || /^inservice$/i.test(status)) return label;
  return `${label} (${status})`;
}

function formatLoading(loading) {
  const value = knownValue(loading);
  if (value == null) return null;
  if (typeof value === "number") {
    if (value >= 1 && value <= 4 && Number.isInteger(value)) {
      return ["", "Many seats", "Some seats", "Standing", "Very busy"][value];
    }
    if (value >= 0 && value <= 100) return `${value}% full`;
    return null;
  }
  if (typeof value === "string" && !/unknown/i.test(value)) return value;
  return null;
}

function isJourneyEnd(station, journeyEnds) {
  const code = crsCode(station);
  return Boolean(code && journeyEnds && (code === journeyEnds.origin || code === journeyEnds.destination));
}

function renderStepFree(coverage, note) {
  const label = stepFreeLabel(coverage);
  const text = htmlToText(note);
  if (!label && !text) return "";
  if (!text) return `<p class="step-free">${escapeHtml(label)}</p>`;
  return `<details class="step-free">
    <summary>${escapeHtml(label || "Step-free information")}</summary>
    <p>${escapeHtml(text)}</p>
  </details>`;
}

function stepFreeLabel(coverage) {
  switch (coverage) {
    case "wholeStation":
      return "Step-free";
    case "partialStation":
      return "Partial step-free";
    case "noAccess":
    case "none":
      return "No step-free access";
    default:
      return coverage ? String(coverage) : "";
  }
}

function renderTimePair(scheduled, estimated) {
  const scheduledClock = formatClock(scheduled);
  const estimatedClock = formatClock(estimated);
  const delayed = Boolean(estimatedClock) && timesDiffer(estimated, scheduled);
  if (!delayed) {
    return `<span class="time">${escapeHtml(scheduledClock || estimatedClock || "—")}</span>`;
  }
  return `<span class="time">
    <span class="replaced">${escapeHtml(scheduledClock)}</span>
    <span class="estimated">${escapeHtml(estimatedClock)}</span>
  </span>`;
}

function renderFares(fares) {
  return `<section class="overview-fares">
    <h4>Price details</h4>
    <ul>${fares
      .map((fare) => {
        const price = formatPence(fare.totalPrice);
        const label = [fare.description, fare.fareClass].filter(Boolean).join(" · ");
        return `<li><span>${escapeHtml(label)}</span><span>${escapeHtml(price || "")}</span></li>`;
      })
      .join("")}</ul>
  </section>`;
}

function isTrain(leg) {
  return leg?.mode === "TRAIN";
}

function modeLabel(mode) {
  if (!mode) return "Service";
  return mode.charAt(0) + mode.slice(1).toLowerCase();
}

function formatStatus(value) {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function bulletinText(bulletin) {
  if (!bulletin) return "";
  if (typeof bulletin === "string") return bulletin;
  return bulletin.message || bulletin.text || bulletin.description || bulletin.title || "";
}

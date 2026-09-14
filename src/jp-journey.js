import { htmlToText } from "./format.js";

export function normalizeJpResponse(data) {
  const links = data?.links;
  if (!links || typeof links !== "object") return { outward: [], inbound: [] };
  return {
    outward: normalizeList(data?.result?.outward, links),
    inbound: normalizeList(data?.result?.return, links),
  };
}

function normalizeList(items, links) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => normalizeJpJourney(item, links)).filter(Boolean);
}

function normalizeJpJourney(item, links) {
  const journey = resolve(item?.journey, links);
  if (!journey) return null;

  const origin = stationFromPoint(firstPoint(journey.origin), links);
  const destination = stationFromPoint(firstPoint(journey.destination), links);
  const legs = (journey.legs ?? []).map((leg) => normalizeJpLeg(leg, links)).filter(Boolean);
  if (origin?.time && legs[0] && !legs[0].scheduledTime?.departure) {
    legs[0].scheduledTime = { ...legs[0].scheduledTime, departure: origin.time.scheduledTime };
    legs[0].realTime = { ...legs[0].realTime, departure: liveTime(origin.time) };
  }
  const last = legs[legs.length - 1];
  if (destination?.time && last && !last.scheduledTime?.arrival) {
    last.scheduledTime = { ...last.scheduledTime, arrival: destination.time.scheduledTime };
    last.realTime = { ...last.realTime, arrival: liveTime(destination.time) };
  }

  return {
    origin: origin?.station,
    destination: destination?.station,
    realtimeClassification: journeyStatus(journey),
    changes: journey.changes,
    scheduledTime: {
      departure: origin?.time?.scheduledTime,
      arrival: destination?.time?.scheduledTime,
    },
    realTime: {
      departure: liveTime(origin?.time),
      arrival: liveTime(destination?.time),
    },
    journeySequence: {
      legs,
      serviceBulletins: journey.bulletins ?? [],
      fares: mapFares(item, links),
    },
  };
}

function normalizeJpLeg(leg, links) {
  const board = stationFromPoint(firstPoint(leg.origin), links);
  const alight = stationFromPoint(firstPoint(leg.destination), links);
  const details = leg.serviceDetails ?? {};
  const toc = resolve(details.toc, links) ?? {};
  const mode = mapMode(details.mode);
  const depart = board?.time;
  const arrive = alight?.time;

  return {
    mode,
    board: board?.station,
    alight: alight?.station,
    originPlatform: board?.platform,
    destinationPlatform: alight?.platform,
    operator: { code: toc.code, name: toc.name },
    trainRID: details.trainRid || null,
    trainUID: details.trainUid || null,
    transferTime: leg.transferTime,
    realtimeClassification: pointStatus(depart, arrive, board, alight),
    scheduledTime: {
      departure: depart?.scheduledTime,
      arrival: arrive?.scheduledTime,
    },
    realTime: {
      departure: liveTime(depart),
      arrival: liveTime(arrive),
    },
    origins: stationCrs(details.trainOrigin, links),
    destinations: stationCrs(details.trainDestination, links),
  };
}

function mapFares(item, links) {
  const singles = (item?.fares?.singles ?? []).map((ref) => mapFare(ref, links, "single"));
  const returns = (item?.fares?.returns ?? []).map((ref) => mapFare(ref, links, "return"));
  return [...singles, ...returns].filter(Boolean);
}

function mapFare(ref, links, kind) {
  const fare = resolve(ref, links);
  if (!fare) return null;
  const ticket = resolve(fare.ticketType, links) ?? {};
  const route = resolve(fare.route, links) ?? {};
  const firstTicket = fare.tickets?.[0] ?? {};
  const isFirstClass = Boolean(
    firstTicket.isFirstClass || ticket.isFirstClass || /\bfirst\b/i.test(ticket.name || ""),
  );
  return {
    description: ticket.name || fare.category || "Ticket",
    fareClass: isFirstClass ? "First" : "",
    isFirstClass,
    kind,
    code: ticket.code || "",
    category: fare.category || "",
    route: titleCaseRoute(route.name || ""),
    totalPrice: fare.totalPrice,
  };
}

function titleCaseRoute(name) {
  const value = String(name || "").trim();
  if (!value) return "";
  if (value === value.toUpperCase()) {
    return value
      .toLowerCase()
      .replace(/\bhs1\b/g, "HS1")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return value;
}

function mapMode(mode) {
  const value = String(mode || "").toLowerCase();
  if (value === "train") return "TRAIN";
  if (value === "walk" || value === "foot") return "WALK";
  if (value === "metro" || value === "tube" || value === "underground") return "METRO";
  if (value === "bus") return "BUS";
  return value ? value.toUpperCase() : "TRAIN";
}

function journeyStatus(journey) {
  if (journey.isCancelled) return "CANCELLED";
  const delayed = [journey.origin, journey.destination].some((point) => firstPoint(point)?.time?.delayed);
  return delayed ? "DELAYED" : "ONTIME";
}

function pointStatus(depart, arrive, board, alight) {
  if (board?.cancelled || alight?.cancelled) return "CANCELLED";
  if (depart?.delayed || arrive?.delayed) return "DELAYED";
  return "ONTIME";
}

function liveTime(time) {
  if (!time) return null;
  if (time.delayed && time.adjustedTime) return time.adjustedTime;
  return null;
}

function firstPoint(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function stationFromPoint(point, links) {
  if (!point) return null;
  const raw = resolve(point.station, links) ?? {};
  const alert = htmlToText(raw.nreAlert);
  return {
    station: {
      crs: raw.crs || "",
      nlc: raw.nlc || "",
      name: raw.name || "",
      stepFreeAccessCoverage: raw.accessibilityData?.stepFreeAccessCoverage,
      stepFreeAccessNote: raw.accessibilityData?.stepFreeAccessNote,
      nreAlert: alert,
    },
    time: point.time,
    platform: point.platform,
    cancelled: point.cancelled,
  };
}

function stationCrs(ref, links) {
  const station = resolve(ref, links);
  return station?.crs ? [station.crs] : [];
}

function resolve(ref, links) {
  if (!ref) return null;
  if (typeof ref === "object") return ref;
  return links[ref] ?? null;
}

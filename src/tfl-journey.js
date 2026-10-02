import coords from "./data/station-coords.json";

// Turns a TfL Journey Planner result into Darwin-shaped services
// ({ locations: [{ crs, locationName, std, sta }] }) so the journey page can
// render, time and join Underground rides exactly like train legs.

export function stationCoords(crs) {
  const point = coords[String(crs || "").toUpperCase()];
  return Array.isArray(point) ? point : null;
}

// Prefer the Tube station named like the rail station (Charing Cross rather
// than the nearer Embankment), otherwise the closest one.
export function pickTubeStation(stopPoints, railName) {
  if (!Array.isArray(stopPoints) || !stopPoints.length) return null;
  const sorted = [...stopPoints].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  const rail = compact(railName);
  const named = rail ? sorted.find((stop) => compact(tidy(stop.commonName)) && rail.includes(compact(tidy(stop.commonName)))) : null;
  return (named || sorted[0])?.naptanId || null;
}

// Darwin and TfL both give local wall-clock ISO strings; work on the digits
// directly so no timezone conversion can shift the requested time.
export function tflDateTime(stamp, offsetMinutes = 0) {
  const match = String(stamp || "").match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match.map(Number);
  const when = new Date(Date.UTC(y, m - 1, d, hh, mm + offsetMinutes));
  const pad = (value) => String(value).padStart(2, "0");
  return {
    date: `${when.getUTCFullYear()}${pad(when.getUTCMonth() + 1)}${pad(when.getUTCDate())}`,
    time: `${pad(when.getUTCHours())}${pad(when.getUTCMinutes())}`,
  };
}

// Returns { service, rides }: `service` spans the whole Underground leg (used for
// timing against neighbouring trains); `rides` holds one leg per Tube train,
// plus any walks TfL puts between them, for rendering.
export function tubeJourney(data, leg, { timeIs = "Departing" } = {}) {
  const journey = pickJourney(data?.journeys, timeIs);
  if (!journey) return null;
  const parts = (journey.legs ?? []).filter((part) => ["tube", "walking"].includes(part?.mode?.id));
  const firstTube = parts.findIndex((part) => part.mode.id === "tube");
  const lastTube = parts.findLastIndex((part) => part.mode.id === "tube");
  if (firstTube < 0) return null;

  const rides = parts.slice(firstTube, lastTube + 1).map((part) =>
    part.mode.id === "tube" ? tubeRide(part) : walkRide(part),
  );
  const first = parts[firstTube];
  const last = parts[lastTube];

  return {
    service: {
      operator: "London Underground",
      operatorCode: "LT",
      locations: [
        { crs: leg.origin, locationName: tidy(first.departurePoint?.commonName), std: first.departureTime },
        { crs: leg.destination, locationName: tidy(last.arrivalPoint?.commonName), sta: last.arrivalTime },
      ],
    },
    rides,
  };
}

function tubeRide(part) {
  const line = lineLabel(part.routeOptions?.[0]?.name);
  const direction = towards(part);
  const boardId = pointId(part.departurePoint);
  const alightId = pointId(part.arrivalPoint);
  const boardName = tidy(part.departurePoint?.commonName);
  const alightName = tidy(part.arrivalPoint?.commonName);
  const via = (part.path?.stopPoints ?? [])
    .map((stop) => tidy(stop.name))
    .filter((name) => name && name !== boardName && name !== alightName)
    .map((name) => ({ crs: "", locationName: name, untimed: true }));

  return {
    leg: {
      mode: "metro",
      origin: boardId,
      destination: alightId,
      originName: boardName,
      destinationName: alightName,
    },
    service: {
      operator: "London Underground",
      operatorCode: "LT",
      tubeSummary: direction ? `${line} towards ${direction}` : line,
      bulletin: disruptionText(part),
      locations: [
        { crs: boardId, locationName: boardName, std: part.departureTime, platform: platformOf(part.departurePoint) },
        ...via,
        { crs: alightId, locationName: alightName, sta: part.arrivalTime, platform: platformOf(part.arrivalPoint) },
      ],
    },
    error: null,
  };
}

function walkRide(part) {
  const fromName = tidy(part.departurePoint?.commonName);
  const toName = tidy(part.arrivalPoint?.commonName);
  const origin = pointId(part.departurePoint);
  const destination = pointId(part.arrivalPoint);
  const metres = Number(part.distance);
  return {
    leg: {
      mode: "walk",
      origin,
      destination,
      originName: fromName,
      destinationName: toName,
      mapsOrigin: part.departurePoint?.commonName || fromName,
      mapsDestination: part.arrivalPoint?.commonName || toName,
      walk: Number.isFinite(part.duration)
        ? { minutes: part.duration, miles: Number.isFinite(metres) && metres > 0 ? metres / 1609.344 : undefined }
        : null,
    },
    service: {
      locations: [
        { crs: origin, locationName: fromName, std: part.departureTime },
        { crs: destination, locationName: toName, sta: part.arrivalTime },
      ],
    },
    error: null,
  };
}

function pickJourney(journeys, timeIs) {
  if (!Array.isArray(journeys) || !journeys.length) return null;
  const rideable = journeys.filter((journey) => (journey.legs ?? []).some((part) => part?.mode?.id === "tube"));
  if (!rideable.length) return null;
  const key = timeIs === "Arriving" ? "startDateTime" : "arrivalDateTime";
  const sorted = [...rideable].sort((a, b) => Date.parse(a[key]) - Date.parse(b[key]));
  // Departing: earliest arrival. Arriving: latest departure.
  return timeIs === "Arriving" ? sorted[sorted.length - 1] : sorted[0];
}

function disruptionText(part) {
  if (!part.isDisrupted) return null;
  const notes = (part.disruptions ?? []).map((item) => String(item?.description || "").trim()).filter(Boolean);
  return [...new Set(notes)].join(" ") || null;
}

function pointId(point) {
  return String(point?.naptanId || point?.icsCode || tidy(point?.commonName) || "").toUpperCase();
}

// TfL platform names look like "Westbound - Platform 2"; keep just the number.
function platformOf(point) {
  return String(point?.platformName || "").match(/platform\s*(\w+)/i)?.[1] || "";
}

function towards(part) {
  const direction = part.routeOptions?.[0]?.directions?.[0] || "";
  const fromInstruction = String(part.instruction?.detailed || "").match(/towards (.+)$/i)?.[1] || "";
  return tidy(direction || fromInstruction).replace(/\s+\(.*\)$/, "");
}

function lineLabel(line) {
  const name = String(line || "").trim();
  if (!name) return "Underground";
  return /line$/i.test(name) || /^DLR$/i.test(name) ? name : `${name} line`;
}

function tidy(name) {
  return String(name || "")
    .replace(/\s+(Underground )?Station$/i, "")
    .replace(/-Underground$/i, "")
    .replace(/\s+\(.*Line\)$/i, "")
    .trim();
}

function compact(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/\bst\.?\b/g, "street")
    .replace(/[^a-z0-9]+/g, "");
}

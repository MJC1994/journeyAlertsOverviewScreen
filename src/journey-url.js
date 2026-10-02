import { crsCode } from "./format.js";

const JOURNEY_ROOT = "/journey";

export function journeyHref(journey, { stadium = "" } = {}) {
  const legs = legsFromJourney(journey);
  if (!legs.length) return null;
  const query = stadium ? `?${new URLSearchParams({ stadium })}` : "";
  return `${JOURNEY_ROOT}/${legs.map(encodeLegSegment).join("/")}${query}`;
}

export function legsFromJourney(journey) {
  return (journey?.journeySequence?.legs ?? [])
    .map((leg) => {
      const origin = crsCode(leg.board).toUpperCase();
      const destination = crsCode(leg.alight).toUpperCase();
      if (!origin || !destination) return null;
      return {
        rid: darwinRid(leg.trainRID),
        mode: String(leg.mode || "train").toLowerCase(),
        origin,
        destination,
      };
    })
    .filter(Boolean);
}

export function parseJourneyPath(pathname = window.location.pathname) {
  const raw = decodeURIComponent(pathname)
    .replace(/\/+$/, "")
    .replace(new RegExp(`^${JOURNEY_ROOT}/?`, "i"), "");
  if (!raw || raw === "index.html") return [];
  return raw.split("/").map(parseLegSegment).filter(Boolean);
}

export function darwinRid(value) {
  const rid = String(value || "");
  return /^\d{10,}$/.test(rid) ? rid : null;
}

function encodeLegSegment(leg) {
  const id = leg.rid || leg.mode || "leg";
  return `${id}-${leg.origin}-${leg.destination}`;
}

function parseLegSegment(segment) {
  const match = String(segment).match(/^([A-Za-z0-9]+)-([A-Za-z]{3})-([A-Za-z]{3})$/);
  if (!match) return null;
  const rid = darwinRid(match[1]);
  return {
    rid,
    mode: rid ? "train" : match[1].toLowerCase(),
    origin: match[2].toUpperCase(),
    destination: match[3].toUpperCase(),
  };
}

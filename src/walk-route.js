import coords from "./data/station-coords.json";

// Valhalla's public OpenStreetMap server: free, keyless, fair use only.
const VALHALLA_ROUTE = "https://valhalla1.openstreetmap.de/route";

const cache = new Map();

export function stationPoint(crs) {
  const point = coords[String(crs || "").toUpperCase()];
  return Array.isArray(point) ? point : null;
}

export function walkRoute([fromLat, fromLon], [toLat, toLon]) {
  const key = [fromLat, fromLon, toLat, toLon].join(",");
  if (!cache.has(key)) {
    cache.set(key, requestWalk(fromLat, fromLon, toLat, toLon).catch((error) => {
      cache.delete(key);
      throw error;
    }));
  }
  return cache.get(key);
}

async function requestWalk(fromLat, fromLon, toLat, toLon) {
  const query = {
    locations: [
      { lat: fromLat, lon: fromLon },
      { lat: toLat, lon: toLon },
    ],
    costing: "pedestrian",
    units: "miles",
    directions_type: "none",
  };
  const response = await fetch(`${VALHALLA_ROUTE}?json=${encodeURIComponent(JSON.stringify(query))}`);
  if (!response.ok) throw new Error(`Walking route failed (${response.status}).`);
  const summary = (await response.json())?.trip?.summary;
  if (!Number.isFinite(summary?.time) || !Number.isFinite(summary?.length)) {
    throw new Error("Walking route returned an unexpected response.");
  }
  return {
    minutes: Math.max(1, Math.round(summary.time / 60)),
    miles: summary.length,
  };
}

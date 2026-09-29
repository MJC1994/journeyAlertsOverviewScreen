import { stationSearch } from "fuzzy-stations";
import coordsByCrs from "./data/station-coords.json";

const EARTH_KM = 6371;
let cachedPosition = null;
let locatePromise = null;

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function getCachedPosition() {
  return cachedPosition;
}

export function requestUserPosition() {
  if (cachedPosition) return Promise.resolve(cachedPosition);
  if (locatePromise) return locatePromise;
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Location is not supported in this browser."));
  }

  locatePromise = new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        cachedPosition = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        resolve(cachedPosition);
      },
      (error) => {
        locatePromise = null;
        reject(error);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });

  return locatePromise;
}

export function nearestStations(position, { limit = 5 } = {}) {
  if (!position) return [];
  const ranked = [];
  for (const [crs, pair] of Object.entries(coordsByCrs)) {
    const station = stationSearch.findByCrs(crs);
    if (!station?.nlc) continue;
    const [lat, lon] = pair;
    const km = distanceKm(position, { lat, lon });
    ranked.push({ station, km });
  }
  ranked.sort((a, b) => a.km - b.km);
  return ranked.slice(0, limit);
}

export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

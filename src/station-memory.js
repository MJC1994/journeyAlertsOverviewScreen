import { stationSearch } from "fuzzy-stations";

const STORAGE_KEY = "journey.stationMemory.v1";
const MAX_RECENT = 5;

const DEMO_HOME_CRS = "SUR"; // Surbiton
const DEMO_WORK_CRS = "LBG"; // London Bridge

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function write(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function stationFromSaved(saved) {
  if (!saved?.nlc && !saved?.crs) return null;
  const byNlc = saved.nlc ? stationSearch.findByNlc(String(saved.nlc)) : null;
  const byCrs = saved.crs ? stationSearch.findByCrs(String(saved.crs)) : null;
  const station = byNlc || byCrs;
  if (!station?.nlc) return null;
  return station;
}

function ensureSeeded() {
  const data = read();
  let changed = false;
  if (!data.home) {
    const home = stationSearch.findByCrs(DEMO_HOME_CRS);
    if (home?.nlc) {
      data.home = { nlc: home.nlc, crs: home.crs, name: home.name };
      changed = true;
    }
  }
  if (!data.work) {
    const work = stationSearch.findByCrs(DEMO_WORK_CRS);
    if (work?.nlc) {
      data.work = { nlc: work.nlc, crs: work.crs, name: work.name };
      changed = true;
    }
  }
  if (!Array.isArray(data.recent)) {
    data.recent = [];
    changed = true;
  }
  if (changed) write(data);
  return data;
}

export function getHomeStation() {
  return stationFromSaved(ensureSeeded().home);
}

export function getWorkStation() {
  return stationFromSaved(ensureSeeded().work);
}

export function getRecentStations() {
  return ensureSeeded()
    .recent.map(stationFromSaved)
    .filter(Boolean)
    .filter((station, index, list) => list.findIndex((item) => item.nlc === station.nlc) === index)
    .slice(0, MAX_RECENT);
}

export function rememberStation(station) {
  if (!station?.nlc) return;
  const data = ensureSeeded();
  const entry = { nlc: station.nlc, crs: station.crs, name: station.name };
  data.recent = [entry, ...(data.recent || []).filter((item) => item.nlc !== station.nlc)].slice(0, MAX_RECENT);
  write(data);
}

export function setHomeStation(station) {
  if (!station?.nlc) return;
  const data = ensureSeeded();
  data.home = { nlc: station.nlc, crs: station.crs, name: station.name };
  write(data);
}

export function setWorkStation(station) {
  if (!station?.nlc) return;
  const data = ensureSeeded();
  data.work = { nlc: station.nlc, crs: station.crs, name: station.name };
  write(data);
}

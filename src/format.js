import { stationSearch } from "fuzzy-stations";

export function formatClock(value) {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : text;
}

export function durationLabel(depart, arrive) {
  const start = Date.parse(depart);
  const end = Date.parse(arrive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const minutes = Math.round((end - start) / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function crsCode(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.crs || "";
}

export function stationName(value) {
  if (value && typeof value === "object" && value.name) {
    return tidyStationName(value.name);
  }
  const code = crsCode(value);
  if (!code) {
    if (value && typeof value === "object") {
      return tidyStationName(value.name || value.locationName || "");
    }
    return typeof value === "string" ? tidyStationName(value) : "";
  }
  if (code.length === 3) {
    return tidyStationName(stationSearch.findByCrs(code)?.name ?? code);
  }
  return tidyStationName(stationSearch.findByNlc(code)?.name ?? code);
}

function tidyStationName(name) {
  return String(name || "")
    .replace(/\s+\((?:low|high) level\)$/i, "")
    .replace(/\s+(Ll|Hl)$/i, "")
    .trim();
}

export function knownValue(value, depth = 0) {
  if (value == null || value === "") return null;
  if (depth > 4) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || /^(unknown|null|undefined|n\/a|none)$/i.test(text)) return null;
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    return text;
  }
  if (Array.isArray(value)) return knownValue(value[0], depth + 1);
  if (typeof value === "object") {
    for (const key of ["value", "count", "number", "percentage", "percent", "loading", "spaces", "amount"]) {
      if (key in value) {
        const inner = knownValue(value[key], depth + 1);
        if (inner != null) return inner;
      }
    }
    return null;
  }
  return null;
}

export function timesDiffer(left, right) {
  const a = formatClock(left);
  const b = formatClock(right);
  return Boolean(a && b && a !== b);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function htmlToText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPence(value) {
  if (typeof value !== "number") return "";
  return `£${(value / 100).toFixed(2)}`;
}

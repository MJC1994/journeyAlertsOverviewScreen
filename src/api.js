const ACCESS_TOKEN = "otrl|a6af56be1691ac2929898c9f68c4b49a0a2d930849770dba976be5d792a";
const DEVICE_FINGERPRINT = "dfp-v1-2bc4vq64c0w-2g26h3a4zmd";

export function jpHeaders() {
  return {
    accept: "application/json",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    "content-type": "application/json",
    pragma: "no-cache",
    "x-access-token": ACCESS_TOKEN,
    "x-device-fingerprint": DEVICE_FINGERPRINT,
    "x-trace-token": `booking-engine@/${crypto.randomUUID().replaceAll("-", "")}`,
  };
}

export function journeyPlanPayload({
  origin,
  destination,
  outward,
  inbound,
  openReturn = false,
  adults = 1,
  children = 0,
  railcards = [],
  via = [],
  avoid = [],
}) {
  const payload = {
    origin: String(origin),
    destination: String(destination),
    outward,
    openReturn: Boolean(openReturn),
    adults,
    children,
    disableGroupSavings: true,
    numJourneys: 5,
    showCheapest: false,
    doRealTime: true,
    keepAllZoneFares: false,
    filterFares: true,
    delayRepayFiltering: false,
    isAmending: false,
    orderId: null,
    preferences: { loadEarlier: true },
    channel: "web",
  };
  if (inbound) payload.return = inbound;
  if (railcards.length) payload.railcards = railcards;
  if (via.length) payload.preferences.via = via.map(String);
  if (avoid.length) payload.preferences.avoid = avoid.map(String);
  return payload;
}

export async function planJourneys(payload) {
  const response = await fetch("/jp/journey-plan", {
    method: "POST",
    headers: jpHeaders(),
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message =
      data?.message || data?.error || data?.title || `Journey search failed (${response.status}).`;
    throw new Error(message);
  }
  if (!data || typeof data !== "object") {
    throw new Error("Journey search returned an unexpected response.");
  }
  return data;
}

export async function fetchService(rid) {
  const response = await fetch(`/departure-boards/service/${encodeURIComponent(rid)}`);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.message || data?.error || `Service lookup failed (${response.status}).`;
    throw new Error(message);
  }
  if (!data || typeof data !== "object") {
    throw new Error("Service lookup returned an unexpected response.");
  }
  return data;
}

export async function fetchTubeJourney({ from, to, date, time, timeIs = "Departing" }) {
  const params = new URLSearchParams({ mode: "tube,walking", timeIs, journeyPreference: "LeastTime" });
  if (date) params.set("date", date);
  if (time) params.set("time", time);
  const place = (value) => (Array.isArray(value) ? value.join(",") : String(value));
  return fetchTfl(`/tfl/Journey/JourneyResults/${place(from)}/to/${place(to)}?${params.toString()}`);
}

export async function fetchTubeStations([lat, lon]) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    stopTypes: "NaptanMetroStation",
    modes: "tube",
    radius: "600",
  });
  const data = await fetchTfl(`/tfl/StopPoint?${params.toString()}`);
  return data.stopPoints ?? [];
}

async function fetchTfl(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.message || `Underground lookup failed (${response.status}).`);
  }
  if (!data || typeof data !== "object") {
    throw new Error("Underground lookup returned an unexpected response.");
  }
  return data;
}

const UPSTREAM = "https://api.tfl.gov.uk";
const PLACE = String.raw`(?:-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?|940GZZ[A-Z0-9]+)`;
const ROUTES = [
  {
    path: new RegExp(`^Journey/JourneyResults/${PLACE}/to/${PLACE}$`),
    params: ["mode", "timeIs", "date", "time", "journeyPreference"],
  },
  {
    path: /^StopPoint$/,
    params: ["lat", "lon", "stopTypes", "modes", "radius"],
  },
];

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "access-control-allow-origin": "*" } };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Only journey and nearby-station lookups for Underground legs; this is not an open TfL proxy.
  const path = String(event.path || "").replace(/^.*?\/(?:tfl|tfl-journey)\//, "");
  const route = ROUTES.find((item) => item.path.test(path));
  if (!route) {
    return { statusCode: 400, body: JSON.stringify({ message: "Unsupported TfL request." }) };
  }

  const query = new URLSearchParams();
  for (const name of route.params) {
    const value = event.queryStringParameters?.[name];
    if (value) query.set(name, value);
  }
  if (process.env.TFL_APP_KEY) query.set("app_key", process.env.TFL_APP_KEY);

  const response = await fetch(`${UPSTREAM}/${path}?${query.toString()}`, {
    headers: { accept: "application/json" },
  });

  return {
    statusCode: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
    body: await response.text(),
  };
}

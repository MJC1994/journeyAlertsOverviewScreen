const UPSTREAM = "https://api.southeasternrailway.co.uk/jp/journey-plan";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "access-control-allow-origin": "*" } };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const incoming = event.headers || {};
  const header = (name) => incoming[name] || incoming[name.toLowerCase()] || "";
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body;

  const response = await fetch(UPSTREAM, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: "https://tickets.southeasternrailway.co.uk",
      referer: "https://tickets.southeasternrailway.co.uk/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
      "x-access-token": header("x-access-token"),
      "x-device-fingerprint": header("x-device-fingerprint"),
      "x-trace-token": header("x-trace-token"),
    },
    body,
  });

  return {
    statusCode: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
    body: await response.text(),
  };
}

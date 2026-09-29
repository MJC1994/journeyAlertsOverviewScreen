const UPSTREAM = "https://api.southeasternrailway.co.uk/departure-boards/service";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "access-control-allow-origin": "*" } };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const rid = event.queryStringParameters?.rid || "";
  if (!/^\d{10,}$/.test(rid)) {
    return { statusCode: 400, body: JSON.stringify({ message: "Missing train RID." }) };
  }

  const response = await fetch(`${UPSTREAM}/${encodeURIComponent(rid)}`, {
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://widgets.otrl.io",
      referer: "https://widgets.otrl.io/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    },
  });

  return {
    statusCode: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
    body: await response.text(),
  };
}

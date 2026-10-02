const UPSTREAM = "https://api.southeasternrailway.co.uk/departure-boards/service";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "access-control-allow-origin": "*" } };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const rid = String(event.path || "").match(/(\d{10,})\/?$/)?.[1];
  if (!rid) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Missing train RID." }),
    };
  }

  const response = await fetch(`${UPSTREAM}/${rid}`, {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      origin: "https://widgets.otrl.io",
      pragma: "no-cache",
      referer: "https://widgets.otrl.io/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    },
  });

  return {
    statusCode: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
    body: await response.text(),
  };
}

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

function southeasternProxy(headers) {
  return {
    target: "https://api.southeasternrailway.co.uk",
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq) => {
        for (const [name, value] of Object.entries(headers)) {
          proxyReq.setHeader(name, value);
        }
      });
    },
  };
}

function rewriteJourneyPage() {
  return {
    name: "rewrite-journey-page",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = req.url?.split("?")[0] || "";
        if (path === "/journey" || (path.startsWith("/journey/") && path !== "/journey/index.html")) {
          req.url = "/journey/index.html";
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = req.url?.split("?")[0] || "";
        if (path === "/journey" || (path.startsWith("/journey/") && path !== "/journey/index.html")) {
          req.url = "/journey/index.html";
        }
        next();
      });
    },
  };
}

const jpHeaders = {
  Origin: "https://tickets.southeasternrailway.co.uk",
  Referer: "https://tickets.southeasternrailway.co.uk/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
};

const boardsHeaders = {
  Origin: "https://widgets.otrl.io",
  Referer: "https://widgets.otrl.io/",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
};

// TfL Journey Planner. Set TFL_APP_KEY in your shell to use a registered key in dev.
function tflProxy() {
  const key = process.env.TFL_APP_KEY;
  return {
    target: "https://api.tfl.gov.uk",
    changeOrigin: true,
    rewrite: (path) => {
      const next = path.replace(/^\/tfl/, "");
      return key ? `${next}${next.includes("?") ? "&" : "?"}app_key=${encodeURIComponent(key)}` : next;
    },
  };
}

export default defineConfig({
  plugins: [rewriteJourneyPage()],
  server: {
    proxy: {
      "/jp": southeasternProxy(jpHeaders),
      "/departure-boards": southeasternProxy(boardsHeaders),
      "/tfl": tflProxy(),
    },
  },
  preview: {
    proxy: {
      "/jp": southeasternProxy(jpHeaders),
      "/departure-boards": southeasternProxy(boardsHeaders),
      "/tfl": tflProxy(),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        journey: resolve(root, "journey/index.html"),
        v2: resolve(root, "v2/index.html"),
        v3: resolve(root, "v3/index.html"),
      },
    },
  },
});

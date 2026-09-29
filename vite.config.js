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
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
};

export default defineConfig({
  plugins: [rewriteJourneyPage()],
  server: {
    proxy: {
      "/jp": southeasternProxy(jpHeaders),
      "/departure-boards": southeasternProxy(boardsHeaders),
    },
  },
  preview: {
    proxy: {
      "/jp": southeasternProxy(jpHeaders),
      "/departure-boards": southeasternProxy(boardsHeaders),
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

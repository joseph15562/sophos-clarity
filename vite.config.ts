import { defineConfig, type Plugin } from "vite";
import { execSync } from "child_process";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const DEV_PORT = 8080;

/**
 * Cursor’s Simple Browser often opens `http://127.0.0.1:8080`, while Safari uses
 * `http://localhost:8080`. Browsers treat those as different origins, so Supabase session and
 * localStorage (e.g. mission-alerts cache) diverge — Mission control can show stale “months ago”.
 * Redirect loopback hostnames to `localhost` so every local tool shares one origin.
 */
function devRedirectLoopbackToLocalhost(): Plugin {
  return {
    name: "dev-redirect-loopback-to-localhost",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const host = req.headers.host?.toLowerCase() ?? "";
        const hostOnly =
          host.includes(":") && host.startsWith("[")
            ? host.slice(0, host.indexOf("]") + 1)
            : (host.split(":")[0] ?? "");
        const isIPv4Loopback = /^127(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/.test(hostOnly);
        const isIPv6Loopback = host === "[::1]" || host.startsWith("[::1]:");
        const isLoopback = isIPv4Loopback || isIPv6Loopback;
        if (!isLoopback) {
          next();
          return;
        }
        const port = server.config.server.port ?? DEV_PORT;
        const pathAndQuery = req.url ?? "/";
        const location = `http://localhost:${port}${pathAndQuery}`;
        res.statusCode = 302;
        res.setHeader("Location", location);
        res.end();
      });
    },
  };
}

/** Prevent identity bypass from being baked into Vercel Production bundles (mis-set env vars). */
function assertE2eBypassNotOnVercelProduction(): void {
  if (process.env.VITE_E2E_AUTH_BYPASS !== "1") return;
  if (process.env.VERCEL !== "1") return;
  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "[security] VITE_E2E_AUTH_BYPASS must not be set for Vercel Production. Remove it from Production environment variables. CI and local preview use non-Vercel builders or Preview.",
    );
  }
}

/** PDF download test mode must not ship to Vercel Production (extra pdfmake path). */
function assertE2ePdfDownloadNotOnVercelProduction(): void {
  if (process.env.VITE_E2E_PDF_DOWNLOAD !== "1") return;
  if (process.env.VERCEL !== "1") return;
  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "[security] VITE_E2E_PDF_DOWNLOAD must not be set for Vercel Production. Use only in CI / local E2E builds.",
    );
  }
}

function gitVersion(): string {
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION;
  try {
    return execSync("git describe --tags --always --dirty", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig(() => {
  assertE2eBypassNotOnVercelProduction();
  assertE2ePdfDownloadNotOnVercelProduction();
  const appVersion = gitVersion();
  return {
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    },
    server: {
      host: "::",
      port: DEV_PORT,
      hmr: {
        overlay: false,
      },
      /** Same path as Vercel rewrite — changelog advisories when Edge Function is unavailable. */
      proxy: {
        "/api/sophos-advisories-feed": {
          target: "https://www.sophos.com",
          changeOrigin: true,
          rewrite: () => "/en-us/security-advisories/feed",
        },
      },
    },
    plugins: [devRedirectLoopbackToLocalhost(), react()],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-radix": [
              "@radix-ui/react-accordion",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-tooltip",
            ],
            "vendor-recharts": ["recharts"],
            "vendor-supabase": ["@supabase/supabase-js"],
            "vendor-docx": ["docx", "file-saver"],
            "vendor-archive": ["jszip", "pptxgenjs"],
            "vendor-pdfmake": ["pdfmake"],
            "vendor-html-to-image": ["html-to-image"],
          },
        },
      },
    },
  };
});

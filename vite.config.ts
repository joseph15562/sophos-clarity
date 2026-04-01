import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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

export default defineConfig(() => {
  assertE2eBypassNotOnVercelProduction();
  assertE2ePdfDownloadNotOnVercelProduction();
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
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

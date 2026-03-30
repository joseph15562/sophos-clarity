import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initSentry } from "./init-sentry";
import "./index.css";
import "./styles/driver-theme.css";

/** After a deploy, lazy chunks may 404 until HTML is revalidated — reload once per tab session. */
const CHUNK_RELOAD_KEY = "sophos-fc-chunk-reload-done";
function installStaleChunkReloadRecovery(): void {
  const handler = (ev: PromiseRejectionEvent) => {
    const r = ev.reason;
    const msg = typeof r?.message === "string" ? r.message : String(r ?? "");
    if (!/module script failed|dynamically imported module|loading chunk/i.test(msg)) return;
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    } catch {
      return;
    }
    ev.preventDefault();
    window.location.reload();
  };
  window.addEventListener("unhandledrejection", handler);
}

installStaleChunkReloadRecovery();

initSentry();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

createRoot(rootEl).render(<App />);

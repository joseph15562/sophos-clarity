import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/driver-theme.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

// #region agent log
fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
  body: JSON.stringify({
    sessionId: "360061",
    runId: "post-fix",
    hypothesisId: "H-dedupe",
    location: "main.tsx:bootstrap",
    message: "static App import; about to createRoot",
    data: {
      href: typeof window !== "undefined" ? window.location.href : "",
      viteDev: import.meta.env.DEV,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

createRoot(rootEl).render(<App />);

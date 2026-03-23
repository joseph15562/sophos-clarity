import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/driver-theme.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

createRoot(rootEl).render(<App />);

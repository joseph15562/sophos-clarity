/**
 * k6 smoke template — Tier 3 backlog.
 *
 * Run: BASE_URL=https://your-app.example/ k6 run scripts/k6/smoke.js
 * Uses a single GET; tune thresholds once you have a stable public health URL.
 */
import http from "k6/http";
import { check, sleep } from "k6";

const base = __ENV.BASE_URL;

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.5"],
  },
};

export default function () {
  if (!base) return;
  const res = http.get(base, { timeout: "15s", tags: { name: "smoke" } });
  check(res, { "status < 500": (r) => r.status < 500 });
  sleep(1);
}

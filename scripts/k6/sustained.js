/**
 * Sustained light load — optional CI / staging gate (Tier 3).
 *
 * Run: BASE_URL=https://your-app.example/ k6 run scripts/k6/sustained.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const base = __ENV.BASE_URL;

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 10 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.1"],
    http_req_duration: ["p(95)<5000"],
  },
};

export default function () {
  if (!base) return;
  const res = http.get(base, { timeout: "20s", tags: { name: "sustained_home" } });
  check(res, { "status < 500": (r) => r.status < 500 });
  sleep(0.5 + Math.random() * 0.5);
}

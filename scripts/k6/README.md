# k6 load scripts

| Script                         | Purpose                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| [`smoke.js`](smoke.js)         | Single VU, 30s — sanity check `BASE_URL` responds.                                           |
| [`sustained.js`](sustained.js) | Ramp to 10 VUs over ~2m — light sustained load; stricter `http_req_failed` / p95 thresholds. |

```bash
BASE_URL=https://your-staging.example/ k6 run scripts/k6/smoke.js
BASE_URL=https://your-staging.example/ k6 run scripts/k6/sustained.js
```

## Optional CI gate

Repo workflow **[`.github/workflows/k6-sustained.yml`](../../.github/workflows/k6-sustained.yml)** runs on `workflow_dispatch` and on pushes that touch `scripts/k6/**`, **only when** repository variable **`K6_BASE_URL`** is set (staging preview URL).

Do not point k6 at production without explicit approval and rate limits.

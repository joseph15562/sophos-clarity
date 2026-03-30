# PDF generation — client bundle ceiling (753)

Executive / compliance PDFs today are built in the browser with **pdfmake** loaded via **dynamic `import()`** so the main route chunk stays smaller until the user exports. The pdfmake vendor chunk is still on the order of **~2 MB** — acceptable for MSP workstations but a hard ceiling for mobile and strict CSP environments.

## Server-side PDF (future product decision)

Moving PDF bytes to an **Edge function** (or dedicated worker) would:

- Remove the large client dependency for first interactive paint.
- Allow consistent fonts, headers, and watermarks server-side.
- Shift cost to compute and timeouts (Fluid Compute limits, payload size).

Ship server PDF only when product commits to: storage of generated artifacts (optional), auth for download links, and regression tests for layout parity with the current client template.

## Until then

- Keep **lazy** pdfmake import on health-check / report export paths.
- Document for integrators that **Playwright** PDF assertions today use a **print stub** (see `docs/TEST-PLAN-TIER2-BACKLOG.md`), not byte-for-byte PDF verification.

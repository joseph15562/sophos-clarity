# Bundle size & Lighthouse (Phase G notes)

- **Bundle budget:** add a CI step that fails when `dist/assets/*.js` exceeds agreed limits (e.g. `find dist/assets -name '*.js' -size +2M`) or integrate `rollup-plugin-visualizer` locally before releases. The largest movable cost remains **pdfmake** until server PDF ships ([pdf-generation-client-ceiling.md](pdf-generation-client-ceiling.md)).
- **Lighthouse:** run **Lighthouse CI** or **Unlighthouse** against `/`, `/command`, and `/health-check` on preview builds; store HTML reports as CI artifacts. Treat as a **regression guard**, not a release gate, until budgets are stable.

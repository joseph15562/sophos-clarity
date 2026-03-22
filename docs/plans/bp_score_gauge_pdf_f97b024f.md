---
name: BP score gauge PDF
overview: Add Sophos Licence Selection and Best Practice Score sections to the SE Health Check PDF, including a canvas-rendered circular gauge, summary counts, per-category breakdown, and licence tier display.
todos:
  - id: licence-section
    content: Add buildLicenceSection(licence) showing selected tier (Standard / Xstream / Individual) and active module names
    status: completed
  - id: gauge-renderer
    content: Add renderScoreGaugePng(score, grade) using Canvas 2D API to draw circular gauge and return base64 PNG
    status: completed
  - id: bp-section
    content: Add buildBPScoreSection(bp) that builds gauge image + summary counts + category table as pdfmake Content
    status: completed
  - id: wire-exec
    content: Insert licence section and BP score section into Executive Summary per-firewall loop
    status: completed
isProject: false
---

# Add Licence Selection and Best Practice Score to PDF

## Approach

Add two new visual sections in the Executive Summary (per firewall) in `[src/lib/se-health-check-pdfmake.ts](src/lib/se-health-check-pdfmake.ts)`:

1. **Sophos Licence Selection** — shows the selected tier and active modules
2. **Sophos Best Practice Score** — circular gauge, summary counts, category breakdown

## Implementation

### 1. Licence Selection section

Add `buildLicenceSection(licence)` matching the UI screenshot layout:

- Heading: "Sophos Licence Selection" (using existing `h4` helper)
- Three-column table row showing all tiers as "cards": Standard Protection, Xstream Protection, Individual Modules — each with title (bold) and blurb text
- The selected tier's cell gets a colored left border or bold accent to distinguish it from the others
- Below the cards: a row of active module names (e.g. "Network Protection  ·  Web Protection  ·  ...") in a smaller font

Reuse `TIER_CARD_COPY` pattern from `[src/lib/se-health-check-report-html.ts](src/lib/se-health-check-report-html.ts)` (define the same constant locally in the pdfmake file). Data: `params.licence`, `getActiveModules()`, `MODULES` from `[src/lib/sophos-licence.ts](src/lib/sophos-licence.ts)`.

### 2. Gauge ring renderer

Add `renderScoreGaugePng(score, grade)` that:

- Creates an offscreen `HTMLCanvasElement` (240x240px)
- Draws a light-gray track circle (stroke, no fill)
- Draws a colored arc from 12-o'clock, proportional to `score / 100`, using grade-based colors
- Renders score number centered (bold) and "Grade X" below
- Returns `data:image/png;base64,...` string

Grade colors: A/B = `#34d399`, C = `#fbbf24`, D = `#f97316`, F = `#ef4444`

### 3. BP Score section

Add `buildBPScoreSection(bp)` that builds:

- Heading: "Sophos Best Practice Score"
- Gauge image + four summary count columns (Passed, Failed, Verify, N/A) side by side via pdfmake `columns`
- Category breakdown table grouped from `bp.results` by `check.category`, showing: Category, Checks, Failed, Passed ratio

### 4. Wire into Executive Summary

In the per-firewall loop, after the firewall `h3` heading, insert:

1. Licence section
2. BP score section (gauge + summary + categories)
3. Keep existing severity counts table and priority next steps

### Files changed

- `[src/lib/se-health-check-pdfmake.ts](src/lib/se-health-check-pdfmake.ts)` — add licence section, gauge renderer, BP score section, wire into executive summary


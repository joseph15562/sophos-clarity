---
name: Report export polish
overview: Fix MSP assessment report PDF/Word export layout (logo sizing, dense recommendation tables) by making print HTML self-contained and tightening docx table behavior; keep PDF and Word in horizontal (landscape) orientation; clarify SE Health Check positioning.
todos:
  - id: landscape-verify
    content: Confirm PDF @page A4 landscape + Word LANDSCAPE remain default; set pdfmake E2E path to landscape; document if browser print dialog can still override
    status: pending
  - id: pdf-print-css
    content: Add print-safe CSS + branding img class in buildPdfHtml / DocumentPreview; optional hide duplicate body branding when header has logo
    status: pending
  - id: pdf-tables
    content: Tune print table breaks / wide-table thresholds in report-export.ts prepPrintLayout + @media print
    status: pending
  - id: word-tables
    content: Adjust buildDocxTable column layout (heuristic widths or AUTOFIT vs FIXED) and cell margins for high column counts (within landscape section)
    status: pending
  - id: se-copy
    content: "Optional: refine HealthCheckInnerHeader subtitle for “snapshot” wording; align SEAuthGate line if needed"
    status: pending
  - id: changelog
    content: "If shipping: ChangelogPage + platform-update-highlights"
    status: pending
---

# Report export polish and SE Health Check positioning

## Horizontal pages (Word + PDF) — requirement

**Product requirement:** Firewall configuration report exports use **horizontal (landscape)** pages for both **PDF** (print-to-PDF) and **Word**.

**Current implementation (MSP markdown reports):**

- **PDF:** [`buildPdfHtml`](src/lib/report-export.ts) already sets `@media print { @page { size: A4 landscape; margin: … } }` so the browser print pipeline targets landscape.
- **Word:** [`generateWordBlob`](src/lib/report-export.ts) already sets the document section to `PageOrientation.LANDSCAPE` with a landscape twip grid for tables.

**Follow-up when implementing:**

- Re-verify after any CSS or docx section changes that nothing regresses to portrait.
- **E2E / pdfmake path:** [`generateExecutiveReportPdfBlob`](src/lib/executive-report-pdfmake.ts) does not set `pageOrientation`; pdfmake defaults to portrait. Add `pageOrientation: "landscape"` (and matching `pageSize` if needed) so the CI PDF path matches product intent.
- **User education:** Some browsers let users override orientation in the print dialog; if support tickets mention portrait, add a short note in UI copy or help (“Choose landscape if the print dialog offers it”).

**Out of scope for this requirement:** SE Health Check PDFs built with pdfmake (`se-health-check-pdfmake-v2`, etc.) remain on their existing **portrait** Letter layout unless a separate initiative changes that product.

---

## Context from codebase

| Surface             | PDF path                                                                                                                                | Word path                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Main assess flow    | [`DocumentPreview.tsx`](src/components/DocumentPreview.tsx) `handlePdf` → `buildPdfHtml(docRef.innerHTML, …)`                           | `generateWordBlob` from [`report-export.ts`](src/lib/report-export.ts) |
| Shared link (7-day) | [`SharedReport.tsx`](src/pages/SharedReport.tsx) `handlePdf` → `buildPdfHtml(reportContentRef.innerHTML, …)` — **body has no MSP logo** | Same `generateWordBlob`                                                |
| Client portal       | Same `buildPdfHtml` + `generateWordBlob`                                                                                                | [`ClientPortal.tsx`](src/pages/ClientPortal.tsx)                       |

**Likely cause of the ~1.5-page logo (main flow):** The printable fragment includes the branding strip from `DocumentPreview` (lines ~927–947) with classes like `h-14 w-auto max-w-[200px] object-contain`. The print window **does not include Tailwind**, so those utilities are no-ops; the browser uses the image’s **intrinsic dimensions**, which can span multiple printed pages for large rasters/SVGs.

The navy bar logo in `buildPdfHtml` already has inline constraints (`height:32px; max-width:180px`), but print engines can still misbehave on some assets—tighten with explicit **print** rules.

**Word “wonky”:** `generateWordBlob` builds a **landscape** doc with `buildDocxTable` using `TableLayoutType.FIXED` and **equal** column widths (`gridTotal / cellCount`). Dense recommendation tables with many columns and uneven text will look cramped or misaligned compared to the browser.

**SE Health Check vs “micro firewall check”:** In-app positioning already exists: [`HealthCheckInnerHeader.tsx`](src/pages/health-check/HealthCheckInnerHeader.tsx) subtitle — _“Sales Engineer quick check — Sophos best practices (not compliance frameworks)”_. Auth gate title is _“Sophos SE Health Check”_ with _“Firewall best-practice assessment for Sophos Sales Engineers”_ ([`SEAuthGate.tsx`](src/components/SEAuthGate.tsx)). So it is **not** the full MSP multi-framework assessment; it **is** a **focused Sophos BP health snapshot** (reasonable to describe informally as a “micro” or quick firewall check if that helps customers).

---

## 1. PDF: make embedded content print-safe (logo + optional layout)

**Primary change — [`report-export.ts`](src/lib/report-export.ts) (`buildPdfHtml`):**

- Add **`@media print` (and base) rules** for images inside `.print-content`, scoped so we do not break legitimate large figures if you add them later:
  - **Preferred:** Add a dedicated class on the branding `<img>` in [`DocumentPreview.tsx`](src/components/DocumentPreview.tsx) (e.g. `report-pdf-brand-logo`) and style only that class with `max-height`, `max-width`, `object-fit: contain`, `width/height: auto`.
  - **Optional safety net:** A conservative rule for **all** `.print-content img` (e.g. `max-width: 100%`, `max-height: 120mm` or similar) if product reports rarely need full-page screenshots.
- In the same print block, reinforce **header** branding image: override inline height if needed with `max-height` / `object-fit: contain` so SVG/raster edge cases cannot balloon.
- **Keep** `@page { size: A4 landscape; … }` as the canonical horizontal PDF layout for this export.

**Secondary — duplicate branding:** The PDF currently shows MSP logo in the **header bar** (if `logoUrl` set) **and** again in the **body** branding strip. After sizing is fixed, if it still feels redundant, consider **hiding the body branding block in print** when `customLogo` is present (CSS `@media print` on a wrapper class), or dropping the inner strip from the cloned HTML only for PDF—product call.

**Dense recommendations / tables:** Existing print CSS already forces `table-layout: fixed`, smaller fonts for `.pdf-table--wide`, and relaxes `page-break-inside` on wide rows. Incremental improvements in the same file:

- Add **`break-inside: avoid`** on `thead` / first header row pattern if Chromium still splits headers badly.
- For **non–wide** tables, consider slightly stronger **`tr` break rules** (balance between “don’t split tiny rows” vs “don’t leave huge gaps”).
- If misalignment is **column width** (not page breaks), extend the client script that adds `pdf-table--wide` (threshold currently `n >= 10` columns) or add a second tier (e.g. `n >= 7`) with intermediate font/padding.

**Verification:** Manual print-to-PDF from assess UI with (a) large pixel logo, (b) report with many recommendation rows/columns; confirm **landscape** output. Optional Playwright path: align [`executive-report-pdfmake.ts`](src/lib/executive-report-pdfmake.ts) to landscape.

---

## 2. Word: improve table behavior for long recommendation sections

All in [`report-export.ts`](src/lib/report-export.ts):

- **Keep** section `PageOrientation.LANDSCAPE` for horizontal pages.
- **Column widths:** Instead of strictly equal DXA widths for every table, use a simple heuristic—e.g. **first column wider** (recommendation title / control name) and remainder split, or switch to **`TableLayoutType.AUTOFIT`** for tables under a column threshold (e.g. ≤5) and keep FIXED for wide rule-style tables.
- **Row splitting:** Ensure wide tables allow **row breaks** where Word supports it (avoid setting `cantSplit` on rows unless needed for tiny header rows).
- **Optional:** Slightly reduce default cell **margins** when `cellCount` is high (beyond current font scaling).

---

## 3. SE Health Check — answer for the field (minimal or copy-only)

- **Factually:** It is the **Sophos SE / Sales Engineer** workflow: **Sophos best-practice checklist** style health assessment, **not** the full MSP compliance-framework assessment. The UI already states that in the header subtitle.
- **If you want one clearer phrase for customers:** Tweak subtitle to explicitly say **“snapshot”** or **“single-session firewall health review”** (one line in [`HealthCheckInnerHeader.tsx`](src/pages/health-check/HealthCheckInnerHeader.tsx) / help doc)—no engineering dependency.

---

## 4. Changelog / platform card (if you ship user-visible export fixes)

Per workspace rules: update [`ChangelogPage.tsx`](src/pages/ChangelogPage.tsx) and [`platform-update-highlights.ts`](src/data/platform-update-highlights.ts) when PDF/Word behavior visibly improves.

---

## What we are **not** changing in this plan

- **Share link / 7-day expiry** — already validated; logic lives in share + [`SharedReport.tsx`](src/pages/SharedReport.tsx).
- **SE Health Check structured PDF** (`se-health-check-pdfmake-v2`, etc.) — separate pipeline; **portrait** unless a separate product decision changes it; not part of the MSP “horizontal Word + PDF” requirement above.

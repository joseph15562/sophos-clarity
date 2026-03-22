---
name: SE Health Check DOCX to PDF
overview: Drop paid Word/DOCX→PDF conversion. Replace the fragile SE Health Check HTML→canvas→jsPDF path with a structured PDF library that supports real document headers, footers, page breaks, and tables—generated entirely in the browser at no per-report cost.
todos:
  - id: pick-pdf-lib
    content: Choose and add `pdfmake` (recommended) or `@react-pdf/renderer`; bundle default fonts for Vite if using pdfmake vfs
    status: pending
  - id: se-pdf-builder
    content: "Add `se-health-check-pdf-document.ts`: map `SEHealthCheckReportParams` → pdfmake `docDefinition` (cover, overview, executive bullets, findings table with header row repeat, BP summary, provenance)"
    status: pending
  - id: wire-download
    content: Change `runHealthCheckPdfDownload` to build PDF from docDefinition + `createPdf().getBlob()`; remove SE path through `htmlDocumentStringToPdfBlob`
    status: pending
  - id: tests-cleanup
    content: "Vitest: non-empty PDF blob / docDefinition sanity; keep HTML export unchanged; trim unused SE-PDF-only HTML layout if dead"
    status: pending
isProject: false
---

# SE Health Check: structured PDF without Word or conversion APIs

## Why change direction

- **Word + CloudConvert / Gotenberg** avoids the bad HTML renderer but adds **ongoing cost or ops** you want to skip.
- The pain today is mainly `**[html-document-to-pdf-blob.ts](src/lib/html-document-to-pdf-blob.ts)`** (HTML → canvas → jsPDF): long documents, pagination, and **repeat headers** are brittle.

You do **not** need Word to get PDFs with **headers, footers, tables, and page breaks**. Use a PDF API that models the document structurally.

## Recommended approach: **pdfmake** (client-side, no per-report fee)

**[pdfmake](http://pdfmake.org/)** builds PDFs from a **document definition** (JSON): paragraphs, stacks, columns, **tables** (`headerRows` for repeating column headers on each page), and **dynamic `header` / `footer` callbacks** per page—ideal for “Copyright / CONFIDENTIAL” lines and Sophos-style running headers.

- **Cost**: library only; no third-party conversion service.
- **Stack fit**: Vite app; typical setup imports `pdfmake/build/pdfmake` + virtual font files (`vfs_fonts`) once.
- **Alternative**: `**[@react-pdf/renderer](https://react-pdf.org/)`** if you prefer JSX-style layout; same idea (structured PDF, headers/footers), slightly different bundling story.

**Less ideal but minimal new deps**: `**jspdf` + `jspdf-autotable`** (you already ship `jspdf`). Good for **tables**; **running headers** are manual (page hooks). Prefer pdfmake if headers/footers are first-class.

## Architecture (revised)

```mermaid
flowchart LR
  params[SEHealthCheckReportParams]
  def[docDefinition]
  pdf[pdfmake.createPdf]
  blob[Blob PDF]
  params --> def --> pdf --> blob
```



- **Single source of data**: same `[SEHealthCheckReportParams](src/lib/se-health-check-report-html.ts)` as today.
- **Parallel outputs**:
  - **PDF**: new pdfmake pipeline (primary fix).
  - **HTML** (`[buildSeHealthCheckBrowserHtmlDocument](src/lib/se-health-check-browser-html.ts)`): keep for dark browser view / archive; no requirement to match PDF pixel-perfect.

## Implementation outline

1. **Dependency**: add `pdfmake` (+ font vfs per their Vite docs).
2. **New module** e.g. `[src/lib/se-health-check-pdf-document.ts](src/lib/se-health-check-pdf-document.ts)`:
  - Map cover fields (customer, prepared for/by, date), overview copy, licence/scoping, per-firewall executive summary and **priority bullets**, **findings table** (severity | summary | category | detail), BP score summary text, provenance section.
  - Set `defaultStyle`, `pageMargins`, `header`/`footer` for lockup text or simple text line (Sophos artwork as **embedded image** in pdfmake is possible if you want the shield/wordmark in-vector/raster).
3. `**[src/lib/health-check-pdf-download.ts](src/lib/health-check-pdf-download.ts)`**:
  - `runHealthCheckPdfDownload`: `getBlob()` from pdfmake → `saveAs` (same filename pattern as today).
  - Remove use of `buildPdfHtml` + `htmlDocumentStringToPdfBlob` **for SE Health Check only** (leave the shared HTML→PDF helper for other app surfaces if still referenced elsewhere).
4. `**[src/components/SEHealthCheckHistory.tsx](src/components/SEHealthCheckHistory.tsx)`** / `**[src/pages/HealthCheck.tsx](src/pages/HealthCheck.tsx)`**: no API change if `runHealthCheckPdfDownload` signature stays the same.
5. **Tests**: assert `docDefinition` structure or PDF `Blob` size & magic bytes `%PDF`.

## Optional later: Word export only (no conversion)

If you still want an editable **.docx** for some customers, the existing `**docx`** dependency can produce a file **in the browser** with **no conversion service** (separate “Download Word” button). That is **not** required for fixing PDF quality.

## What we are explicitly not doing (for this iteration)

- No **DOCX → PDF** Edge Function or CloudConvert/Gotenberg bill.
- No reliance on **canvas screenshots** of HTML for the SE Health Check PDF.

## Operational checklist

- Tune column widths and `pageBreak` / `dontBreakRows` on the findings table for readability.
- Confirm default fonts meet brand guidelines or swap in approved TTF via pdfmake vfs.


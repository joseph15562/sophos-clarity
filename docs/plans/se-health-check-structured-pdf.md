---
name: SE Health Check structured PDF
overview: "Drop paid Word/DOCX→PDF conversion. Replace the fragile SE Health Check HTML→canvas→jsPDF path with a structured PDF library (pdfmake or @react-pdf/renderer) for headers, footers, tables, and page breaks—browser-only, no per-report cost."
todos:
  - id: pick-pdf-lib
    content: "Choose and add pdfmake (recommended) or @react-pdf/renderer; bundle default fonts for Vite if using pdfmake vfs"
    status: pending
  - id: se-pdf-builder
    content: "Add se-health-check-pdf-document.ts mapping SEHealthCheckReportParams to docDefinition"
    status: pending
  - id: wire-download
    content: "Change runHealthCheckPdfDownload to pdfmake blob; remove SE path through htmlDocumentStringToPdfBlob"
    status: pending
  - id: tests-cleanup
    content: "Vitest smoke tests; keep HTML export; trim dead SE-only PDF HTML if unused"
    status: pending
isProject: false
---

# SE Health Check: structured PDF without Word or conversion APIs

See the canonical Cursor plan copy at `~/.cursor/plans/se_health_check_docx_to_pdf_36dbc480.plan.md` for the full body (architecture, pdfmake vs alternatives, implementation outline). This file is the git-mirrored summary for the team.

**Summary:** Use **pdfmake** (or **@react-pdf/renderer**) to generate the SE Health Check PDF from `SEHealthCheckReportParams` with real document **headers**, **footers**, **repeating table headers**, and **page breaks**—no Word and no paid DOCX→PDF API.

**Shipped:** PDF download uses pdfmake in [`src/lib/se-health-check-pdfmake.ts`](../../src/lib/se-health-check-pdfmake.ts) via [`src/lib/health-check-pdf-download.ts`](../../src/lib/health-check-pdf-download.ts) (HTML export unchanged).

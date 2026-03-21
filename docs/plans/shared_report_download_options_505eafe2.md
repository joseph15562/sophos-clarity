---
name: Shared report download options
overview: Add Download Word and Download PDF actions to the shared report page when the share has allowDownload enabled, reusing the same export utilities as the main app.
todos: []
isProject: false
---

# Shared report download options when MSP allows it

## Current behavior

- [src/pages/SharedReport.tsx](src/pages/SharedReport.tsx) loads the report via `loadSharedReport(token)` and gets `SharedReport` with `markdown`, `customerName`, `expiresAt`, and `allowDownload`.
- When `allowDownload === false`, it shows a "View only" notice (lines 125–129). When `allowDownload` is true, it shows **no** download actions.
- The main app ([src/components/DocumentPreview.tsx](src/components/DocumentPreview.tsx)) has "Download Word" and "Download PDF" that use [src/lib/report-export.ts](src/lib/report-export.ts): `generateWordBlob(markdown, branding)` and `buildPdfHtml(innerHTML, title, branding, options)` + print window.

## Data flow

- `allow_download` is stored in `shared_reports` and returned by the shared-report API ([src/lib/share-report.ts](src/lib/share-report.ts) and the `api/shared/[token]` Edge Function). `loadSharedReport` already maps this to `allowDownload` (line 96), so the client has the flag. No backend change required.

## Implementation

**File: [src/pages/SharedReport.tsx](src/pages/SharedReport.tsx)**

1. **Ref for PDF**
  Add a `useRef<HTMLDivElement>(null)` pointing at the report content container (the div that wraps `dangerouslySetInnerHTML`). PDF export will use this element’s `innerHTML` in a print window, same as DocumentPreview.
2. **Minimal branding**
  Build a minimal `BrandingData` from the shared report:
  - `customerName` and `companyName` from `report.customerName`
  - `logoUrl: null`, `environment: ""`, `country: ""`, `selectedFrameworks: []`, other optional fields omitted or defaulted  
   so `generateWordBlob` and `buildPdfHtml` can be called without full branding.
3. **Export helpers**
  - **Word:** `handleWord`: call `generateWordBlob(report.markdown, branding)`, then `saveAs(blob, filename)` (use `file-saver`’s `saveAs`; add import if not present). Filename e.g. `Firewall-Configuration-Assessment-Report.docx` or derive from `report.customerName`.
  - **PDF:** `handlePdf`: get the content div from the ref, open a new window, write `buildPdfHtml(div.innerHTML, title, branding, { theme })`, then trigger print. Use the same `buildPdfHtml` and, if needed, a default export theme (e.g. from DocumentPreview or report-export defaults).
4. **UI when `allowDownload` is true**
  In the header bar of the shared report (e.g. next to the expiry text in the dark bar, or above the TOC), add a small row or group of buttons:
  - "Download Word" → `handleWord`
  - "Download PDF" → `handlePdf`  
   Reuse the same icons as DocumentPreview (`FileText`, `Download` from lucide-react) and similar secondary button styling so it’s consistent. Keep these inside the same `no-print` area so they don’t appear on the printed PDF.
5. **Leave "View only" as-is**
  Keep the existing conditional that shows the amber "View only — export and download are disabled" when `report.allowDownload === false`. No download buttons in that case.

## Dependencies

- [src/lib/report-export.ts](src/lib/report-export.ts): use `buildPdfHtml` and `generateWordBlob`; ensure they accept minimal branding (they already take `BrandingData` with optional fields).
- [src/components/BrandingSetup.tsx](src/components/BrandingSetup.tsx): `BrandingData` type only (no code change).
- Add `file-saver` import for `saveAs` in SharedReport if not already used there; DocumentPreview already uses it.

## Summary

- **Backend:** No change; `allow_download` is already returned by the shared-report API and mapped to `allowDownload` in `loadSharedReport`.
- **Frontend:** In `SharedReport.tsx`, when `report.allowDownload` is true, show Download Word and Download PDF buttons that call the same export helpers as DocumentPreview, using a minimal branding object built from `report.customerName`. Use a ref on the report content div for PDF HTML. When `allowDownload` is false, keep showing only the existing "View only" message.


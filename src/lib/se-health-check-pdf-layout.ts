/**
 * SE Health Check PDF: full-bleed cover (no white gutter) + re-padding body sections.
 * Applied when `buildPdfHtml` sets `data-pdf-profile` and html2canvas injects the same rules.
 */
export const SE_HEALTH_CHECK_PDF_PROFILE = "se-health-check" as const;

export const SE_HEALTH_CHECK_PDF_LAYOUT_CSS = `
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content {
  padding: 0 !important;
  max-width: none !important;
}
/* Side padding for everything after the cover + overview sheet */
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content > *:not(.se-hc-cover-fullpage):not(.se-hc-overview-sheet) {
  padding-left: clamp(16px, 4vw, 48px) !important;
  padding-right: clamp(16px, 4vw, 48px) !important;
  box-sizing: border-box !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .pdf-toc {
  padding-top: 28px !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .report-footer {
  padding-left: clamp(16px, 4vw, 48px) !important;
  padding-right: clamp(16px, 4vw, 48px) !important;
}
/* Cover: beat generic .print-content typography (all copy white on navy) */
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content .se-hc-cover-fullpage,
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content .se-hc-cover-fullpage h1,
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content .se-hc-cover-fullpage p,
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content .se-hc-cover-fullpage span {
  color: #ffffff !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content .se-hc-cover-fullpage .se-hc-cover-copy {
  color: rgba(255, 255, 255, 0.92) !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content > .se-hc-cover-fullpage:first-child {
  margin-bottom: 0 !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content > .se-hc-overview-sheet {
  margin-top: 0 !important;
}
/* One full A4 page for cover at 1024px capture width — keeps overview on PDF page 2 */
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-cover-fullpage {
  height: calc(1024px * 297 / 210) !important;
  min-height: calc(1024px * 297 / 210) !important;
  max-height: calc(1024px * 297 / 210) !important;
  overflow: hidden !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-cover-mark-wrap {
  flex: 1 1 auto !important;
  min-height: 0 !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-overview-sheet {
  page-break-before: always !important;
  break-before: page !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-overview-header-navy {
  background: #001b44 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  padding: 40px 48px 48px !important;
  min-height: 280px !important;
  box-sizing: border-box !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-overview-wordmark {
  display: block !important;
  max-height: 36px !important;
  max-width: min(360px, 92%) !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
  object-position: left center !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .print-content h2.se-hc-overview-title {
  margin-top: auto !important;
  background-image: none !important;
  background-clip: border-box !important;
  -webkit-background-clip: border-box !important;
  color: #00d094 !important;
  -webkit-text-fill-color: #00d094 !important;
  border-bottom: none !important;
}
/* Body pages (after cover + overview): typography; lockup is stamped per PDF page via jsPDF (pages 3+) */
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages {
  background: #ffffff !important;
  /* Reserve ~16mm for small top-left lockup (~12mm top margin + ~4.5mm logo height) */
  padding-top: calc(1024px * 16.5 / 210) !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages h2 {
  font-family: 'Zalando Sans Expanded', 'Zalando Sans', sans-serif !important;
  font-size: 20pt !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  color: #001A47 !important;
  border-bottom: 2px solid #001A47 !important;
  border-bottom-color: #001A47 !important;
  padding-bottom: 10px !important;
  margin: 0 0 18px !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages h3 {
  font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  font-size: 12.5pt !important;
  font-weight: 700 !important;
  color: #111827 !important;
  margin: 22px 0 10px !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages h4 {
  font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  font-size: 11pt !important;
  font-weight: 700 !important;
  color: #0f172a !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages p,
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages li {
  font-family: 'Zalando Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  font-size: 11pt !important;
  line-height: 1.55 !important;
  color: #0f172a !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages .table-wrapper {
  margin: 16px 0 22px !important;
  padding: 14px 16px 16px !important;
  background: #ffffff !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 6px !important;
  box-sizing: border-box !important;
  overflow: visible !important;
  box-shadow: none !important;
}
/* Central-style tables: no sticky header (fixes html2canvas glitches), light card, dark column titles */
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages .table-wrapper table {
  min-width: 0 !important;
  border-collapse: collapse !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages thead th {
  position: static !important;
  top: auto !important;
  background: #ffffff !important;
  color: #111827 !important;
  font-weight: 700 !important;
  font-size: 10pt !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  border: none !important;
  border-bottom: 2px solid #e5e7eb !important;
  padding: 10px 12px 10px 0 !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages thead th:first-child {
  border-top-left-radius: 0 !important;
  padding-left: 0 !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages thead th:last-child {
  border-top-right-radius: 0 !important;
  padding-right: 0 !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages tbody td {
  background: #ffffff !important;
  color: #1f2937 !important;
  border-color: #f3f4f6 !important;
  padding: 9px 12px 9px 0 !important;
  vertical-align: top !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages tbody tr:nth-child(even) td {
  background: #f9fafb !important;
  color: #1f2937 !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages tbody tr:nth-child(odd) td {
  background: #ffffff !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages ul {
  margin: 8px 0 14px !important;
  padding-left: 1.35em !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages ul li {
  margin: 0.35em 0 !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-footer {
  padding-left: clamp(16px, 4vw, 48px) !important;
  padding-right: clamp(16px, 4vw, 48px) !important;
  box-sizing: border-box !important;
}
`;

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
/* Body pages (after cover + overview): Sophos Central Executive Summary–style letterhead + typography */
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages {
  background: #ffffff !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-pdf-section-letterhead {
  display: flex !important;
  align-items: center !important;
  min-height: 44px !important;
  margin: 0 0 14px !important;
  padding: 0 0 14px !important;
  border-bottom: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-pdf-section-letterhead-img {
  display: block !important;
  height: 40px !important;
  width: auto !important;
  max-width: min(260px, 88%) !important;
  object-fit: contain !important;
  object-position: left center !important;
}
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-pdf-section-letterhead + h2 {
  margin-top: 0 !important;
}
/* Each major chapter starts on a new page (lockup repeats at top) */
html[data-pdf-profile="${SE_HEALTH_CHECK_PDF_PROFILE}"] .se-hc-report-body-pages .se-hc-pdf-section-letterhead:not(:first-of-type) {
  page-break-before: always !important;
  break-before: page !important;
  padding-top: 4px !important;
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
  margin: 10px 0 18px !important;
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

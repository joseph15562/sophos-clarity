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
  background-image: linear-gradient(90deg, #00ff9d 0%, #00d1ff 100%) !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  border-bottom: none !important;
}
`;

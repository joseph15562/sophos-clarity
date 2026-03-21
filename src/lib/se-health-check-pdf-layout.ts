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
`;

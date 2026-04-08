import type { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

/**
 * CSS injected after the page loads so the screen-mode rendering is tuned
 * for PDF output (image sizing, table overflow, color-adjust hints).
 */
const PDF_OVERLAY_CSS = `
  /* Force light theme regardless of what the HTML was built with */
  :root, html, [data-theme] {
    --bg: #ffffff !important;
    --bg-surface: #f8fafc !important;
    --bg-muted: #f1f5f9 !important;
    --border: #e2e8f0 !important;
    --text: #001A47 !important;
    --text-secondary: #334155 !important;
    --text-muted: #94a3b8 !important;
    --accent: #2006F7 !important;
    --accent-light: rgba(32, 6, 247, 0.06) !important;
    --accent-dark: #10037C !important;
    --th-bg: #10037C !important;
    --th-text: #ffffff !important;
    --row-even: #f8fafc !important;
    --row-odd: #ffffff !important;
    --code-bg: #f1f5f9 !important;
  }
  body {
    background: #ffffff !important;
    color: #001A47 !important;
  }

  /* Ensure background colours and fills are preserved in PDF */
  * {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }

  /* Cap inline images so logos/figures don't dominate pages */
  .print-content img {
    max-width: 100% !important;
    max-height: 60mm !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }
  .print-content img.report-pdf-brand-logo {
    max-height: 40px !important;
    max-width: 180px !important;
  }

  /* Tables must not overflow the page — no scrolling in a PDF */
  .table-wrapper {
    overflow: visible !important;
    max-width: 100% !important;
  }
  table {
    table-layout: auto !important;
    width: 100% !important;
    min-width: 0 !important;
    font-size: 7pt !important;
  }
  th, td {
    padding: 4px 6px !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    word-break: normal !important;
    white-space: normal !important;
    vertical-align: top !important;
  }
  th {
    font-size: 6.5pt !important;
    text-transform: none !important;
    letter-spacing: 0.02em !important;
    line-height: 1.25 !important;
  }
  /* Wide tables (10+ cols): tighter to fit */
  table.pdf-table--wide { font-size: 5.5pt !important; }
  table.pdf-table--wide th,
  table.pdf-table--wide td {
    padding: 2px 3px !important;
    font-size: 5.5pt !important;
    line-height: 1.2 !important;
  }
  /* Medium tables (7-9 cols) */
  table.pdf-table--medium { font-size: 6pt !important; }
  table.pdf-table--medium th,
  table.pdf-table--medium td {
    padding: 3px 4px !important;
    font-size: 6pt !important;
    line-height: 1.22 !important;
  }

  /* Hide the interactive dark/light toggle */
  .theme-toggle { display: none !important; }
  .report-footer { display: none !important; }

  /* Header logo sizing */
  .report-header img.sophos-logo {
    max-height: 28px !important;
    max-width: 180px !important;
    width: auto !important;
    height: auto !important;
    object-fit: contain !important;
  }
  .report-header {
    background: var(--accent-dark) !important;
    color: #fff !important;
  }

  /* Hide duplicate body logo when header already shows it */
  html[data-hide-duplicate-body-logo="true"] .report-pdf-brand-block img.report-pdf-brand-logo {
    display: none !important;
  }
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { html, landscape = true, format = "A4" } = req.body ?? {};

  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Missing or invalid `html` field" });
  }

  let browser: Awaited<ReturnType<typeof puppeteerCore.launch>> | null = null;

  try {
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.emulateMediaType("screen");

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 20_000 });

    await page.addStyleTag({ content: PDF_OVERLAY_CSS });

    await page.evaluate(() => {
      const el = document.documentElement;
      el.setAttribute("data-theme", "light");
    });

    await page.waitForFunction(() => document.fonts.ready, { timeout: 8_000 }).catch(() => {});

    const pdfBuffer = await page.pdf({
      format: format as "A4",
      landscape,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(pdfBuffer));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("render-pdf error:", message);
    return res.status(500).json({ error: "PDF rendering failed", detail: message });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

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

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 20_000 });

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

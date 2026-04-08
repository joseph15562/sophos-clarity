/**
 * Sends a fully-rendered HTML document string to the Vercel serverless
 * function and returns a PDF blob suitable for `saveAs()`.
 */
export async function renderPdfViaServer(
  html: string,
  opts?: { landscape?: boolean; format?: string },
): Promise<Blob> {
  const res = await fetch("/api/render-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      landscape: opts?.landscape ?? true,
      format: opts?.format ?? "A4",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PDF render failed (${res.status}): ${body}`);
  }

  return res.blob();
}

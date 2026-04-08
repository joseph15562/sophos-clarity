import { describe, it, expect } from "vitest";
import { generateWordBlob } from "@/lib/report-export";
import type { BrandingData } from "@/components/BrandingSetup";

const minimalBranding: BrandingData = {
  companyName: "Test Co",
  customerName: "",
  logoUrl: null,
  environment: "",
  country: "",
  selectedFrameworks: [],
};

describe("generateWordBlob — data URI images", () => {
  it("embeds a PNG data-URI as binary instead of pasting base64 text", async () => {
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const md = `# Section\n\n![Company Logo](data:image/png;base64,${tinyPng})\n\nAfter image.`;
    const blob = await generateWordBlob(md, minimalBranding);
    expect(blob.size).toBeGreaterThan(1_500);
    const ab = await new Response(blob as Blob).arrayBuffer();
    const raw = new TextDecoder("latin1").decode(new Uint8Array(ab));
    expect(raw).not.toContain("iVBORw0KGgo");
    expect(raw).not.toContain("data:image/png;base64");
  });
});

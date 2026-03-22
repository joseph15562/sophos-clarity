import { describe, it, expect } from "vitest";
import type { ExtractedSections } from "@/lib/extract-sections";
import { analyseConfig } from "@/lib/analyse-config";
import { evaluateBaseline, BASELINE_TEMPLATES } from "@/lib/policy-baselines";
import { computeSophosBPScore } from "@/lib/sophos-licence";
import { buildSeHealthCheckPdfDocDefinition } from "@/lib/se-health-check-pdfmake";

const SOPHOS_BP_TEMPLATE = BASELINE_TEMPLATES.find((t) => t.id === "sophos-best-practice") ?? BASELINE_TEMPLATES[0];

function minimalParams() {
  const ar = analyseConfig({});
  const label = "TestFW";
  const bl = evaluateBaseline(SOPHOS_BP_TEMPLATE, ar);
  const licence = { tier: "xstream" as const, modules: [] as const };
  const bp = computeSophosBPScore(ar, licence);
  return {
    labels: [label],
    files: [
      {
        id: "1",
        fileName: "export.html",
        label,
        content: "",
        extractedData: {} as ExtractedSections,
        source: "upload" as const,
      },
    ],
    analysisResults: { [label]: ar },
    baselineResults: { [label]: bl },
    bpByLabel: { [label]: bp },
    licence,
    customerName: "Acme Corp",
    preparedBy: "SE User",
    dpiExemptZones: [] as string[],
    dpiExemptNetworks: [] as string[],
    webFilterComplianceMode: "strict" as const,
    webFilterExemptRuleNames: [] as string[],
    centralValidated: false,
    generatedAt: new Date("2024-01-15T12:00:00.000Z"),
  };
}

describe("se-health-check-pdfmake", () => {
  it("buildSeHealthCheckPdfDocDefinition includes header, footer, and core sections", () => {
    const doc = buildSeHealthCheckPdfDocDefinition(minimalParams());
    expect(doc.content).toBeDefined();
    expect(Array.isArray(doc.content)).toBe(true);
    expect(typeof doc.header).toBe("function");
    expect(typeof doc.footer).toBe("function");
    const stack = doc.content![0] as { stack?: unknown[] };
    expect(stack.stack).toBeDefined();
    const coverText = JSON.stringify(doc.content);
    expect(coverText).toContain("Sophos Firewall Health Check");
    expect(coverText).toContain("Acme Corp");
    expect(coverText).toContain("Executive Summary");
    expect(coverText).toContain("Provenance and limitations");
  });

});

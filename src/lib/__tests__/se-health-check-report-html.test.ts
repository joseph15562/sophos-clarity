import { describe, it, expect } from "vitest";
import type { ExtractedSections } from "@/lib/extract-sections";
import { analyseConfig } from "@/lib/analyse-config";
import { evaluateBaseline, BASELINE_TEMPLATES } from "@/lib/policy-baselines";
import { computeSophosBPScore } from "@/lib/sophos-licence";
import { buildSEHealthCheckReportHtml, escapeHtml } from "@/lib/se-health-check-report-html";

const SOPHOS_BP_TEMPLATE = BASELINE_TEMPLATES.find((t) => t.id === "sophos-best-practice") ?? BASELINE_TEMPLATES[0];

describe("se-health-check-report-html", () => {
  it("escapeHtml neutralizes markup and ampersands", () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain("<script>");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml('"quotes"')).toBe("&quot;quotes&quot;");
  });

  it("buildSEHealthCheckReportHtml includes core sections and escapes user strings", () => {
    const ar = analyseConfig({});
    const label = "TestFW";
    const bl = evaluateBaseline(SOPHOS_BP_TEMPLATE, ar);
    const licence = { tier: "xstream" as const, modules: [] as const };
    const bp = computeSophosBPScore(ar, licence);
    const html = buildSEHealthCheckReportHtml({
      labels: [label],
      files: [
        {
          id: "1",
          fileName: "export.html",
          label,
          content: "",
          extractedData: {} as ExtractedSections,
          source: "upload",
        },
      ],
      analysisResults: { [label]: ar },
      baselineResults: { [label]: bl },
      bpByLabel: { [label]: bp },
      licence,
      customerName: 'Evil<img src=x onerror=alert(1)>',
      preparedBy: "SE User",
      dpiExemptZones: [],
      dpiExemptNetworks: [],
      webFilterComplianceMode: "strict",
      webFilterExemptRuleNames: [],
      centralValidated: false,
      generatedAt: new Date("2024-01-15T12:00:00.000Z"),
    });
    expect(html).toContain("Sophos Firewall Health Check");
    expect(html).toContain("se-hc-cover-fullpage");
    expect(html).toContain("Firewall health check overview");
    expect(html).toContain("Sophos Ltd. All Rights Reserved");
    expect(html).toContain("Executive summary");
    expect(html).toContain("Configuration file manifest");
    expect(html).toContain("export.html");
    expect(html).not.toContain("<img");
    expect(html).toContain("Evil&lt;img");
  });
});

import { describe, it, expect } from "vitest";
import {
  BASELINE_TEMPLATES,
  evaluateBaseline,
} from "@/lib/policy-baselines";
import { analyseConfig } from "@/lib/analyse-config";
import type { AnalysisResult } from "@/lib/analyse-config";

describe("policy-baselines", () => {
  it("includes sophos-firewall-audit-inspired template", () => {
    const t = BASELINE_TEMPLATES.find((x) => x.id === "sophos-firewall-audit-inspired");
    expect(t).toBeDefined();
    expect(t!.requirements.length).toBeGreaterThan(5);
  });

  it("evaluateBaseline scores audit-inspired template on empty WAN / clean findings", () => {
    const template = BASELINE_TEMPLATES.find((x) => x.id === "sophos-firewall-audit-inspired")!;
    const result = evaluateBaseline(template, analyseConfig({}));
    expect(result.requirements.length).toBe(template.requirements.length);
    expect(result.score).toBeGreaterThan(0);
  });

  it("fails threatIntelligenceFeedsHealthy when X-Ops disabled finding present", () => {
    const template = BASELINE_TEMPLATES.find((x) => x.id === "sophos-firewall-audit-inspired")!;
    const base = analyseConfig({});
    const bad: AnalysisResult = {
      ...base,
      findings: [
        ...base.findings,
        {
          id: "fxops",
          severity: "high",
          title: "Sophos X-Ops Active Threat Response is disabled",
          detail: "test",
          section: "Threat",
          remediation: "",
          confidence: "high",
          evidence: "",
        },
      ],
    };
    const evaluated = evaluateBaseline(template, bad);
    const threatReq = evaluated.requirements.find((r) => r.label.includes("X-Ops"));
    expect(threatReq?.met).toBe(false);
  });
});

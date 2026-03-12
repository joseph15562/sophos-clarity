import { useState, useMemo, useCallback } from "react";
import type { AnalysisResult, InspectionPosture, Finding } from "@/lib/analyse-config";
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

interface Toggle {
  id: string;
  label: string;
  description: string;
  apply: (r: AnalysisResult) => AnalysisResult;
}

function cloneResult(r: AnalysisResult): AnalysisResult {
  return {
    stats: { ...r.stats },
    findings: r.findings.map((f) => ({ ...f })),
    inspectionPosture: {
      ...r.inspectionPosture,
      sslRules: [...r.inspectionPosture.sslRules],
      sslUncoveredZones: [...r.inspectionPosture.sslUncoveredZones],
      wanRuleNames: [...r.inspectionPosture.wanRuleNames],
    },
    ruleColumns: r.ruleColumns ? [...r.ruleColumns] : undefined,
  };
}

function removeFindings(findings: Finding[], pattern: RegExp): Finding[] {
  return findings.filter((f) => !pattern.test(f.title));
}

const TOGGLES: Toggle[] = [
  {
    id: "enable-web-filter",
    label: "Enable Web Filtering on all WAN rules",
    description: "Applies web filter policy to every enabled WAN rule with HTTP/HTTPS/ANY service",
    apply: (r) => {
      const c = cloneResult(r);
      c.inspectionPosture.withWebFilter = c.inspectionPosture.webFilterableRules;
      c.inspectionPosture.withoutWebFilter = 0;
      c.findings = removeFindings(c.findings, /missing web filtering/i);
      return c;
    },
  },
  {
    id: "enable-ips",
    label: "Enable IPS on all WAN rules",
    description: "Applies intrusion prevention to every enabled WAN rule",
    apply: (r) => {
      const c = cloneResult(r);
      c.inspectionPosture.withIps = c.inspectionPosture.enabledWanRules;
      c.findings = removeFindings(c.findings, /without IPS/i);
      return c;
    },
  },
  {
    id: "enable-app-control",
    label: "Enable Application Control on all WAN rules",
    description: "Applies application filtering to every enabled WAN rule",
    apply: (r) => {
      const c = cloneResult(r);
      c.inspectionPosture.withAppControl = c.inspectionPosture.enabledWanRules;
      c.findings = removeFindings(c.findings, /without Application Control/i);
      return c;
    },
  },
  {
    id: "enable-ssl-decrypt",
    label: "Enable SSL/TLS Decrypt on all WAN traffic",
    description: "Adds Decrypt rules so every source zone with WAN-bound firewall rules has encrypted traffic inspected",
    apply: (r) => {
      const c = cloneResult(r);
      c.inspectionPosture.sslDecryptRules = Math.max(1, c.inspectionPosture.sslDecryptRules);
      c.inspectionPosture.dpiEngineEnabled = true;
      c.inspectionPosture.sslUncoveredZones = [];
      c.inspectionPosture.withSslInspection = Math.max(1, c.inspectionPosture.withSslInspection);
      c.findings = removeFindings(c.findings, /SSL\/TLS inspection|DPI inactive|not covered by SSL/i);
      return c;
    },
  },
  {
    id: "enable-logging",
    label: "Enable logging on all rules",
    description: "Turns on traffic logging across all firewall rules",
    apply: (r) => {
      const c = cloneResult(r);
      c.findings = removeFindings(c.findings, /logging disabled/i);
      return c;
    },
  },
  {
    id: "enable-mfa",
    label: "Enable MFA/OTP everywhere",
    description: "Enables multi-factor authentication for all admin and VPN access",
    apply: (r) => {
      const c = cloneResult(r);
      c.findings = removeFindings(c.findings, /MFA|OTP/i);
      return c;
    },
  },
  {
    id: "remove-any-service",
    label: "Replace all ANY service rules",
    description: "Restricts service to specific protocols on every rule currently using 'Any'",
    apply: (r) => {
      const c = cloneResult(r);
      c.findings = removeFindings(c.findings, /"ANY" service/i);
      return c;
    },
  },
  {
    id: "restrict-admin",
    label: "Restrict admin access to LAN only",
    description: "Removes all management service access from WAN, DMZ, and Guest zones",
    apply: (r) => {
      const c = cloneResult(r);
      c.findings = removeFindings(c.findings, /admin console|ssh accessible|snmp exposed|management service.*exposed/i);
      return c;
    },
  },
];

export function ScoreSimulator({ analysisResults }: Props) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const toggle = useCallback((id: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setActive(new Set(TOGGLES.map((t) => t.id)));
  }, []);

  const clearAll = useCallback(() => {
    setActive(new Set());
  }, []);

  const { current, projected } = useMemo(() => {
    const entries = Object.entries(analysisResults);
    const currentScores: RiskScoreResult[] = [];
    const projectedScores: RiskScoreResult[] = [];

    for (const [, ar] of entries) {
      currentScores.push(computeRiskScore(ar));

      let modified = ar;
      for (const t of TOGGLES) {
        if (active.has(t.id)) modified = t.apply(modified);
      }
      projectedScores.push(computeRiskScore(modified));
    }

    const avg = (scores: RiskScoreResult[]): RiskScoreResult => {
      if (scores.length === 1) return scores[0];
      const labels = scores[0].categories.map((c) => c.label);
      const cats = labels.map((label) => {
        const vals = scores.map((s) => s.categories.find((c) => c.label === label)?.pct ?? 0);
        const a = Math.round(vals.reduce((x, y) => x + y, 0) / vals.length);
        return { label, score: a, maxScore: 100, pct: a, details: "" };
      });
      const overall = Math.round(cats.reduce((s, c) => s + c.pct, 0) / cats.length);
      const grade: RiskScoreResult["grade"] =
        overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";
      return { overall, grade, categories: cats };
    };

    return { current: avg(currentScores), projected: avg(projectedScores) };
  }, [analysisResults, active]);

  const delta = projected.overall - current.overall;
  const findingsResolved = useMemo(() => {
    let cur = 0, proj = 0;
    for (const ar of Object.values(analysisResults)) {
      cur += ar.findings.length;
      let m = ar;
      for (const t of TOGGLES) {
        if (active.has(t.id)) m = t.apply(m);
      }
      proj += m.findings.length;
    }
    return cur - proj;
  }, [analysisResults, active]);

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="h-8 w-8 rounded-lg bg-[#5A00FF]/10 flex items-center justify-center shrink-0">
          <span className="text-lg">🧪</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">What-If Score Simulator</h3>
          <p className="text-[10px] text-muted-foreground">Toggle hypothetical changes to see projected risk score impact</p>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▼" : "▶"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border">
          <div className="flex items-center gap-2 pt-3">
            <button onClick={selectAll} className="text-[10px] text-[#2006F7] dark:text-[#00EDFF] hover:underline font-medium">Select all</button>
            <span className="text-muted-foreground text-[10px]">|</span>
            <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:underline font-medium">Clear</button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {TOGGLES.map((t) => (
              <label
                key={t.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  active.has(t.id) ? "border-[#2006F7]/40 bg-[#2006F7]/[0.04] dark:border-[#00EDFF]/30 dark:bg-[#00EDFF]/[0.04]" : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={active.has(t.id)}
                  onChange={() => toggle(t.id)}
                  className="mt-0.5 accent-[#2006F7]"
                />
                <div>
                  <span className="text-xs font-medium text-foreground">{t.label}</span>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.description}</p>
                </div>
              </label>
            ))}
          </div>

          {active.size > 0 && (
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Current</p>
                  <p className="text-2xl font-extrabold text-foreground">{current.overall}</p>
                  <p className={`text-xs font-bold ${gradeColor(current.grade)}`}>Grade {current.grade}</p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-xl text-muted-foreground">→</span>
                  {delta !== 0 && (
                    <span className={`text-sm font-bold ${delta > 0 ? "text-[#00995a] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
                      {delta > 0 ? "+" : ""}{delta}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Projected</p>
                  <p className={`text-2xl font-extrabold ${gradeColor(projected.grade)}`}>{projected.overall}</p>
                  <p className={`text-xs font-bold ${gradeColor(projected.grade)}`}>Grade {projected.grade}</p>
                </div>
              </div>

              {findingsResolved > 0 && (
                <p className="text-center text-[10px] text-[#00995a] dark:text-[#00F2B3] mt-3 font-medium">
                  {findingsResolved} finding{findingsResolved !== 1 ? "s" : ""} would be resolved
                </p>
              )}

              <div className="mt-4 space-y-1.5">
                {projected.categories.map((pc) => {
                  const cc = current.categories.find((c) => c.label === pc.label);
                  const d = cc ? pc.pct - cc.pct : 0;
                  return (
                    <div key={pc.label} className="flex items-center gap-2 text-[10px]">
                      <span className="text-muted-foreground w-28 truncate">{pc.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pc.pct >= 80 ? "bg-[#00995a] dark:bg-[#00F2B3]" : pc.pct >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]"
                          }`}
                          style={{ width: `${pc.pct}%` }}
                        />
                      </div>
                      <span className="font-bold text-foreground w-8 text-right">{pc.pct}%</span>
                      {d !== 0 && (
                        <span className={`w-8 text-right font-bold ${d > 0 ? "text-[#00995a] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
                          {d > 0 ? "+" : ""}{d}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": case "B": return "text-[#00995a] dark:text-[#00F2B3]";
    case "C": return "text-[#b8a200] dark:text-[#F8E300]";
    case "D": return "text-[#c47800] dark:text-[#F29400]";
    default: return "text-[#EA0022]";
  }
}

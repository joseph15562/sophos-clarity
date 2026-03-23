import { useState, useMemo, useCallback, useEffect } from "react";
import { Shield, TrendingUp, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Zap } from "lucide-react";
import type { AnalysisResult, Finding, Severity } from "@/lib/analyse-config";
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  onProjectedChange?: (projected: RiskScoreResult | null) => void;
  defaultOpen?: boolean;
}

interface Toggle {
  id: string;
  label: string;
  description: string;
  apply: (r: AnalysisResult) => AnalysisResult;
  matchPattern: RegExp;
}

function cloneResult(r: AnalysisResult): AnalysisResult {
  return {
    stats: { ...r.stats },
    findings: r.findings.map((f) => ({ ...f })),
    inspectionPosture: {
      ...r.inspectionPosture,
      sslRules: [...r.inspectionPosture.sslRules],
      sslUncoveredZones: [...r.inspectionPosture.sslUncoveredZones],
      sslUncoveredNetworks: [...r.inspectionPosture.sslUncoveredNetworks],
      allWanSourceZones: [...r.inspectionPosture.allWanSourceZones],
      allWanSourceNetworks: [...r.inspectionPosture.allWanSourceNetworks],
      wanRuleNames: [...r.inspectionPosture.wanRuleNames],
      wanWebServiceRuleNames: [...r.inspectionPosture.wanWebServiceRuleNames],
      wanMissingWebFilterRuleNames: [...r.inspectionPosture.wanMissingWebFilterRuleNames],
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
    description: "Apply web filter policy to every WAN rule with HTTP/HTTPS/ANY service",
    matchPattern: /missing web filtering/i,
    apply: (r) => {
      const c = cloneResult(r);
      c.inspectionPosture.withWebFilter = c.inspectionPosture.webFilterableRules;
      c.inspectionPosture.withoutWebFilter = 0;
      c.inspectionPosture.wanMissingWebFilterRuleNames = [];
      c.findings = removeFindings(c.findings, /missing web filtering/i);
      return c;
    },
  },
  {
    id: "enable-ips",
    label: "Enable IPS on all WAN rules",
    description: "Apply intrusion prevention to every enabled WAN rule",
    matchPattern: /without IPS/i,
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
    description: "Apply application filtering to every enabled WAN rule",
    matchPattern: /without Application Control/i,
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
    description: "Add Decrypt rules so encrypted traffic from all WAN zones is inspected",
    matchPattern: /SSL\/TLS inspection|DPI inactive|not covered by SSL/i,
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
    description: "Turn on traffic logging across all firewall rules for audit readiness",
    matchPattern: /logging disabled/i,
    apply: (r) => {
      const c = cloneResult(r);
      c.findings = removeFindings(c.findings, /logging disabled/i);
      return c;
    },
  },
  {
    id: "enable-mfa",
    label: "Enable MFA / OTP everywhere",
    description: "Require multi-factor authentication for all admin and VPN access",
    matchPattern: /MFA|OTP/i,
    apply: (r) => {
      const c = cloneResult(r);
      c.findings = removeFindings(c.findings, /MFA|OTP/i);
      return c;
    },
  },
  {
    id: "remove-any-service",
    label: "Replace all ANY service rules",
    description: "Restrict service to specific protocols instead of 'Any'",
    matchPattern: /"ANY" service/i,
    apply: (r) => {
      const c = cloneResult(r);
      c.findings = removeFindings(c.findings, /"ANY" service/i);
      return c;
    },
  },
  {
    id: "restrict-admin",
    label: "Restrict admin access to LAN only",
    description: "Remove management service access from WAN, DMZ, and Guest zones",
    matchPattern: /admin console|ssh accessible|snmp exposed|management service.*exposed/i,
    apply: (r) => {
      const c = cloneResult(r);
      c.findings = removeFindings(c.findings, /admin console|ssh accessible|snmp exposed|management service.*exposed/i);
      return c;
    },
  },
];

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

function sevColor(s: Severity): string {
  switch (s) {
    case "critical": return "text-[#EA0022]";
    case "high": return "text-[#F29400]";
    case "medium": return "text-[#b8a200] dark:text-[#F8E300]";
    case "low": return "text-[#00b8d4] dark:text-[#00EDFF]";
    default: return "text-muted-foreground";
  }
}

function gradeColor(grade: string): string {
  switch (grade) {
    case "A": case "B": return "text-[#00F2B3]";
    case "C": return "text-[#b8a200] dark:text-[#F8E300]";
    case "D": return "text-[#c47800] dark:text-[#F29400]";
    default: return "text-[#EA0022]";
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case "A": case "B": return "bg-[#00F2B3]/10 border-[#00F2B3]/30";
    case "C": return "bg-[#F8E300]/10 border-[#F8E300]/30";
    case "D": return "bg-[#F29400]/10 border-[#F29400]/30";
    default: return "bg-[#EA0022]/10 border-[#EA0022]/30";
  }
}

export function ScoreSimulator({ analysisResults, onProjectedChange, defaultOpen = false }: Props) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(defaultOpen);

  const allFindings = useMemo(() => {
    const out: Finding[] = [];
    for (const ar of Object.values(analysisResults)) out.push(...ar.findings);
    return out;
  }, [analysisResults]);

  const relevantToggles = useMemo(() => {
    return TOGGLES.filter((t) => allFindings.some((f) => t.matchPattern.test(f.title)));
  }, [allFindings]);

  const toggle = useCallback((id: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setActive(new Set(relevantToggles.map((t) => t.id)));
  }, [relevantToggles]);

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

  useEffect(() => {
    onProjectedChange?.(active.size > 0 ? projected : null);
  }, [projected, active.size, onProjectedChange]);

  const delta = projected.overall - current.overall;
  const gradeChanged = projected.grade !== current.grade;

  const { resolvedFindings, currentSev, projectedSev } = useMemo(() => {
    const curAll: Finding[] = [];
    const projAll: Finding[] = [];
    for (const ar of Object.values(analysisResults)) {
      curAll.push(...ar.findings);
      let m = ar;
      for (const t of TOGGLES) {
        if (active.has(t.id)) m = t.apply(m);
      }
      projAll.push(...m.findings);
    }
    return {
      resolvedFindings: curAll.length - projAll.length,
      currentSev: countBySeverity(curAll),
      projectedSev: countBySeverity(projAll),
    };
  }, [analysisResults, active]);

  const findingsPerToggle = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of relevantToggles) {
      let total = 0;
      for (const ar of Object.values(analysisResults)) {
        const before = ar.findings.length;
        const after = removeFindings(ar.findings, t.matchPattern).length;
        total += before - after;
      }
      counts.set(t.id, total);
    }
    return counts;
  }, [relevantToggles, analysisResults]);

  const coverageImprovements = useMemo(() => {
    if (active.size === 0) return [];
    const improvements: Array<{ label: string; before: number; after: number }> = [];
    const entries = Object.values(analysisResults);
    if (entries.length === 0) return improvements;

    let beforeWf = 0, afterWf = 0, totalWfRules = 0;
    let beforeIps = 0, afterIps = 0, totalIpsRules = 0;
    let beforeApp = 0, afterApp = 0, totalAppRules = 0;

    for (const ar of entries) {
      let modified = ar;
      for (const t of TOGGLES) {
        if (active.has(t.id)) modified = t.apply(modified);
      }
      const bIp = ar.inspectionPosture;
      const aIp = modified.inspectionPosture;

      if (bIp.webFilterableRules > 0) {
        beforeWf += bIp.withWebFilter;
        afterWf += aIp.withWebFilter;
        totalWfRules += bIp.webFilterableRules;
      }
      if (bIp.enabledWanRules > 0) {
        beforeIps += bIp.withIps;
        afterIps += aIp.withIps;
        totalIpsRules += bIp.enabledWanRules;

        beforeApp += bIp.withAppControl;
        afterApp += aIp.withAppControl;
        totalAppRules += bIp.enabledWanRules;
      }
    }

    if (totalWfRules > 0 && afterWf > beforeWf)
      improvements.push({ label: "Web Filtering", before: Math.round((beforeWf / totalWfRules) * 100), after: Math.round((afterWf / totalWfRules) * 100) });
    if (totalIpsRules > 0 && afterIps > beforeIps)
      improvements.push({ label: "IPS", before: Math.round((beforeIps / totalIpsRules) * 100), after: Math.round((afterIps / totalIpsRules) * 100) });
    if (totalAppRules > 0 && afterApp > beforeApp)
      improvements.push({ label: "App Control", before: Math.round((beforeApp / totalAppRules) * 100), after: Math.round((afterApp / totalAppRules) * 100) });

    return improvements;
  }, [analysisResults, active]);

  if (relevantToggles.length === 0) return null;

  const hasSimulation = active.size > 0;

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden" data-tour="score-simulator">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#5A00FF]/20 to-[#00EDFF]/20 flex items-center justify-center shrink-0">
          <TrendingUp className="h-4.5 w-4.5 text-[#5A00FF] dark:text-[#00EDFF]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Remediation Impact Simulator</h3>
          <p className="text-[10px] text-muted-foreground">Select recommended actions to see projected score, grade, and coverage improvements</p>
        </div>
        {hasSimulation && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#00F2B3]/10 border border-[#00F2B3]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#00F2B3]">
            <TrendingUp className="h-3 w-3" /> +{delta}
          </span>
        )}
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border">
          {/* Action toggles */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">
                {relevantToggles.length} recommended actions based on your findings
              </p>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-[10px] text-[#2006F7] dark:text-[#00EDFF] hover:underline font-medium">Apply all</button>
                <span className="text-muted-foreground text-[10px]">|</span>
                <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:underline font-medium">Reset</button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {relevantToggles.map((t) => {
                const count = findingsPerToggle.get(t.id) ?? 0;
                const isActive = active.has(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all ${
                      isActive
                        ? "border-[#00F2B3]/40 bg-[#00F2B3]/[0.04] dark:border-[#00F2B3]/30"
                        : "border-border hover:bg-muted/30 hover:border-muted-foreground/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggle(t.id)}
                      className="mt-0.5 accent-[#00F2B3]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{t.label}</span>
                        <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                          {count} finding{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.description}</p>
                    </div>
                    {isActive && (
                      <CheckCircle2 className="h-4 w-4 text-[#00F2B3] shrink-0 mt-0.5" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Results panel */}
          {hasSimulation && (
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              {/* Score + Grade header */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-5">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Current</p>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 ${gradeBg(current.grade)}`}>
                    <div>
                      <p className="text-xl font-extrabold text-foreground leading-none">{current.overall}</p>
                      <p className={`text-[10px] font-bold ${gradeColor(current.grade)}`}>{current.grade}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-px bg-gradient-to-r from-transparent via-muted-foreground/40 to-transparent" />
                  <div className={`text-sm font-extrabold ${delta > 0 ? "text-[#00F2B3]" : delta < 0 ? "text-[#EA0022]" : "text-muted-foreground"}`}>
                    {delta > 0 ? "+" : ""}{delta} pts
                  </div>
                  {gradeChanged && (
                    <span className="text-[10px] font-bold text-[#00F2B3]">
                      {current.grade} → {projected.grade}
                    </span>
                  )}
                  <div className="w-10 h-px bg-gradient-to-r from-transparent via-muted-foreground/40 to-transparent" />
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Projected</p>
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 ${gradeBg(projected.grade)}`}>
                    <div>
                      <p className={`text-xl font-extrabold leading-none ${gradeColor(projected.grade)}`}>{projected.overall}</p>
                      <p className={`text-[10px] font-bold ${gradeColor(projected.grade)}`}>{projected.grade}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Findings severity breakdown */}
              {resolvedFindings > 0 && (
                <div className="border-t border-border px-5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-3.5 w-3.5 text-[#00F2B3]" />
                    <span className="text-xs font-semibold text-foreground">
                      {resolvedFindings} finding{resolvedFindings !== 1 ? "s" : ""} resolved
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {SEVERITY_ORDER.filter((s) => s !== "info").map((s) => {
                      const reduced = currentSev[s] - projectedSev[s];
                      if (reduced <= 0) return null;
                      return (
                        <span key={s} className={`text-[11px] font-medium ${sevColor(s)}`}>
                          {reduced} {s}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Coverage improvements */}
              {coverageImprovements.length > 0 && (
                <div className="border-t border-border px-5 py-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Zap className="h-3.5 w-3.5 text-[#00EDFF]" />
                    <span className="text-xs font-semibold text-foreground">Coverage improvements</span>
                  </div>
                  <div className="space-y-2">
                    {coverageImprovements.map((ci) => (
                      <div key={ci.label} className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground w-24 shrink-0">{ci.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden relative">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/20"
                            style={{ width: `${ci.before}%` }}
                          />
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-[#00F2B3] transition-all"
                            style={{ width: `${ci.after}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-[#00F2B3] w-16 text-right shrink-0">
                          {ci.before}% → {ci.after}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-category score bars */}
              <div className="border-t border-border px-5 py-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-2">Category breakdown</p>
                <div className="space-y-1.5">
                  {projected.categories.map((pc) => {
                    const cc = current.categories.find((c) => c.label === pc.label);
                    const d = cc ? pc.pct - cc.pct : 0;
                    return (
                      <div key={pc.label} className="flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground w-28 truncate shrink-0">{pc.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pc.pct >= 80 ? "bg-[#00F2B3]" : pc.pct >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]"
                            }`}
                            style={{ width: `${pc.pct}%` }}
                          />
                        </div>
                        <span className="font-bold text-foreground w-8 text-right shrink-0">{pc.pct}%</span>
                        {d !== 0 && (
                          <span className={`w-8 text-right font-bold shrink-0 ${d > 0 ? "text-[#00F2B3]" : "text-[#EA0022]"}`}>
                            +{d}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty state prompt */}
          {!hasSimulation && (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Select one or more actions above to see the projected impact on your risk score, grade, and security coverage.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

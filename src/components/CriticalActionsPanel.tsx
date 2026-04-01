import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FileSearch, Shield } from "lucide-react";
import type { AnalysisResult, Finding, Severity } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { loadAcceptedFindings, isAccepted, type AcceptedFinding } from "@/lib/accepted-findings";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  onExplainFinding?: (title: string) => void;
}

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const SEV_COLORS: Record<Severity, { badge: string; border: string; hex: string }> = {
  critical: {
    badge: "bg-[#EA0022]/10 text-[#EA0022]",
    border: "border-l-[#EA0022]",
    hex: "#EA0022",
  },
  high: {
    badge: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
    border: "border-l-[#F29400]",
    hex: "#F29400",
  },
  medium: {
    badge: "bg-[#ca8a04]/12 text-[#78350f] dark:bg-[#F8E300]/10 dark:text-[#F8E300]",
    border: "border-l-[#ca8a04] dark:border-l-[#F8E300]",
    hex: "#ca8a04",
  },
  low: {
    badge: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#00F2B3]",
    border: "border-l-[#00F2B3]",
    hex: "#00F2B3",
  },
  info: {
    badge: "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]",
    border: "border-l-[#009CFB]",
    hex: "#009CFB",
  },
};

function estimateImpact(severity: Severity, score: number): string {
  if (severity === "critical")
    return `+${Math.min(15, Math.max(5, Math.round((100 - score) * 0.15)))} pts`;
  if (severity === "high")
    return `+${Math.min(10, Math.max(3, Math.round((100 - score) * 0.08)))} pts`;
  return `+${Math.min(5, Math.max(1, Math.round((100 - score) * 0.04)))} pts`;
}

export function CriticalActionsPanel({ analysisResults, onExplainFinding }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [acceptedList, setAcceptedList] = useState<AcceptedFinding[]>([]);

  useEffect(() => {
    loadAcceptedFindings().then(setAcceptedList);
    const refresh = () => loadAcceptedFindings().then(setAcceptedList);
    window.addEventListener("accepted-findings-changed", refresh);
    return () => window.removeEventListener("accepted-findings-changed", refresh);
  }, []);

  const { actions, avgScore } = useMemo(() => {
    const all: (Finding & { firewall: string })[] = [];
    let totalScore = 0;
    const entries = Object.entries(analysisResults);

    for (const [label, ar] of entries) {
      totalScore += computeRiskScore(ar).overall;
      for (const f of ar.findings) {
        if (isAccepted(acceptedList, f.title)) continue;
        all.push({ ...f, firewall: label });
      }
    }

    const sorted = all
      .filter((f) => f.severity !== "info")
      .sort((a, b) => {
        const sevDiff = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
        if (sevDiff !== 0) return sevDiff;
        return (b.remediation?.length ?? 0) - (a.remediation?.length ?? 0);
      });

    const seen = new Set<string>();
    const deduped: typeof sorted = [];
    for (const f of sorted) {
      if (!seen.has(f.title)) {
        seen.add(f.title);
        deduped.push(f);
      }
      if (deduped.length >= 5) break;
    }

    return {
      actions: deduped,
      avgScore: entries.length > 0 ? Math.round(totalScore / entries.length) : 0,
    };
  }, [analysisResults, acceptedList]);

  if (actions.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 space-y-4 shadow-card"
      style={{ background: "linear-gradient(145deg, rgba(234,0,34,0.06), rgba(234,0,34,0.015))" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full blur-[32px] opacity-15 bg-[#EA0022]" />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(234,0,34,0.22), transparent)",
        }}
      />
      <div className="relative flex items-center gap-2.5">
        <div
          className="h-8 w-8 rounded-xl flex items-center justify-center border border-slate-900/[0.12] dark:border-white/[0.08]"
          style={{ backgroundColor: "rgba(234,0,34,0.12)" }}
        >
          <AlertTriangle className="h-4 w-4 text-[#EA0022]" />
        </div>
        <div>
          <h3 className="text-sm font-display tracking-tight font-bold text-foreground">
            Top {actions.length} Critical Actions
          </h3>
          <p className="text-[10px] text-muted-foreground/80">
            Highest-impact remediations ranked by severity and expected score improvement
          </p>
        </div>
      </div>

      <div className="relative space-y-2.5">
        {actions.map((f, i) => {
          const colors = SEV_COLORS[f.severity];
          const hex = colors.hex;
          const expanded = expandedIdx === i;
          return (
            <div
              key={`${f.id}-${i}`}
              className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] border-l-[3px] transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
              style={{
                borderLeftColor: hex,
                background: `linear-gradient(135deg, ${hex}0C, ${hex}03)`,
              }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute -top-4 -left-4 h-10 w-10 rounded-full blur-[20px] opacity-15"
                  style={{ backgroundColor: hex }}
                />
              </div>
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${hex}30, transparent 60%)` }}
              />
              <button
                onClick={() => setExpandedIdx(expanded ? null : i)}
                className="relative w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02] transition-colors"
              >
                <span
                  className="shrink-0 text-xs font-black tabular-nums w-5 text-right mt-0.5"
                  style={{ color: hex }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border"
                      style={{
                        color: hex,
                        backgroundColor: `${hex}14`,
                        borderColor: `${hex}25`,
                      }}
                    >
                      {f.severity}
                    </span>
                    <span className="text-xs font-bold text-foreground">{f.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                    {f.firewall}
                    <span className="mx-1.5 text-white/10">·</span>
                    Est. impact:{" "}
                    <span className="font-bold text-[#00F2B3]">
                      {estimateImpact(f.severity, avgScore)}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 mt-1" style={{ color: hex }}>
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>

              {expanded && (
                <div className="relative px-4 pb-3.5 pl-12 space-y-2 border-t border-slate-900/[0.10] dark:border-white/[0.06] pt-2.5">
                  {f.remediation && (
                    <div>
                      <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.18em] mb-0.5">
                        Recommended Action
                      </p>
                      <p className="text-[11px] text-foreground leading-relaxed">{f.remediation}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-brand-accent uppercase tracking-[0.18em] mb-0.5 flex items-center gap-1">
                      <FileSearch className="h-3 w-3" /> Evidence Source
                    </p>
                    <p className="text-[11px] text-foreground leading-relaxed">
                      <span className="font-medium">Section:</span> {f.section}
                      {f.evidence && (
                        <>
                          <br />
                          <span className="font-medium">Extracted fact:</span> {f.evidence}
                        </>
                      )}
                      {f.confidence && (
                        <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border border-slate-900/[0.12] dark:border-white/[0.08] bg-white/75 dark:bg-white/[0.04] text-muted-foreground">
                          {f.confidence} confidence
                        </span>
                      )}
                    </p>
                  </div>
                  {onExplainFinding && (
                    <button
                      onClick={() => onExplainFinding(f.title)}
                      className="text-[10px] font-bold text-brand-accent hover:underline flex items-center gap-1"
                    >
                      <Shield className="h-3 w-3" /> Explain with AI
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

const SEV_COLORS: Record<Severity, { badge: string; border: string }> = {
  critical: { badge: "bg-[#EA0022]/10 text-[#EA0022]", border: "border-l-[#EA0022]" },
  high: {
    badge: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
    border: "border-l-[#F29400]",
  },
  medium: {
    badge: "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]",
    border: "border-l-[#F8E300]",
  },
  low: { badge: "bg-[#00F2B3]/10 text-[#00F2B3]", border: "border-l-[#00F2B3]" },
  info: {
    badge: "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]",
    border: "border-l-[#009CFB]",
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
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-[#EA0022]/10 flex items-center justify-center">
          <AlertTriangle className="h-4 w-4 text-[#EA0022]" />
        </div>
        <div>
          <h3 className="text-sm font-display tracking-tight font-bold text-foreground">
            Top {actions.length} Critical Actions
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Highest-impact remediations ranked by severity and expected score improvement
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {actions.map((f, i) => {
          const colors = SEV_COLORS[f.severity];
          const expanded = expandedIdx === i;
          return (
            <div
              key={`${f.id}-${i}`}
              className={`rounded-lg border border-border border-l-[3px] ${colors.border} bg-background/50 overflow-hidden`}
            >
              <button
                onClick={() => setExpandedIdx(expanded ? null : i)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <span className="shrink-0 text-xs font-black text-muted-foreground tabular-nums w-5 text-right mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.badge}`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-xs font-semibold text-foreground">{f.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {f.firewall}
                    <span className="mx-1.5 text-border">·</span>
                    Est. impact:{" "}
                    <span className="font-semibold text-[#00F2B3]">
                      {estimateImpact(f.severity, avgScore)}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground mt-1">
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>

              {expanded && (
                <div className="px-4 pb-3 pl-12 space-y-2 border-t border-border/50 pt-2.5">
                  {f.remediation && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                        Recommended Action
                      </p>
                      <p className="text-[11px] text-foreground leading-relaxed">{f.remediation}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
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
                        <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {f.confidence} confidence
                        </span>
                      )}
                    </p>
                  </div>
                  {onExplainFinding && (
                    <button
                      onClick={() => onExplainFinding(f.title)}
                      className="text-[10px] font-medium text-brand-accent hover:underline flex items-center gap-1"
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

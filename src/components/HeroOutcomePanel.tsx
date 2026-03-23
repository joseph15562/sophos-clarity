import { useMemo } from "react";
import { Shield, AlertTriangle, FileCheck2, TrendingUp, Zap } from "lucide-react";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  totalFindings: number;
  fileCount: number;
  extractionPct: number;
  hasComplianceFrameworks: boolean;
  hasReports: boolean;
}

const GRADE_STYLE: Record<string, { ring: string; text: string; bg: string; label: string }> = {
  A: { ring: "ring-[#00F2B3]", text: "text-[#00F2B3]", bg: "bg-[#00F2B3]/10", label: "Excellent" },
  B: { ring: "ring-[#00F2B3]", text: "text-[#00F2B3]", bg: "bg-[#00F2B3]/10", label: "Good" },
  C: { ring: "ring-[#F29400]", text: "text-[#F29400]", bg: "bg-[#F29400]/10", label: "Needs Improvement" },
  D: { ring: "ring-[#EA0022]", text: "text-[#EA0022]", bg: "bg-[#EA0022]/10", label: "At Risk" },
  F: { ring: "ring-[#EA0022]", text: "text-[#EA0022]", bg: "bg-[#EA0022]/10", label: "Critical Risk" },
};

export function HeroOutcomePanel({ analysisResults, totalFindings, fileCount, extractionPct, hasComplianceFrameworks, hasReports }: Props) {
  const { score, grade, critCount, highCount, topActions, coveragePct } = useMemo(() => {
    const entries = Object.entries(analysisResults);
    if (entries.length === 0) return { score: 0, grade: "F" as const, critCount: 0, highCount: 0, topActions: [] as string[], coveragePct: 0 };

    let totalScore = 0;
    let crit = 0;
    let high = 0;
    const sevCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const actionSet = new Set<string>();

    for (const [, ar] of entries) {
      const rs = computeRiskScore(ar);
      totalScore += rs.overall;
      for (const f of ar.findings) {
        sevCounts[f.severity]++;
        if (f.severity === "critical") crit++;
        if (f.severity === "high") high++;
        if (f.remediation && (f.severity === "critical" || f.severity === "high") && actionSet.size < 3) {
          actionSet.add(f.remediation.slice(0, 80));
        }
      }
    }

    const avgScore = Math.round(totalScore / entries.length);
    const g = avgScore >= 90 ? "A" : avgScore >= 75 ? "B" : avgScore >= 60 ? "C" : avgScore >= 40 ? "D" : "F";

    let covTotal = 0;
    let covCount = 0;
    for (const [, ar] of entries) {
      const ip = ar.inspectionPosture;
      const activeWan = ip.enabledWanRules || 1;
      covTotal += ((ip.withWebFilter + ip.withIps + ip.withAppControl) / (activeWan * 3)) * 100;
      covCount++;
    }

    return {
      score: avgScore,
      grade: g,
      critCount: crit,
      highCount: high,
      topActions: Array.from(actionSet),
      coveragePct: covCount > 0 ? Math.round(covTotal / covCount) : 0,
    };
  }, [analysisResults]);

  const gs = GRADE_STYLE[grade] ?? GRADE_STYLE.F;

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-5 sm:p-6 space-y-5">
      {/* Row 1: Score + headline */}
      <div className="flex items-center gap-5">
        <div className={`shrink-0 h-20 w-20 rounded-2xl ring-2 ${gs.ring} ${gs.bg} flex flex-col items-center justify-center`}>
          <span className={`text-3xl font-black tabular-nums ${gs.text}`}>{score}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${gs.text}`}>{grade}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-display font-bold text-foreground tracking-tight">
            Security Posture: <span className={gs.text}>{gs.label}</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {fileCount} firewall{fileCount > 1 ? "s" : ""} assessed · {extractionPct}% config extraction · {totalFindings} finding{totalFindings !== 1 ? "s" : ""} identified
          </p>
        </div>
      </div>

      {/* Row 2: Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Critical / High"
          value={`${critCount + highCount}`}
          accent={critCount + highCount > 0 ? "red" : "green"}
        />
        <StatPill
          icon={<Shield className="h-3.5 w-3.5" />}
          label="Security Coverage"
          value={`${coveragePct}%`}
          accent={coveragePct >= 70 ? "green" : coveragePct >= 40 ? "amber" : "red"}
        />
        <StatPill
          icon={<FileCheck2 className="h-3.5 w-3.5" />}
          label="Compliance"
          value={hasComplianceFrameworks ? "Mapped" : "Not Set"}
          accent={hasComplianceFrameworks ? "green" : "neutral"}
        />
        <StatPill
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Reports"
          value={hasReports ? "Ready" : "Pending"}
          accent={hasReports ? "green" : "neutral"}
        />
      </div>

      {/* Row 3: Top quick actions */}
      {topActions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Top Actions to Improve Score
          </p>
          {topActions.map((a, i) => (
            <p key={i} className="text-[11px] text-foreground pl-5 before:content-['→'] before:mr-1.5 before:text-muted-foreground">
              {a}{a.length >= 80 ? "…" : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: "red" | "amber" | "green" | "neutral" }) {
  const colors = {
    red: "border-[#EA0022]/20 bg-[#EA0022]/[0.04] text-[#EA0022]",
    amber: "border-[#F29400]/20 bg-[#F29400]/[0.04] text-[#F29400]",
    green: "border-[#00F2B3]/20 bg-[#00F2B3]/[0.04] text-[#00F2B3]",
    neutral: "border-border bg-muted/30 text-muted-foreground",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${colors[accent]}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className={`text-lg font-bold mt-0.5 tabular-nums ${accent !== "neutral" ? colors[accent].split(" ").pop() : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

import { useMemo } from "react";
import { Shield, AlertTriangle, FileCheck2, TrendingUp, Zap, Clock3, Sparkles } from "lucide-react";
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

type HeroAction = {
  title: string;
  remediation?: string;
  section: string;
  evidence?: string;
  severity: Severity;
};

const GRADE_STYLE: Record<string, { ring: string; text: string; bg: string; label: string }> = {
  A: { ring: "ring-[#00F2B3]", text: "text-[#00F2B3]", bg: "bg-[#00F2B3]/10", label: "Excellent" },
  B: { ring: "ring-[#00F2B3]", text: "text-[#00F2B3]", bg: "bg-[#00F2B3]/10", label: "Good" },
  C: { ring: "ring-[#F29400]", text: "text-[#F29400]", bg: "bg-[#F29400]/10", label: "Needs Improvement" },
  D: { ring: "ring-[#EA0022]", text: "text-[#EA0022]", bg: "bg-[#EA0022]/10", label: "At Risk" },
  F: { ring: "ring-[#EA0022]", text: "text-[#EA0022]", bg: "bg-[#EA0022]/10", label: "Critical Risk" },
};

const IMPACT_COPY = {
  manualHours: "3–4 hours",
  withFireComply: "< 2 minutes",
  effortSaved: "90%+",
};

function trimEvidence(evidence?: string, max = 88) {
  if (!evidence) return undefined;
  return evidence.length > max ? `${evidence.slice(0, max)}…` : evidence;
}

export function HeroOutcomePanel({ analysisResults, totalFindings, fileCount, extractionPct, hasComplianceFrameworks, hasReports }: Props) {
  const { score, grade, critCount, highCount, topActions, coveragePct } = useMemo(() => {
    const entries = Object.entries(analysisResults);
    if (entries.length === 0) {
      return {
        score: 0,
        grade: "F" as const,
        critCount: 0,
        highCount: 0,
        topActions: [] as HeroAction[],
        coveragePct: 0,
      };
    }

    let totalScore = 0;
    let crit = 0;
    let high = 0;
    const seenTitles = new Set<string>();
    const actions: HeroAction[] = [];

    for (const [, ar] of entries) {
      const rs = computeRiskScore(ar);
      totalScore += rs.overall;
      for (const f of ar.findings) {
        if (f.severity === "critical") crit++;
        if (f.severity === "high") high++;
        if (
          (f.severity === "critical" || f.severity === "high") &&
          !seenTitles.has(f.title) &&
          actions.length < 3
        ) {
          seenTitles.add(f.title);
          actions.push({
            title: f.title,
            remediation: f.remediation,
            section: f.section,
            evidence: trimEvidence(f.evidence),
            severity: f.severity,
          });
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
      topActions: actions,
      coveragePct: covCount > 0 ? Math.round(covTotal / covCount) : 0,
    };
  }, [analysisResults]);

  const gs = GRADE_STYLE[grade] ?? GRADE_STYLE.F;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.12),transparent_28%),linear-gradient(135deg,rgba(9,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.08)] p-6 sm:p-7 space-y-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-5 min-w-0">
          <div className={`shrink-0 h-24 w-24 rounded-[22px] ring-2 ${gs.ring} ${gs.bg} flex flex-col items-center justify-center shadow-sm`}>
            <span className={`text-4xl font-black tabular-nums ${gs.text}`}>{score}</span>
            <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${gs.text}`}>{grade}</span>
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-accent">
              <Sparkles className="h-3 w-3" />
              FireComply Outcome Summary
            </div>
            <h3 className="mt-3 text-2xl sm:text-[2rem] font-display font-black text-foreground tracking-tight leading-tight">
              Security Posture: <span className={gs.text}>{gs.label}</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
              {fileCount} firewall{fileCount > 1 ? "s" : ""} assessed with {extractionPct}% extraction coverage. FireComply converts raw Sophos exports into deterministic findings, priority actions, and client-ready reports in minutes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 min-w-full sm:min-w-[340px] lg:max-w-[380px]">
          <ValueCard label="Manual review" value={IMPACT_COPY.manualHours} sublabel="Typical MSP effort" />
          <ValueCard label="With FireComply" value={IMPACT_COPY.withFireComply} sublabel="Demo-ready outcome" accent="primary" />
          <ValueCard label="Effort saved" value={IMPACT_COPY.effortSaved} sublabel="Assessment & reporting" accent="success" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          label="Report Readiness"
          value={hasReports ? "Ready" : "Generate"}
          accent={hasReports ? "green" : "neutral"}
        />
      </div>

      {topActions.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.24em] flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-[#F29400]" /> Top Actions to Improve Score
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" /> Deterministic findings before AI reporting
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {topActions.map((action, i) => (
              <div key={`${action.title}-${i}`} className="rounded-xl border border-border bg-background/70 px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${action.severity === "critical" ? "bg-[#EA0022]/10 text-[#EA0022]" : "bg-[#F29400]/10 text-[#F29400]"}`}>
                    {action.severity}
                  </span>
                  <span className="text-xs font-semibold text-foreground">{action.title}</span>
                </div>
                {action.remediation && (
                  <p className="text-[11px] text-foreground leading-relaxed">{action.remediation}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">Evidence source:</span> {action.section}
                  {action.evidence ? ` · ${action.evidence}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ValueCard({ label, value, sublabel, accent = "neutral" }: { label: string; value: string; sublabel: string; accent?: "neutral" | "primary" | "success" }) {
  const styles = {
    neutral: "border-border bg-card/70 text-foreground",
    primary: "border-brand-accent/20 bg-brand-accent/[0.05] text-brand-accent",
    success: "border-[#00F2B3]/20 bg-[#00F2B3]/[0.05] text-[#00774a] dark:text-[#00F2B3]",
  } as const;
  return (
    <div className={`rounded-2xl border px-3 py-3 ${styles[accent]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
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
    <div className={`rounded-2xl border px-4 py-3 ${colors[accent]}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {icon} {label}
      </div>
      <p className={`text-2xl font-black mt-1 tabular-nums ${accent !== "neutral" ? colors[accent].split(" ").pop() : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

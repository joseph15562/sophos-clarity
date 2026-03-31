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
  A: {
    ring: "ring-[#00F2B3]",
    text: "text-[#00F2B3]",
    bg: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10",
    label: "Excellent",
  },
  B: {
    ring: "ring-[#00F2B3]",
    text: "text-[#00F2B3]",
    bg: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10",
    label: "Good",
  },
  C: {
    ring: "ring-[#F29400]",
    text: "text-[#F29400]",
    bg: "bg-[#F29400]/10",
    label: "Needs Improvement",
  },
  D: { ring: "ring-[#EA0022]", text: "text-[#EA0022]", bg: "bg-[#EA0022]/10", label: "At Risk" },
  F: {
    ring: "ring-[#EA0022]",
    text: "text-[#EA0022]",
    bg: "bg-[#EA0022]/10",
    label: "Critical Risk",
  },
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

export function HeroOutcomePanel({
  analysisResults,
  totalFindings,
  fileCount,
  extractionPct,
  hasComplianceFrameworks,
  hasReports,
}: Props) {
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
    const g =
      avgScore >= 90
        ? "A"
        : avgScore >= 75
          ? "B"
          : avgScore >= 60
            ? "C"
            : avgScore >= 40
              ? "D"
              : "F";

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
    <div className="relative isolate contain-paint overflow-hidden rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.12),transparent_28%),linear-gradient(135deg,rgba(9,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.08)] p-6 sm:p-7 space-y-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-5 min-w-0">
          <div
            className={`shrink-0 h-24 w-24 rounded-[22px] ring-2 ${gs.ring} ${gs.bg} flex flex-col items-center justify-center shadow-sm`}
          >
            <span className={`text-4xl font-black tabular-nums ${gs.text}`}>{score}</span>
            <span className={`text-[10px] font-bold uppercase tracking-[0.22em] ${gs.text}`}>
              {grade}
            </span>
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
              {fileCount} firewall{fileCount > 1 ? "s" : ""} assessed with {extractionPct}%
              extraction coverage. FireComply converts raw Sophos exports into deterministic
              findings, priority actions, and client-ready reports in minutes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 min-w-full sm:min-w-[340px] lg:max-w-[380px]">
          <ValueCard
            label="Manual review"
            value={IMPACT_COPY.manualHours}
            sublabel="Typical MSP effort"
          />
          <ValueCard
            label="With FireComply"
            value={IMPACT_COPY.withFireComply}
            sublabel="Demo-ready outcome"
            accent="primary"
          />
          <ValueCard
            label="Effort saved"
            value={IMPACT_COPY.effortSaved}
            sublabel="Assessment & reporting"
            accent="success"
          />
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
        <div className="rounded-2xl border border-[#F29400]/20 bg-[linear-gradient(135deg,rgba(242,148,0,0.04),rgba(234,0,34,0.02),transparent_60%)] dark:bg-[linear-gradient(135deg,rgba(242,148,0,0.08),rgba(234,0,34,0.04),transparent_60%)] backdrop-blur-sm p-4 sm:p-5 space-y-4 shadow-card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#F29400]/20 bg-[#F29400]/[0.08] dark:bg-[#F29400]/[0.12] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F29400]">
              <Zap className="h-3 w-3" /> Top Actions to Improve Score
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" /> Deterministic findings before AI reporting
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {topActions.map((action, i) => {
              const isCrit = action.severity === "critical";
              const sevHex = isCrit ? "#EA0022" : "#F29400";
              return (
                <div
                  key={`${action.title}-${i}`}
                  className="relative isolate overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] border-l-[3px] px-4 py-4 contain-paint space-y-2.5 shadow-card transition-all duration-200 hover:scale-[1.02] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
                  style={{
                    borderLeftColor: sevHex,
                    background: `radial-gradient(120% 95% at 100% 0%, ${sevHex}40, transparent 58%), linear-gradient(145deg, ${sevHex}10, ${sevHex}04)`,
                  }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-px pointer-events-none"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${sevHex}30, transparent)`,
                    }}
                  />

                  <div className="relative flex items-center gap-2.5 flex-wrap">
                    <span
                      className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg tracking-wider border"
                      style={{
                        color: sevHex,
                        backgroundColor: `${sevHex}14`,
                        borderColor: `${sevHex}25`,
                      }}
                    >
                      {action.severity}
                    </span>
                    <span className="text-sm font-bold text-foreground leading-tight">
                      {action.title}
                    </span>
                  </div>
                  {action.remediation && (
                    <p className="relative text-[11px] text-foreground/85 leading-relaxed">
                      {action.remediation}
                    </p>
                  )}
                  <div
                    className="relative rounded-lg border border-slate-900/[0.10] dark:border-white/[0.06] px-3 py-2"
                    style={{ background: `linear-gradient(135deg, ${sevHex}06, transparent)` }}
                  >
                    <p className="text-[10px] text-muted-foreground/90">
                      <span className="font-bold" style={{ color: sevHex }}>
                        Evidence source:
                      </span>{" "}
                      {action.section}
                      {action.evidence ? ` · ${action.evidence}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const VALUE_HEX = {
  neutral: "#2006F7",
  primary: "#2006F7",
  success: "#00F2B3",
} as const;

function ValueCard({
  label,
  value,
  sublabel,
  accent = "neutral",
}: {
  label: string;
  value: string;
  sublabel: string;
  accent?: "neutral" | "primary" | "success";
}) {
  const hex = VALUE_HEX[accent];
  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] px-3 py-3 contain-paint transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{
        background: `radial-gradient(130% 100% at 100% 0%, ${hex}38, transparent 56%), linear-gradient(145deg, ${hex}10, ${hex}04)`,
      }}
    >
      <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
        {label}
      </p>
      <p className="relative mt-1 text-xl font-black tracking-tight" style={{ color: hex }}>
        {value}
      </p>
      <p className="relative text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
    </div>
  );
}

const STAT_HEX = {
  red: "#EA0022",
  amber: "#F29400",
  green: "#00F2B3",
  neutral: "#2006F7",
} as const;

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "red" | "amber" | "green" | "neutral";
}) {
  const hex = STAT_HEX[accent];
  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3 contain-paint transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
      style={{
        background: `radial-gradient(130% 100% at 100% 0%, ${hex}38, transparent 56%), linear-gradient(145deg, ${hex}10, ${hex}04)`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}28, transparent)` }}
      />
      <div className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/80">
        {icon} {label}
      </div>
      <p className="relative text-2xl font-black mt-1 tabular-nums" style={{ color: hex }}>
        {value}
      </p>
    </div>
  );
}

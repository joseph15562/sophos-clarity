import { useMemo } from "react";
import { Shield, AlertTriangle, FileCheck2, TrendingUp, Zap, Clock3, Sparkles } from "lucide-react";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { cn } from "@/lib/utils";
import { accentKindFromHex, statIconTextClass, statValueTextClass } from "@/lib/stat-accent";

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
    ring: "ring-emerald-700 dark:ring-[#00F2B3]",
    text: "text-emerald-800 dark:text-[#00F2B3]",
    bg: "bg-emerald-100/90 dark:bg-[#00F2B3]/10",
    label: "Excellent",
  },
  B: {
    ring: "ring-emerald-700 dark:ring-[#00F2B3]",
    text: "text-emerald-800 dark:text-[#00F2B3]",
    bg: "bg-emerald-100/90 dark:bg-[#00F2B3]/10",
    label: "Good",
  },
  C: {
    ring: "ring-amber-700 dark:ring-[#F29400]",
    text: "text-amber-950 dark:text-[#F29400]",
    bg: "bg-amber-100/90 dark:bg-[#F29400]/10",
    label: "Needs Improvement",
  },
  D: {
    ring: "ring-rose-700 dark:ring-[#EA0022]",
    text: "text-rose-800 dark:text-[#EA0022]",
    bg: "bg-rose-100/90 dark:bg-[#EA0022]/10",
    label: "At Risk",
  },
  F: {
    ring: "ring-rose-700 dark:ring-[#EA0022]",
    text: "text-rose-800 dark:text-[#EA0022]",
    bg: "bg-rose-100/90 dark:bg-[#EA0022]/10",
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
  totalFindings: _totalFindings,
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
        <div
          className={cn(
            "space-y-4 rounded-2xl border p-4 shadow-card backdrop-blur-sm sm:p-5",
            "border-amber-200/70 bg-amber-50/45",
            "dark:border-amber-500/25 dark:bg-white/[0.04] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-100/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/55 dark:text-amber-300">
              <Zap className="h-3 w-3" /> Top Actions to Improve Score
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400">
              <Clock3 className="h-3.5 w-3.5" /> Deterministic findings before AI reporting
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {topActions.map((action, i) => {
              const isCrit = action.severity === "critical";
              const sevHex = isCrit ? "#EA0022" : "#F29400";
              const sevKind = isCrit ? "red" : "amber";
              return (
                <div
                  key={`${action.title}-${i}`}
                  className={cn(
                    "relative isolate overflow-hidden rounded-2xl border pl-5 pr-4 py-4 contain-paint space-y-2.5 shadow-card transition-all duration-200 hover:scale-[1.02] hover:shadow-elevated",
                    "border-slate-200/90 bg-card",
                    "dark:border-white/[0.10] dark:bg-white/[0.05]",
                    "hover:border-slate-300/90 dark:hover:border-white/[0.14]",
                  )}
                >
                  <div
                    className="absolute inset-y-0 left-0 w-[3px]"
                    style={{ backgroundColor: sevHex }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 hidden dark:block opacity-50"
                    style={{
                      background: `radial-gradient(120% 95% at 100% 0%, ${sevHex}35, transparent 58%), linear-gradient(145deg, ${sevHex}12, transparent)`,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 hidden h-px dark:block"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${sevHex}35, transparent)`,
                    }}
                  />

                  <div className="relative flex items-center gap-2.5 flex-wrap">
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg tracking-wider border",
                        sevKind === "red"
                          ? "border-rose-300/70 bg-rose-100/80 text-rose-900 dark:border-rose-500/45 dark:bg-rose-950/60 dark:text-rose-300"
                          : "border-amber-300/70 bg-amber-100/80 text-amber-950 dark:border-amber-500/45 dark:bg-amber-950/55 dark:text-amber-300",
                      )}
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
                    className={cn(
                      "relative rounded-lg border px-3 py-2",
                      "border-slate-200/80 bg-slate-50/90",
                      "dark:border-white/10 dark:bg-slate-950/85",
                    )}
                  >
                    <p className="text-[10px] text-slate-700 dark:text-zinc-300">
                      <span
                        className={cn(
                          "font-bold",
                          sevKind === "red"
                            ? "text-rose-800 dark:text-rose-300"
                            : "text-amber-950 dark:text-amber-300",
                        )}
                      >
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
  const kind = accentKindFromHex(hex);
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border px-3 py-3 contain-paint transition-all duration-200 hover:shadow-elevated",
        "border-slate-200/90 bg-card shadow-sm",
        "dark:border-white/[0.06] dark:bg-transparent dark:shadow-none",
        "hover:border-slate-300/80 dark:hover:border-white/[0.12]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background: `radial-gradient(130% 100% at 100% 0%, ${hex}38, transparent 56%), linear-gradient(145deg, ${hex}10, ${hex}04)`,
        }}
      />
      <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn("relative mt-1 text-xl font-black tracking-tight", statValueTextClass(kind))}
      >
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
  const kind = accentKindFromHex(hex);
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border px-4 py-3 contain-paint transition-all duration-200",
        "border-slate-200/90 bg-card shadow-sm",
        "dark:border-white/[0.06] dark:bg-transparent dark:shadow-none",
        "hover:border-slate-300/80 dark:hover:border-white/[0.12]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background: `radial-gradient(130% 100% at 100% 0%, ${hex}38, transparent 56%), linear-gradient(145deg, ${hex}10, ${hex}04)`,
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none hidden dark:block"
        style={{ background: `linear-gradient(90deg, transparent, ${hex}28, transparent)` }}
      />
      <div className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:text-muted-foreground/80">
        <span className={cn("inline-flex shrink-0", statIconTextClass(kind))}>{icon}</span>
        {label}
      </div>
      <p className={cn("relative text-2xl font-black mt-1 tabular-nums", statValueTextClass(kind))}>
        {value}
      </p>
    </div>
  );
}

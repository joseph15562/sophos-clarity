import { useMemo, useState } from "react";
import { Layers, Copy, EyeOff, Merge, ChevronDown } from "lucide-react";
import type { ParsedFile } from "@/hooks/use-report-generation";
import {
  analyseRuleOptimisation,
  type OptimiserResult,
  type RuleIssue,
} from "@/lib/rule-optimiser";

interface Props {
  files: ParsedFile[];
}

const ISSUE_CONFIG = {
  duplicate: {
    icon: Copy,
    label: "Duplicate Rules",
    color: "text-[#F29400]",
    bg: "bg-[#F29400]/15",
    accentBar: "linear-gradient(180deg, rgba(242,148,0,0.9), rgba(242,148,0,0.12))",
    iconGlow: "shadow-[0_0_16px_rgba(242,148,0,0.35)]",
    border: "border-[#F29400]/35",
  },
  shadowed: {
    icon: EyeOff,
    label: "Shadowed Rules",
    color: "text-[#EA0022]",
    bg: "bg-[#EA0022]/15",
    accentBar: "linear-gradient(180deg, rgba(234,0,34,0.9), rgba(234,0,34,0.12))",
    iconGlow: "shadow-[0_0_16px_rgba(234,0,34,0.35)]",
    border: "border-[#EA0022]/35",
  },
  mergeable: {
    icon: Merge,
    label: "Merge Candidates",
    color: "text-[#009CFB]",
    bg: "bg-[#009CFB]/15",
    accentBar: "linear-gradient(180deg, rgba(0,156,251,0.9), rgba(0,156,251,0.12))",
    iconGlow: "shadow-[0_0_16px_rgba(0,156,251,0.35)]",
    border: "border-[#009CFB]/35",
  },
} as const;

function IssueCard({ issue }: { issue: RuleIssue }) {
  const [open, setOpen] = useState(false);
  const cfg = ISSUE_CONFIG[issue.type];
  const Icon = cfg.icon;

  return (
    <div
      className="group/issue relative rounded-2xl border border-slate-900/[0.14] dark:border-white/[0.1] backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-slate-900/[0.18] dark:hover:border-white/[0.14] hover:shadow-[0_16px_40px_rgba(0,0,0,0.3)]"
      style={{
        background: "linear-gradient(105deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="pointer-events-none absolute left-0 top-4 bottom-4 w-1 rounded-full z-[1]"
        style={{
          background: cfg.accentBar,
          boxShadow: "0 0 12px rgba(255,255,255,0.12)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none opacity-60"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
        }}
      />
      <button
        onClick={() => setOpen(!open)}
        className="relative z-[2] w-full flex items-center gap-3 sm:gap-4 pl-4 sm:pl-5 pr-3 py-3.5 sm:py-4 text-left transition-colors hover:bg-slate-950/[0.05] dark:hover:bg-white/[0.04]"
      >
        <div
          className={`h-10 w-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 border backdrop-blur-sm ${cfg.border} ${cfg.iconGlow}`}
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }}
        >
          <Icon className={`h-5 w-5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          {issue.type === "duplicate" && (
            <span className="text-sm sm:text-base font-display font-bold text-foreground">
              {issue.rules.length} rules with identical criteria
            </span>
          )}
          {issue.type === "shadowed" && (
            <span className="text-sm sm:text-base font-display font-bold text-foreground">
              #{issue.shadowedRule.index + 1} "{issue.shadowedRule.name}" shadowed by #
              {issue.shadowedBy.index + 1}
            </span>
          )}
          {issue.type === "mergeable" && (
            <span className="text-sm sm:text-base font-display font-bold text-foreground">
              #{issue.rules[0].index + 1} and #{issue.rules[1].index + 1} can be merged
            </span>
          )}
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-900/[0.14] dark:border-white/[0.1] backdrop-blur-sm"
          style={{
            background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <ChevronDown
            className={`h-4 w-4 text-foreground/50 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && (
        <div
          className="relative z-[2] px-4 sm:px-5 pb-4 pt-3 border-t border-slate-900/[0.12] dark:border-white/[0.08] space-y-2.5 backdrop-blur-lg"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.08))",
          }}
        >
          {issue.type === "duplicate" &&
            issue.rules.map((r) => (
              <div
                key={r.index}
                className="rounded-lg px-3 py-2 text-[11px] sm:text-xs text-foreground/80 font-mono border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                #{r.index + 1} {r.name} — {r.srcZone || "any"}→{r.dstZone || "any"} |{" "}
                {r.service || "any"} | {r.action} {!r.enabled && "(disabled)"}
              </div>
            ))}
          {issue.type === "shadowed" && (
            <>
              <p className="text-xs text-foreground/55">{issue.reason}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  className="rounded-xl px-3 py-2.5 border border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-sm"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}
                >
                  <p className="text-[9px] font-bold text-foreground/45 uppercase tracking-wider mb-1">
                    Blocking Rule (Higher)
                  </p>
                  <p className="text-xs font-semibold text-foreground">
                    #{issue.shadowedBy.index + 1} {issue.shadowedBy.name}
                  </p>
                  <p className="text-[11px] text-foreground/55 font-mono mt-1">
                    {issue.shadowedBy.srcZone || "any"}→{issue.shadowedBy.dstZone || "any"} |{" "}
                    {issue.shadowedBy.service || "any"}
                  </p>
                </div>
                <div
                  className="rounded-xl px-3 py-2.5 border border-[#EA0022]/25 backdrop-blur-sm"
                  style={{
                    background: "linear-gradient(145deg, rgba(234,0,34,0.12), rgba(234,0,34,0.03))",
                    boxShadow: "0 0 16px rgba(234,0,34,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}
                >
                  <p className="text-[9px] font-bold text-[#EA0022] uppercase tracking-wider mb-1">
                    Unreachable Rule
                  </p>
                  <p className="text-xs font-semibold text-foreground">
                    #{issue.shadowedRule.index + 1} {issue.shadowedRule.name}
                  </p>
                  <p className="text-[11px] text-foreground/55 font-mono mt-1">
                    {issue.shadowedRule.srcZone || "any"}→{issue.shadowedRule.dstZone || "any"} |{" "}
                    {issue.shadowedRule.service || "any"}
                  </p>
                </div>
              </div>
            </>
          )}
          {issue.type === "mergeable" && (
            <>
              <p className="text-xs text-foreground/55">
                {issue.reason} — consider combining into a single rule with multiple values.
              </p>
              {issue.rules.map((r) => (
                <div
                  key={r.index}
                  className="rounded-lg px-3 py-2 text-[11px] sm:text-xs text-foreground/80 font-mono border border-[#009CFB]/20 backdrop-blur-sm"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(0,156,251,0.08), rgba(255,255,255,0.02))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  #{r.index + 1} {r.name} — {r.srcZone || "any"}→{r.dstZone || "any"} | src:
                  {r.srcNet || "any"} dst:{r.dstNet || "any"} svc:{r.service || "any"}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function RuleOptimiser({ files }: Props) {
  const results = useMemo(() => {
    const out: Record<string, OptimiserResult> = {};
    for (const f of files) {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      out[label] = analyseRuleOptimisation(f.extractedData ?? {});
    }
    return out;
  }, [files]);

  const totalIssues = Object.values(results).reduce((s, r) => s + r.issues.length, 0);

  return (
    <div
      className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-5 sm:p-6 shadow-[0_18px_50px_rgba(32,6,247,0.08)] space-y-4"
      data-tour="rule-optimiser"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 min-w-[220px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
            Policy optimisation
          </div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-accent" />
            <h3 className="text-lg font-display font-black text-foreground tracking-tight">
              Rule Optimisation
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-2xl">
            Surface duplicate, shadowed, and mergeable policy entries so MSP engineers and SE teams
            can quickly explain rule hygiene improvements.
          </p>
        </div>
        {totalIssues > 0 ? (
          <div className="rounded-2xl border border-[#F29400]/15 bg-[#F29400]/10 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c47800] dark:text-[#F29400]">
              Issues detected
            </p>
            <p className="text-3xl font-black text-[#c47800] dark:text-[#F29400] mt-1">
              {totalIssues}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#00F2B3]/15 bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00774a] dark:text-[#00F2B3]">
              Policy state
            </p>
            <p className="text-xl font-black text-[#00774a] dark:text-[#00F2B3] mt-1">Clean</p>
          </div>
        )}
      </div>

      {Object.entries(results).map(([label, result]) => (
        <div
          key={label}
          className="relative space-y-4 rounded-2xl border border-slate-900/[0.12] dark:border-white/[0.08] p-4 sm:p-5 backdrop-blur-md shadow-card transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
          style={{
            background:
              "linear-gradient(145deg, rgba(32,6,247,0.06), rgba(0,156,251,0.04), rgba(255,255,255,0.02))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(0,156,251,0.25), rgba(32,6,247,0.15), transparent)",
            }}
          />
          {Object.keys(results).length > 1 && (
            <p className="text-sm font-display font-bold text-foreground">{label}</p>
          )}

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span
              className="text-[11px] px-3 py-1.5 rounded-xl font-bold text-foreground/70 backdrop-blur-sm border border-slate-900/[0.14] dark:border-white/[0.1]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {result.totalRules} total · {result.enabledRules} enabled
            </span>
            {result.duplicates.length > 0 && (
              <span
                className={`text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-xl border backdrop-blur-sm ${ISSUE_CONFIG.duplicate.bg} ${ISSUE_CONFIG.duplicate.color} ${ISSUE_CONFIG.duplicate.border}`}
                style={{
                  boxShadow: "0 0 14px rgba(242,148,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                {result.duplicates.length} duplicate group
                {result.duplicates.length !== 1 ? "s" : ""}
              </span>
            )}
            {result.shadowed.length > 0 && (
              <span
                className={`text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-xl border backdrop-blur-sm ${ISSUE_CONFIG.shadowed.bg} ${ISSUE_CONFIG.shadowed.color} ${ISSUE_CONFIG.shadowed.border}`}
                style={{
                  boxShadow: "0 0 14px rgba(234,0,34,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                {result.shadowed.length} shadowed
              </span>
            )}
            {result.mergeable.length > 0 && (
              <span
                className={`text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-xl border backdrop-blur-sm ${ISSUE_CONFIG.mergeable.bg} ${ISSUE_CONFIG.mergeable.color} ${ISSUE_CONFIG.mergeable.border}`}
                style={{
                  boxShadow: "0 0 14px rgba(0,156,251,0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                {result.mergeable.length} merge candidate{result.mergeable.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {result.issues.length === 0 ? (
            <p className="text-sm text-foreground/50 text-center py-4">
              No duplicate, shadowed, or mergeable rules detected. Rule base looks clean.
            </p>
          ) : (
            <div className="space-y-3">
              {result.issues.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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
    bg: "bg-[#F29400]/10",
  },
  shadowed: {
    icon: EyeOff,
    label: "Shadowed Rules",
    color: "text-[#EA0022]",
    bg: "bg-[#EA0022]/10",
  },
  mergeable: {
    icon: Merge,
    label: "Merge Candidates",
    color: "text-[#009CFB]",
    bg: "bg-[#009CFB]/10",
  },
} as const;

function IssueCard({ issue }: { issue: RuleIssue }) {
  const [open, setOpen] = useState(false);
  const cfg = ISSUE_CONFIG[issue.type];
  const Icon = cfg.icon;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/90 overflow-hidden shadow-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <div
          className={`h-8 w-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 border border-transparent`}
        >
          <Icon className={`h-4 w-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          {issue.type === "duplicate" && (
            <span className="text-sm font-semibold text-foreground">
              {issue.rules.length} rules with identical criteria
            </span>
          )}
          {issue.type === "shadowed" && (
            <span className="text-sm font-semibold text-foreground">
              #{issue.shadowedRule.index + 1} "{issue.shadowedRule.name}" shadowed by #
              {issue.shadowedBy.index + 1}
            </span>
          )}
          {issue.type === "mergeable" && (
            <span className="text-sm font-semibold text-foreground">
              #{issue.rules[0].index + 1} and #{issue.rules[1].index + 1} can be merged
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-border/50 bg-muted/[0.08] space-y-2.5">
          {issue.type === "duplicate" &&
            issue.rules.map((r) => (
              <div key={r.index} className="text-[10px] text-muted-foreground font-mono">
                #{r.index + 1} {r.name} — {r.srcZone || "any"}→{r.dstZone || "any"} |{" "}
                {r.service || "any"} | {r.action} {!r.enabled && "(disabled)"}
              </div>
            ))}
          {issue.type === "shadowed" && (
            <>
              <p className="text-[10px] text-muted-foreground">{issue.reason}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded bg-muted/40 px-2.5 py-2">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Blocking Rule (Higher)
                  </p>
                  <p className="text-[10px] font-medium text-foreground">
                    #{issue.shadowedBy.index + 1} {issue.shadowedBy.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {issue.shadowedBy.srcZone || "any"}→{issue.shadowedBy.dstZone || "any"} |{" "}
                    {issue.shadowedBy.service || "any"}
                  </p>
                </div>
                <div className="rounded bg-[#EA0022]/5 px-2.5 py-2">
                  <p className="text-[9px] font-bold text-[#EA0022] uppercase tracking-wider mb-1">
                    Unreachable Rule
                  </p>
                  <p className="text-[10px] font-medium text-foreground">
                    #{issue.shadowedRule.index + 1} {issue.shadowedRule.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {issue.shadowedRule.srcZone || "any"}→{issue.shadowedRule.dstZone || "any"} |{" "}
                    {issue.shadowedRule.service || "any"}
                  </p>
                </div>
              </div>
            </>
          )}
          {issue.type === "mergeable" && (
            <>
              <p className="text-[10px] text-muted-foreground">
                {issue.reason} — consider combining into a single rule with multiple values.
              </p>
              {issue.rules.map((r) => (
                <div key={r.index} className="text-[10px] text-muted-foreground font-mono">
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
          <div className="rounded-2xl border border-[#00F2B3]/15 bg-[#00F2B3]/10 px-4 py-3 text-right">
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
          className="space-y-3 rounded-2xl border border-border/50 bg-card/70 p-4 shadow-card"
        >
          {Object.keys(results).length > 1 && (
            <p className="text-sm font-semibold text-foreground">{label}</p>
          )}

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] px-2.5 py-1 rounded-full border border-border bg-background/70 text-muted-foreground font-medium">
              {result.totalRules} total · {result.enabledRules} enabled
            </span>
            {result.duplicates.length > 0 && (
              <span
                className={`text-[10px] font-medium px-2 py-1 rounded-md ${ISSUE_CONFIG.duplicate.bg} ${ISSUE_CONFIG.duplicate.color}`}
              >
                {result.duplicates.length} duplicate group
                {result.duplicates.length !== 1 ? "s" : ""}
              </span>
            )}
            {result.shadowed.length > 0 && (
              <span
                className={`text-[10px] font-medium px-2 py-1 rounded-md ${ISSUE_CONFIG.shadowed.bg} ${ISSUE_CONFIG.shadowed.color}`}
              >
                {result.shadowed.length} shadowed
              </span>
            )}
            {result.mergeable.length > 0 && (
              <span
                className={`text-[10px] font-medium px-2 py-1 rounded-md ${ISSUE_CONFIG.mergeable.bg} ${ISSUE_CONFIG.mergeable.color}`}
              >
                {result.mergeable.length} merge candidate{result.mergeable.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {result.issues.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No duplicate, shadowed, or mergeable rules detected. Rule base looks clean.
            </p>
          ) : (
            <div className="space-y-2">
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

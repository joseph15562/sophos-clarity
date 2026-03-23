import { useMemo, useState } from "react";
import { Layers, Copy, EyeOff, Merge, ChevronDown } from "lucide-react";
import type { ParsedFile } from "@/hooks/use-report-generation";
import { analyseRuleOptimisation, type OptimiserResult, type RuleIssue } from "@/lib/rule-optimiser";

interface Props {
  files: ParsedFile[];
}

const ISSUE_CONFIG = {
  duplicate: { icon: Copy, label: "Duplicate Rules", color: "text-[#F29400]", bg: "bg-[#F29400]/10" },
  shadowed: { icon: EyeOff, label: "Shadowed Rules", color: "text-[#EA0022]", bg: "bg-[#EA0022]/10" },
  mergeable: { icon: Merge, label: "Merge Candidates", color: "text-[#009CFB]", bg: "bg-[#009CFB]/10" },
} as const;

function IssueCard({ issue }: { issue: RuleIssue }) {
  const [open, setOpen] = useState(false);
  const cfg = ISSUE_CONFIG[issue.type];
  const Icon = cfg.icon;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors">
        <div className={`h-6 w-6 rounded-md ${cfg.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          {issue.type === "duplicate" && (
            <span className="text-xs font-medium text-foreground">
              {issue.rules.length} rules with identical criteria
            </span>
          )}
          {issue.type === "shadowed" && (
            <span className="text-xs font-medium text-foreground">
              #{issue.shadowedRule.index + 1} "{issue.shadowedRule.name}" shadowed by #{issue.shadowedBy.index + 1}
            </span>
          )}
          {issue.type === "mergeable" && (
            <span className="text-xs font-medium text-foreground">
              #{issue.rules[0].index + 1} and #{issue.rules[1].index + 1} can be merged
            </span>
          )}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-border space-y-2">
          {issue.type === "duplicate" && issue.rules.map((r) => (
            <div key={r.index} className="text-[10px] text-muted-foreground font-mono">
              #{r.index + 1} {r.name} — {r.srcZone || "any"}→{r.dstZone || "any"} | {r.service || "any"} | {r.action} {!r.enabled && "(disabled)"}
            </div>
          ))}
          {issue.type === "shadowed" && (
            <>
              <p className="text-[10px] text-muted-foreground">{issue.reason}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded bg-muted/40 px-2.5 py-2">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Blocking Rule (Higher)</p>
                  <p className="text-[10px] font-medium text-foreground">#{issue.shadowedBy.index + 1} {issue.shadowedBy.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{issue.shadowedBy.srcZone || "any"}→{issue.shadowedBy.dstZone || "any"} | {issue.shadowedBy.service || "any"}</p>
                </div>
                <div className="rounded bg-[#EA0022]/5 px-2.5 py-2">
                  <p className="text-[9px] font-bold text-[#EA0022] uppercase tracking-wider mb-1">Unreachable Rule</p>
                  <p className="text-[10px] font-medium text-foreground">#{issue.shadowedRule.index + 1} {issue.shadowedRule.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{issue.shadowedRule.srcZone || "any"}→{issue.shadowedRule.dstZone || "any"} | {issue.shadowedRule.service || "any"}</p>
                </div>
              </div>
            </>
          )}
          {issue.type === "mergeable" && (
            <>
              <p className="text-[10px] text-muted-foreground">{issue.reason} — consider combining into a single rule with multiple values.</p>
              {issue.rules.map((r) => (
                <div key={r.index} className="text-[10px] text-muted-foreground font-mono">
                  #{r.index + 1} {r.name} — {r.srcZone || "any"}→{r.dstZone || "any"} | src:{r.srcNet || "any"} dst:{r.dstNet || "any"} svc:{r.service || "any"}
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
    <div className="p-5 space-y-4" data-tour="rule-optimiser">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
        <h3 className="text-sm font-display font-bold text-foreground">Rule Optimisation</h3>
        {totalIssues > 0 ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]">
            {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]">
            Clean
          </span>
        )}
      </div>

      {Object.entries(results).map(([label, result]) => (
        <div key={label} className="space-y-3">
          {Object.keys(results).length > 1 && (
            <p className="text-xs font-semibold text-foreground">{label}</p>
          )}

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
              {result.totalRules} total · {result.enabledRules} enabled
            </span>
            {result.duplicates.length > 0 && (
              <span className={`text-[10px] font-medium px-2 py-1 rounded-md ${ISSUE_CONFIG.duplicate.bg} ${ISSUE_CONFIG.duplicate.color}`}>
                {result.duplicates.length} duplicate group{result.duplicates.length !== 1 ? "s" : ""}
              </span>
            )}
            {result.shadowed.length > 0 && (
              <span className={`text-[10px] font-medium px-2 py-1 rounded-md ${ISSUE_CONFIG.shadowed.bg} ${ISSUE_CONFIG.shadowed.color}`}>
                {result.shadowed.length} shadowed
              </span>
            )}
            {result.mergeable.length > 0 && (
              <span className={`text-[10px] font-medium px-2 py-1 rounded-md ${ISSUE_CONFIG.mergeable.bg} ${ISSUE_CONFIG.mergeable.color}`}>
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

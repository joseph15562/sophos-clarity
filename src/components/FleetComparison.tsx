import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, Minus, GitCompareArrows } from "lucide-react";
import { computeRiskScore } from "@/lib/risk-score";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SEV_BADGE: Record<string, string> = {
  critical: "bg-[#EA0022]/10 text-[#EA0022]",
  high: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
  medium: "bg-[#ca8a04]/12 text-[#78350f] dark:bg-[#F8E300]/10 dark:text-[#F8E300]",
  low: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]",
  info: "bg-[#009CFB]/10 text-[#009CFB]",
};

function barColorClass(pct: number): string {
  if (pct < 40) return "bg-[#EA0022]";
  if (pct <= 75) return "bg-[#F29400]";
  return "bg-[#00A878] dark:bg-[#00F2B3]";
}

function gradeColorClass(grade: string): string {
  if (grade === "A" || grade === "B") return "text-[#007A5A] dark:text-[#00F2B3]";
  if (grade === "C" || grade === "D") return "text-[#F29400]";
  return "text-[#EA0022]";
}

export interface FleetComparisonProps {
  analysisResults: Record<string, AnalysisResult>;
  files: Array<{ label: string; extractedData: unknown }>;
}

export function FleetComparison({ analysisResults, files }: FleetComparisonProps) {
  const labels = useMemo(() => Object.keys(analysisResults), [analysisResults]);
  const [firewallA, setFirewallA] = useState("");
  const [firewallB, setFirewallB] = useState("");
  useEffect(() => {
    if (labels.length >= 2) {
      setFirewallA((prev) => (labels.includes(prev) ? prev : labels[0]));
      setFirewallB((prev) => (labels.includes(prev) ? prev : labels[1]));
    }
  }, [labels]);
  const selectLabels = labels;

  const resultA = analysisResults[firewallA];
  const resultB = analysisResults[firewallB];
  const scoreA = resultA ? computeRiskScore(resultA) : null;
  const scoreB = resultB ? computeRiskScore(resultB) : null;

  const findingDelta = useMemo(() => {
    if (!resultA || !resultB) return null;
    const idsA = new Set(resultA.findings.map((f) => f.id));
    const idsB = new Set(resultB.findings.map((f) => f.id));
    const onlyA = resultA.findings.filter((f) => !idsB.has(f.id));
    const onlyB = resultB.findings.filter((f) => !idsA.has(f.id));
    const commonCount = resultA.findings.filter((f) => idsB.has(f.id)).length;
    return { onlyA, onlyB, commonCount };
  }, [resultA, resultB]);

  const categoriesA = useMemo(() => scoreA?.categories ?? [], [scoreA]);
  const categoriesB = useMemo(() => scoreB?.categories ?? [], [scoreB]);
  const categoryLabels = useMemo(() => {
    const set = new Set<string>();
    categoriesA.forEach((c) => set.add(c.label));
    categoriesB.forEach((c) => set.add(c.label));
    return Array.from(set);
  }, [categoriesA, categoriesB]);

  if (labels.length < 2) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-2">
          Fleet Comparison
        </h3>
        <p className="text-sm text-muted-foreground">
          Upload 2+ configurations to compare firewalls
        </p>
      </div>
    );
  }

  const getCategoryScore = (categories: { label: string; pct: number }[], label: string) =>
    categories.find((c) => c.label === label)?.pct ?? 0;

  return (
    <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-muted/20 p-5 shadow-card">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand-accent/10 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF]">
              <GitCompareArrows className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fleet comparison
            </p>
          </div>
          <h3 className="text-lg font-display font-semibold tracking-tight text-foreground">
            Compare posture, scoring, and deltas side-by-side
          </h3>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/80 px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
          Best used after uploading two or more customer firewall exports.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Firewall A
          </label>
          <Select value={firewallA} onValueChange={setFirewallA}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectLabels.map((l) => (
                <SelectItem key={l} value={l} disabled={l === firewallB}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Firewall B
          </label>
          <Select value={firewallB} onValueChange={setFirewallB}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectLabels.map((l) => (
                <SelectItem key={l} value={l} disabled={l === firewallA}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 mb-6">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {firewallA}
          </div>
          {scoreA ? (
            <div className="flex items-center gap-3">
              <span
                className={`text-2xl font-extrabold tabular-nums ${gradeColorClass(scoreA.grade)}`}
              >
                {scoreA.overall}
              </span>
              <span
                className={`text-sm font-bold px-2 py-0.5 rounded ${gradeColorClass(scoreA.grade)}`}
              >
                {scoreA.grade}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {firewallB}
          </div>
          {scoreB ? (
            <div className="flex items-center gap-3">
              <span
                className={`text-2xl font-extrabold tabular-nums ${gradeColorClass(scoreB.grade)}`}
              >
                {scoreB.overall}
              </span>
              <span
                className={`text-sm font-bold px-2 py-0.5 rounded ${gradeColorClass(scoreB.grade)}`}
              >
                {scoreB.grade}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="text-xs font-semibold text-foreground">Category scores</div>
        {categoryLabels.map((label) => {
          const pctA = getCategoryScore(categoriesA, label);
          const pctB = getCategoryScore(categoriesB, label);
          const delta = pctA - pctB;
          const deltaIcon =
            delta > 0 ? (
              <ArrowUp className="h-3 w-3 text-[#007A5A] dark:text-[#00F2B3]" />
            ) : delta < 0 ? (
              <ArrowDown className="h-3 w-3 text-[#EA0022]" />
            ) : (
              <Minus className="h-3 w-3 text-muted-foreground" />
            );
          return (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-foreground w-32 shrink-0">{label}</span>
              <div className="flex-1 flex gap-1 items-center">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-0">
                  <div
                    className={`h-full rounded-full ${barColorClass(pctA)}`}
                    style={{ width: `${pctA}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums w-6 text-right shrink-0">
                  {pctA}%
                </span>
                {deltaIcon}
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-0">
                  <div
                    className={`h-full rounded-full ${barColorClass(pctB)}`}
                    style={{ width: `${pctB}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums w-6 text-right shrink-0">
                  {pctB}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {findingDelta && (
        <div className="border-t border-border pt-4 space-y-4">
          <div className="text-xs font-semibold text-foreground">Finding Delta</div>
          <div className="grid gap-4 sm:grid-cols-3 text-[10px]">
            <div>
              <div className="font-semibold text-muted-foreground mb-1">Only in {firewallA}</div>
              <FindingList findings={findingDelta.onlyA} />
            </div>
            <div>
              <div className="font-semibold text-muted-foreground mb-1">Only in {firewallB}</div>
              <FindingList findings={findingDelta.onlyB} />
            </div>
            <div>
              <div className="font-semibold text-muted-foreground mb-1">Common findings</div>
              <span className="text-foreground font-bold tabular-nums">
                {findingDelta.commonCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <ul className="space-y-1 max-h-32 overflow-y-auto">
      {findings.length === 0 ? (
        <li className="text-muted-foreground">None</li>
      ) : (
        findings.map((f) => (
          <li key={f.id} className="flex items-start gap-1.5">
            <span
              className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase ${SEV_BADGE[f.severity] ?? "bg-muted text-muted-foreground"}`}
            >
              {f.severity}
            </span>
            <span className="text-foreground truncate">{f.title}</span>
          </li>
        ))
      )}
    </ul>
  );
}

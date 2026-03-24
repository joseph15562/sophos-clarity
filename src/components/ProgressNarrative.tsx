import { useEffect, useMemo, useState, useCallback } from "react";
import { MessageSquare, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { AnalysisResult } from "@/lib/analyse-config";
import { loadScoreHistoryForFleet, type ScoreHistoryEntry } from "@/lib/score-history";
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface ProgressNarrativeProps {
  orgId: string;
  currentResults: Record<string, AnalysisResult>;
  customerName: string;
}

function normCustomer(s: string): string {
  return s.trim().toLowerCase();
}

function avgOverall(batch: ScoreHistoryEntry[]): number {
  if (batch.length === 0) return 0;
  return Math.round(batch.reduce((s, e) => s + e.overall_score, 0) / batch.length);
}

function avgCategoriesFromHistory(batch: ScoreHistoryEntry[]): Map<string, number> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const e of batch) {
    for (const c of e.category_scores ?? []) {
      if (!acc.has(c.label)) acc.set(c.label, { sum: 0, n: 0 });
      const x = acc.get(c.label)!;
      x.sum += c.score;
      x.n += 1;
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of acc) out.set(k, Math.round(v.sum / v.n));
  return out;
}

function avgCategoriesFromLive(results: RiskScoreResult[]): Map<string, number> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of results) {
    for (const c of r.categories) {
      if (!acc.has(c.label)) acc.set(c.label, { sum: 0, n: 0 });
      const x = acc.get(c.label)!;
      x.sum += c.pct;
      x.n += 1;
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of acc) out.set(k, Math.round(v.sum / v.n));
  return out;
}

function buildNarrative(
  customerLabel: string,
  currentAvg: number,
  currentGrade: string,
  prevAvg: number | null,
  prevCategories: Map<string, number> | null,
  liveCategories: Map<string, number>,
  criticalCount: number,
  prevFindingsAvg: number | null,
  currentFindingsTotal: number,
): string[] {
  const sentences: string[] = [];

  if (prevAvg === null) {
    sentences.push(
      `This is the first recorded score history for ${customerLabel} in FireComply.`,
    );
    sentences.push(
      `The current assessment averages ${currentAvg}/100 (grade ${currentGrade}) across loaded firewalls, with ${currentFindingsTotal} open finding${currentFindingsTotal === 1 ? "" : "s"}.`,
    );
    if (criticalCount > 0) {
      sentences.push(
        `${criticalCount} critical-severity finding${criticalCount === 1 ? "" : "s"} should be reviewed first.`,
      );
    }
    sentences.push(
      "Re-run assessments after remediation to track progress over time.",
    );
    return sentences.slice(0, 5);
  }

  const delta = currentAvg - prevAvg;
  const deltaStr = delta === 0 ? "unchanged" : `${delta > 0 ? "+" : ""}${delta} point${Math.abs(delta) === 1 ? "" : "s"}`;
  sentences.push(
    `For ${customerLabel}, the fleet now averages ${currentAvg}/100 (grade ${currentGrade}), compared with ${prevAvg}/100 last time — a change of ${deltaStr}.`,
  );

  if (prevCategories && liveCategories.size > 0) {
    const improved: string[] = [];
    const regressed: string[] = [];
    for (const [label, now] of liveCategories) {
      const was = prevCategories.get(label);
      if (was === undefined) continue;
      if (now - was >= 3) improved.push(label);
      if (was - now >= 3) regressed.push(label);
    }
    if (improved.length > 0) {
      sentences.push(`The largest gains are in ${improved.slice(0, 3).join(", ")}${improved.length > 3 ? ", and more" : ""}.`);
    }
    if (regressed.length > 0) {
      sentences.push(`Watch ${regressed.slice(0, 3).join(", ")}${regressed.length > 3 ? ", and other areas" : ""} where scores slipped.`);
    }
  }

  if (prevFindingsAvg !== null) {
    const diff = currentFindingsTotal - prevFindingsAvg;
    if (diff > 0) {
      sentences.push(`Open findings increased versus the prior snapshot (about ${Math.round(diff)} more across the fleet).`);
    } else if (diff < 0) {
      sentences.push(`Open findings decreased compared with the prior snapshot — roughly ${Math.round(Math.abs(diff))} fewer in total.`);
    }
  }

  if (criticalCount > 0) {
    sentences.push(`${criticalCount} critical-severity item${criticalCount === 1 ? "" : "s"} remain in scope and warrant immediate prioritisation.`);
  } else if (delta > 0) {
    sentences.push("No critical-severity items are flagged in the current pass — keep momentum on the remaining hardening work.");
  }

  while (sentences.length > 5) sentences.pop();
  if (sentences.length < 3) {
    sentences.push("Use this narrative in QBRs and customer updates to anchor the conversation on measurable progress.");
  }
  return sentences;
}

export function ProgressNarrative({ orgId, currentResults, customerName }: ProgressNarrativeProps) {
  const [history, setHistory] = useState<ScoreHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadScoreHistoryForFleet(orgId, 10).then((rows) => {
      if (!cancelled) {
        setHistory(rows);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [orgId]);

  const live = useMemo(() => {
    const results = Object.values(currentResults);
    if (results.length === 0) return null;
    const risks = results.map((r) => computeRiskScore(r));
    const overall = Math.round(risks.reduce((s, r) => s + r.overall, 0) / risks.length);
    const grade: string = overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";
    const criticalCount = results.reduce(
      (n, r) => n + r.findings.filter((f) => f.severity === "critical").length,
      0,
    );
    const findingsTotal = results.reduce((n, r) => n + r.findings.length, 0);
    const categories = avgCategoriesFromLive(risks);
    return { overall, grade, criticalCount, findingsTotal, categories };
  }, [currentResults]);

  const narrative = useMemo(() => {
    if (!live || !history) return null;
    const label = customerName.trim() || "this customer";
    const cn = normCustomer(customerName);
    const rows = customerName.trim()
      ? history.filter((h) => normCustomer(h.customer_name) === cn)
      : history;

    if (rows.length === 0) {
      return buildNarrative(
        label,
        live.overall,
        live.grade,
        null,
        null,
        live.categories,
        live.criticalCount,
        null,
        live.findingsTotal,
      );
    }

    const times = [...new Set(rows.map((r) => r.assessed_at))].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    const latestBatch = rows.filter((r) => r.assessed_at === times[0]);
    const prevBatch = times.length >= 2 ? rows.filter((r) => r.assessed_at === times[1]) : [];

    const prevAvg = prevBatch.length > 0 ? avgOverall(prevBatch) : avgOverall(latestBatch);
    const prevCats = (prevBatch.length > 0 ? prevBatch : latestBatch).length > 0
      ? avgCategoriesFromHistory(prevBatch.length > 0 ? prevBatch : latestBatch)
      : null;
    const prevFindingsAvg =
      (prevBatch.length > 0 ? prevBatch : latestBatch).length > 0
        ? (prevBatch.length > 0 ? prevBatch : latestBatch).reduce((s, e) => s + e.findings_count, 0) /
          (prevBatch.length > 0 ? prevBatch.length : latestBatch.length)
        : null;

    return buildNarrative(
      label,
      live.overall,
      live.grade,
      prevAvg,
      prevCats,
      live.categories,
      live.criticalCount,
      prevFindingsAvg,
      live.findingsTotal,
    );
  }, [history, live, customerName]);

  const text = narrative?.join(" ") ?? "";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }, [text]);

  if (Object.keys(currentResults).length === 0) return null;

  return (
    <Card className="rounded-xl border border-[#2006F7]/15 bg-[linear-gradient(135deg,rgba(32,6,247,0.04),rgba(0,242,179,0.03))] dark:bg-[linear-gradient(135deg,rgba(32,6,247,0.10),rgba(0,242,179,0.04))] shadow-[0_12px_36px_rgba(32,6,247,0.08)] no-print">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-display font-black tracking-tight flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
              Progress narrative
            </CardTitle>
            <CardDescription className="text-sm font-medium text-foreground/80 dark:text-white/75 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#00F2B3] dark:text-[#00F2B3] shrink-0" />
              Share with your customer — paste into email or Teams
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 border-[#2006F7]/25 dark:border-[#00EDFF]/30 hover:bg-[#2006F7]/10 dark:hover:bg-[#00EDFF]/10 font-semibold"
            disabled={loading || !text}
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy to clipboard
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <p className="text-sm font-medium text-foreground/75 dark:text-white/70">Loading score history…</p>
        ) : (
          <p className="text-sm font-medium text-foreground/85 dark:text-white/78 leading-relaxed">{text}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Config History — timeline of configuration snapshots with optional diff comparison.
 */

import { useState, useMemo } from "react";
import { History, GitCompare, ChevronDown, ChevronRight } from "lucide-react";
import { loadConfigSnapshots, type ConfigSnapshot } from "@/lib/config-snapshots";
import type { ExtractedSections } from "@/lib/extract-sections";
import { ConfigDiff } from "@/components/ConfigDiff";
import { Button } from "@/components/ui/button";

interface Props {
  /** Optional: filter by hostname */
  hostname?: string;
  /** Optional: refetch trigger */
  refreshTrigger?: number;
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#00F2B3] dark:text-[#00F2B3]",
  B: "text-[#009CFB]",
  C: "text-[#F8E300] dark:text-[#F8E300]",
  D: "text-[#F29400]",
  F: "text-[#EA0022]",
};

function gradeColor(grade: string): string {
  const score = parseInt(grade, 10);
  if (!isNaN(score)) {
    if (score >= 90) return GRADE_COLORS.A;
    if (score >= 75) return GRADE_COLORS.B;
    if (score >= 60) return GRADE_COLORS.C;
    if (score >= 40) return GRADE_COLORS.D;
    return GRADE_COLORS.F;
  }
  return GRADE_COLORS.C;
}

export function ConfigHistory({ hostname, refreshTrigger }: Props) {
  const [compareSelection, setCompareSelection] = useState<[ConfigSnapshot | null, ConfigSnapshot | null]>([null, null]);
  const [diffOpen, setDiffOpen] = useState(false);

  const snapshots = useMemo(() => {
    const all = loadConfigSnapshots(hostname);
    return [...all].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [hostname]);

  const [before, after] = compareSelection;
  const canCompare = before && after && before.id !== after.id;
  const bothHaveSections = before?.sections && after?.sections;

  const handleCompare = () => {
    if (!canCompare || !bothHaveSections) return;
    setDiffOpen(true);
  };

  const selectForCompare = (snap: ConfigSnapshot, slot: 0 | 1) => {
    setCompareSelection((prev) => {
      const next: [ConfigSnapshot | null, ConfigSnapshot | null] = [...prev];
      next[slot] = snap;
      return next;
    });
  };

  if (snapshots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <History className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">
          No configuration snapshots yet. Snapshots are saved when analyses are run.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[#2006F7] dark:text-[#00EDFF]" />
          <h3 className="text-sm font-semibold text-foreground">Config History</h3>
          <span className="text-[10px] text-muted-foreground">{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Compare selection */}
      {snapshots.length >= 2 && (
        <div className="rounded-lg bg-muted/30 p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Compare snapshots</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={before?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                selectForCompare(snapshots.find((s) => s.id === id)!, 0);
              }}
              className="text-[10px] rounded border border-border bg-background px-2 py-1 min-w-[140px]"
            >
              <option value="">Before…</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleDateString("en-GB")} — {s.hostname} ({s.overall_score})
                </option>
              ))}
            </select>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={after?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                selectForCompare(snapshots.find((s) => s.id === id)!, 1);
              }}
              className="text-[10px] rounded border border-border bg-background px-2 py-1 min-w-[140px]"
            >
              <option value="">After…</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleDateString("en-GB")} — {s.hostname} ({s.overall_score})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCompare}
              disabled={!canCompare || !bothHaveSections}
              className="gap-1.5 text-[10px] h-7"
            >
              <GitCompare className="h-3 w-3" />
              Compare
            </Button>
            {canCompare && !bothHaveSections && (
              <span className="text-[9px] text-muted-foreground italic">Section data not stored for these snapshots</span>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {snapshots.map((snap) => (
          <div
            key={snap.id}
            className="flex items-center justify-between py-2 px-3 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(snap.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-xs font-medium text-foreground truncate">{snap.hostname}</span>
              {snap.customer_name && (
                <span className="text-[9px] text-muted-foreground truncate">{snap.customer_name}</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-sm font-bold tabular-nums ${gradeColor(String(snap.overall_score))}`}>
                {snap.overall_score}
              </span>
              <span className="text-[9px] text-muted-foreground">{snap.findings_count} findings</span>
              <span className="text-[9px] text-muted-foreground">{snap.section_count} sections</span>
            </div>
          </div>
        ))}
      </div>

      {/* ConfigDiff modal */}
      {diffOpen && before && after && bothHaveSections && (
        <ConfigDiff
          beforeLabel={`${before.hostname} — ${new Date(before.created_at).toLocaleDateString("en-GB")}`}
          afterLabel={`${after.hostname} — ${new Date(after.created_at).toLocaleDateString("en-GB")}`}
          beforeSections={before.sections as ExtractedSections}
          afterSections={after.sections as ExtractedSections}
          onClose={() => setDiffOpen(false)}
        />
      )}
    </section>
  );
}

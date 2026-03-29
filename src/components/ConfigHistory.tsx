/**
 * Config History — timeline of configuration snapshots with optional diff comparison.
 */

import { useState, useMemo } from "react";
import { History, GitCompare, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { loadConfigSnapshots, type ConfigSnapshot } from "@/lib/config-snapshots";
import type { ExtractedSections } from "@/lib/extract-sections";
import { ConfigDiff } from "@/components/ConfigDiff";
import { Button } from "@/components/ui/button";
import { GRADE_COLORS, gradeForScore } from "@/lib/design-tokens";
import { displayCustomerNameForUi } from "@/lib/sophos-central";

interface Props {
  /** Optional: filter by hostname */
  hostname?: string;
  /** Optional: refetch trigger */
  refreshTrigger?: number;
}

function gradeColor(grade: string): string {
  const score = parseInt(grade, 10);
  if (!isNaN(score)) {
    const g = gradeForScore(score);
    const hex = GRADE_COLORS[g];
    return `text-[${hex}] dark:text-[${hex}]`;
  }
  return `text-[${GRADE_COLORS.C}] dark:text-[${GRADE_COLORS.C}]`;
}

export function ConfigHistory({ hostname, refreshTrigger }: Props) {
  const { org } = useAuth();
  const [compareSelection, setCompareSelection] = useState<
    [ConfigSnapshot | null, ConfigSnapshot | null]
  >([null, null]);
  const [diffOpen, setDiffOpen] = useState(false);

  const snapshots = useMemo(() => {
    const all = loadConfigSnapshots(hostname);
    return [...all].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
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
      <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-6 text-center space-y-2">
        <History className="h-8 w-8 mx-auto text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">
          No configuration snapshots yet. Snapshots are saved when analyses are run.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center shrink-0">
            <History className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-[13px] font-display font-semibold tracking-tight text-foreground">
              Config History
            </h3>
            <span className="text-[10px] text-muted-foreground/60">
              {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Compare selection */}
      {snapshots.length >= 2 && (
        <div className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center shrink-0">
              <GitCompare className="h-3 w-3 text-white" />
            </div>
            <p className="text-[10px] font-display font-semibold text-foreground uppercase tracking-[0.08em]">
              Compare Snapshots
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={before?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                selectForCompare(snapshots.find((s) => s.id === id)!, 0);
              }}
              className="text-[10px] rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] dark:bg-brand-accent/[0.08] px-3 py-2 min-w-[160px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
            >
              <option value="">Before…</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleDateString("en-GB")} — {s.hostname} (
                  {s.overall_score})
                </option>
              ))}
            </select>
            <ChevronRight className="h-3.5 w-3.5 text-brand-accent/40" />
            <select
              value={after?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                selectForCompare(snapshots.find((s) => s.id === id)!, 1);
              }}
              className="text-[10px] rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] dark:bg-brand-accent/[0.08] px-3 py-2 min-w-[160px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
            >
              <option value="">After…</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.created_at).toLocaleDateString("en-GB")} — {s.hostname} (
                  {s.overall_score})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleCompare}
              disabled={!canCompare || !bothHaveSections}
              className="gap-1.5 text-[10px] h-8 rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white hover:opacity-90 border-0 shadow-sm disabled:opacity-40"
            >
              <GitCompare className="h-3 w-3" />
              Compare
            </Button>
            {canCompare && !bothHaveSections && (
              <span className="text-[9px] text-muted-foreground/60 italic">
                Section data not stored for these snapshots
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {snapshots.map((snap) => (
          <div
            key={snap.id}
            className="flex items-center justify-between py-2.5 px-3.5 rounded-xl border border-brand-accent/10 bg-background/60 dark:bg-background/30 hover:bg-brand-accent/[0.03] dark:hover:bg-brand-accent/[0.06] transition-colors"
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
              {snap.customer_name.trim() && (
                <span
                  className="text-[9px] text-muted-foreground truncate"
                  title="Customer name from report branding when this snapshot was saved (not a separate MSP account)."
                >
                  {displayCustomerNameForUi(snap.customer_name, org?.name)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-sm font-bold tabular-nums ${gradeColor(String(snap.overall_score))}`}
              >
                {snap.overall_score}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {snap.findings_count} findings
              </span>
              <span className="text-[9px] text-muted-foreground">
                {snap.section_count} sections
              </span>
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

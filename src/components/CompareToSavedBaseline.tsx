"use client";

import { useState, useEffect, useCallback } from "react";
import { History, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { loadScoreHistoryForFleet, type ScoreHistoryEntry } from "@/lib/score-history";
import {
  loadFindingSnapshotsForHostname,
  snapshotClosestToDate,
  diffFindings,
  type FindingSnapshot,
} from "@/lib/finding-snapshots";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
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
  medium: "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]",
  low: "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]",
  info: "bg-[#009CFB]/10 text-[#009CFB]",
};

export interface CompareToSavedBaselineProps {
  analysisResults: Record<string, AnalysisResult>;
  customerName?: string;
}

function formatBaselineLabel(entry: ScoreHistoryEntry): string {
  const d = new Date(entry.assessed_at);
  const dateStr = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${dateStr} · ${entry.hostname} · ${entry.overall_score} (${entry.overall_grade})`;
}

export function CompareToSavedBaseline({
  analysisResults,
  customerName,
}: CompareToSavedBaselineProps) {
  const { org, isGuest } = useAuth();
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotsByHost, setSnapshotsByHost] = useState<Record<string, FindingSnapshot[]>>({});

  const loadHistory = useCallback(async () => {
    if (!org?.id || isGuest) return;
    setLoading(true);
    const data = await loadScoreHistoryForFleet(org.id, 100);
    setHistory(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [org?.id, isGuest]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selectedEntry = history.find((e) => e.id === selectedId);

  useEffect(() => {
    if (!org?.id || !selectedEntry) {
      setSnapshotsByHost({});
      return;
    }
    const hostnames = [
      ...new Set([
        selectedEntry.hostname,
        ...Object.keys(analysisResults).map((l) => analysisResults[l].hostname || l),
      ]),
    ];
    let cancelled = false;
    const acc: Record<string, FindingSnapshot[]> = {};
    Promise.all(
      hostnames.map(async (h) => {
        const snapshots = await loadFindingSnapshotsForHostname(org.id, h, 30);
        if (!cancelled) acc[h] = snapshots;
      }),
    ).then(() => {
      if (!cancelled) setSnapshotsByHost(acc);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, selectedEntry?.hostname, selectedEntry?.assessed_at, analysisResults]);

  if (isGuest || !org) return null;
  if (Object.keys(analysisResults).length === 0) return null;

  const currentLabels = Object.keys(analysisResults);
  const baselineOptions = history.filter((e) =>
    currentLabels.some((l) => (analysisResults[l].hostname || l) === e.hostname),
  );

  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-5 space-y-4"
      data-tour="compare-baseline"
    >
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-brand-accent" />
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Compare to saved baseline
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Select a past assessment (from score history) to see score delta and findings added/removed
        since that date.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <span className="animate-spin h-5 w-5 border-2 border-brand-accent/30 border-t-[#2006F7] rounded-full" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Select value={selectedId ?? ""} onValueChange={(v) => setSelectedId(v || null)}>
              <SelectTrigger className="w-full max-w-md text-xs">
                <SelectValue placeholder="Select a baseline (e.g. Q1 2025)…" />
              </SelectTrigger>
              <SelectContent>
                {baselineOptions.slice(0, 50).map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {formatBaselineLabel(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEntry && (
            <div className="space-y-4 pt-2 border-t border-border">
              {currentLabels.map((label) => {
                const result = analysisResults[label];
                const hostname = result.hostname || label;
                const currentScoreResult = computeRiskScore(result);
                const currentScore = currentScoreResult.overall;
                const currentGrade = currentScoreResult.grade;
                const baselineScore =
                  selectedEntry.hostname === hostname ? selectedEntry.overall_score : null;
                const baselineGrade =
                  selectedEntry.hostname === hostname ? selectedEntry.overall_grade : null;

                if (selectedEntry.hostname !== hostname) {
                  return (
                    <div
                      key={label}
                      className="rounded-lg border border-border p-3 text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{label}</span> — No matching
                      baseline (baseline is for {selectedEntry.hostname}).
                    </div>
                  );
                }

                const snapshots = snapshotsByHost[hostname] ?? [];
                const baselineSnapshot = snapshotClosestToDate(
                  snapshots,
                  selectedEntry.assessed_at,
                );
                const diff = baselineSnapshot
                  ? diffFindings(
                      {
                        hostname,
                        titles: baselineSnapshot.titles,
                        score: baselineSnapshot.score,
                        timestamp: baselineSnapshot.timestamp,
                      },
                      result.findings.map((f) => ({ title: f.title })),
                    )
                  : { newFindings: [], fixedFindings: [], regressed: [] };

                const scoreDelta = baselineScore != null ? currentScore - baselineScore : 0;

                return (
                  <div key={label} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Baseline: {baselineScore} ({baselineGrade})
                        </span>
                        <span className="text-foreground font-medium">
                          Current: {currentScore} ({currentGrade})
                        </span>
                        {scoreDelta > 0 && (
                          <span className="flex items-center gap-0.5 text-[#00F2B3]">
                            <ArrowUpRight className="h-3.5 w-3.5" /> +{scoreDelta}
                          </span>
                        )}
                        {scoreDelta < 0 && (
                          <span className="flex items-center gap-0.5 text-[#EA0022]">
                            <ArrowDownRight className="h-3.5 w-3.5" /> {scoreDelta}
                          </span>
                        )}
                        {scoreDelta === 0 && (
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Minus className="h-3.5 w-3.5" /> No change
                          </span>
                        )}
                      </div>
                    </div>
                    {(diff.newFindings.length > 0 ||
                      diff.fixedFindings.length > 0 ||
                      diff.regressed.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        {diff.newFindings.length > 0 && (
                          <div>
                            <p className="font-semibold text-[#EA0022] mb-1">
                              New ({diff.newFindings.length})
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                              {diff.newFindings.slice(0, 5).map((t) => (
                                <li key={t} className="truncate">
                                  {t}
                                </li>
                              ))}
                              {diff.newFindings.length > 5 && (
                                <li>+{diff.newFindings.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {diff.fixedFindings.length > 0 && (
                          <div>
                            <p className="font-semibold text-[#00F2B3] dark:text-[#00F2B3] mb-1">
                              Fixed ({diff.fixedFindings.length})
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                              {diff.fixedFindings.slice(0, 5).map((t) => (
                                <li key={t} className="truncate">
                                  {t}
                                </li>
                              ))}
                              {diff.fixedFindings.length > 5 && (
                                <li>+{diff.fixedFindings.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {diff.regressed.length > 0 && (
                          <div>
                            <p className="font-semibold text-[#F29400] mb-1">
                              Regressed ({diff.regressed.length})
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                              {diff.regressed.slice(0, 5).map((t) => (
                                <li key={t} className="truncate">
                                  {t}
                                </li>
                              ))}
                              {diff.regressed.length > 5 && (
                                <li>+{diff.regressed.length - 5} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {!baselineSnapshot &&
                      diff.newFindings.length === 0 &&
                      diff.fixedFindings.length === 0 &&
                      diff.regressed.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          No finding snapshot found for baseline date; score delta only.
                        </p>
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

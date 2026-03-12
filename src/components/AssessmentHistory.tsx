import { useState, useEffect, useCallback } from "react";
import { History, Trash2, TrendingUp, TrendingDown, Minus, Save, ChevronDown, ChevronRight } from "lucide-react";
import {
  loadHistory,
  saveAssessment,
  deleteAssessment,
  clearHistory,
  detectDrift,
  type AssessmentSnapshot,
} from "@/lib/assessment-history";
import type { AnalysisResult } from "@/lib/analyse-config";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  customerName: string;
  environment: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#00995a] dark:text-[#00F2B3]",
  B: "text-[#00774a] dark:text-[#00F2B3]",
  C: "text-[#b8a200] dark:text-[#F8E300]",
  D: "text-[#c47800] dark:text-[#F29400]",
  F: "text-[#EA0022]",
};

export function AssessmentHistory({ analysisResults, customerName, environment }: Props) {
  const [history, setHistory] = useState<AssessmentSnapshot[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const items = await loadHistory();
      setHistory(items);
    } catch { /* IndexedDB not available */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = async () => {
    if (Object.keys(analysisResults).length === 0) return;
    setSaving(true);
    try {
      await saveAssessment(analysisResults, customerName, environment);
      await refresh();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await deleteAssessment(id);
    await refresh();
  };

  const handleClearAll = async () => {
    await clearHistory();
    setHistory([]);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const hasResults = Object.keys(analysisResults).length > 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[#2006F7] dark:text-[#00EDFF]" />
          <h3 className="text-sm font-semibold text-foreground">Assessment History</h3>
          {history.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{history.length} snapshot{history.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasResults && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                justSaved
                  ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]"
                  : "bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF] hover:bg-[#2006F7]/20"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              {justSaved ? "Saved!" : saving ? "Saving…" : "Save Snapshot"}
            </button>
          )}
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#EA0022] px-2 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No assessment snapshots yet. Upload configs and save a snapshot to start tracking changes over time.
        </p>
      ) : (
        <div className="space-y-2">
          {history.map((snap, idx) => {
            const prev = history[idx + 1]; // older snapshot
            const drift = prev ? detectDrift(snap, prev) : null;
            const isOpen = expanded.has(snap.id);

            return (
              <div key={snap.id} className="rounded-lg border border-border bg-card">
                <button onClick={() => toggle(snap.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  {isOpen
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground">{snap.customerName}</span>
                      <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{snap.environment}</span>
                      <span className="text-[9px] text-muted-foreground">{formatDate(snap.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-sm font-extrabold ${GRADE_COLORS[snap.overallGrade] ?? ""}`}>{snap.overallScore}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ring-1 ring-current/20 ${GRADE_COLORS[snap.overallGrade] ?? ""}`}>{snap.overallGrade}</span>
                      <span className="text-[9px] text-muted-foreground">{snap.firewalls.length} fw{snap.firewalls.length !== 1 ? "s" : ""}</span>
                      {drift && (
                        <span className={`flex items-center gap-0.5 text-[9px] font-bold ${
                          drift.scoreDelta > 0 ? "text-[#00995a] dark:text-[#00F2B3]" :
                          drift.scoreDelta < 0 ? "text-[#EA0022]" : "text-muted-foreground"
                        }`}>
                          {drift.scoreDelta > 0 ? <TrendingUp className="h-3 w-3" /> :
                           drift.scoreDelta < 0 ? <TrendingDown className="h-3 w-3" /> :
                           <Minus className="h-3 w-3" />}
                          {drift.scoreDelta > 0 ? "+" : ""}{drift.scoreDelta}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(snap.id); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-[#EA0022] transition-colors shrink-0"
                    title="Delete snapshot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border">
                    {/* Per-firewall breakdown */}
                    <div className="grid gap-2 sm:grid-cols-2 pt-3">
                      {snap.firewalls.map((fw) => (
                        <div key={fw.label} className="rounded-lg bg-muted/30 px-3 py-2">
                          <p className="text-[10px] font-semibold text-foreground truncate">{fw.label}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-sm font-extrabold ${GRADE_COLORS[fw.riskScore.grade] ?? ""}`}>{fw.riskScore.overall}</span>
                            <span className={`text-[9px] font-bold ${GRADE_COLORS[fw.riskScore.grade] ?? ""}`}>{fw.riskScore.grade}</span>
                            <span className="text-[9px] text-muted-foreground">{fw.totalRules}r {fw.totalFindings}f</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 mt-1.5">
                            {fw.riskScore.categories.map((c) => (
                              <div key={c.label} className="text-center">
                                <div className={`text-[9px] font-bold tabular-nums ${
                                  c.pct >= 80 ? "text-[#00995a] dark:text-[#00F2B3]" :
                                  c.pct >= 50 ? "text-[#F29400]" : "text-[#EA0022]"
                                }`}>{c.pct}%</div>
                                <div className="text-[8px] text-muted-foreground leading-tight">{c.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Drift indicators */}
                    {drift && (drift.improved.length > 0 || drift.regressed.length > 0) && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Changes from Previous</p>
                        {drift.improved.map((item) => (
                          <div key={item} className="flex items-center gap-1.5 text-[10px] text-[#00995a] dark:text-[#00F2B3]">
                            <TrendingUp className="h-3 w-3 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                        {drift.regressed.map((item) => (
                          <div key={item} className="flex items-center gap-1.5 text-[10px] text-[#EA0022]">
                            <TrendingDown className="h-3 w-3 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

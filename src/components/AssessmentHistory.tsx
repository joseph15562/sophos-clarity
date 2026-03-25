import { useState, useEffect, useCallback } from "react";
import {
  History,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Cloud,
  HardDrive,
} from "lucide-react";
import {
  loadHistory,
  saveAssessment,
  deleteAssessment,
  renameAssessment,
  clearHistory,
  detectDrift,
  type AssessmentSnapshot,
} from "@/lib/assessment-history";
import {
  saveAssessmentCloud,
  loadHistoryCloud,
  deleteAssessmentCloud,
  renameAssessmentCloud,
} from "@/lib/assessment-cloud";
import { useAuth } from "@/hooks/use-auth";
import type { AnalysisResult } from "@/lib/analyse-config";
import { toast } from "sonner";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  customerName: string;
  environment: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#00F2B3] dark:text-[#00F2B3]",
  B: "text-[#00774a] dark:text-[#00F2B3]",
  C: "text-[#b8a200] dark:text-[#F8E300]",
  D: "text-[#c47800] dark:text-[#F29400]",
  F: "text-[#EA0022]",
};

function ScoreTrendChart({ snapshots }: { snapshots: AssessmentSnapshot[] }) {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp).slice(-7);
  const scores = sorted.map((s) => s.overallScore);
  const allSameMonth = new Set(sorted.map((s) => new Date(s.timestamp).getMonth())).size === 1;
  const labels = sorted.map((s) => {
    const d = new Date(s.timestamp);
    return allSameMonth
      ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : d.toLocaleDateString("en-GB", { month: "short" });
  });
  const maxV = 100;
  const w = 320,
    h = 120,
    pad = { top: 12, right: 20, bottom: 28, left: 20 };
  const plotW = w - pad.left - pad.right,
    plotH = h - pad.top - pad.bottom;
  const toX = (i: number) => pad.left + (i / (scores.length - 1 || 1)) * plotW;
  const toY = (v: number) => pad.top + plotH - (v / maxV) * plotH;

  return (
    <div className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] p-4">
      <p className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.08em] mb-3 flex items-center gap-2">
        <span className="h-5 w-5 rounded-md bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center">
          <TrendingUp className="h-2.5 w-2.5 text-white" />
        </span>
        Score Trend
      </p>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h + 14}`}
        role="img"
        aria-label="Assessment score trend chart"
        className="text-muted-foreground overflow-visible"
      >
        <defs>
          <linearGradient id="hist-line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5A00FF" />
            <stop offset="50%" stopColor="#2006F7" />
            <stop offset="100%" stopColor="#00EDFF" />
          </linearGradient>
          <linearGradient id="hist-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2006F7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2006F7" stopOpacity="0" />
          </linearGradient>
          <filter id="hist-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[25, 50, 75].map((v) => (
          <line
            key={v}
            x1={pad.left}
            x2={w - pad.right}
            y1={toY(v)}
            y2={toY(v)}
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.07"
            strokeDasharray="3 3"
          />
        ))}
        <path
          d={`${scores.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")} L ${toX(scores.length - 1)} ${toY(0)} L ${toX(0)} ${toY(0)} Z`}
          fill="url(#hist-area-grad)"
        />
        <polyline
          fill="none"
          stroke="url(#hist-line-grad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#hist-glow)"
          points={scores.map((v, i) => `${toX(i)},${toY(v)}`).join(" ")}
        />
        {scores.map((v, i) => (
          <g key={i}>
            <circle
              cx={toX(i)}
              cy={toY(v)}
              r="4"
              fill="url(#hist-line-grad)"
              stroke="white"
              strokeWidth="1.5"
            />
            <text
              x={toX(i)}
              y={h + 6}
              textAnchor="middle"
              fontSize="7"
              fill="currentColor"
              opacity="0.5"
            >
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function AssessmentHistory({ analysisResults, customerName, environment }: Props) {
  const { isGuest, org } = useAuth();
  const useCloud = !isGuest && !!org;

  const [history, setHistory] = useState<AssessmentSnapshot[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnv, setEditEnv] = useState("");

  const refresh = useCallback(async () => {
    try {
      const items = useCloud ? await loadHistoryCloud() : await loadHistory();
      setHistory(items);
    } catch (err) {
      console.warn("[refresh] AssessmentHistory", err);
    }
  }, [useCloud]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    if (Object.keys(analysisResults).length === 0) return;
    setSaving(true);
    try {
      if (useCloud && org) {
        await saveAssessmentCloud(analysisResults, customerName, environment, org.id);
      } else {
        await saveAssessment(analysisResults, customerName, environment);
      }
      await refresh();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.warn("[handleSave] AssessmentHistory", err);
      if (useCloud) toast.error("Couldn't save assessment to cloud — try again or save locally");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (useCloud) await deleteAssessmentCloud(id);
    else await deleteAssessment(id);
    await refresh();
  };

  const handleClearAll = async () => {
    if (useCloud) {
      for (const snap of history) await deleteAssessmentCloud(snap.id);
    } else {
      await clearHistory();
    }
    setHistory([]);
  };

  const startEditing = (snap: AssessmentSnapshot) => {
    setEditingId(snap.id);
    setEditName(snap.customerName);
    setEditEnv(snap.environment);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditEnv("");
  };

  const confirmRename = async () => {
    if (!editingId || !editName.trim()) return;
    if (useCloud)
      await renameAssessmentCloud(editingId, editName.trim(), editEnv.trim() || "Unknown");
    else await renameAssessment(editingId, editName.trim(), editEnv.trim() || "Unknown");
    setEditingId(null);
    await refresh();
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return (
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const hasResults = Object.keys(analysisResults).length > 0;

  return (
    <section className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#5A00FF] to-[#00EDFF] flex items-center justify-center shrink-0">
            <History className="h-4 w-4 text-white" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-display font-semibold tracking-tight text-foreground">
                Assessment History
              </h3>
              {history.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60">
                  {history.length} snapshot{history.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <span
              className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md ${useCloud ? "bg-brand-accent/10 text-brand-accent" : "bg-brand-accent/[0.06] text-muted-foreground"}`}
            >
              {useCloud ? <Cloud className="h-2.5 w-2.5" /> : <HardDrive className="h-2.5 w-2.5" />}
              {useCloud ? "Cloud" : "Local"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasResults && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-xl transition-all ${
                justSaved
                  ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                  : "bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 hover:shadow-sm"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              {justSaved ? "Saved!" : saving ? "Saving…" : "Save Snapshot"}
            </button>
          )}
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#EA0022] px-2 py-1.5 rounded-xl transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      <ScoreTrendChart snapshots={history} />

      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No assessment snapshots yet. Upload configs and save a snapshot to start tracking changes
          over time.
        </p>
      ) : (
        <div className="space-y-2">
          {history.map((snap, idx) => {
            const prev = history[idx + 1]; // older snapshot
            const drift = prev ? detectDrift(snap, prev) : null;
            const isOpen = expanded.has(snap.id);

            return (
              <div
                key={snap.id}
                className="rounded-xl border border-brand-accent/10 bg-background/60 dark:bg-background/30 overflow-hidden transition-all"
              >
                <button
                  onClick={() => editingId !== snap.id && toggle(snap.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-brand-accent/[0.02] dark:hover:bg-brand-accent/[0.04] transition-colors"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {editingId === snap.id ? (
                      <div
                        className="flex items-center gap-2 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRename();
                            if (e.key === "Escape") cancelEditing();
                          }}
                          placeholder="Customer name"
                          autoFocus
                          className="text-xs font-medium text-foreground bg-muted border border-border rounded px-2 py-1 w-36 outline-none focus:ring-1 focus:ring-[#2006F7]"
                        />
                        <input
                          type="text"
                          value={editEnv}
                          onChange={(e) => setEditEnv(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRename();
                            if (e.key === "Escape") cancelEditing();
                          }}
                          placeholder="Environment"
                          className="text-[9px] text-muted-foreground bg-muted border border-border rounded px-2 py-1 w-24 outline-none focus:ring-1 focus:ring-[#2006F7]"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmRename();
                          }}
                          className="p-1 rounded-md text-[#00F2B3] hover:bg-[#00F2B3]/10 transition-colors"
                          title="Save"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEditing();
                          }}
                          className="p-1 rounded-md text-muted-foreground hover:text-[#EA0022] transition-colors"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-foreground">
                          {snap.customerName}
                        </span>
                        <span className="text-[9px] text-muted-foreground bg-brand-accent/[0.06] px-1.5 py-0.5 rounded-md">
                          {snap.environment}
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          {formatDate(snap.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-sm font-extrabold ${GRADE_COLORS[snap.overallGrade] ?? ""}`}
                      >
                        {snap.overallScore}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ring-1 ring-current/20 ${GRADE_COLORS[snap.overallGrade] ?? ""}`}
                      >
                        {snap.overallGrade}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {snap.firewalls.length} fw{snap.firewalls.length !== 1 ? "s" : ""}
                      </span>
                      {drift && (
                        <span
                          className={`flex items-center gap-0.5 text-[9px] font-bold ${
                            drift.scoreDelta > 0
                              ? "text-[#00F2B3] dark:text-[#00F2B3]"
                              : drift.scoreDelta < 0
                                ? "text-[#EA0022]"
                                : "text-muted-foreground"
                          }`}
                        >
                          {drift.scoreDelta > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : drift.scoreDelta < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          {drift.scoreDelta > 0 ? "+" : ""}
                          {drift.scoreDelta}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(snap);
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-[#2006F7] transition-colors"
                      title="Rename snapshot"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(snap.id);
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-[#EA0022] transition-colors"
                      title="Delete snapshot"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-brand-accent/10">
                    {/* Per-firewall breakdown */}
                    <div className="grid gap-2 sm:grid-cols-2 pt-3">
                      {snap.firewalls.map((fw) => (
                        <div
                          key={fw.label}
                          className="rounded-xl bg-brand-accent/[0.03] dark:bg-brand-accent/[0.06] px-3.5 py-2.5 border border-brand-accent/[0.06]"
                        >
                          <p className="text-[10px] font-semibold text-foreground truncate">
                            {fw.label}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-sm font-extrabold ${GRADE_COLORS[fw.riskScore.grade] ?? ""}`}
                            >
                              {fw.riskScore.overall}
                            </span>
                            <span
                              className={`text-[9px] font-bold ${GRADE_COLORS[fw.riskScore.grade] ?? ""}`}
                            >
                              {fw.riskScore.grade}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {fw.totalRules}r {fw.totalFindings}f
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 mt-1.5">
                            {fw.riskScore.categories.map((c) => (
                              <div key={c.label} className="text-center">
                                <div
                                  className={`text-[9px] font-bold tabular-nums ${
                                    c.pct >= 80
                                      ? "text-[#00F2B3] dark:text-[#00F2B3]"
                                      : c.pct >= 50
                                        ? "text-[#F29400]"
                                        : "text-[#EA0022]"
                                  }`}
                                >
                                  {c.pct}%
                                </div>
                                <div className="text-[8px] text-muted-foreground leading-tight">
                                  {c.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Drift indicators */}
                    {drift && (drift.improved.length > 0 || drift.regressed.length > 0) && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Changes from Previous
                        </p>
                        {drift.improved.map((item) => (
                          <div
                            key={item}
                            className="flex items-center gap-1.5 text-[10px] text-[#00F2B3] dark:text-[#00F2B3]"
                          >
                            <TrendingUp className="h-3 w-3 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                        {drift.regressed.map((item) => (
                          <div
                            key={item}
                            className="flex items-center gap-1.5 text-[10px] text-[#EA0022]"
                          >
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

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  mapToAllFrameworks,
  type FrameworkMapping,
  type ControlMapping,
} from "@/lib/compliance-map";

const STORAGE_KEY = "firecomply-evidence";

export interface EvidenceItem {
  controlKey: string;
  note: string;
  url: string;
  addedAt: string;
}

function loadEvidence(): EvidenceItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEvidence(items: EvidenceItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  selectedFrameworks: string[];
}

export function EvidenceCollection({ analysisResults, selectedFrameworks }: Props) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [urlInput, setUrlInput] = useState("");

  useEffect(() => {
    setEvidence(loadEvidence());
  }, []);

  const firstResult = Object.values(analysisResults)[0];
  const mappings = useMemo<FrameworkMapping[]>(() => {
    if (!firstResult) return [];
    const fws =
      selectedFrameworks.length > 0
        ? selectedFrameworks
        : ["NCSC Guidelines", "Cyber Essentials / CE+"];
    return mapToAllFrameworks(fws, firstResult);
  }, [firstResult, selectedFrameworks]);

  const controlsWithEvidence = useMemo(() => {
    const map = new Map<string, { control: ControlMapping; framework: string; key: string }>();
    for (const m of mappings) {
      for (const c of m.controls) {
        const key = `${m.framework}:${c.controlId}`;
        map.set(key, { control: c, framework: m.framework, key });
      }
    }
    return map;
  }, [mappings]);

  const evidenceByControl = useMemo(() => {
    const map = new Map<string, EvidenceItem[]>();
    for (const e of evidence) {
      const list = map.get(e.controlKey) ?? [];
      list.push(e);
      map.set(e.controlKey, list);
    }
    for (const [, list] of map) list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return map;
  }, [evidence]);

  const addEvidence = () => {
    if (!addingFor) return;
    const item: EvidenceItem = {
      controlKey: addingFor,
      note: noteInput.trim(),
      url: urlInput.trim(),
      addedAt: new Date().toISOString(),
    };
    const next = [...evidence, item];
    setEvidence(next);
    saveEvidence(next);
    setNoteInput("");
    setUrlInput("");
    setAddingFor(null);
  };

  const removeEvidence = (idx: number) => {
    const next = evidence.filter((_, i) => i !== idx);
    setEvidence(next);
    saveEvidence(next);
  };

  if (mappings.length === 0) return null;

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-8 shadow-card backdrop-blur-sm space-y-6 transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(234,0,34,0.05), rgba(32,6,247,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(234,0,34,0.18), rgba(32,6,247,0.12), transparent)",
        }}
      />
      <h3 className="text-lg font-display font-black tracking-tight text-foreground">
        Evidence Collection
      </h3>

      <div className="space-y-3">
        {Array.from(controlsWithEvidence.values()).map(({ control, framework, key }) => {
          const items = evidenceByControl.get(key) ?? [];
          const isAdding = addingFor === key;
          const borderAccent =
            control.status === "pass"
              ? "#00F2B3"
              : control.status === "fail"
                ? "#EA0022"
                : control.status === "partial"
                  ? "#F29400"
                  : "rgba(255,255,255,0.15)";

          return (
            <div
              key={key}
              className="rounded-xl p-4 sm:p-5 backdrop-blur-sm transition-all duration-200 hover:bg-slate-950/[0.04] dark:hover:bg-white/[0.03]"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderLeftWidth: 4,
                borderLeftColor: borderAccent,
                background:
                  "linear-gradient(105deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.12)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="text-base font-display font-bold tracking-tight text-foreground">
                    {control.controlName}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg backdrop-blur-sm border ${
                      control.status === "fail"
                        ? "text-[#EA0022] border-[#EA0022]/35"
                        : control.status === "partial"
                          ? "text-[#F29400] border-[#F29400]/35"
                          : control.status === "pass"
                            ? "text-[#00F2B3] border-[#00F2B3]/35"
                            : "text-muted-foreground border-white/10"
                    }`}
                    style={{
                      background:
                        control.status === "fail"
                          ? "linear-gradient(145deg, rgba(234,0,34,0.18), rgba(234,0,34,0.06))"
                          : control.status === "partial"
                            ? "linear-gradient(145deg, rgba(242,148,0,0.18), rgba(242,148,0,0.06))"
                            : control.status === "pass"
                              ? "linear-gradient(145deg, rgba(0,242,179,0.15), rgba(0,242,179,0.05))"
                              : "rgba(255,255,255,0.04)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                    }}
                  >
                    {control.status}
                  </span>
                </div>
                <span className="text-xs text-foreground/40 font-bold uppercase tracking-wide shrink-0 px-2 py-1 rounded-md border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02]">
                  {framework}
                </span>
              </div>

              {items.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[11px] rounded-lg bg-muted/15 dark:bg-muted/10 border border-border/30 px-3.5 py-2.5"
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        {item.note && (
                          <p className="text-foreground/90 leading-relaxed">{item.note}</p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-accent truncate block hover:underline underline-offset-2"
                          >
                            {item.url}
                          </a>
                        )}
                        <span className="text-muted-foreground/50 text-[10px]">
                          {new Date(item.addedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const idx = evidence.indexOf(item);
                          if (idx >= 0) removeEvidence(idx);
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                        aria-label="Remove evidence"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {isAdding ? (
                <div className="space-y-2.5 pt-1">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Describe the evidence…"
                    rows={2}
                    className="w-full rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30 focus:border-brand-accent/30 transition-colors placeholder:text-muted-foreground/40"
                  />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Link to evidence (URL)"
                    className="w-full rounded-lg border border-border/60 bg-card px-3.5 py-2.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30 focus:border-brand-accent/30 transition-colors placeholder:text-muted-foreground/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addEvidence}
                      className="px-4 py-2 rounded-lg bg-[#2006F7] dark:bg-[#00EDFF] text-white dark:text-[#0a0a14] text-[11px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
                    >
                      Save Evidence
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingFor(null);
                        setNoteInput("");
                        setUrlInput("");
                      }}
                      className="px-4 py-2 rounded-lg border border-border/60 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingFor(key)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground/50 hover:text-[#2006F7] dark:hover:text-[#00EDFF] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Evidence
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

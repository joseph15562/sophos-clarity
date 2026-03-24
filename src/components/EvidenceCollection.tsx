import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { mapToAllFrameworks, type FrameworkMapping, type ControlMapping, type ControlStatus } from "@/lib/compliance-map";

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
  } catch { /* ignore */ }
}

const STATUS_STYLES: Record<ControlStatus, string> = {
  pass: "text-[#00F2B3] dark:text-[#00F2B3]",
  partial: "text-[#F29400]",
  fail: "text-[#EA0022]",
  na: "text-muted-foreground/60",
};

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
    const fws = selectedFrameworks.length > 0 ? selectedFrameworks : ["NCSC Guidelines", "Cyber Essentials / CE+"];
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
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card space-y-5">
      <h3 className="text-base font-display font-bold tracking-tight text-foreground">Evidence Collection</h3>

      <div className="space-y-2">
        {Array.from(controlsWithEvidence.values()).map(({ control, framework, key }) => {
          const items = evidenceByControl.get(key) ?? [];
          const isAdding = addingFor === key;
          const borderAccent =
            control.status === "pass" ? "border-l-[#00F2B3]" :
            control.status === "fail" ? "border-l-[#EA0022]" :
            control.status === "partial" ? "border-l-[#F29400]" :
            "border-l-border";

          return (
            <div
              key={key}
              className={`rounded-xl border border-border/40 border-l-[3px] ${borderAccent} bg-muted/5 dark:bg-muted/5 p-4 transition-colors hover:bg-muted/15`}
            >
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[13px] font-display font-semibold tracking-tight text-foreground truncate">{control.controlName}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                    control.status === "fail" ? "bg-[#EA0022]/10 text-[#EA0022] border-[#EA0022]/20" :
                    control.status === "partial" ? "bg-[#F29400]/10 text-[#F29400] border-[#F29400]/20" :
                    control.status === "pass" ? "bg-[#00F2B3]/10 text-[#00F2B3] border-[#00F2B3]/20" :
                    "bg-muted text-muted-foreground border-border/40"
                  }`}>
                    {control.status}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground/50 font-medium shrink-0">{framework}</span>
              </div>

              {items.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[11px] rounded-lg bg-muted/15 dark:bg-muted/10 border border-border/30 px-3.5 py-2.5">
                      <div className="flex-1 min-w-0 space-y-0.5">
                        {item.note && <p className="text-foreground/90 leading-relaxed">{item.note}</p>}
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

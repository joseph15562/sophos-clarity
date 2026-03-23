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
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Evidence Collection</h3>

      <div className="space-y-4">
        {Array.from(controlsWithEvidence.values()).map(({ control, framework, key }) => {
          const items = evidenceByControl.get(key) ?? [];
          const isAdding = addingFor === key;

          return (
            <div
              key={key}
              className="rounded-lg border border-border bg-muted/10 p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-medium text-foreground">{control.controlName}</span>
                  <span className={`text-[10px] ml-2 ${STATUS_STYLES[control.status]}`}>
                    ({control.status})
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{framework}</span>
              </div>

              {items.length > 0 && (
                <ul className="space-y-1.5 mb-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[10px]">
                      <div className="flex-1 min-w-0">
                        {item.note && <p className="text-foreground">{item.note}</p>}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#2006F7] dark:text-[#00EDFF] truncate block"
                          >
                            {item.url}
                          </a>
                        )}
                        <span className="text-muted-foreground">
                          {new Date(item.addedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const idx = evidence.indexOf(item);
                          if (idx >= 0) removeEvidence(idx);
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0"
                        aria-label="Remove evidence"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {isAdding ? (
                <div className="space-y-2">
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Note"
                    rows={2}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs resize-none"
                  />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="URL"
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addEvidence}
                      className="px-2.5 py-1 rounded bg-[#2006F7] dark:bg-[#00EDFF] text-white text-xs font-medium"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingFor(null);
                        setNoteInput("");
                        setUrlInput("");
                      }}
                      className="px-2.5 py-1 rounded border border-border text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingFor(key)}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
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

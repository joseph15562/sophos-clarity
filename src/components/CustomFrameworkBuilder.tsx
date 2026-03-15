import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Edit } from "lucide-react";

const STORAGE_KEY = "firecomply-custom-frameworks";

export interface CustomControl {
  controlId: string;
  controlName: string;
  mappedKeywords: string;
}

export interface CustomFramework {
  id: string;
  name: string;
  description: string;
  controls: CustomControl[];
  createdAt: string;
}

function loadFrameworks(): CustomFramework[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFrameworks(frameworks: CustomFramework[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(frameworks));
  } catch { /* ignore */ }
}

export function CustomFrameworkBuilder() {
  const [frameworks, setFrameworks] = useState<CustomFramework[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CustomFramework>>({
    name: "",
    description: "",
    controls: [],
  });
  const [controlForm, setControlForm] = useState<CustomControl>({
    controlId: "",
    controlName: "",
    mappedKeywords: "",
  });

  useEffect(() => {
    setFrameworks(loadFrameworks());
  }, []);

  const addControl = () => {
    if (!controlForm.controlId.trim() || !controlForm.controlName.trim()) return;
    const controls = [...(form.controls ?? []), { ...controlForm }];
    setForm((f) => ({ ...f, controls }));
    setControlForm({ controlId: "", controlName: "", mappedKeywords: "" });
  };

  const removeControl = (idx: number) => {
    const controls = [...(form.controls ?? [])];
    controls.splice(idx, 1);
    setForm((f) => ({ ...f, controls }));
  };

  const saveFramework = () => {
    if (!form.name?.trim()) return;
    const fw: CustomFramework = {
      id: editingId ?? `cf-${Date.now()}`,
      name: form.name.trim(),
      description: form.description?.trim() ?? "",
      controls: form.controls ?? [],
      createdAt: editingId ? (frameworks.find((f) => f.id === editingId)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
    };
    const next = editingId
      ? frameworks.map((f) => (f.id === editingId ? fw : f))
      : [...frameworks, fw];
    setFrameworks(next);
    saveFrameworks(next);
    setForm({ name: "", description: "", controls: [] });
    setEditingId(null);
  };

  const editFramework = (fw: CustomFramework) => {
    setForm({
      name: fw.name,
      description: fw.description,
      controls: [...fw.controls],
    });
    setEditingId(fw.id);
  };

  const deleteFramework = (id: string) => {
    const next = frameworks.filter((f) => f.id !== id);
    setFrameworks(next);
    saveFrameworks(next);
    if (editingId === id) {
      setForm({ name: "", description: "", controls: [] });
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setForm({ name: "", description: "", controls: [] });
    setEditingId(null);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Custom Framework Builder</h3>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Framework name</label>
          <input
            type="text"
            value={form.name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Internal Security Standard"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional description"
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Add controls</label>
          <div className="flex flex-wrap gap-2 mb-2">
            <input
              type="text"
              value={controlForm.controlId}
              onChange={(e) => setControlForm((c) => ({ ...c, controlId: e.target.value }))}
              placeholder="Control ID"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs w-24"
            />
            <input
              type="text"
              value={controlForm.controlName}
              onChange={(e) => setControlForm((c) => ({ ...c, controlName: e.target.value }))}
              placeholder="Control name"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs flex-1 min-w-[120px]"
            />
            <input
              type="text"
              value={controlForm.mappedKeywords}
              onChange={(e) => setControlForm((c) => ({ ...c, mappedKeywords: e.target.value }))}
              placeholder="Keywords (comma separated)"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs flex-1 min-w-[140px]"
            />
            <button
              type="button"
              onClick={addControl}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {(form.controls?.length ?? 0) > 0 && (
            <ul className="space-y-1.5">
              {form.controls.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground">{c.controlId}</span>
                  <span className="text-foreground">{c.controlName}</span>
                  {c.mappedKeywords && (
                    <span className="text-muted-foreground truncate max-w-[120px]">({c.mappedKeywords})</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeControl(i)}
                    className="ml-auto p-1 rounded hover:bg-destructive/10 text-destructive"
                    aria-label="Remove control"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveFramework}
            disabled={!form.name?.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2006F7] dark:bg-[#00EDFF] text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" />
            {editingId ? "Update" : "Save"} Framework
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {frameworks.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-foreground mb-2">Existing custom frameworks</h4>
          <ul className="space-y-2">
            {frameworks.map((fw) => (
              <li
                key={fw.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
              >
                <div>
                  <span className="text-xs font-medium text-foreground">{fw.name}</span>
                  {fw.controls.length > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-2">{fw.controls.length} controls</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => editFramework(fw)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFramework(fw.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

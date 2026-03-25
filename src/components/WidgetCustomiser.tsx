import { useState } from "react";
import { LayoutGrid, X, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type WidgetPreferences,
  type WidgetDef,
  getWidgetsForTab,
  isWidgetVisible,
  saveWidgetPreferences,
} from "@/lib/widget-preferences";

interface Props {
  tab: string;
  prefs: WidgetPreferences;
  onChange: (prefs: WidgetPreferences) => void;
}

export function WidgetCustomiser({ tab, prefs, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const widgets = getWidgetsForTab(tab);
  if (widgets.length === 0) return null;

  const enabledCount = widgets.filter((w) => isWidgetVisible(prefs, w.id)).length;

  const toggle = (id: string) => {
    const next = { ...prefs, [id]: !isWidgetVisible(prefs, id) };
    onChange(next);
    saveWidgetPreferences(next);
  };

  const enableAll = () => {
    const next = { ...prefs };
    for (const w of widgets) next[w.id] = true;
    onChange(next);
    saveWidgetPreferences(next);
  };

  const resetDefaults = () => {
    const next = { ...prefs };
    for (const w of widgets) delete next[w.id];
    onChange(next);
    saveWidgetPreferences(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        data-tour="widget-customiser"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-xl border border-border/50 bg-card text-muted-foreground hover:text-foreground hover:border-brand-accent/30 dark:hover:border-[#00EDFF]/30 transition-colors"
      >
        <LayoutGrid className="h-3 w-3" />
        Widgets
        {enabledCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-brand-accent/10 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF] text-[9px] font-bold">
            {enabledCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-80 rounded-2xl border border-border/60 bg-card shadow-panel backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/20 dark:bg-muted/10">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-brand-accent/10 dark:bg-[#00EDFF]/10">
                  <LayoutGrid className="h-3.5 w-3.5 text-brand-accent" />
                </div>
                <span className="text-sm font-display font-semibold tracking-tight text-foreground">
                  Optional Widgets
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto px-2.5 py-2.5 space-y-0.5">
              {widgets.map((w) => {
                const checked = isWidgetVisible(prefs, w.id);
                return (
                  <label
                    key={w.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${checked ? "bg-[#2006F7]/[0.04] dark:bg-[#00EDFF]/[0.04] hover:bg-brand-accent/[0.08] dark:hover:bg-[#00EDFF]/[0.08]" : "hover:bg-muted/40"}`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(w.id)} />
                    <span
                      className={`text-[13px] select-none transition-colors ${checked ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    >
                      {w.label}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-muted/10 dark:bg-muted/5">
              <button
                type="button"
                onClick={enableAll}
                className="text-[11px] font-semibold text-brand-accent hover:underline underline-offset-2"
              >
                Enable All
              </button>
              <button
                type="button"
                onClick={resetDefaults}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to Defaults
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

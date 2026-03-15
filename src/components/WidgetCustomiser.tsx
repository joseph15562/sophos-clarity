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
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-[#2006F7]/30 dark:hover:border-[#00EDFF]/30 transition-colors"
      >
        <LayoutGrid className="h-3 w-3" />
        Widgets
        {enabledCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-[#2006F7]/10 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF] text-[9px] font-bold">
            {enabledCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-72 rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-xs font-semibold text-foreground">Optional Widgets</span>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto px-2 py-2 space-y-0.5">
              {widgets.map((w) => (
                <label
                  key={w.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={isWidgetVisible(prefs, w.id)}
                    onCheckedChange={() => toggle(w.id)}
                  />
                  <span className="text-xs text-foreground select-none">{w.label}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
              <button
                type="button"
                onClick={enableAll}
                className="text-[10px] font-medium text-[#2006F7] dark:text-[#00EDFF] hover:underline"
              >
                Enable All
              </button>
              <button
                type="button"
                onClick={resetDefaults}
                className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Reset to Defaults
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

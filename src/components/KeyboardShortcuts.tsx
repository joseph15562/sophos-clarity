import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = isMac ? "\u2318" : "Ctrl";

const SHORTCUT_GROUPS = [
  {
    label: "Navigation",
    shortcuts: [
      { keys: ["Escape"], description: "Go back / close modal" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    label: "Actions",
    shortcuts: [
      { keys: [MOD, "S"], description: "Save reports / assessment" },
      { keys: [MOD, "G"], description: "Generate all reports" },
    ],
  },
  {
    label: "Reports",
    shortcuts: [
      { keys: ["1–9"], description: "Switch report tab" },
    ],
  },
];

export function KeyboardShortcutsModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <Keyboard className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
              <span className="text-sm font-semibold text-foreground">Keyboard Shortcuts</span>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.shortcuts.map((s) => (
                    <div key={s.description} className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-foreground">{s.description}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k) => (
                          <kbd
                            key={k}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-border bg-muted text-[10px] font-mono font-semibold text-foreground shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-border bg-muted/30">
            <p className="text-[10px] text-muted-foreground text-center">
              Press <kbd className="inline px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono font-semibold">?</kbd> anywhere to toggle this panel
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

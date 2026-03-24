import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-border space-y-0">
          <DialogTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <Keyboard className="h-4 w-4 text-brand-accent" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            Available keyboard shortcuts for Sophos FireComply
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}

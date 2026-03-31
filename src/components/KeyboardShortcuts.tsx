import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
    shortcuts: [{ keys: ["1–9"], description: "Switch report tab" }],
  },
];

export function KeyboardShortcutsModal({ open, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "max-w-md gap-0 overflow-hidden border-border p-0",
          /* Default dialog uses bg-white/88 + blur; on light theme the navy shell bleeds through. */
          "bg-card text-card-foreground shadow-elevated backdrop-blur-none",
          "dark:bg-background dark:text-foreground dark:backdrop-blur-2xl",
        )}
      >
        <DialogHeader className="space-y-0 border-b border-border bg-card px-5 py-3.5 dark:bg-background">
          <DialogTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <Keyboard className="h-4 w-4 shrink-0 text-brand-accent" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            Available keyboard shortcuts for Sophos FireComply
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 bg-card p-5 dark:bg-background">
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
                          className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-border bg-background px-1.5 font-mono text-[10px] font-semibold text-foreground shadow-sm dark:bg-muted"
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

        <div className="border-t border-border bg-muted/50 px-5 py-3 dark:bg-muted/30">
          <p className="text-center text-[10px] text-muted-foreground">
            Press{" "}
            <kbd className="inline rounded border border-border bg-background px-1 py-0.5 font-mono text-[9px] font-semibold text-foreground dark:bg-muted">
              ?
            </kbd>{" "}
            anywhere to toggle this panel
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

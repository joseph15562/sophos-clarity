import { useState } from "react";
import { useTheme } from "next-themes";
import { Eye, FileText, AlertTriangle, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { BrandingData } from "@/components/BrandingSetup";
import { cn } from "@/lib/utils";

export type StickyActionBarVariant = "full" | "reports";

export interface StickyActionBarProps {
  hasFiles: boolean;
  branding: BrandingData;
  onScrollToFindings: () => void;
  onScrollToReports: () => void;
  onScrollToContext: () => void;
  onGenerateAll: () => void;
  tourSlot?: React.ReactNode;
  onOpenShortcuts?: () => void;
  /** `reports`: same full-width bottom bar as analysis, but only Tours + Shortcuts (report view). */
  variant?: StickyActionBarVariant;
}

const REQUIRED_FIELDS: { key: keyof BrandingData; label: string }[] = [
  { key: "customerName", label: "Customer Name" },
  { key: "preparedBy", label: "Prepared By" },
  { key: "environment", label: "Environment" },
  { key: "country", label: "Country" },
];

export function StickyActionBar({
  hasFiles,
  branding,
  onScrollToFindings,
  onScrollToReports,
  onScrollToContext,
  onGenerateAll,
  tourSlot,
  onOpenShortcuts,
  variant = "full",
}: StickyActionBarProps) {
  const { resolvedTheme } = useTheme();
  const barDark = resolvedTheme === "dark";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  function handleGenerateClick() {
    const missing = REQUIRED_FIELDS.filter(
      (f) => !((branding as Record<string, unknown>)[f.key] as string)?.trim(),
    ).map((f) => f.label);

    if (missing.length === 0) {
      onScrollToReports();
      onGenerateAll();
      return;
    }

    setMissingFields(missing);
    setConfirmOpen(true);
  }

  function handleGenerateAnyway() {
    setConfirmOpen(false);
    onScrollToReports();
    onGenerateAll();
  }

  function handleFillContext() {
    setConfirmOpen(false);
    onScrollToContext();
  }

  return (
    <>
      <div
        className={
          barDark
            ? "no-print fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.08] backdrop-blur-xl"
            : "no-print fixed bottom-0 inset-x-0 z-40 border-t border-slate-900/[0.08] supports-[backdrop-filter]:backdrop-blur-2xl backdrop-blur-2xl backdrop-saturate-150"
        }
        style={{
          background: barDark
            ? "linear-gradient(135deg, rgba(32,6,247,0.08), rgba(0,237,255,0.04), rgba(12,18,34,0.85))"
            : "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(247,249,255,0.28), rgba(32,6,247,0.05))",
          ...(!barDark ? { WebkitBackdropFilter: "blur(40px)" as const } : {}),
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: barDark
              ? "linear-gradient(90deg, transparent, rgba(32,6,247,0.3), transparent)"
              : "linear-gradient(90deg, transparent, rgba(32,6,247,0.12), rgba(0,237,255,0.08), transparent)",
          }}
        />

        <div
          className={cn(
            "mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-3 sm:px-6",
            variant === "reports" ? "justify-start" : "justify-between",
          )}
        >
          {/* Left: utility actions */}
          <div className="flex items-center gap-2">
            {tourSlot}

            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className={cn(
                  "group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all duration-200",
                  "border-slate-900/[0.10] dark:border-white/[0.06]",
                  "text-slate-700 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground",
                  "hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
                )}
                style={{
                  background: "linear-gradient(145deg, rgba(32,6,247,0.06), rgba(32,6,247,0.02))",
                }}
                title="Keyboard shortcuts (?)"
                aria-label="Keyboard shortcuts"
                data-tour="shortcuts-button"
              >
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full blur-[10px] opacity-0 transition-opacity duration-200 group-hover:opacity-25 bg-brand-accent" />
                </span>
                <Keyboard className="relative z-[1] h-3 w-3 text-brand-accent" />
                <span className="relative z-[1]">Shortcuts</span>
              </button>
            )}
          </div>

          {/* Right: primary actions (analysis dashboard only) */}
          {variant === "full" && (
            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={onScrollToFindings}
                className="gap-2 text-xs font-bold text-slate-900 border-slate-900/[0.18] bg-white/90 hover:bg-white hover:text-slate-950 dark:text-foreground dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] hover:border-slate-900/[0.22] dark:hover:border-white/[0.15] transition-all duration-200"
              >
                <Eye className="h-3.5 w-3.5 text-brand-accent" />
                View Findings
              </Button>

              <Button
                size="sm"
                onClick={handleGenerateClick}
                className="gap-2 text-xs font-bold text-white border-0 transition-all duration-200 shadow-[0_4px_16px_rgba(32,6,247,0.25)] hover:shadow-[0_6px_24px_rgba(32,6,247,0.35)] hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #2006F7, #5A00FF)",
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                Generate Reports
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-900/[0.12] dark:border-white/[0.08] bg-card/95 backdrop-blur-xl shadow-elevated">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center border border-[#F29400]/20"
                style={{ backgroundColor: "rgba(242,148,0,0.12)" }}
              >
                <AlertTriangle className="h-5 w-5 text-[#F29400]" />
              </div>
              <AlertDialogTitle className="text-base font-display font-black tracking-tight">
                Missing Report Context
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm leading-relaxed pt-2">
              The following fields are not filled in. Reports will still generate, but they will be
              less personalised and may lack important context.
            </AlertDialogDescription>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {missingFields.map((field) => (
                <span
                  key={field}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#F29400]/20 text-[#F29400]"
                  style={{ backgroundColor: "rgba(242,148,0,0.08)" }}
                >
                  {field}
                </span>
              ))}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel
              onClick={handleFillContext}
              className="gap-2 font-bold border-slate-900/[0.12] dark:border-white/[0.08] bg-white/75 dark:bg-white/[0.04] hover:bg-slate-950/[0.08] dark:hover:bg-white/[0.08]"
            >
              Fill in context
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerateAnyway}
              className="gap-2 font-bold text-white border-0 shadow-[0_4px_16px_rgba(32,6,247,0.25)] hover:shadow-[0_6px_24px_rgba(32,6,247,0.35)] hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #2006F7, #5A00FF)",
              }}
            >
              Generate anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

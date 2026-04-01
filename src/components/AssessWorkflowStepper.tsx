import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface AssessWorkflowStepperProps {
  hasFiles: boolean;
  /** Assessment context (customer / branding) considered complete */
  hasContext: boolean;
  /** Deterministic analysis available */
  hasAnalysis: boolean;
  /** Viewing generated reports */
  viewingReports: boolean;
  className?: string;
}

const steps = [
  { key: "upload", label: "Upload", desc: "Configs" },
  { key: "context", label: "Context", desc: "Customer" },
  { key: "analysis", label: "Analysis", desc: "Findings" },
  { key: "reports", label: "Reports", desc: "Export" },
] as const;

/**
 * Linear workflow hint for Assess — complements guided tours.
 */
export function AssessWorkflowStepper({
  hasFiles,
  hasContext,
  hasAnalysis,
  viewingReports,
  className,
}: AssessWorkflowStepperProps) {
  const stepDone = [hasFiles, hasContext, hasAnalysis, viewingReports];
  let currentIdx = 0;
  for (let i = 0; i < stepDone.length; i++) {
    if (!stepDone[i]) {
      currentIdx = i;
      break;
    }
    currentIdx = i;
  }
  if (stepDone.every(Boolean)) currentIdx = steps.length - 1;

  return (
    <nav
      aria-label="Assessment workflow"
      className={cn(
        "no-print rounded-xl border border-border/60 bg-muted/30 dark:bg-muted/20 px-3 py-2.5",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-1 sm:gap-2">
        {steps.map((s, i) => {
          const isDone = stepDone[i];
          const isCurrent = i === currentIdx;

          return (
            <li key={s.key} className="flex items-center gap-1 sm:gap-2">
              {i > 0 && (
                <span
                  className={cn(
                    "hidden sm:inline w-4 h-px shrink-0",
                    stepDone[i - 1] ? "bg-[#00F2B3]/60" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] sm:text-xs",
                  isCurrent && "bg-brand-accent/10 ring-1 ring-brand-accent/25",
                  isDone && !isCurrent && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isDone
                      ? "bg-[#00F2B3]/20 text-[#007A5A] dark:text-[#00F2B3]"
                      : isCurrent
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className="font-semibold text-foreground whitespace-nowrap">{s.label}</span>
                <span className="hidden md:inline text-muted-foreground">· {s.desc}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

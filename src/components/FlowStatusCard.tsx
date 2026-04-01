import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type FlowStatusVariant = "loading" | "error";

export type FlowStatusTone = "destructive" | "warning";

export interface FlowStatusCardProps {
  variant: FlowStatusVariant;
  title: string;
  description?: ReactNode;
  /** Loading only */
  progressLabel?: string;
  progressValue?: number;
  /** Error only */
  errorDetail?: string;
  /** Error only — default destructive (red); warning uses amber (connection / checklist). */
  tone?: FlowStatusTone;
  /** Error only — shown after description; e.g. link to fix flow */
  footerSlot?: ReactNode;
  /** Error only — hide Trust / support line when not relevant */
  showTrustLink?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Unified status surface for long-running flows (upload/parse, save, report generation).
 * Matches demo-critical paths called out in product UX review.
 */
export function FlowStatusCard({
  variant,
  title,
  description,
  progressLabel,
  progressValue,
  errorDetail,
  tone = "destructive",
  footerSlot,
  showTrustLink = true,
  onRetry,
  retryLabel = "Try again",
  className,
}: FlowStatusCardProps) {
  if (variant === "loading") {
    return (
      <div
        className={cn(
          "rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(247,249,255,0.96))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(12,18,34,0.92))] px-4 py-3 space-y-2 shadow-sm",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          <p className="text-xs font-semibold text-foreground">{title}</p>
        </div>
        {description != null && description !== false && (
          <div className="text-[11px] text-muted-foreground pl-6">{description}</div>
        )}
        {progressLabel && (
          <>
            <p className="text-[11px] text-muted-foreground pl-6">{progressLabel}</p>
            <Progress value={progressValue ?? 50} className="h-1.5" />
          </>
        )}
      </div>
    );
  }

  const isWarning = tone === "warning";

  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-3 space-y-3",
        isWarning
          ? "border-amber-500/40 bg-amber-500/[0.06] dark:border-amber-500/30 dark:bg-amber-500/10"
          : "border-destructive/25 bg-destructive/[0.06] dark:bg-destructive/10",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            "h-4 w-4 shrink-0 mt-0.5",
            isWarning ? "text-amber-600 dark:text-amber-400" : "text-destructive",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          {description != null && description !== false && (
            <div className="text-[11px] text-muted-foreground">{description}</div>
          )}
          {errorDetail && (
            <p
              className={cn(
                "text-[11px] font-mono break-words rounded-md bg-background/60 px-2 py-1.5 border border-border/60",
                isWarning ? "text-amber-900/90 dark:text-amber-100" : "text-destructive/90",
              )}
            >
              {errorDetail}
            </p>
          )}
          {showTrustLink && (
            <p className="text-[10px] text-muted-foreground">
              <Link to="/trust" className="font-medium text-brand-accent hover:underline">
                How we handle your data
              </Link>
              {" · "}
              If this persists, contact support with the message above.
            </p>
          )}
          {footerSlot ? <div className="pt-1">{footerSlot}</div> : null}
        </div>
      </div>
      {onRetry && (
        <div className="pl-6">
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

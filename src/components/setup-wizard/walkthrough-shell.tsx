import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export type WalkthroughShellStep = {
  id: string;
  title: string;
  icon: LucideIcon;
};

export type WalkthroughShellTourIds = {
  header?: string;
  progress?: string;
  body?: string;
  footer?: string;
};

export type WalkthroughShellProps = {
  variant: "modal" | "page";
  title: string;
  steps: WalkthroughShellStep[];
  currentStepIndex: number;
  onDismiss?: () => void;
  dismissButtonTitle?: string;
  children: ReactNode;
  footer: ReactNode;
  tourIds?: WalkthroughShellTourIds;
};

export function WalkthroughShell({
  variant,
  title,
  steps,
  currentStepIndex,
  onDismiss,
  dismissButtonTitle = "Close",
  children,
  footer,
  tourIds,
}: WalkthroughShellProps) {
  const step = steps[currentStepIndex];
  if (!step) return null;

  const Icon = step.icon;

  const card = (
    <div
      className={`w-full max-w-4xl bg-background rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] shadow-2xl overflow-hidden flex flex-col ${
        variant === "page" ? "max-h-[min(88vh,calc(100vh-10rem))]" : "max-h-[88vh]"
      }`}
    >
      <div
        className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0"
        data-tour={tourIds?.header}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src="/sophos-icon-white.svg" alt="Sophos" className="h-5 w-5 hidden dark:block" />
            <img
              src="/sophos-icon-white.svg"
              alt="Sophos"
              className="h-5 w-5 dark:hidden brightness-0"
            />
            <span className="text-sm font-display font-bold text-foreground">{title}</span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
              title={dismissButtonTitle}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1" data-tour={tourIds?.progress}>
          {steps.map((s, i) => (
            <div key={s.id} className="flex-1 flex items-center gap-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < currentStepIndex
                    ? "bg-[#00A878] dark:bg-[#00F2B3]"
                    : i === currentStepIndex
                      ? "bg-[#2006F7]"
                      : "bg-muted"
                }`}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="h-7 w-7 rounded-lg bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-brand-accent" />
          </div>
          <span className="text-xs font-semibold text-foreground">{step.title}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5" data-tour={tourIds?.body}>
        {children}
      </div>

      <div
        className="px-6 py-4 border-t border-border bg-card flex items-center gap-3 shrink-0"
        data-tour={tourIds?.footer}
      >
        {footer}
      </div>
    </div>
  );

  if (variant === "modal") {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">{card}</div>
      </>
    );
  }

  return <div className="w-full flex justify-center">{card}</div>;
}

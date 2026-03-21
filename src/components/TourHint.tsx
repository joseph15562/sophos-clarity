import { useCallback } from "react";
import { HelpCircle } from "lucide-react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

interface TourHintProps {
  /** The data-tour selector value to highlight (without `[data-tour=""]` wrapper). */
  tourId?: string;
  /** Override steps — if provided, these are used instead of highlighting tourId. */
  steps?: DriveStep[];
  /** Popover title when using the simple single-element mode. */
  title?: string;
  /** Popover description when using the simple single-element mode. */
  description?: string;
  /** Which side to show the popover. */
  side?: "top" | "bottom" | "left" | "right";
  /** Extra CSS classes on the button. */
  className?: string;
}

export function TourHint({ tourId, steps, title, description, side = "bottom", className = "" }: TourHintProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    const resolvedSteps: DriveStep[] = steps ?? (tourId
      ? [{
          element: `[data-tour="${tourId}"]`,
          popover: { title: title ?? "", description: description ?? "", side, align: "center" as const },
        }]
      : [{ popover: { title: title ?? "", description: description ?? "" } }]);

    const visible = resolvedSteps.filter((s) => {
      if (!s.element) return true;
      const el = typeof s.element === "string" ? document.querySelector(s.element) : s.element;
      return !!el;
    });

    if (visible.length === 0) return;

    const d = driver({
      showProgress: visible.length > 1,
      animate: true,
      overlayColor: "rgba(0,0,0,0.5)",
      stagePadding: 8,
      stageRadius: 10,
      popoverOffset: 12,
      progressText: "{{current}} / {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Got it",
      steps: visible,
    });
    d.drive();
  }, [tourId, steps, title, description, side]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground/60 hover:text-[#2006F7] dark:hover:text-[#00EDFF] hover:bg-[#2006F7]/10 dark:hover:bg-[#00EDFF]/10 transition-colors ${className}`}
      aria-label={title ? `Learn about: ${title}` : "Quick tour"}
      title={title ?? "Quick tour"}
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </button>
  );
}

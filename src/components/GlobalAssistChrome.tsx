import { lazy, Suspense, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import { GuidedTourButton } from "@/components/GuidedTourButton";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcuts";
import { useAssistChrome } from "@/contexts/assist-chrome-context";
import { useKeyboardShortcuts, type ShortcutAction } from "@/hooks/use-keyboard-shortcuts";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const AIChatPanel = lazy(() =>
  import("@/components/AIChatPanel").then((m) => ({ default: m.AIChatPanel })),
);

const noopTour = {
  openDrawer: () => {},
  setDrawerTab: () => {},
  setAnalysisTab: () => {},
};

/**
 * Global bottom Tours + Shortcuts strip and floating AI chat (hub mode or assess override from context).
 */
export function GlobalAssistChrome() {
  const location = useLocation();
  const { assess } = useAssistChrome();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const barDark = useResolvedIsDark();

  const tourCallbacks = assess?.tourCallbacks ?? noopTour;
  const hasFiles = assess?.hasFiles ?? false;
  const hasReports = assess?.hasReports ?? false;
  const isGuest = assess?.isGuest ?? true;

  const toggleShortcuts = useCallback(() => setShortcutsOpen((v) => !v), []);

  const globalShortcutActions = useMemo<ShortcutAction[]>(() => {
    const list: ShortcutAction[] = [
      {
        key: "?",
        shift: true,
        description: "Show keyboard shortcuts",
        handler: toggleShortcuts,
      },
    ];
    if (shortcutsOpen) {
      list.push({
        key: "Escape",
        description: "Close keyboard shortcuts",
        handler: () => setShortcutsOpen(false),
      });
    }
    return list;
  }, [toggleShortcuts, shortcutsOpen]);

  useKeyboardShortcuts(globalShortcutActions);

  const showAi = assess === null || assess.ai !== null;
  const aiBinding = assess?.ai;

  const hideAssistBar = location.pathname === "/help" || location.pathname.startsWith("/help/");

  return (
    <>
      {!hideAssistBar && (
        <div
          className={
            barDark
              ? "no-print fixed bottom-0 inset-x-0 z-30 border-t border-white/[0.1] shadow-[0_-20px_56px_-12px_rgba(0,0,0,0.55),0_-1px_0_rgba(0,237,255,0.12)] backdrop-blur-xl"
              : "no-print fixed bottom-0 inset-x-0 z-30 border-t border-slate-900/[0.1] shadow-[0_-24px_60px_-14px_rgba(32,6,247,0.12),0_-1px_0_rgba(32,6,247,0.08)] supports-[backdrop-filter]:backdrop-blur-2xl backdrop-blur-2xl backdrop-saturate-150"
          }
          style={{
            background: barDark
              ? "linear-gradient(155deg, rgba(32,6,247,0.16), rgba(0,237,255,0.1), rgba(8,14,28,0.92))"
              : "linear-gradient(155deg, rgba(255,255,255,0.38), rgba(240,248,255,0.45), rgba(32,6,247,0.1))",
            ...(!barDark ? { WebkitBackdropFilter: "blur(40px)" as const } : {}),
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
              background: barDark
                ? "linear-gradient(90deg, transparent, rgba(0,237,255,0.65), rgba(255,255,255,0.2), rgba(32,6,247,0.4), transparent)"
                : "linear-gradient(90deg, transparent, rgba(32,6,247,0.22), rgba(0,156,251,0.2), rgba(0,237,255,0.12), transparent)",
            }}
          />

          <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-4 py-3 sm:px-6 justify-start">
            <div className="flex items-center gap-2">
              <GuidedTourButton
                hasFiles={hasFiles}
                hasReports={hasReports}
                isGuest={isGuest}
                tourCallbacks={tourCallbacks}
              />
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
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
            </div>
          </div>
        </div>
      )}

      {showAi ? (
        <ErrorBoundary fallbackTitle="AI Chat failed to load">
          <Suspense fallback={null}>
            {aiBinding ? (
              <AIChatPanel {...aiBinding} assistPathname="/" />
            ) : (
              <AIChatPanel analysisResults={{}} reports={[]} assistPathname={location.pathname} />
            )}
          </Suspense>
        </ErrorBoundary>
      ) : null}

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}

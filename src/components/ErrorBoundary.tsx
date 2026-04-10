import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  /** When any value changes while in error state, the boundary auto-resets. */
  resetKeys?: unknown[];
  /** Fires once when an error is caught (useful for closing drawers / resetting parent state). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Stale SPA shell after deploy: old index points at removed hashed chunks. Full reload fetches fresh HTML. */
export function isLikelyStaleBundleError(error: Error | null): boolean {
  if (!error?.message) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes("importing a module script failed") ||
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("error loading dynamically imported module") ||
    m.includes("loading css chunk") ||
    m.includes("loading chunk") ||
    m.includes("dynamically imported module")
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && this.props.resetKeys) {
      const prev = prevProps.resetKeys ?? [];
      if (this.props.resetKeys.some((k, i) => k !== prev[i])) {
        this.setState({ hasError: false, error: null });
      }
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[ErrorBoundary]", error.message, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleFullReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const staleBundle = isLikelyStaleBundleError(this.state.error);
      return (
        <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-10 w-10 rounded-full bg-severity-high/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-severity-high" />
            </div>
          </div>
          <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {staleBundle ? (
              <>
                This usually happens right after we publish an update: your browser still has an old
                copy of the app that points at scripts that no longer exist.{" "}
                <strong className="text-foreground">Reload the page</strong> to fetch the latest
                version (a normal refresh is enough).
              </>
            ) : (
              <>
                This section encountered an error. Your data is safe — try refreshing this section
                or reload the page.
              </>
            )}
          </p>
          {this.state.error && (
            <p className="text-[10px] font-mono text-muted-foreground/60 max-w-md mx-auto break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {staleBundle ? (
              <Button
                variant="default"
                size="sm"
                onClick={this.handleFullReload}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="h-3 w-3" /> Reload page
              </Button>
            ) : (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={this.handleFullReload}
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw className="h-3 w-3" /> Reload page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                  className="gap-1.5 text-xs"
                >
                  Try again (same session)
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

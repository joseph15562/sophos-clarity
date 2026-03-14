import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[ErrorBoundary]", error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-10 w-10 rounded-full bg-[#F29400]/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-[#F29400]" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            This section encountered an error. Your data is safe — try refreshing this section or reload the page.
          </p>
          {this.state.error && (
            <p className="text-[10px] font-mono text-muted-foreground/60 max-w-md mx-auto truncate">
              {this.state.error.message}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-1.5 text-xs">
            <RotateCcw className="h-3 w-3" /> Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type LoadingVariant = "spinner" | "skeleton" | "inline";

interface LoadingStateProps {
  variant?: LoadingVariant;
  className?: string;
}

export function LoadingState({ variant = "spinner", className = "" }: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div className={`space-y-2 ${className}`}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }
  if (variant === "inline") {
    return (
      <Loader2 className={`h-4 w-4 animate-spin shrink-0 text-muted-foreground ${className}`} />
    );
  }
  return (
    <div className={`flex justify-center py-8 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

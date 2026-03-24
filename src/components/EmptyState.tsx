import type { ReactNode } from "react";
import { InboxIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title = "Nothing here yet",
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        {icon ?? <InboxIcon className="h-6 w-6 text-muted-foreground/50" />}
      </div>
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mt-1.5 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2.5 w-48" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="w-full rounded-lg" style={{ height }} />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="space-y-2">
        <div className="flex gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/30">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <StatGridSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-2.5 w-64" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
        <Skeleton className="h-3 w-3/6" />
      </div>
    </div>
  );
}

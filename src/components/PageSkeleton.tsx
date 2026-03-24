import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="h-14 border-b border-border/50 px-6 flex items-center gap-4">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-4 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Page content area */}
      <div className="mx-auto w-full max-w-[1320px] px-4 md:px-6 py-8 space-y-6 animate-in fade-in duration-300">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Title block */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3.5 w-80" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>

        {/* Content rows */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { AlertTriangle, Clock, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PortfolioRiskStripProps {
  /** Distinct customers in portfolio */
  customerCount: number;
  /** Customers with score &lt; 60 */
  belowTargetCount: number;
  /** Customers with last assessment ≥ 30 days ago */
  staleCount: number;
  /** Lowest score among customers (0 if empty) */
  lowestScore: number;
  /** Name of lowest-scoring customer */
  lowestName: string | null;
  className?: string;
}

/**
 * Read-only cross-customer risk summary for Insights — uses aggregated portfolio inputs only.
 */
export function PortfolioRiskStrip({
  customerCount,
  belowTargetCount,
  staleCount,
  lowestScore,
  lowestName,
  className,
}: PortfolioRiskStripProps) {
  if (customerCount === 0) return null;

  return (
    <section
      className={cn(
        "rounded-xl border border-[#EA0022]/20 bg-gradient-to-r from-[#EA0022]/[0.06] via-background to-[#F29400]/[0.06] px-4 py-3",
        className,
      )}
      aria-label="Portfolio risk summary"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <TrendingDown className="h-4 w-4 text-[#EA0022]" aria-hidden />
          Portfolio risk
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {belowTargetCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[#EA0022] font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {belowTargetCount} customer{belowTargetCount !== 1 ? "s" : ""} below score 60
            </span>
          ) : (
            <span className="text-[#00A878] dark:text-[#00F2B3] font-medium">
              All customers at or above 60
            </span>
          )}
          {staleCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[#F29400] font-medium">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {staleCount} stale (30d+)
            </span>
          )}
          {lowestName && (
            <span>
              Lowest: <strong className="text-foreground">{lowestName}</strong> ({lowestScore})
            </span>
          )}
        </div>
        <Link
          to="/customers"
          className="ml-auto text-xs font-semibold text-brand-accent hover:underline shrink-0"
        >
          Open customers →
        </Link>
      </div>
    </section>
  );
}

import { useMemo, useState } from "react";
import { Shield } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00995a",
};

interface Alert {
  severity: string;
  description: string;
  category: string;
  raisedAt: string;
}

interface MdrIndicator {
  indicator: string;
  type: string;
}

interface FileItem {
  centralEnrichment?: {
    alerts?: Alert[];
    mdrFeed?: MdrIndicator[];
  };
}

interface ThreatFeedTimelineProps {
  files: FileItem[];
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ThreatFeedTimeline({ files }: ThreatFeedTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const MAX_EVENTS = 20;

  const { alerts, mdrIndicators } = useMemo(() => {
    const allAlerts: Alert[] = [];
    const allMdr: MdrIndicator[] = [];

    for (const file of files) {
      const ce = file.centralEnrichment;
      if (ce?.alerts) allAlerts.push(...ce.alerts);
      if (ce?.mdrFeed) allMdr.push(...ce.mdrFeed);
    }

    const sorted = [...allAlerts].sort(
      (a, b) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime()
    );

    return {
      alerts: sorted,
      mdrIndicators: allMdr,
    };
  }, [files]);

  const displayedAlerts = showAll ? alerts : alerts.slice(0, MAX_EVENTS);
  const hasMore = alerts.length > MAX_EVENTS;
  const hasCentralEnrichment = files.some((f) => f.centralEnrichment);
  const hasAlerts = alerts.length > 0;

  if (!hasCentralEnrichment || !hasAlerts) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Threat Intelligence Feed
        </h3>
        <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4 opacity-50" />
          Connect to Sophos Central to see threat intelligence
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <Shield className="h-4 w-4" />
        Threat Intelligence Feed
      </h3>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {displayedAlerts.map((event, idx) => {
          const color = SEVERITY_COLORS[event.severity?.toLowerCase()] ?? "#6b7280";
          return (
            <div
              key={`${event.raisedAt}-${idx}`}
              className="border-l-2 pl-4 py-2 border-border/50"
              style={{ borderLeftColor: color }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase"
                  style={{
                    backgroundColor: `${color}20`,
                    color,
                  }}
                >
                  {event.severity ?? "info"}
                </span>
                {event.category && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {event.category}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatRelativeTime(event.raisedAt)}
                </span>
              </div>
              <p className="text-sm text-foreground mt-1">{event.description}</p>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          {showAll ? "Show less" : `Show all (${alerts.length})`}
        </button>
      )}

      {mdrIndicators.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-foreground mb-2">MDR Indicators</h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {mdrIndicators.map((ind, idx) => (
              <div
                key={`${ind.indicator}-${idx}`}
                className="flex items-center gap-2 text-xs"
              >
                <span className="text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                  {ind.indicator}
                </span>
                <span className="text-muted-foreground">({ind.type})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

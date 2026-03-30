import { useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { severityToColor } from "@/lib/design-tokens";

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
      (a, b) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime(),
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
      <div
        className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated min-h-[160px] flex flex-col"
        style={{
          background:
            "linear-gradient(145deg, rgba(56,136,255,0.05), rgba(0,242,179,0.03), transparent)",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(56,136,255,0.18), rgba(0,242,179,0.1), transparent)",
          }}
        />
        <h3 className="text-base font-display font-bold tracking-tight text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#00F2B3]" />
          Threat Intelligence Feed
        </h3>
        <div
          className="mt-4 flex flex-1 items-center gap-4 rounded-xl p-5"
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
          }}
        >
          <Shield className="h-10 w-10 text-foreground/20 shrink-0" />
          <p className="text-sm text-foreground/50 font-medium leading-relaxed">
            {hasCentralEnrichment
              ? "No recent alerts — all clear"
              : "Link to Sophos Central to see threat intelligence"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(56,136,255,0.05), rgba(0,242,179,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(56,136,255,0.18), rgba(0,242,179,0.1), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground flex items-center gap-2 mb-5">
        <Shield className="h-5 w-5 text-[#00F2B3]" />
        Threat Intelligence Feed
      </h3>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {displayedAlerts.map((event, idx) => {
          const color = severityToColor(event.severity?.toLowerCase() ?? "info");
          return (
            <div
              key={`${event.raisedAt}-${idx}`}
              className="rounded-xl pl-4 py-3 pr-3 backdrop-blur-sm"
              style={{
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${color}`,
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              }}
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
              <p className="text-sm text-foreground/90 mt-2 font-medium leading-snug">
                {event.description}
              </p>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-4 text-sm font-bold transition-opacity hover:opacity-90"
          style={{ color: "rgba(56,136,255,0.85)" }}
        >
          {showAll ? "Show less" : `Show all (${alerts.length})`}
        </button>
      )}

      {mdrIndicators.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-900/[0.10] dark:border-white/[0.06]">
          <h4 className="text-sm font-display font-bold tracking-tight text-foreground mb-3">
            MDR Indicators
          </h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {mdrIndicators.map((ind, idx) => (
              <div key={`${ind.indicator}-${idx}`} className="flex items-center gap-2 text-xs">
                <span
                  className="text-foreground/60 font-mono px-2.5 py-1 rounded-lg backdrop-blur-sm"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
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

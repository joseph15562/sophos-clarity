"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Shield } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import type { Severity } from "@/lib/analyse-config";
import { loadPreviousSnapshot, diffFindings } from "@/lib/finding-snapshots";
import { computeRiskScore } from "@/lib/risk-score";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

type EventType = "new" | "fixed" | "score_up" | "score_down";

interface FeedEvent {
  id: string;
  type: EventType;
  title: string;
  severity?: Severity;
  hostname: string;
  delta?: number;
}

interface AlertFeedProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function AlertFeed({ analysisResults }: AlertFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [filter, setFilter] = useState<"all" | "new" | "fixed">("all");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const allEvents: FeedEvent[] = [];
      let eventId = 0;

      for (const [label, ar] of Object.entries(analysisResults)) {
        const hostname = ar.hostname ?? label;
        const previous = await loadPreviousSnapshot(hostname);
        const currentFindings = ar.findings.map((f) => ({ title: f.title }));
        const diff = diffFindings(previous, currentFindings);

        const findingByTitle = new Map(ar.findings.map((f) => [f.title, f]));

        for (const title of diff.newFindings) {
          const f = findingByTitle.get(title);
          const severity = f?.severity ?? "medium";
          allEvents.push({
            id: `new-${eventId++}`,
            type: "new",
            title,
            severity,
            hostname,
          });
        }

        for (const title of diff.fixedFindings) {
          allEvents.push({
            id: `fixed-${eventId++}`,
            type: "fixed",
            title,
            hostname,
          });
        }

        const currentScore = computeRiskScore(ar).overall;
        const prevScore = previous?.score ?? null;
        if (prevScore !== null && currentScore !== prevScore) {
          const delta = currentScore - prevScore;
          allEvents.push({
            id: `score-${eventId++}`,
            type: delta > 0 ? "score_up" : "score_down",
            title: `Score ${delta > 0 ? "+" : ""}${delta}`,
            hostname,
            delta,
          });
        }
      }

      allEvents.sort((a, b) => {
        if (a.type === "new" && b.type === "new") {
          const orderA = SEVERITY_ORDER[a.severity ?? "info"];
          const orderB = SEVERITY_ORDER[b.severity ?? "info"];
          return orderA - orderB;
        }
        if (a.type === "new") return -1;
        if (b.type === "new") return 1;
        if (a.type === "fixed" && b.type === "fixed") return 0;
        if (a.type === "fixed") return -1;
        if (b.type === "fixed") return 1;
        return 0;
      });

      if (!cancelled) {
        setEvents(allEvents.slice(0, 20));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [analysisResults]);

  const filteredEvents =
    filter === "all"
      ? events
      : filter === "new"
        ? events.filter((e) => e.type === "new")
        : events.filter((e) => e.type === "fixed");

  const renderIcon = (e: FeedEvent) => {
    const base = "h-3.5 w-3.5 shrink-0";
    switch (e.type) {
      case "new":
        return <AlertTriangle className={`${base} text-severity-critical`} />;
      case "fixed":
        return <CheckCircle className={`${base} text-severity-low`} />;
      case "score_up":
        return <TrendingUp className={`${base} text-severity-low`} />;
      case "score_down":
        return <TrendingDown className={`${base} text-severity-critical`} />;
      default:
        return <Shield className={base} />;
    }
  };

  const renderText = (e: FeedEvent) => {
    switch (e.type) {
      case "new":
        return `New finding: ${e.title}`;
      case "fixed":
        return `Resolved: ${e.title}`;
      case "score_up":
      case "score_down":
        return e.title;
      default:
        return e.title;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        Activity Feed
      </h3>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["all", "new", "fixed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer capitalize transition-colors ${
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-muted-foreground/50 text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
        {filteredEvents.length === 0 ? (
          <p className="py-6 text-xs text-muted-foreground text-center">
            {events.length === 0 ? "No activity history yet" : `No ${filter} events`}
          </p>
        ) : (
          filteredEvents.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0"
            >
              {renderIcon(e)}
              <span className="text-xs text-foreground">{renderText(e)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

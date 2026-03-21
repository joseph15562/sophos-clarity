"use client";

import { useEffect, useState } from "react";
import { Upload, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadScoreHistoryForFleet, type ScoreHistoryEntry } from "@/lib/score-history";

export interface WelcomeBackCardProps {
  orgId: string;
  onUpload: () => void;
  onLoadAgent: () => void;
}

export function WelcomeBackCard({ orgId, onUpload, onLoadAgent }: WelcomeBackCardProps) {
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<ScoreHistoryEntry | null>(null);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      setLatest(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadScoreHistoryForFleet(orgId, 500).then((entries) => {
      if (cancelled) return;
      setLatest(entries[0] ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return (
      <Card className="rounded-xl border border-border bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-44" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!latest) return null;

  const assessed = new Date(latest.assessed_at);
  const dateLabel = Number.isNaN(assessed.getTime())
    ? latest.assessed_at
    : assessed.toLocaleDateString(undefined, { dateStyle: "medium" });

  return (
    <Card className="rounded-xl border border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-display">Welcome back</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Last assessment: <span className="font-medium text-foreground">{dateLabel}</span>
          {" · "}
          <span className="tabular-nums font-semibold text-foreground">{latest.overall_score}</span>
          {" · "}
          <span className="font-semibold text-foreground">Grade {latest.overall_grade}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="default" size="sm" className="gap-1.5" onClick={onUpload}>
            <Upload className="h-3.5 w-3.5" />
            Upload New Config
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onLoadAgent}>
            <RefreshCw className="h-3.5 w-3.5" />
            Load from Agent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

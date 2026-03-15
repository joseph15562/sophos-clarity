"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { supabase } from "@/integrations/supabase/client";

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

interface FindingHeatmapTimeProps {
  analysisResults: Record<string, AnalysisResult>;
}

const DAY_LABELS = ["M", "", "W", "", "F", "", "S"];
const CELL_SIZE = 12;
const GAP = 2;

export function FindingHeatmapTime({ analysisResults }: FindingHeatmapTimeProps) {
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgId = await getOrgId();
      if (!orgId || cancelled) return;
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);
      const { data } = await supabase
        .from("finding_snapshots")
        .select("titles, created_at")
        .eq("org_id", orgId)
        .gte("created_at", ninetyDaysAgo.toISOString());

      if (cancelled || !data) return;

      const counts: Record<string, number> = {};
      for (const row of data) {
        const date = row.created_at?.slice(0, 10) ?? "";
        if (!date) continue;
        const n = Array.isArray(row.titles) ? row.titles.length : 0;
        counts[date] = (counts[date] ?? 0) + n;
      }
      setDailyCounts(counts);
    })();
    return () => { cancelled = true; };
  }, []);

  const { grid, hasData } = useMemo(() => {
    const today = new Date();
    const grid: (number | null)[][] = Array(7)
      .fill(null)
      .map(() => Array(13).fill(null) as (number | null)[]);

    for (let i = 0; i < 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (89 - i));
      const key = d.toISOString().slice(0, 10);
      const col = Math.floor(i / 7);
      const row = (d.getDay() + 6) % 7;
      if (col < 13 && row < 7) {
        grid[row][col] = dailyCounts[key] ?? 0;
      }
    }

    const hasData = Object.values(dailyCounts).some((v) => v > 0);
    return { grid, hasData };
  }, [dailyCounts]);

  const cellClass = (count: number): string => {
    if (count === 0) return "bg-muted/30";
    if (count <= 2) return "bg-[#00995a]/20";
    if (count <= 5) return "bg-[#00995a]/40";
    return "bg-[#00995a]/70";
  };

  const getDateForCell = (col: number, row: number): string => {
    const today = new Date();
    for (let i = col * 7; i < col * 7 + 7 && i < 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (89 - i));
      if ((d.getDay() + 6) % 7 === row) return d.toISOString().slice(0, 10);
    }
    return "";
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Finding Activity</h3>
      {!hasData ? (
        <p className="text-xs text-muted-foreground">Assessment history builds over time</p>
      ) : (
        <div className="flex gap-2">
          <div className="flex flex-col justify-between py-0.5 text-[10px] text-muted-foreground">
            {DAY_LABELS.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <div
            className="rounded-sm"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(13, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
              gap: GAP,
            }}
          >
            {grid.map((row, rowIdx) =>
              row.map((count, colIdx) => {
                const date = getDateForCell(colIdx, rowIdx);
                const c = count ?? 0;
                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={`rounded-sm ${cellClass(c)}`}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    title={`${date}: ${c} finding${c !== 1 ? "s" : ""}`}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

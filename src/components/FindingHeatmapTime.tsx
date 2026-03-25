"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { supabase } from "@/integrations/supabase/client";

async function getOrgId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
const CELL_SIZE = 14;
const GAP = 3;

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
    return () => {
      cancelled = true;
    };
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
    if (count === 0)
      return "bg-white/75 dark:bg-white/[0.04] border border-slate-900/[0.10] dark:border-white/[0.05]";
    if (count <= 2) return "bg-[#00F2B3]/25 border border-[#008F69]/30 dark:border-[#00F2B3]/20";
    if (count <= 5) return "bg-[#00F2B3]/45 border border-[#00F2B3]/25";
    return "bg-[#00F2B3]/75 border border-[#00F2B3]/40";
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
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(0,242,179,0.05), rgba(56,136,255,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,242,179,0.2), rgba(56,136,255,0.1), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-5">
        Finding Activity
      </h3>
      {!hasData ? (
        <p className="text-sm text-foreground/45 font-medium">
          Assessment history builds over time
        </p>
      ) : (
        <div
          className="flex gap-4 justify-center sm:justify-start rounded-xl p-4 backdrop-blur-sm w-full"
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex flex-col justify-between py-0.5 text-[11px] font-semibold text-foreground/40 w-4">
            {DAY_LABELS.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <div
            className="rounded-lg"
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
                    className={`rounded-md ${cellClass(c)} transition-transform hover:scale-110`}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      boxShadow: c > 0 ? "0 0 8px rgba(0,242,179,0.2)" : undefined,
                    }}
                    title={`${date}: ${c} finding${c !== 1 ? "s" : ""}`}
                  />
                );
              }),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

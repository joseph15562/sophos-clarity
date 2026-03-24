import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { getFirstDetectedAtBatch } from "@/lib/finding-snapshots";
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

const AGE_BANDS = [
  { key: "new", label: "< 7 days", color: "#009CFB", minDays: 0, maxDays: 7 },
  { key: "7-30", label: "7–30 days", color: "#F29400", minDays: 7, maxDays: 30 },
  { key: "30-90", label: "30–90 days", color: "#EA6A00", minDays: 30, maxDays: 90 },
  { key: "90+", label: "> 90 days", color: "#EA0022", minDays: 90, maxDays: Infinity },
] as const;

function getAgeBand(firstDetectedAt: string | null): (typeof AGE_BANDS)[number]["key"] {
  if (!firstDetectedAt) return "new";
  const days = (Date.now() - new Date(firstDetectedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 7) return "new";
  if (days < 30) return "7-30";
  if (days < 90) return "30-90";
  return "90+";
}

export function FindingsByAge({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [firstDetectedMap, setFirstDetectedMap] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const pairs = useMemo(() => {
    const out: { hostname: string; findingTitle: string }[] = [];
    for (const [hostname, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) {
        out.push({ hostname, findingTitle: f.title });
      }
    }
    return out;
  }, [analysisResults]);

  useEffect(() => {
    setLoaded(false);
    let cancelled = false;
    (async () => {
      const orgId = await getOrgId();
      const map = await getFirstDetectedAtBatch(orgId, pairs);
      if (!cancelled) {
        setFirstDetectedMap(map);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pairs]);

  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = { new: 0, "7-30": 0, "30-90": 0, "90+": 0 };
    for (const [hostname, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) {
        const key = `${hostname}:${f.title}`;
        const firstAt = firstDetectedMap.get(key) ?? null;
        const band = getAgeBand(firstAt);
        counts[band]++;
      }
    }
    return counts;
  }, [analysisResults, firstDetectedMap]);

  const total = useMemo(() => Object.values(bandCounts).reduce((a, b) => a + b, 0), [bandCounts]);
  const hasHistoricalData = useMemo(
    () => loaded && pairs.length > 0 && pairs.some((p) => firstDetectedMap.has(`${p.hostname}:${p.findingTitle}`)),
    [loaded, pairs, firstDetectedMap]
  );

  if (total === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">Findings by Age</h3>
        <p className="mt-3 text-[10px] text-muted-foreground">No findings detected</p>
      </div>
    );
  }

  const bandsWithCount = AGE_BANDS.map((b) => ({ ...b, count: bandCounts[b.key] })).filter((b) => b.count > 0);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">Findings by Age</h3>

      <div className="mt-3 w-full h-4 rounded-full overflow-hidden flex">
        {AGE_BANDS.map((band, idx) => {
          const count = bandCounts[band.key];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          const isFirst = AGE_BANDS.slice(0, idx).every((b) => bandCounts[b.key] === 0);
          const isLast = AGE_BANDS.slice(idx + 1).every((b) => bandCounts[b.key] === 0);
          return (
            <div
              key={band.key}
              className="h-full min-w-[2px] transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: band.color,
                borderRadius: isFirst && isLast ? "9999px" : isFirst ? "9999px 0 0 9999px" : isLast ? "0 9999px 9999px 0" : 0,
              }}
            />
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {bandsWithCount.map((b) => (
          <span key={b.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
            {b.count} finding{b.count !== 1 ? "s" : ""}
          </span>
        ))}
      </div>

      {loaded && total > 0 && !hasHistoricalData && (
        <p className="mt-2 text-[10px] text-muted-foreground italic">First assessment — all findings are new</p>
      )}
    </div>
  );
}

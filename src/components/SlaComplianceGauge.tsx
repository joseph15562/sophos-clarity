"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import type { Severity } from "@/lib/analyse-config";
import { supabase } from "@/integrations/supabase/client";
import { getFirstDetectedAtBatch } from "@/lib/finding-snapshots";

const GREEN = "#00F2B3";
const RED = "#EA0022";

const DEFAULT_SLA: Record<string, number> = {
  critical: 3,
  high: 7,
  medium: 30,
  low: 90,
  info: 90,
};

interface SlaComplianceGaugeProps {
  analysisResults: Record<string, AnalysisResult>;
}

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

function loadSlaConfig(): Record<string, number> {
  try {
    const raw = localStorage.getItem("sophos-sla-config");
    if (!raw) return { ...DEFAULT_SLA };
    const parsed = JSON.parse(raw) as { critical?: number; high?: number; medium?: number; low?: number };
    return {
      critical: parsed.critical ?? DEFAULT_SLA.critical,
      high: parsed.high ?? DEFAULT_SLA.high,
      medium: parsed.medium ?? DEFAULT_SLA.medium,
      low: parsed.low ?? DEFAULT_SLA.low,
      info: parsed.low ?? DEFAULT_SLA.info,
    };
  } catch {
    return { ...DEFAULT_SLA };
  }
}

export function SlaComplianceGauge({ analysisResults }: SlaComplianceGaugeProps) {
  const [firstDetectedMap, setFirstDetectedMap] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const pairs = useMemo(() => {
    const out: { hostname: string; findingTitle: string }[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      const hostname = ar.hostname ?? label;
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

  const slaConfig = useMemo(loadSlaConfig, []);

  const { onTrack, breached, total, hasHistoricalData } = useMemo(() => {
    let onTrack = 0;
    let breached = 0;

    for (const [label, ar] of Object.entries(analysisResults)) {
      const hostname = ar.hostname ?? label;
      for (const f of ar.findings) {
        const key = `${hostname}:${f.title}`;
        const firstAt = firstDetectedMap.get(key) ?? null;

        if (!firstAt) {
          continue;
        }

        const severity = f.severity as Severity;
        const slaDays = slaConfig[severity] ?? slaConfig.low ?? 90;
        const daysSince = (Date.now() - new Date(firstAt).getTime()) / (1000 * 60 * 60 * 24);

        if (daysSince < slaDays) {
          onTrack++;
        } else {
          breached++;
        }
      }
    }

    const total = onTrack + breached;
    const hasHistoricalData =
      loaded &&
      pairs.length > 0 &&
      pairs.some((p) => firstDetectedMap.has(`${p.hostname}:${p.findingTitle}`));

    return { onTrack, breached, total, hasHistoricalData };
  }, [analysisResults, firstDetectedMap, loaded, pairs, slaConfig]);

  if (!loaded || !hasHistoricalData) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">SLA Compliance</h3>
        <p className="mt-4 text-sm text-muted-foreground text-center">
          SLA tracking requires assessment history
        </p>
      </div>
    );
  }

  const totalFindings = total;
  const pct = totalFindings > 0 ? Math.round((onTrack / totalFindings) * 100) : 100;

  const r = 80;
  const circumference = 2 * Math.PI * r;
  const onTrackLen = totalFindings > 0 ? (onTrack / totalFindings) * circumference : circumference;
  const breachedLen = totalFindings > 0 ? (breached / totalFindings) * circumference : 0;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">SLA Compliance</h3>

      <div className="mt-4 flex flex-col items-center">
        <svg width={200} height={200} viewBox="0 0 200 200" className="overflow-visible">
          <circle
            cx={100}
            cy={100}
            r={r}
            fill="none"
            stroke="rgb(229 231 235)"
            strokeWidth={16}
          />
          {onTrackLen > 0 && (
            <circle
              cx={100}
              cy={100}
              r={r}
              fill="none"
              stroke={GREEN}
              strokeWidth={16}
              strokeDasharray={`${onTrackLen} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
            />
          )}
          {breachedLen > 0 && (
            <circle
              cx={100}
              cy={100}
              r={r}
              fill="none"
              stroke={RED}
              strokeWidth={16}
              strokeDasharray={`${breachedLen} ${circumference}`}
              strokeDashoffset={-onTrackLen}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
            />
          )}
          <text
            x={100}
            y={100}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground font-bold"
            style={{ fontSize: 32 }}
          >
            {pct}%
          </text>
        </svg>

        <p className="mt-2 text-xs text-muted-foreground">
          {onTrack} on track · {breached} breached
        </p>
      </div>
    </div>
  );
}

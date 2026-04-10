import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { AnalysisResult } from "@/lib/analyse-config";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

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

function getWeekStart(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy;
}

interface WeekData {
  week: string;
  label: string;
  count: number;
}

export function RemediationVelocity({ analysisResults: _analysisResults }: Props) {
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orgId = await getOrgId();
      if (!orgId) {
        if (!cancelled) {
          setWeeklyData([]);
          setLoading(false);
        }
        return;
      }

      const now = new Date();
      const eightWeeksAgo = new Date(now);
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

      const { data, error } = await supabase
        .from("remediation_status")
        .select("completed_at")
        .eq("org_id", orgId)
        .gte("completed_at", eightWeeksAgo.toISOString());

      if (cancelled) return;
      if (error) {
        setWeeklyData([]);
        setLoading(false);
        return;
      }

      const weekStarts: Date[] = [];
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        weekStarts.push(getWeekStart(d));
      }

      const counts = new Map<string, number>();
      weekStarts.forEach((ws) => {
        const key = ws.toISOString().slice(0, 10);
        counts.set(key, 0);
      });

      const weekKeys = weekStarts.map((ws) => ws.toISOString().slice(0, 10));

      (data ?? []).forEach((row) => {
        const completed = new Date(row.completed_at);
        const ws = getWeekStart(completed);
        const key = ws.toISOString().slice(0, 10);
        const idx = weekKeys.indexOf(key);
        if (idx >= 0) {
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      });

      const chartData: WeekData[] = weekStarts.map((ws, i) => {
        const key = ws.toISOString().slice(0, 10);
        return {
          week: key,
          label: `W${i + 1}`,
          count: counts.get(key) ?? 0,
        };
      });

      if (!cancelled) {
        setWeeklyData(chartData);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5 animate-pulse">
        <div className="h-4 bg-muted/40 rounded w-1/3 mb-3" />
        <div className="h-40 bg-muted/40 rounded" />
      </div>
    );
  }

  const hasData = weeklyData.some((w) => w.count > 0);
  if (!hasData) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-2">
          Remediation Velocity
        </h3>
        <p className="text-sm text-muted-foreground">
          No remediation history yet. Complete playbook items to see velocity.
        </p>
      </div>
    );
  }

  const total = weeklyData.reduce((s, w) => s + w.count, 0);
  const avg = total / 8;
  const first4Avg = weeklyData.slice(0, 4).reduce((s, w) => s + w.count, 0) / 4;
  const last4Avg = weeklyData.slice(4, 8).reduce((s, w) => s + w.count, 0) / 4;
  const improving = last4Avg > first4Avg;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-3">
        Remediation Velocity
      </h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="remediationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00F2B3" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#00F2B3" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-md border border-border/50 bg-card px-2 py-1.5 text-xs shadow-elevated">
                    Week {d.label.replace("W", "")}: {d.count} finding{d.count === 1 ? "" : "s"}{" "}
                    resolved
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#00F2B3"
              strokeWidth={2}
              fill="url(#remediationGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-muted-foreground">Avg {avg.toFixed(1)} findings/week</span>
        <span
          className={
            improving
              ? "font-medium text-[#00F2B3]"
              : "font-medium text-amber-600 dark:text-amber-500"
          }
        >
          {improving ? "Improving" : "Declining"}
        </span>
      </div>
    </div>
  );
}

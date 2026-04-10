import { memo, useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, Clock, RefreshCw, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useHealthChecksQuery, queryKeys } from "@/hooks/queries";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  activeTeamId: string;
  seProfileId: string;
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A":
      return "bg-[#00F2B3]/15 text-[#00F2B3] dark:bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3]";
    case "B":
      return "bg-brand-accent/15 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF]";
    case "C":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "D":
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
    case "F":
      return "bg-[#EA0022]/15 text-[#EA0022]";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const GRADE_BAR_COLORS: Record<string, string> = {
  A: "#00F2B3",
  B: "#2006F7",
  C: "#ca8a04",
  D: "#F29400",
  F: "#EA0022",
};

function TeamDashboardInner({ activeTeamId, seProfileId }: Props) {
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading: loading } = useHealthChecksQuery(activeTeamId);
  const [open, setOpen] = useState(false);

  const load = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.healthChecks.list(activeTeamId) });

  const stats = useMemo(() => {
    if (rows.length === 0) return null;

    const now = new Date();
    const thisMonth = rows.filter((r) => {
      const d = new Date(r.checked_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const thisQuarter = rows.filter((r) => {
      const d = new Date(r.checked_at);
      const q = Math.floor(d.getMonth() / 3);
      const nowQ = Math.floor(now.getMonth() / 3);
      return q === nowQ && d.getFullYear() === now.getFullYear();
    });

    const scores = rows.filter((r) => r.overall_score != null).map((r) => r.overall_score!);
    const avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    const gradeDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const r of rows) {
      if (r.overall_grade && r.overall_grade in gradeDist) gradeDist[r.overall_grade]++;
    }

    const byMember = new Map<string, { name: string; count: number }>();
    for (const r of rows) {
      const key = r.se_user_id;
      const existing = byMember.get(key);
      if (existing) {
        existing.count++;
      } else {
        const name =
          r.se_profiles?.display_name || (r.se_user_id === seProfileId ? "You" : "Unknown");
        byMember.set(key, { name, count: 1 });
      }
    }
    const memberActivity = Array.from(byMember.values()).sort((a, b) => b.count - a.count);

    const findingCounts = new Map<string, number>();
    for (const r of rows) {
      const sj = r.summary_json;
      const topFindings = (sj?.topFindings as string[]) ?? [];
      for (const f of topFindings) {
        findingCounts.set(f, (findingCounts.get(f) ?? 0) + 1);
      }
    }
    const commonFindings = Array.from(findingCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const recent = rows.slice(0, 10);

    return {
      totalChecks: rows.length,
      thisMonth: thisMonth.length,
      thisQuarter: thisQuarter.length,
      avgScore,
      gradeDist,
      memberActivity,
      commonFindings,
      recent,
    };
  }, [rows, seProfileId]);

  if (loading && rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.96),rgba(12,18,34,0.96))] px-4 py-3.5 text-left shadow-sm hover:border-brand-accent/25 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl border border-brand-accent/15 bg-brand-accent/10 flex items-center justify-center shrink-0">
            <BarChart3 className="h-4 w-4 text-brand-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-display font-black text-foreground tracking-tight">
              Team Dashboard
            </p>
            <p className="text-[11px] text-muted-foreground">
              Monitor team score distribution, activity, and recurring findings.
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] overflow-hidden shadow-[0_18px_50px_rgba(32,6,247,0.08)]">
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card/60">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Team Overview
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                Health check performance across the active team
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="p-8">
              <LoadingState variant="spinner" />
            </div>
          ) : !stats ? (
            <EmptyState
              className="py-10"
              title="No health checks yet"
              description="Run a health check for this team to see distribution and trends here."
            />
          ) : (
            <div className="p-4 space-y-5">
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Checks" value={stats.totalChecks} />
                <StatCard label="This Month" value={stats.thisMonth} />
                <StatCard label="This Quarter" value={stats.thisQuarter} />
                <StatCard
                  label="Avg Score"
                  value={stats.avgScore != null ? `${stats.avgScore}%` : "—"}
                />
              </div>

              {/* Grade distribution */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Score Distribution
                </p>
                <div className="flex items-end gap-1 h-20">
                  {(["A", "B", "C", "D", "F"] as const).map((g) => {
                    const count = stats.gradeDist[g];
                    const max = Math.max(...Object.values(stats.gradeDist), 1);
                    const pct = (count / max) * 100;
                    return (
                      <div key={g} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full relative" style={{ height: 60 }}>
                          <div
                            className="absolute bottom-0 w-full rounded-t"
                            style={{
                              height: `${Math.max(pct, 4)}%`,
                              backgroundColor: GRADE_BAR_COLORS[g] ?? "#666",
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground">{g}</span>
                        <span className="text-[9px] text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Common failing findings */}
              {stats.commonFindings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Most Common Findings
                  </p>
                  <div className="space-y-1.5">
                    {stats.commonFindings.map(([finding, count]) => (
                      <div
                        key={finding}
                        className="flex items-center justify-between gap-2 text-xs py-2 px-3 rounded-xl border border-border/60 bg-card/70 shadow-sm"
                      >
                        <span className="truncate text-foreground font-medium">{finding}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {count}x
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity by member */}
              {stats.memberActivity.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Team Activity
                  </p>
                  <div className="space-y-1.5">
                    {stats.memberActivity.map((m) => (
                      <div
                        key={m.name}
                        className="flex items-center justify-between gap-2 text-xs py-2 px-3 rounded-xl border border-border/60 bg-card/70 shadow-sm"
                      >
                        <span className="text-foreground font-medium">{m.name}</span>
                        <span className="text-muted-foreground">
                          {m.count} check{m.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent activity */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recent Activity
                </p>
                <div className="space-y-1.5">
                  {stats.recent.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 text-xs py-2.5 px-3 rounded-xl border border-border/60 bg-card/70 shadow-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{r.customer_name || "—"}</span>
                        <span className="text-muted-foreground shrink-0">
                          by{" "}
                          {r.se_user_id === seProfileId
                            ? "You"
                            : r.se_profiles?.display_name || "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          className={`${gradeColor(r.overall_grade)} border-0 text-[9px] px-1.5 py-0`}
                        >
                          {r.overall_grade ?? "—"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(r.checked_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export const TeamDashboard = memo(TeamDashboardInner);

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/70 p-3.5 text-center shadow-sm">
      <p className="text-2xl font-display font-black tracking-tight text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </p>
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildSeHealthCheckExportBundle,
  parseSeHealthCheckSnapshotFromSummaryJson,
  type SeHealthCheckSnapshotV1,
} from "@/lib/se-health-check-snapshot-v2";
import { toast } from "sonner";
import type { SETeam } from "@/hooks/use-active-team";

interface HealthCheckRow {
  id: string;
  customer_name: string | null;
  overall_score: number | null;
  overall_grade: string | null;
  findings_count: number | null;
  firewall_count: number | null;
  checked_at: string;
  summary_json?: Record<string, unknown> | null;
  se_user_id?: string;
  team_id?: string | null;
  followup_at?: string | null;
  se_profiles?: { display_name: string | null } | null;
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A":
      return "bg-[#00F2B3]/15 text-[#00F2B3] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3]";
    case "B":
      return "bg-[#2006F7]/15 text-[#2006F7] dark:text-[#00EDFF]/10 dark:text-[#00EDFF]";
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

type Props = {
  seProfileId: string;
  refreshTrigger?: number;
  preparedBy: string;
  onRestoreSnapshot?: (snapshot: SeHealthCheckSnapshotV1, meta?: { checkId: string; followupAt?: string | null }) => void;
  activeTeamId?: string | null;
  teams?: SETeam[];
};

export function SEHealthCheckHistory({ seProfileId, refreshTrigger = 0, preparedBy, onRestoreSnapshot, activeTeamId, teams }: Props) {
  const [rows, setRows] = useState<HealthCheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportingKind, setExportingKind] = useState<"pdf" | "html" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [movingBulk, setMovingBulk] = useState(false);
  const [viewMode, setViewMode] = useState<"mine" | "team" | "all">("mine");

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("se_health_checks")
      .select("id, customer_name, overall_score, overall_grade, findings_count, firewall_count, checked_at, se_user_id, team_id, followup_at, se_profiles(display_name)")
      .order("checked_at", { ascending: false })
      .limit(50);

    if (viewMode === "all" && teams && teams.length > 0) {
      query = query.in("team_id", teams.map((t) => t.id));
    } else if (activeTeamId) {
      query = query.eq("team_id", activeTeamId);
      if (viewMode === "mine") {
        query = query.eq("se_user_id", seProfileId);
      }
    } else {
      query = query.eq("se_user_id", seProfileId).is("team_id", null);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRows(data as unknown as HealthCheckRow[]);
    }
    setSelectedIds(new Set());
    setLoading(false);
  }, [seProfileId, activeTeamId, viewMode, teams]);

  useEffect(() => {
    void load();
  }, [load, refreshTrigger]);

  const fetchSnapshot = useCallback(async (rowId: string): Promise<SeHealthCheckSnapshotV1 | null> => {
    const { data, error } = await supabase
      .from("se_health_checks")
      .select("summary_json")
      .eq("id", rowId)
      .single();
    if (error || !data) return null;
    return parseSeHealthCheckSnapshotFromSummaryJson(data.summary_json as Record<string, unknown> | null);
  }, []);

  const runExport = useCallback(
    async (row: HealthCheckRow, kind: "pdf" | "html") => {
      const id = row.id;
      setExportingId(id);
      setExportingKind(kind);
      try {
        const snapshot = await fetchSnapshot(id);
        if (!snapshot) {
          toast.error("This save has no full snapshot — save the health check again from a current session to enable reopen and export.");
          return;
        }
        const generatedAt = new Date(row.checked_at);
        const { reportParams, branding } = buildSeHealthCheckExportBundle(snapshot, preparedBy, generatedAt);
        const customerPart = row.customer_name?.trim() || snapshot.customerName.trim() || "health-check";
        if (kind === "pdf") {
          const { runHealthCheckPdfDownload } = await import("@/lib/health-check-pdf-download-v2");
          await runHealthCheckPdfDownload({ reportParams, branding, filenameCustomerPart: customerPart });
          toast.success("PDF downloaded.");
        } else {
          const { runHealthCheckHtmlDownload } = await import("@/lib/health-check-pdf-download-v2");
          await runHealthCheckHtmlDownload({ reportParams, branding, filenameCustomerPart: customerPart });
          toast.success("HTML downloaded.");
        }
      } catch (e) {
        console.warn("[SEHealthCheckHistory] export failed", e);
        toast.error(e instanceof Error ? e.message : "Export failed.");
      } finally {
        setExportingId(null);
        setExportingKind(null);
      }
    },
    [preparedBy, fetchSnapshot],
  );

  const handleMoveToTeam = useCallback(async (checkId: string, targetTeamId: string | null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/health-checks/${checkId}/team`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ team_id: targetTeamId }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Move failed");
      }
      toast.success("Health check moved.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move health check.");
    }
  }, [load]);

  const handleBulkMove = useCallback(async (targetTeamId: string | null) => {
    if (selectedIds.size === 0) return;
    setMovingBulk(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/health-checks/bulk-team`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: [...selectedIds], team_id: targetTeamId }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk move failed");
      }
      const result = await res.json();
      toast.success(`Moved ${result.updated} health check${result.updated !== 1 ? "s" : ""}.`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk move failed.");
    } finally {
      setMovingBulk(false);
    }
  }, [selectedIds, load]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.filter((r) => r.se_user_id === seProfileId).map((r) => r.id)));
    }
  }, [selectedIds, rows, seProfileId]);

  const moveTargets = useMemo(() => {
    const targets: Array<{ id: string; label: string }> = [];
    for (const t of teams ?? []) {
      if (t.id !== activeTeamId) targets.push({ id: t.id, label: t.name });
    }
    return targets;
  }, [teams, activeTeamId]);

  const teamNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teams ?? []) m.set(t.id, t.name);
    return m;
  }, [teams]);

  if (loading && rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-[#2006F7] dark:hover:text-[#00EDFF] transition-colors"
      >
        <Clock className="h-4 w-4" />
        Past health checks ({rows.length})
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-2 border-b border-border gap-2">
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && moveTargets.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{selectedIds.size} selected</span>
                  {moveTargets.map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      disabled={movingBulk}
                      onClick={() => void handleBulkMove(t.id)}
                    >
                      <ArrowRightLeft className="h-3 w-3" />
                      {t.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {activeTeamId && (
                <div className="flex items-center rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${viewMode === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setViewMode("mine")}
                  >
                    My reports
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${viewMode === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setViewMode("team")}
                  >
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />Team</span>
                  </button>
                  {(teams?.length ?? 0) > 1 && (
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${viewMode === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => setViewMode("all")}
                    >
                      All teams
                    </button>
                  )}
                </div>
              )}
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No health checks saved yet. Run a check and click &quot;Save health check&quot; to start building your history.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {(teams?.length ?? 0) > 0 && (
                      <th className="px-2 py-2 w-8">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedIds.size > 0 && selectedIds.size === rows.filter((r) => r.se_user_id === seProfileId).length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                    )}
                    <th className="px-4 py-2">Customer</th>
                    {viewMode !== "mine" && <th className="px-4 py-2">Created by</th>}
                    {viewMode === "all" && <th className="px-4 py-2">Team</th>}
                    <th className="px-4 py-2">Score</th>
                    <th className="px-4 py-2">Grade</th>
                    <th className="px-4 py-2">Findings</th>
                    <th className="px-4 py-2">Firewalls</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const busyPdf = exportingId === row.id && exportingKind === "pdf";
                    const busyHtml = exportingId === row.id && exportingKind === "html";
                    const isOwn = row.se_user_id === seProfileId;
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        {(teams?.length ?? 0) > 0 && (
                          <td className="px-2 py-2.5">
                            {isOwn ? (
                              <input
                                type="checkbox"
                                className="rounded border-border"
                                checked={selectedIds.has(row.id)}
                                onChange={() => toggleSelect(row.id)}
                              />
                            ) : (
                              <Users className="h-3.5 w-3.5 text-muted-foreground" title="Teammate's check" />
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2.5">
                          <span className="font-medium truncate block max-w-[160px]">
                            {row.customer_name || <span className="text-muted-foreground italic">—</span>}
                          </span>
                        </td>
                        {viewMode !== "mine" && (
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {isOwn ? "You" : (row.se_profiles?.display_name || "—")}
                          </td>
                        )}
                        {viewMode === "all" && (
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {(row.team_id && teamNameMap.get(row.team_id)) || "—"}
                          </td>
                        )}
                        <td className="px-4 py-2.5 font-mono text-xs">{row.overall_score ?? "—"}%</td>
                        <td className="px-4 py-2.5">
                          <Badge className={`${gradeColor(row.overall_grade)} border-0 text-xs font-bold`}>
                            {row.overall_grade ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.findings_count ?? 0}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.firewall_count ?? 0}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          <span>{new Date(row.checked_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}</span>
                          {row.followup_at && new Date(row.followup_at) > new Date() && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] text-primary" title={`Follow-up: ${new Date(row.followup_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}>
                              <CalendarClock className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1"
                              disabled={!onRestoreSnapshot || busyPdf || busyHtml}
                              title="Open in editor"
                              onClick={async () => {
                                if (!onRestoreSnapshot) return;
                                const snap = await fetchSnapshot(row.id);
                                if (snap) onRestoreSnapshot(snap, { checkId: row.id, followupAt: row.followup_at });
                                else toast.error("No snapshot found — re-save from a current session.");
                              }}
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              Open
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1"
                              disabled={busyPdf || busyHtml}
                              title="Download PDF"
                              onClick={() => void runExport(row, "pdf")}
                            >
                              {busyPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                              PDF
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1"
                              disabled={busyPdf || busyHtml}
                              title="Download HTML"
                              onClick={() => void runExport(row, "html")}
                            >
                              {busyHtml ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                              HTML
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

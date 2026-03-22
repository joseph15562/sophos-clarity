import { useEffect, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
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

interface HealthCheckRow {
  id: string;
  customer_name: string | null;
  overall_score: number | null;
  overall_grade: string | null;
  findings_count: number | null;
  firewall_count: number | null;
  checked_at: string;
  summary_json: Record<string, unknown> | null;
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A":
      return "bg-[#00995a]/15 text-[#00995a] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3]";
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
  onRestoreSnapshot?: (snapshot: SeHealthCheckSnapshotV1) => void;
};

export function SEHealthCheckHistory({ seProfileId, refreshTrigger = 0, preparedBy, onRestoreSnapshot }: Props) {
  const [rows, setRows] = useState<HealthCheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportingKind, setExportingKind] = useState<"pdf" | "html" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("se_health_checks")
      .select("id, customer_name, overall_score, overall_grade, findings_count, firewall_count, checked_at, summary_json")
      .eq("se_user_id", seProfileId)
      .order("checked_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setRows(data as unknown as HealthCheckRow[]);
    }
    setLoading(false);
  }, [seProfileId]);

  useEffect(() => {
    void load();
  }, [load, refreshTrigger]);

  const runExport = useCallback(
    async (row: HealthCheckRow, kind: "pdf" | "html") => {
      const snapshot = parseSeHealthCheckSnapshotFromSummaryJson(row.summary_json);
      if (!snapshot) {
        toast.error("This save has no full snapshot — save the health check again from a current session to enable reopen and export.");
        return;
      }
      const id = row.id;
      setExportingId(id);
      setExportingKind(kind);
      try {
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
    [preparedBy],
  );

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
          <div className="flex justify-end p-2 border-b border-border">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
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
                    <th className="px-4 py-2">Customer</th>
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
                    const snapshot = parseSeHealthCheckSnapshotFromSummaryJson(row.summary_json);
                    const hasSnapshot = snapshot !== null;
                    const serials = snapshot?.files
                      ?.map((f) => f.serialNumber?.trim())
                      .filter((s): s is string => Boolean(s)) ?? [];
                    const busyPdf = exportingId === row.id && exportingKind === "pdf";
                    const busyHtml = exportingId === row.id && exportingKind === "html";
                    return (
                      <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-medium truncate block max-w-[160px]">
                            {row.customer_name || <span className="text-muted-foreground italic">—</span>}
                          </span>
                          {serials.length > 0 && (
                            <span className="text-[10px] font-mono text-muted-foreground block truncate max-w-[160px]">
                              {serials.join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{row.overall_score ?? "—"}%</td>
                        <td className="px-4 py-2.5">
                          <Badge className={`${gradeColor(row.overall_grade)} border-0 text-xs font-bold`}>
                            {row.overall_grade ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.findings_count ?? 0}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.firewall_count ?? 0}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(row.checked_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1"
                              disabled={!hasSnapshot || !onRestoreSnapshot}
                              title={!hasSnapshot ? "Re-save from a current session to enable" : "Open in editor"}
                              onClick={() => {
                                if (snapshot && onRestoreSnapshot) onRestoreSnapshot(snapshot);
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
                              disabled={!hasSnapshot || busyPdf || busyHtml}
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
                              disabled={!hasSnapshot || busyPdf || busyHtml}
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

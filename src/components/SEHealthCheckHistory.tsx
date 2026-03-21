import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Clock, FileText, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    case "A": return "bg-[#00995a]/15 text-[#00995a] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3]";
    case "B": return "bg-[#2006F7]/15 text-[#2006F7] dark:bg-[#00EDFF]/10 dark:text-[#00EDFF]";
    case "C": return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    case "D": return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
    case "F": return "bg-[#EA0022]/15 text-[#EA0022]";
    default: return "bg-muted text-muted-foreground";
  }
}

export function SEHealthCheckHistory({ seProfileId }: { seProfileId: string }) {
  const [rows, setRows] = useState<HealthCheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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

  useEffect(() => { load(); }, [load]);

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
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No health checks saved yet. Run a check and click "Save health check" to start building your history.
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
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">
                        {row.customer_name || <span className="text-muted-foreground italic">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {row.overall_score ?? "—"}%
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={`${gradeColor(row.overall_grade)} border-0 text-xs font-bold`}>
                          {row.overall_grade ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.findings_count ?? 0}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.firewall_count ?? 0}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.checked_at).toLocaleDateString(undefined, {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

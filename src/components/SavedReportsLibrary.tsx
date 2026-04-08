import { useEffect, useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Trash2,
  Search,
  ArrowUpDown,
  ChevronDown,
  Cloud,
  HardDrive,
  Cpu,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import {
  loadSavedReportsCloud,
  loadSavedReportsLocal,
  deleteSavedReportCloud,
  deleteSavedReportLocal,
  type SavedReportPackage,
  type SavedReportEntry,
} from "@/lib/saved-reports";
import { logAudit } from "@/lib/audit";
import { scoreToColor, gradeForScore } from "@/lib/design-tokens";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface LoadSavedReportArgs {
  reports: SavedReportEntry[];
  customerName: string;
  environment: string;
  analysisSummary: import("@/lib/saved-reports").AnalysisSummary;
}

interface Props {
  onLoadReports: (args: LoadSavedReportArgs) => void;
  refreshTrigger?: number;
}

type SortField = "customer" | "type" | "score" | "date";
type SortDir = "asc" | "desc";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SavedReportsLibrary({ onLoadReports, refreshTrigger = 0 }: Props) {
  const { isGuest, org } = useAuth();
  const useCloud = !isGuest && !!org;
  const scope = useCloud && org ? org.id : "local";
  const queryClient = useQueryClient();

  const {
    data: packages = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: queryKeys.savedReports.packages(scope, refreshTrigger),
    queryFn: async ({ signal }) =>
      useCloud ? loadSavedReportsCloud(signal) : loadSavedReportsLocal(),
  });

  useEffect(() => {
    if (error) console.warn("[SavedReportsLibrary]", error);
  }, [error]);

  const deleteMutation = useMutation({
    mutationFn: async (pkg: SavedReportPackage) => {
      if (useCloud) await deleteSavedReportCloud(pkg.id);
      else await deleteSavedReportLocal(pkg.id);
      if (org?.id) {
        await logAudit(org.id, "report.deleted", "report", pkg.id, {
          customerName: pkg.customerName,
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "saved-reports" &&
          q.queryKey[1] === "packages" &&
          q.queryKey[2] === scope,
      });
    },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortField(field);
        setSortDir(field === "date" ? "desc" : "asc");
      }
    },
    [sortField],
  );

  const filtered = useMemo(() => {
    const visible = packages.filter((p) => !p.archivedAt);
    let list = visible;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (p) => p.customerName.toLowerCase().includes(q) || p.environment.toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "customer":
          cmp = a.customerName.localeCompare(b.customerName);
          break;
        case "type":
          cmp = a.reportType.localeCompare(b.reportType);
          break;
        case "score":
          cmp = a.analysisSummary.overallScore - b.analysisSummary.overallScore;
          break;
        case "date":
          cmp = a.createdAt - b.createdAt;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [packages, searchTerm, sortField, sortDir]);

  if (loading) {
    return (
      <div className="p-5 text-center">
        <span className="animate-spin inline-block h-4 w-4 border-2 border-brand-accent/30 border-t-[#2006F7] rounded-full" />
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_12px_40px_rgba(32,6,247,0.06)] p-4">
        <EmptyState
          icon={<FileText className="h-6 w-6 text-brand-accent/40" />}
          title="No saved reports yet"
          description='Generate reports for a customer and click "Save Reports" to store them here.'
          className="py-10"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Storage badge + search */}
      <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] px-4 py-3.5">
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold shrink-0 ${useCloud ? "bg-brand-accent/10 text-brand-accent" : "bg-brand-accent/[0.06] text-muted-foreground"}`}
        >
          {useCloud ? <Cloud className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
          {useCloud ? "Cloud Library" : "Local Library"}
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          {packages.length} saved package{packages.length !== 1 ? "s" : ""}
        </span>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-accent/40" />
          <input
            type="text"
            placeholder="Search saved reports…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] dark:bg-brand-accent/[0.08] pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[20px] border border-brand-accent/15 overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)]">
        <div className="grid grid-cols-[3fr_70px_50px_1fr_40px] gap-3 px-4 py-2.5 bg-brand-accent/[0.03] dark:bg-brand-accent/[0.06] text-[8px] font-display font-bold text-muted-foreground/60 uppercase tracking-[0.08em] border-b border-brand-accent/10">
          <button
            className="flex items-center gap-1 text-left hover:text-foreground transition-colors"
            onClick={() => toggleSort("customer")}
          >
            Customer <ArrowUpDown className="h-2.5 w-2.5" />
          </button>
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => toggleSort("type")}
          >
            Type <ArrowUpDown className="h-2.5 w-2.5" />
          </button>
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => toggleSort("score")}
          >
            Score <ArrowUpDown className="h-2.5 w-2.5" />
          </button>
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => toggleSort("date")}
          >
            Date <ArrowUpDown className="h-2.5 w-2.5" />
          </button>
          <span />
        </div>
        <div className="divide-y divide-brand-accent/[0.06]">
          {filtered.map((pkg) => {
            const isExpanded = expanded === pkg.id;
            const score = pkg.analysisSummary.overallScore;
            const color = scoreToColor(score);
            const grade = gradeForScore(score);
            const deleting = deleteMutation.isPending && deleteMutation.variables?.id === pkg.id;
            return (
              <div key={pkg.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : pkg.id)}
                  className="w-full grid grid-cols-[3fr_70px_50px_1fr_40px] gap-3 px-4 py-3 items-center text-left hover:bg-brand-accent/[0.02] dark:hover:bg-brand-accent/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronDown
                      className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {pkg.customerName}
                      </p>
                      {pkg.environment && (
                        <p className="text-[9px] text-muted-foreground truncate">
                          {pkg.environment}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1 text-[10px] font-medium ${pkg.reportType === "full" ? "text-brand-accent" : "text-muted-foreground"}`}
                  >
                    {pkg.reportType === "full" ? (
                      <Sparkles className="h-3 w-3" />
                    ) : (
                      <Cpu className="h-3 w-3" />
                    )}
                    {pkg.reportType === "full" ? "Full" : "Pre-AI"}
                  </span>
                  <span
                    className="inline-flex items-center justify-center text-[11px] font-display font-bold tabular-nums h-7 w-10 rounded-md"
                    style={{ color, backgroundColor: hexToRgba(color, 0.18) }}
                    title={`Grade ${grade}`}
                  >
                    {score}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(pkg.createdAt)}
                  </span>
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={deleting}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(pkg);
                      }}
                      className="h-7 w-7 text-muted-foreground hover:text-severity-critical"
                      title="Delete"
                    >
                      {deleting ? (
                        <span className="inline-block h-3.5 w-3.5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-brand-accent/10 space-y-3 bg-brand-accent/[0.01] dark:bg-brand-accent/[0.03]">
                    {/* Summary chips */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] px-2 py-1 rounded-md bg-brand-accent/[0.06] text-muted-foreground font-medium">
                        {pkg.analysisSummary.totalFindings} findings
                      </span>
                      <span className="text-[10px] px-2 py-1 rounded-md bg-brand-accent/[0.06] text-muted-foreground font-medium">
                        {pkg.analysisSummary.totalRules} rules
                      </span>
                      {pkg.analysisSummary.categories.map((c) => (
                        <span
                          key={c.label}
                          className={`text-[10px] px-2 py-1 rounded-md ${c.pct >= 80 ? "bg-severity-low/10 text-severity-low" : c.pct >= 50 ? "bg-severity-high/10 text-severity-high" : "bg-severity-critical/10 text-severity-critical"}`}
                        >
                          {c.label}: {c.pct}%
                        </span>
                      ))}
                    </div>

                    {/* Report list */}
                    {pkg.reports.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-[9px] font-display font-bold text-muted-foreground/60 uppercase tracking-[0.08em]">
                          Reports ({pkg.reports.length})
                        </p>
                        {pkg.reports.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-accent/[0.03] dark:bg-brand-accent/[0.06] border border-brand-accent/[0.06]"
                          >
                            <FileText className="h-3 w-3 text-brand-accent shrink-0" />
                            <span className="text-[10px] font-medium text-foreground flex-1 truncate">
                              {r.label}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {Math.round(r.markdown.length / 1024)}KB
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Pre-AI assessment only (no generated reports).
                      </p>
                    )}

                    {/* Load button */}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        onLoadReports({
                          reports: pkg.reports,
                          customerName: pkg.customerName,
                          environment: pkg.environment,
                          analysisSummary: pkg.analysisSummary,
                        })
                      }
                      className="gap-1.5 text-[11px] rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white hover:opacity-90 border-0 shadow-sm"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {pkg.reports.length > 0 ? "Load Reports into Viewer" : "View Assessment"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo, useCallback } from "react";
import { FileText, Trash2, Search, ArrowUpDown, ChevronDown, Cloud, HardDrive, Cpu, Sparkles, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  loadSavedReportsCloud,
  loadSavedReportsLocal,
  deleteSavedReportCloud,
  deleteSavedReportLocal,
  type SavedReportPackage,
  type SavedReportEntry,
} from "@/lib/saved-reports";
import { logAudit } from "@/lib/audit";

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

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#00995a] dark:text-[#00F2B3] bg-[#00995a]/10 dark:bg-[#00F2B3]/10",
  B: "text-[#009CFB] bg-[#009CFB]/10",
  C: "text-[#F8E300] bg-[#F8E300]/10",
  D: "text-[#F29400] bg-[#F29400]/10",
  F: "text-[#EA0022] bg-[#EA0022]/10",
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SavedReportsLibrary({ onLoadReports, refreshTrigger }: Props) {
  const { isGuest, org } = useAuth();
  const useCloud = !isGuest && !!org;

  const [packages, setPackages] = useState<SavedReportPackage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const items = useCloud ? await loadSavedReportsCloud() : await loadSavedReportsLocal();
      setPackages(items);
    } catch (err) {
      console.warn("[refresh] SavedReportsLibrary", err);
    }
    setLoading(false);
  }, [useCloud]);

  useEffect(() => { refresh(); }, [refresh, refreshTrigger]);

  const handleDelete = useCallback(async (pkg: SavedReportPackage) => {
    if (useCloud) await deleteSavedReportCloud(pkg.id);
    else await deleteSavedReportLocal(pkg.id);
    setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
    if (org?.id) {
      logAudit(org.id, "report.deleted", "report", pkg.id, { customerName: pkg.customerName }).catch(() => {});
    }
  }, [useCloud, org]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "date" ? "desc" : "asc"); }
  }, [sortField]);

  const filtered = useMemo(() => {
    let list = packages;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((p) => p.customerName.toLowerCase().includes(q) || p.environment.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "customer": cmp = a.customerName.localeCompare(b.customerName); break;
        case "type": cmp = a.reportType.localeCompare(b.reportType); break;
        case "score": cmp = a.analysisSummary.overallScore - b.analysisSummary.overallScore; break;
        case "date": cmp = a.createdAt - b.createdAt; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [packages, searchTerm, sortField, sortDir]);

  if (loading) {
    return (
      <div className="p-5 text-center">
        <span className="animate-spin inline-block h-4 w-4 border-2 border-[#2006F7]/30 border-t-[#2006F7] rounded-full" />
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="p-5 text-center space-y-2">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          No saved reports yet. Generate reports for a customer and click "Save Reports" to store them here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Storage badge + search */}
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded shrink-0 ${useCloud ? "bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF]" : "bg-muted text-muted-foreground"}`}>
          {useCloud ? <Cloud className="h-2.5 w-2.5" /> : <HardDrive className="h-2.5 w-2.5" />}
          {useCloud ? "Cloud" : "Local"}
        </span>
        <span className="text-[10px] text-muted-foreground">{packages.length} saved</span>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search saved reports…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
          />
        </div>
      </div>

      {/* Table header */}
      <div className="rounded-t-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_60px_120px_50px] gap-2 px-3 py-2 bg-muted/30 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
          <button className="flex items-center gap-1 text-left" onClick={() => toggleSort("customer")}>
            Customer <ArrowUpDown className="h-2.5 w-2.5" />
          </button>
          <button className="flex items-center gap-1" onClick={() => toggleSort("type")}>
            Type <ArrowUpDown className="h-2.5 w-2.5" />
          </button>
          <button className="flex items-center gap-1" onClick={() => toggleSort("score")}>
            Score <ArrowUpDown className="h-2.5 w-2.5" />
          </button>
          <button className="flex items-center gap-1" onClick={() => toggleSort("date")}>
            Date <ArrowUpDown className="h-2.5 w-2.5" />
          </button>
          <span />
        </div>
      </div>

      {/* Rows */}
      <div className="rounded-b-lg border border-t-0 border-border overflow-hidden divide-y divide-border">
        {filtered.map((pkg) => {
          const isExpanded = expanded === pkg.id;
          const gradeClass = GRADE_COLORS[pkg.analysisSummary.overallGrade] ?? GRADE_COLORS.C;
          return (
            <div key={pkg.id} className="bg-card">
              <button
                onClick={() => setExpanded(isExpanded ? null : pkg.id)}
                className="w-full grid grid-cols-[1fr_80px_60px_120px_50px] gap-2 px-3 py-2.5 items-center text-left hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{pkg.customerName}</p>
                    {pkg.environment && <p className="text-[9px] text-muted-foreground truncate">{pkg.environment}</p>}
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-[10px] font-medium ${pkg.reportType === "full" ? "text-[#2006F7] dark:text-[#00EDFF]" : "text-muted-foreground"}`}>
                  {pkg.reportType === "full" ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                  {pkg.reportType === "full" ? "Full" : "Pre-AI"}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-center ${gradeClass}`}>
                  {pkg.analysisSummary.overallScore}
                </span>
                <span className="text-[10px] text-muted-foreground">{formatDate(pkg.createdAt)}</span>
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(pkg); }}
                    className="p-1 rounded text-muted-foreground hover:text-[#EA0022] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border space-y-3">
                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
                      {pkg.analysisSummary.totalFindings} findings
                    </span>
                    <span className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
                      {pkg.analysisSummary.totalRules} rules
                    </span>
                    {pkg.analysisSummary.categories.map((c) => (
                      <span key={c.label} className={`text-[10px] px-2 py-1 rounded-md ${c.pct >= 80 ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" : c.pct >= 50 ? "bg-[#F29400]/10 text-[#F29400]" : "bg-[#EA0022]/10 text-[#EA0022]"}`}>
                        {c.label}: {c.pct}%
                      </span>
                    ))}
                  </div>

                  {/* Report list */}
                  {pkg.reports.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Reports ({pkg.reports.length})</p>
                      {pkg.reports.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-muted/30">
                          <FileText className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF] shrink-0" />
                          <span className="text-[10px] font-medium text-foreground flex-1 truncate">{r.label}</span>
                          <span className="text-[9px] text-muted-foreground">{Math.round(r.markdown.length / 1024)}KB</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Pre-AI assessment only (no generated reports).</p>
                  )}

                  {/* Load button */}
                  <button
                    onClick={() => onLoadReports({ reports: pkg.reports, customerName: pkg.customerName, environment: pkg.environment, analysisSummary: pkg.analysisSummary })}
                    className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF] hover:bg-[#2006F7]/20 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {pkg.reports.length > 0 ? "Load Reports into Viewer" : "View Assessment"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

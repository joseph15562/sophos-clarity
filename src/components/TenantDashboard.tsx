import { useEffect, useState, useMemo, useCallback } from "react";
import { Building2, TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, ChevronDown, Search, ArrowUpDown, Cloud, HardDrive } from "lucide-react";
import { loadHistory, type AssessmentSnapshot } from "@/lib/assessment-history";
import { loadHistoryCloud } from "@/lib/assessment-cloud";
import { useAuth } from "@/hooks/use-auth";

type SortField = "customer" | "score" | "findings" | "date";
type SortDir = "asc" | "desc";

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#00995a] dark:text-[#00F2B3] bg-[#00995a]/10 dark:bg-[#00F2B3]/10",
  B: "text-[#009CFB] bg-[#009CFB]/10",
  C: "text-[#F8E300] bg-[#F8E300]/10",
  D: "text-[#F29400] bg-[#F29400]/10",
  F: "text-[#EA0022] bg-[#EA0022]/10",
};

function gradeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? GRADE_COLORS.C;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface CustomerSummary {
  name: string;
  environment: string;
  latestSnapshot: AssessmentSnapshot;
  previousSnapshot: AssessmentSnapshot | null;
  assessmentCount: number;
  scoreTrend: number;
}

export function TenantDashboard() {
  const { isGuest, org } = useAuth();
  const useCloud = !isGuest && !!org;

  const [history, setHistory] = useState<AssessmentSnapshot[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (useCloud ? loadHistoryCloud() : loadHistory()).then(setHistory);
  }, [useCloud]);

  const customers = useMemo(() => {
    const byCustomer = new Map<string, AssessmentSnapshot[]>();
    for (const snap of history) {
      const key = `${snap.customerName}||${snap.environment}`;
      if (!byCustomer.has(key)) byCustomer.set(key, []);
      byCustomer.get(key)!.push(snap);
    }

    const summaries: CustomerSummary[] = [];
    for (const [, snaps] of byCustomer) {
      const sorted = [...snaps].sort((a, b) => b.timestamp - a.timestamp);
      const latest = sorted[0];
      const prev = sorted.length > 1 ? sorted[1] : null;
      summaries.push({
        name: latest.customerName,
        environment: latest.environment,
        latestSnapshot: latest,
        previousSnapshot: prev,
        assessmentCount: sorted.length,
        scoreTrend: prev ? latest.overallScore - prev.overallScore : 0,
      });
    }
    return summaries;
  }, [history]);

  const filtered = useMemo(() => {
    let list = customers;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.environment.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "customer": cmp = a.name.localeCompare(b.name); break;
        case "score": cmp = a.latestSnapshot.overallScore - b.latestSnapshot.overallScore; break;
        case "findings": {
          const af = a.latestSnapshot.firewalls.reduce((s, f) => s + f.totalFindings, 0);
          const bf = b.latestSnapshot.firewalls.reduce((s, f) => s + f.totalFindings, 0);
          cmp = af - bf; break;
        }
        case "date": cmp = a.latestSnapshot.timestamp - b.latestSnapshot.timestamp; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [customers, searchTerm, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "score" ? "asc" : "desc"); }
  }, [sortField]);

  const avgScore = customers.length > 0
    ? Math.round(customers.reduce((s, c) => s + c.latestSnapshot.overallScore, 0) / customers.length)
    : 0;
  const atRisk = customers.filter((c) => c.latestSnapshot.overallScore < 60).length;
  const totalFirewalls = customers.reduce((s, c) => s + c.latestSnapshot.firewalls.length, 0);

  if (customers.length === 0) {
    return (
      <div className="p-5 text-center space-y-3">
        <Building2 className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          {useCloud
            ? `No assessments in ${org?.name ?? "your organisation"} yet. Save snapshots from the Assessment History panel.`
            : "No customer assessments saved yet. Run assessments and save snapshots from the Assessment History panel to populate the multi-tenant view."}
        </p>
        {!useCloud && (
          <p className="text-[9px] text-muted-foreground">
            Sign in to sync assessments across your team via the cloud.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Storage mode badge */}
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${useCloud ? "bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF]" : "bg-muted text-muted-foreground"}`}>
          {useCloud ? <Cloud className="h-2.5 w-2.5" /> : <HardDrive className="h-2.5 w-2.5" />}
          {useCloud ? `${org?.name} (Cloud)` : "Local Browser Storage"}
        </span>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{customers.length}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Customers</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{totalFirewalls}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Firewalls</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{avgScore}/100</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Avg Score</p>
        </div>
        <div className={`rounded-lg px-3 py-2.5 text-center ${atRisk > 0 ? "bg-[#EA0022]/5" : "bg-[#00995a]/5"}`}>
          <p className={`text-lg font-bold ${atRisk > 0 ? "text-[#EA0022]" : "text-[#00995a] dark:text-[#00F2B3]"}`}>{atRisk}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">At Risk (&lt;60)</p>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
          />
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_80px_80px_90px] gap-2 px-3 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
        <button className="flex items-center gap-1 text-left" onClick={() => toggleSort("customer")}>
          Customer <ArrowUpDown className="h-2.5 w-2.5" />
        </button>
        <button className="flex items-center gap-1" onClick={() => toggleSort("score")}>
          Score <ArrowUpDown className="h-2.5 w-2.5" />
        </button>
        <button className="flex items-center gap-1" onClick={() => toggleSort("findings")}>
          Findings <ArrowUpDown className="h-2.5 w-2.5" />
        </button>
        <button className="flex items-center gap-1" onClick={() => toggleSort("date")}>
          Last Assessed <ArrowUpDown className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Customer rows */}
      <div className="space-y-1.5">
        {filtered.map((c) => {
          const totalFindings = c.latestSnapshot.firewalls.reduce((s, f) => s + f.totalFindings, 0);
          const isExpanded = expanded === c.latestSnapshot.id;
          return (
            <div key={c.latestSnapshot.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <button onClick={() => setExpanded(isExpanded ? null : c.latestSnapshot.id)} className="w-full grid grid-cols-[1fr_80px_80px_90px] gap-2 px-3 py-2.5 items-center text-left hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{c.environment} · {c.latestSnapshot.firewalls.length} fw · {c.assessmentCount} assessment{c.assessmentCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gradeColor(c.latestSnapshot.overallGrade)}`}>
                    {c.latestSnapshot.overallGrade}
                  </span>
                  <span className="text-xs font-medium text-foreground">{c.latestSnapshot.overallScore}</span>
                  {c.scoreTrend !== 0 && (
                    c.scoreTrend > 0
                      ? <TrendingUp className="h-3 w-3 text-[#00995a] dark:text-[#00F2B3]" />
                      : <TrendingDown className="h-3 w-3 text-[#EA0022]" />
                  )}
                  {c.scoreTrend === 0 && c.previousSnapshot && <Minus className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-1">
                  {totalFindings > 0 && <AlertTriangle className="h-3 w-3 text-[#F29400]" />}
                  <span className="text-xs text-foreground">{totalFindings}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{formatDate(c.latestSnapshot.timestamp)}</span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
                  {c.latestSnapshot.firewalls.map((fw) => (
                    <div key={fw.label} className="flex items-center gap-3 px-2.5 py-1.5 rounded bg-muted/30">
                      <Shield className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF] shrink-0" />
                      <span className="text-[10px] font-medium text-foreground flex-1 truncate">{fw.label}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${gradeColor(fw.riskScore.overall >= 90 ? "A" : fw.riskScore.overall >= 75 ? "B" : fw.riskScore.overall >= 60 ? "C" : fw.riskScore.overall >= 40 ? "D" : "F")}`}>
                        {fw.riskScore.overall}/100
                      </span>
                      <span className="text-[10px] text-muted-foreground">{fw.totalRules} rules</span>
                      <span className="text-[10px] text-muted-foreground">{fw.totalFindings} findings</span>
                    </div>
                  ))}
                  {c.previousSnapshot && (
                    <div className="text-[9px] text-muted-foreground pt-1 flex items-center gap-2">
                      <span>Previous: {formatDate(c.previousSnapshot.timestamp)} — Score {c.previousSnapshot.overallScore} ({c.scoreTrend > 0 ? "+" : ""}{c.scoreTrend})</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.latestSnapshot.firewalls.flatMap((fw) =>
                      fw.riskScore.categories.filter((cat) => cat.pct < 50).map((cat) => (
                        <span key={`${fw.label}-${cat.label}`} className="text-[9px] px-1.5 py-0.5 rounded bg-[#EA0022]/10 text-[#EA0022]">
                          {fw.label}: {cat.label} {cat.pct}%
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo, useCallback } from "react";
import { Building2, Shield, ChevronDown, Search, ArrowUpDown, Cloud, HardDrive, Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function scoreToGrade(score: number): string {
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
}

interface CustomerSummary {
  name: string;
  environment: string;
  latestSnapshot: AssessmentSnapshot;
  previousSnapshot: AssessmentSnapshot | null;
  assessmentCount: number;
  scoreTrend: number;
  scoreHistory: number[];
}

/** Mini sparkline (~60x20px) of score history. Uses assessments from Supabase (cloud) or IndexedDB (local). Shows nothing when &lt;2 data points. */
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 60, h = 20, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} role="img" aria-label="Trend sparkline" className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return i === values.length - 1 ? <circle key={i} cx={x} cy={y} r="2" fill={color} /> : null;
      })}
    </svg>
  );
}

export function TenantDashboard() {
  const { isGuest, org } = useAuth();
  const useCloud = !isGuest && !!org;

  const [history, setHistory] = useState<AssessmentSnapshot[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [_fleetOverviewExpanded, _setFleetOverviewExpanded] = useState(false);
  const [agentCustomers, setAgentCustomers] = useState<Map<string, { lastSeen: string | null; status: string }>>(new Map());

  useEffect(() => {
    (useCloud ? loadHistoryCloud() : loadHistory()).then(setHistory);
  }, [useCloud]);

  useEffect(() => {
    if (!useCloud) return;
    supabase
      .from("agents")
      .select("customer_name, last_seen_at, status")
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, { lastSeen: string | null; status: string }>();
        for (const a of data) {
          map.set(a.customer_name, { lastSeen: a.last_seen_at, status: a.status });
        }
        setAgentCustomers(map);
      });
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
        scoreHistory: sorted.slice().reverse().slice(-7).map((s) => s.overallScore),
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

  /** All firewalls across customers for fleet heatmap (from latest snapshot per customer) */
  const allFirewalls = useMemo(() => {
    const out: { label: string; customer: string; environment: string; score: number; grade: string }[] = [];
    for (const c of customers) {
      for (const fw of c.latestSnapshot.firewalls) {
        const grade = fw.riskScore.grade ?? scoreToGrade(fw.riskScore.overall);
        out.push({
          label: fw.label,
          customer: c.name,
          environment: c.environment,
          score: fw.riskScore.overall,
          grade,
        });
      }
    }
    return out;
  }, [customers]);

  /** Outlier detection: aggregate low category scores. "X of Y firewalls have [category] below 50%". Top 5 by count. */
  const outlierCounts = useMemo(() => {
    if (allFirewalls.length < 2) return [];
    const byCategory = new Map<string, number>();
    for (const c of customers) {
      for (const fw of c.latestSnapshot.firewalls) {
        for (const cat of fw.riskScore.categories) {
          if (cat.pct < 50) {
            byCategory.set(cat.label, (byCategory.get(cat.label) ?? 0) + 1);
          }
        }
      }
    }
    return [...byCategory.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [customers, allFirewalls.length]);

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
            ? `No customer assessments in ${org?.name ?? "your organisation"} yet.`
            : "No customer assessments saved yet."}
        </p>
        <p className="text-[10px] text-muted-foreground max-w-md mx-auto">
          Upload a firewall config and click <strong className="text-foreground">Save Reports</strong> or <strong className="text-foreground">Save Assessment (Pre-AI)</strong> — the assessment will appear here automatically so you can track scores across all your customers.
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

      {/* Fleet heatmap grid */}
      {allFirewalls.length > 1 && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Fleet Health Map</p>
          <div className="flex flex-wrap gap-1.5">
            {allFirewalls.map((fw) => {
              const g = fw.grade;
              const color = g === "A" || g === "B" ? "bg-[#00995a]/70 dark:bg-[#00F2B3]/60" :
                g === "C" ? "bg-[#F8E300]/50" :
                g === "D" ? "bg-[#F29400]/60" : "bg-[#EA0022]/60";
              return (
                <div
                  key={`${fw.customer}-${fw.label}`}
                  title={`${fw.customer} — ${fw.label}: ${fw.score} (${g})`}
                  className={`h-5 w-5 rounded-sm ${color} cursor-default flex items-center justify-center`}
                >
                  <span className="text-[7px] font-bold text-white drop-shadow-sm">{fw.score}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Outlier detection */}
      {outlierCounts.length > 0 && (
        <div className="rounded-lg border border-[#F29400]/20 bg-[#F29400]/[0.04] p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-[#c47800] dark:text-[#F29400] uppercase tracking-wider">Common Weaknesses Across Fleet</p>
          {outlierCounts.map((o) => (
            <p key={o.label} className="text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground">{o.count} of {allFirewalls.length}</span> firewalls have <span className="font-medium text-foreground">{o.label}</span> below 50%
            </p>
          ))}
        </div>
      )}

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
          const isExpanded = expanded === c.latestSnapshot.id;
          const sparkColor = c.latestSnapshot.overallScore >= 75 ? "#00995a" : c.latestSnapshot.overallScore >= 50 ? "#F29400" : "#EA0022";
          return (
            <div key={c.latestSnapshot.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <button onClick={() => setExpanded(isExpanded ? null : c.latestSnapshot.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold" style={{ color: sparkColor }}>{c.latestSnapshot.overallScore}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    {agentCustomers.has(c.name) && (
                      <span className="flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded bg-[#6B5BFF]/10 text-[#6B5BFF] shrink-0" title={`Agent: ${agentCustomers.get(c.name)?.status}`}>
                        <Plug className="h-2 w-2" /> Agent
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {c.latestSnapshot.firewalls.length} firewall{c.latestSnapshot.firewalls.length !== 1 ? "s" : ""} · Grade {c.latestSnapshot.overallGrade}
                    {c.scoreTrend !== 0 && (
                      <span className={c.scoreTrend > 0 ? "text-[#00995a] dark:text-[#00F2B3]" : "text-[#EA0022]"}>
                        {" "}({c.scoreTrend > 0 ? "+" : ""}{c.scoreTrend})
                      </span>
                    )}
                    {agentCustomers.has(c.name) && agentCustomers.get(c.name)?.lastSeen && (
                      <span className="text-[#6B5BFF]"> · Agent synced {timeAgo(new Date(agentCustomers.get(c.name)!.lastSeen!).getTime())}</span>
                    )}
                  </p>
                </div>
                <MiniSparkline values={c.scoreHistory} color={sparkColor} />
                <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
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

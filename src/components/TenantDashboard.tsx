import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Building2, Shield, ChevronDown, Search, ArrowUpDown, Cloud, HardDrive, Plug, Download, Maximize2, X, ChevronRight, Activity, AlertTriangle, FileWarning } from "lucide-react";
import { scoreToColor } from "@/lib/design-tokens";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { loadHistory, type AssessmentSnapshot } from "@/lib/assessment-history";
import { loadHistoryCloud } from "@/lib/assessment-cloud";
import { loadScoreHistoryForFleet, type ScoreHistoryEntry } from "@/lib/score-history";
import { useAuth } from "@/hooks/use-auth";

type SortField = "customer" | "score" | "findings" | "date";
type SortDir = "asc" | "desc";

const STALE_ASSESSMENT_MS = 60 * 24 * 60 * 60 * 1000;

const GRADE_COLORS: Record<string, string> = {
  A: "text-[#00F2B3] dark:text-[#00F2B3] bg-[#00F2B3]/10 dark:bg-[#00F2B3]/10",
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
  const [scoreHistoryEntries, setScoreHistoryEntries] = useState<ScoreHistoryEntry[]>([]);
  const [topFindings, setTopFindings] = useState<{ title: string; severity: string; affectedCount: number; totalFirewalls: number; firewalls: string[] }[]>([]);
  const [agentList, setAgentList] = useState<{ id: string; name: string; customer_name: string; last_seen_at: string | null; status: string }[]>([]);
  const [agentSubmissions, setAgentSubmissions] = useState<{ agent_id: string; created_at: string }[]>([]);
  const [nocMode, setNocMode] = useState(false);
  const [nocSlide, setNocSlide] = useState(0);
  const [heatmapDrill, setHeatmapDrill] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const nocRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevThemeRef = useRef<string | undefined>(undefined);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    (useCloud ? loadHistoryCloud() : loadHistory()).then(setHistory);
  }, [useCloud]);

  useEffect(() => {
    if (!useCloud) return;
    supabase
      .from("agents")
      .select("id, name, customer_name, tenant_name, last_seen_at, status")
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, { lastSeen: string | null; status: string }>();
        const enriched = (data as Array<{ id: string; name: string; customer_name: string; tenant_name?: string; last_seen_at: string | null; status: string }>).map((a) => {
          const displayName = a.tenant_name || (a.customer_name !== "Unnamed" ? a.customer_name : a.name) || a.customer_name;
          return { ...a, customer_name: displayName };
        });
        for (const a of enriched) {
          map.set(a.customer_name, { lastSeen: a.last_seen_at, status: a.status });
        }
        setAgentCustomers(map);
        setAgentList(enriched);
      });
  }, [useCloud]);

  useEffect(() => {
    if (!useCloud || !org?.id) return;
    loadScoreHistoryForFleet(org.id).then(setScoreHistoryEntries);
  }, [useCloud, org?.id]);

  useEffect(() => {
    if (!useCloud || !org?.id) return;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    supabase
      .from("agent_submissions")
      .select("agent_id, created_at")
      .eq("org_id", org.id)
      .gte("created_at", weekAgo.toISOString())
      .then(({ data }) => setAgentSubmissions((data ?? []) as { agent_id: string; created_at: string }[]));
  }, [useCloud, org?.id]);

  useEffect(() => {
    if (!useCloud || !org?.id) return;
    supabase
      .from("finding_snapshots")
      .select("hostname, titles, created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!data) return;
        const byHost = new Map<string, string[]>();
        for (const row of data as { hostname: string; titles: string[]; created_at: string }[]) {
          if (!byHost.has(row.hostname)) byHost.set(row.hostname, row.titles ?? []);
        }
        const byTitle = new Map<string, { count: number; firewalls: Set<string> }>();
        for (const [host, titles] of byHost) {
          for (const t of titles) {
            if (!byTitle.has(t)) byTitle.set(t, { count: 0, firewalls: new Set() });
            const entry = byTitle.get(t)!;
            entry.count++;
            entry.firewalls.add(host);
          }
        }
        const total = byHost.size;
        const top = [...byTitle.entries()]
          .map(([title, { count, firewalls }]) => ({
            title,
            severity: "medium",
            affectedCount: firewalls.size,
            totalFirewalls: total,
            firewalls: [...firewalls],
          }))
          .sort((a, b) => b.affectedCount - a.affectedCount)
          .slice(0, 10);
        setTopFindings(top);
      });
  }, [useCloud, org?.id]);

  const customers = useMemo(() => {
    const agentTenantNames = new Set(agentList.map((a) => a.customer_name).filter((n) => n && n !== "Unnamed"));
    const resolvedHistory = history.map((snap) => {
      if (snap.customerName !== "Unnamed") return snap;
      const bestName = agentTenantNames.size === 1 ? [...agentTenantNames][0] : null;
      if (!bestName) return snap;
      return { ...snap, customerName: bestName };
    });

    const byCustomer = new Map<string, AssessmentSnapshot[]>();
    for (const snap of resolvedHistory) {
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
  }, [history, agentList]);

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
  const totalFindings = customers.reduce((s, c) =>
    s + c.latestSnapshot.firewalls.reduce((sf, f) => sf + f.totalFindings, 0), 0);
  const totalRulesAnalysed = customers.reduce((s, c) =>
    s + c.latestSnapshot.firewalls.reduce((sf, f) => sf + f.totalRules, 0), 0);
  const slaBreaches = 0;
  const agentsOffline = agentList.filter((a) => (a.status ?? "").toLowerCase() !== "active").length;
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.getTime();
  }, []);
  const assessmentsThisWeek = useMemo(() => {
    return scoreHistoryEntries.filter((e) => new Date(e.assessed_at).getTime() >= weekStart).length;
  }, [scoreHistoryEntries, weekStart]);

  const decliningFirewalls = useMemo(() => {
    const byHost = new Map<string, ScoreHistoryEntry[]>();
    for (const e of scoreHistoryEntries) {
      const key = `${e.customer_name}||${e.hostname}`;
      if (!byHost.has(key)) byHost.set(key, []);
      byHost.get(key)!.push(e);
    }
    const out: { hostname: string; customer: string; prevScore: number; currScore: number; delta: number; history: number[] }[] = [];
    for (const [, entries] of byHost) {
      const sorted = [...entries].sort((a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime());
      if (sorted.length >= 2) {
        const curr = sorted[0];
        const prev = sorted[1];
        const delta = curr.overall_score - prev.overall_score;
        if (delta <= -5) {
          out.push({
            hostname: curr.hostname,
            customer: curr.customer_name,
            prevScore: prev.overall_score,
            currScore: curr.overall_score,
            delta,
            history: sorted.slice(0, 7).reverse().map((x) => x.overall_score),
          });
        }
      }
    }
    return out.sort((a, b) => a.delta - b.delta);
  }, [scoreHistoryEntries]);

  const agentTimelineData = useMemo(() => {
    if (agentList.length === 0) return null;
    const days = 7;
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const byAgentDay = new Map<string, Map<string, "active" | "offline" | "none">>();
    for (const agent of agentList) {
      const m = new Map<string, "active" | "offline" | "none">();
      for (const dk of dayKeys) m.set(dk, "none");
      byAgentDay.set(agent.id, m);
    }
    const now = Date.now();
    const heartbeatThreshold = 30 * 60 * 1000;
    for (const sub of agentSubmissions) {
      const day = sub.created_at.slice(0, 10);
      const agent = agentList.find((a) => a.id === sub.agent_id);
      if (agent && byAgentDay.has(agent.id)) {
        byAgentDay.get(agent.id)!.set(day, "active");
      }
    }
    const todayKey = dayKeys[dayKeys.length - 1];
    for (const agent of agentList) {
      const m = byAgentDay.get(agent.id)!;
      const lastSeen = agent.last_seen_at ? new Date(agent.last_seen_at).getTime() : 0;
      if (lastSeen > 0) {
        const lastSeenDay = new Date(agent.last_seen_at!).toISOString().slice(0, 10);
        if (m.has(lastSeenDay) && m.get(lastSeenDay) === "none") {
          m.set(lastSeenDay, "active");
        }
      }
      const isHeartbeatStale = !lastSeen || (now - lastSeen > heartbeatThreshold);
      if (isHeartbeatStale && m.get(todayKey) !== "active") {
        m.set(todayKey, "offline");
      }
    }
    return { agents: agentList, dayKeys, byAgentDay };
  }, [agentList, agentSubmissions]);

  const exportFleetCsv = useCallback(() => {
    const rows = allFirewalls.map((fw) => {
      const cust = customers.find((c) => c.name === fw.customer);
      const snap = cust?.latestSnapshot;
      const lastAssessed = snap ? formatDate(snap.timestamp) : "";
      const findingCount = cust?.latestSnapshot.firewalls.find((f) => f.label === fw.label)?.totalFindings ?? 0;
      return [fw.customer, fw.label, fw.score, fw.grade, findingCount, lastAssessed].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const header = "Customer,Firewall Hostname,Score,Grade,Finding Count,Last Assessed";
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fleet-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [allFirewalls, customers]);

  useEffect(() => {
    if (!nocMode) return;
    prevThemeRef.current = resolvedTheme;
    setTheme("dark");
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    nocRotateRef.current = setInterval(() => setNocSlide((s) => (s + 1) % 2), 30_000);
    return () => {
      if (nocRotateRef.current) clearInterval(nocRotateRef.current);
      if (prevThemeRef.current) setTheme(prevThemeRef.current);
      document.exitFullscreen?.().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nocMode]);

  if (nocMode) {
    const showHeatmap = nocSlide % 2 === 0;
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-8">
        <button
          onClick={() => setNocMode(false)}
          className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-2 text-sm"
          aria-label="Exit NOC mode"
        >
          <X className="h-5 w-5" /> Exit
        </button>
        {showHeatmap ? (
          <div className="flex flex-col items-center gap-6 max-w-4xl w-full">
            <h2 className="text-2xl font-bold uppercase tracking-wider text-white/90">Fleet Risk Heatmap</h2>
            <div className="flex flex-wrap gap-2 justify-center">
              {allFirewalls.map((fw) => {
                const g = fw.grade;
                const color = g === "A" || g === "B" ? "bg-severity-low/80" : g === "C" ? "bg-severity-medium/80" : g === "D" ? "bg-severity-high/80" : "bg-severity-critical/80";
                return (
                  <div
                    key={`${fw.customer}-${fw.label}`}
                    className={`min-w-[48px] min-h-[48px] rounded-lg ${color} flex items-center justify-center text-lg font-bold text-white drop-shadow-lg`}
                  >
                    {g}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold uppercase tracking-wider text-white/90">Declining Firewalls</h2>
            {decliningFirewalls.length > 0 ? (
              <div className="space-y-4 w-full">
                {decliningFirewalls.slice(0, 8).map((d) => (
                  <div key={`${d.customer}-${d.hostname}`} className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                    <span className="text-lg font-medium truncate">{d.customer} — {d.hostname}</span>
                    <span className="text-lg text-[#EA0022] shrink-0">{d.prevScore} → {d.currScore} ({d.delta})</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/60 text-lg">No declining firewalls</p>
            )}
          </div>
        )}
      </div>
    );
  }

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
    <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-5 sm:p-6 space-y-5 shadow-[0_18px_50px_rgba(32,6,247,0.08)] overflow-hidden">
      {/* Storage mode badge + NOC + Export */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 min-w-[220px] max-w-2xl">
          <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full border ${useCloud ? "bg-brand-accent/[0.06] text-brand-accent border-brand-accent/15 dark:border-[#00EDFF]/15" : "bg-muted/40 text-muted-foreground border-border/50"}`}>
            {useCloud ? <Cloud className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
            {useCloud ? `${org?.name} (Cloud)` : "Local Browser Storage"}
          </div>
          <div>
            <h3 className="text-lg font-display font-black tracking-tight text-foreground">Fleet Command Overview</h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Review customer posture, identify recurring weaknesses, and monitor managed estate health from one MSP-facing dashboard.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportFleetCsv}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 hover:bg-muted/40 hover:border-brand-accent/15 transition-colors shadow-sm"
          >
            <Download className="h-3 w-3" /> Export Fleet Report (CSV)
          </button>
          <button
            onClick={() => setNocMode(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 hover:bg-muted/40 hover:border-brand-accent/15 transition-colors shadow-sm"
            title="Fullscreen NOC view"
          >
            <Maximize2 className="h-3 w-3" /> NOC Mode
          </button>
        </div>
      </div>

      {/* Fleet KPI Summary Bar */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {([
            { value: customers.length, label: "Customers", icon: <Building2 className="h-3.5 w-3.5" /> },
            { value: totalFirewalls, label: "Firewalls", icon: <Shield className="h-3.5 w-3.5" /> },
            { value: avgScore, label: "Score /100", icon: <Activity className="h-3.5 w-3.5" />, color: scoreToColor(avgScore) },
            { value: atRisk, label: "At Risk", icon: <AlertTriangle className="h-3.5 w-3.5" />, alert: atRisk > 0 },
            { value: totalFindings, label: "Findings", icon: <FileWarning className="h-3.5 w-3.5" /> },
          ] as const).map((kpi) => {
            const isAlert = "alert" in kpi && kpi.alert;
            return (
              <div
                key={kpi.label}
                className={`group relative rounded-2xl border px-3 py-3.5 text-center flex flex-col items-center justify-between transition-all duration-200 hover:shadow-md overflow-hidden ${
                  isAlert
                    ? "border-severity-critical/30 bg-severity-critical/[0.06] dark:bg-severity-critical/[0.08] shadow-sm"
                    : "border-border/50 bg-card/60 dark:bg-white/[0.03] shadow-sm hover:border-brand-accent/20"
                }`}
              >
                <div className={`h-6 w-6 rounded-md flex items-center justify-center mb-2 ${
                  isAlert
                    ? "bg-severity-critical/10 text-severity-critical"
                    : "bg-brand-accent/[0.08] text-brand-accent"
                }`}>
                  {kpi.icon}
                </div>
                <p className={`text-2xl font-display font-black tracking-tight tabular-nums leading-none ${
                  isAlert ? "text-severity-critical" : ""
                }`} style={"color" in kpi && kpi.color && !isAlert ? { color: kpi.color } : undefined}>
                  {kpi.value}
                </p>
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.14em] mt-2 h-4 flex items-center">{kpi.label}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { value: slaBreaches, label: "SLA Breaches", warn: slaBreaches > 0 },
            { value: useCloud ? agentsOffline : "—", label: "Agents Offline", warn: typeof agentsOffline === "number" && agentsOffline > 0 },
            { value: useCloud ? assessmentsThisWeek : "—", label: "Assessments 7d" },
            { value: totalRulesAnalysed.toLocaleString(), label: "Rules Analysed" },
          ] as const).map((kpi) => {
            const isWarn = "warn" in kpi && kpi.warn;
            return (
              <div
                key={kpi.label}
                className={`rounded-xl border px-3 py-3 text-center flex flex-col items-center justify-center transition-colors ${
                  isWarn
                    ? "border-severity-high/25 bg-severity-high/[0.05]"
                    : "border-border/40 bg-card/40 dark:bg-white/[0.02]"
                }`}
              >
                <p className={`text-xl font-display font-bold tracking-tight tabular-nums leading-none ${isWarn ? "text-severity-high" : "text-foreground"}`}>{kpi.value}</p>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-[0.14em] mt-1.5 whitespace-nowrap">{kpi.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fleet heatmap grid */}
      {allFirewalls.length > 1 && (
        <div className="rounded-[24px] border border-border/70 bg-card/75 shadow-sm p-4 sm:p-5 space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-display font-semibold tracking-tight text-foreground uppercase tracking-[0.12em]">Fleet Health Map</h3>
            <p className="text-[11px] text-muted-foreground">Spot weak sites, drill into affected firewalls, and compare customer posture at a glance.</p>
          </div>
          {(() => {
            const byCustomer = new Map<string, typeof allFirewalls>();
            for (const fw of allFirewalls) {
              const key = fw.customer;
              if (!byCustomer.has(key)) byCustomer.set(key, []);
              byCustomer.get(key)!.push(fw);
            }
            const customersList = customers.length > 1 ? [...byCustomer.entries()] : [["", allFirewalls] as [string, typeof allFirewalls]];
            return (
              <div className="space-y-3">
                {customersList.map(([custName, fws]) => (
                  <div key={custName || "single"} className="space-y-1.5">
                    {custName && <p className="text-[11px] font-display font-medium text-muted-foreground/70">{custName}</p>}
                    <div className="flex flex-wrap gap-2">
                      {fws.map((fw) => {
                        const g = fw.grade;
                        const color = g === "A" || g === "B" ? "bg-[#00F2B3]/70 dark:bg-[#00F2B3]/60" :
                          g === "C" ? "bg-[#F8E300]/50" :
                          g === "D" ? "bg-[#F29400]/60" : "bg-[#EA0022]/60";
                        const key = `${fw.customer}-${fw.label}`;
                        const isDrilled = heatmapDrill === key;
                        return (
                          <div
                            key={key}
                            title={`${fw.customer} — ${fw.label}: ${fw.score} (${g})`}
                            className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg ${color} cursor-pointer flex items-center justify-center transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-white/60 hover:shadow-lg ${isDrilled ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110" : ""}`}
                            onClick={() => setHeatmapDrill(isDrilled ? null : key)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && setHeatmapDrill(isDrilled ? null : key)}
                          >
                            <span className="text-sm font-display font-bold text-white drop-shadow-md">{g}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {heatmapDrill && (() => {
                  const drilled = allFirewalls.find((f) => `${f.customer}-${f.label}` === heatmapDrill);
                  if (!drilled) return null;
                  return (
                    <div className="mt-2 p-3.5 rounded-lg bg-muted/20 dark:bg-muted/10 border border-border/30">
                      <p className="text-[12px] font-display font-semibold text-foreground">
                        {drilled.customer} — {drilled.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        Score: <span className="font-semibold text-foreground tabular-nums">{drilled.score}/100</span> · Grade <span className={`font-bold ${GRADE_COLORS[drilled.grade]?.split(" ")[0] ?? "text-foreground"}`}>{drilled.grade}</span>
                      </p>
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </div>
      )}

      {/* Top 10 Findings Across Fleet */}
      {topFindings.length > 0 && (
        <div className="rounded-[24px] border border-border/70 bg-card/75 shadow-sm p-4 sm:p-5 space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-display font-semibold tracking-tight text-foreground uppercase tracking-[0.12em]">Top 10 Findings Across Fleet</h3>
            <p className="text-[11px] text-muted-foreground">Identify the recurring weaknesses most likely to drive customer conversations and remediation priorities.</p>
          </div>
          <div className="space-y-1.5">
            {topFindings.map((f) => {
              const isExpanded = expandedFinding === f.title;
              return (
                <div key={f.title} className="rounded-lg border border-border/30 bg-muted/10 dark:bg-muted/5 overflow-hidden transition-all">
                  <button
                    onClick={() => setExpandedFinding(isExpanded ? null : f.title)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-muted/20 transition-colors group"
                  >
                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-[#F29400]/10 text-[#F29400] border border-[#F29400]/20 capitalize">{f.severity}</span>
                    <span className="flex-1 text-[13px] font-display font-semibold tracking-tight text-foreground truncate">{f.title}</span>
                    <span className="text-[11px] text-muted-foreground/60 font-medium tabular-nums shrink-0">{f.affectedCount} of {f.totalFirewalls} firewalls</span>
                  </button>
                  {isExpanded && (
                    <div className="px-3.5 pb-3 pt-2 border-t border-border/30 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Affected firewalls</p>
                      <div className="flex flex-wrap gap-1.5">
                        {f.firewalls.map((host) => (
                          <span key={host} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/30 dark:bg-muted/20 border border-border/40 text-foreground/80">{host}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Outlier detection */}
      {outlierCounts.length > 0 && (
        <div className="rounded-[24px] border border-[#F29400]/20 bg-[#F29400]/[0.04] p-4 sm:p-5 space-y-2 shadow-sm">
          <h3 className="text-sm font-display font-semibold tracking-tight text-[#c47800] dark:text-[#F29400]">Common Weaknesses Across Fleet</h3>
          {outlierCounts.map((o) => (
            <p key={o.label} className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{o.count} of {allFirewalls.length}</span> firewalls have <span className="font-semibold text-foreground">{o.label}</span> below 50%
            </p>
          ))}
        </div>
      )}

      {/* Agent Status Timeline — last 7 days, green/red/grey dots */}
      {agentTimelineData && agentTimelineData.agents.length > 0 && (
        <div className="rounded-[24px] border border-border/70 bg-card/75 shadow-sm p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">Agent Status (Last 7 Days)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-2 font-medium text-muted-foreground">Agent</th>
                  {agentTimelineData.dayKeys.map((d) => (
                    <th key={d} className="text-center py-1 px-0.5 font-medium text-muted-foreground w-6">
                      {new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentTimelineData.agents.map((agent) => (
                  <tr key={agent.id}>
                    <td className="py-1 pr-2 font-medium truncate max-w-[120px]" title={agent.customer_name}>
                      {agent.name || agent.customer_name}
                    </td>
                    {agentTimelineData.dayKeys.map((day) => {
                      const status = agentTimelineData.byAgentDay.get(agent.id)?.get(day) ?? "none";
                      const dotColor = status === "active" ? "bg-[#00F2B3]" : status === "offline" ? "bg-[#EA0022]" : "bg-muted";
                      return (
                        <td key={day} className="py-1 px-0.5 text-center">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`}
                            title={`${day}: ${status === "active" ? "Active" : status === "offline" ? "Offline" : "No data"}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Search + sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search customers…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-border/70 bg-card/90 pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30 focus:border-brand-accent/30 shadow-sm transition-colors"
          />
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_80px_80px_90px] gap-2 px-4 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.12em]">
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
      <div className="space-y-2">
        {filtered.map((c) => {
          const isExpanded = expanded === c.latestSnapshot.id;
          const sparkColor = c.latestSnapshot.overallScore >= 75 ? "#00F2B3" : c.latestSnapshot.overallScore >= 50 ? "#F29400" : "#EA0022";
          const assessmentStale = Date.now() - c.latestSnapshot.timestamp > STALE_ASSESSMENT_MS;
          const scoreGrade = scoreToGrade(c.latestSnapshot.overallScore);
          return (
            <div key={c.latestSnapshot.id} className="rounded-[24px] border border-border/70 bg-card/85 shadow-sm overflow-hidden transition-all hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] hover:border-brand-accent/15">
              <button onClick={() => setExpanded(isExpanded ? null : c.latestSnapshot.id)} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/20 transition-colors group">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${GRADE_COLORS[scoreGrade] ?? GRADE_COLORS.C}`}>
                  <span className="text-sm font-display font-bold tabular-nums">{c.latestSnapshot.overallScore}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-display font-semibold tracking-tight text-foreground truncate">{c.name}</p>
                    {assessmentStale && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0"
                        title="Last assessment was more than 60 days ago"
                      >
                        Overdue
                      </span>
                    )}
                    {agentCustomers.has(c.name) && (
                      <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-[#6B5BFF]/10 text-[#6B5BFF] border border-[#6B5BFF]/15 shrink-0" title={`Agent: ${agentCustomers.get(c.name)?.status}`}>
                        <Plug className="h-2.5 w-2.5" /> Agent
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    {c.latestSnapshot.firewalls.length} firewall{c.latestSnapshot.firewalls.length !== 1 ? "s" : ""} · Grade {c.latestSnapshot.overallGrade}
                    {c.scoreTrend !== 0 && (
                      <span className={`font-semibold ${c.scoreTrend > 0 ? "text-[#00F2B3]" : "text-[#EA0022]"}`}>
                        {" "}({c.scoreTrend > 0 ? "+" : ""}{c.scoreTrend})
                      </span>
                    )}
                    {agentCustomers.has(c.name) && agentCustomers.get(c.name)?.lastSeen && (
                      <span className="text-[#6B5BFF]"> · Agent synced {timeAgo(new Date(agentCustomers.get(c.name)!.lastSeen!).getTime())}</span>
                    )}
                  </p>
                </div>
                <MiniSparkline values={c.scoreHistory} color={sparkColor} />
                <ChevronRight className={`h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-border/40 space-y-2">
                  {c.latestSnapshot.firewalls.map((fw) => {
                    const fwGrade = fw.riskScore.overall >= 90 ? "A" : fw.riskScore.overall >= 75 ? "B" : fw.riskScore.overall >= 60 ? "C" : fw.riskScore.overall >= 40 ? "D" : "F";
                    return (
                      <div key={fw.label} className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-muted/20 dark:bg-muted/10 border border-border/30">
                        <Shield className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                        <span className="text-[11px] font-display font-medium text-foreground flex-1 truncate">{fw.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${gradeColor(fwGrade)}`}>
                          {fw.riskScore.overall}/100
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 tabular-nums">{fw.totalRules} rules</span>
                        <span className="text-[10px] text-muted-foreground/70 tabular-nums">{fw.totalFindings} findings</span>
                      </div>
                    );
                  })}
                  {c.previousSnapshot && (
                    <div className="text-[10px] text-muted-foreground/70 pt-1 flex items-center gap-2">
                      <span>Previous: {formatDate(c.previousSnapshot.timestamp)} — Score {c.previousSnapshot.overallScore} ({c.scoreTrend > 0 ? "+" : ""}{c.scoreTrend})</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.latestSnapshot.firewalls.flatMap((fw) =>
                      fw.riskScore.categories.filter((cat) => cat.pct < 50).map((cat) => (
                        <span key={`${fw.label}-${cat.label}`} className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-[#EA0022]/8 text-[#EA0022] border border-[#EA0022]/15">
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

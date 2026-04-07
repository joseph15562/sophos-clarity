import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOCK_DRIFT_HISTORY } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import {
  GitCompare,
  Clock,
  ChevronRight,
  ChevronDown,
  FileCode2,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Activity,
  Bell,
  ToggleLeft,
  ToggleRight,
  Server,
  Loader2,
} from "lucide-react";

interface ConfigChange {
  description: string;
  severity: "green" | "red" | "amber";
}

interface Snapshot {
  id: string;
  date: string;
  time: string;
  scoreBefore: number;
  scoreAfter: number;
  findingsAdded: number;
  findingsRemoved: number;
  changes: ConfigChange[];
  firewall: string;
}

const FIREWALLS = [
  { id: "fw-hq-01", label: "XGS 4300 — HQ Primary" },
  { id: "fw-hq-02", label: "XGS 4300 — HQ Secondary" },
  { id: "fw-br-01", label: "XGS 2300 — Branch London" },
  { id: "fw-br-02", label: "XGS 2100 — Branch Manchester" },
];

const DEMO_SNAPSHOTS: Snapshot[] = [
  {
    id: "s01",
    date: "2025-10-02",
    time: "03:15",
    scoreBefore: 72,
    scoreAfter: 72,
    findingsAdded: 0,
    findingsRemoved: 0,
    firewall: "fw-hq-01",
    changes: [
      { description: "Baseline snapshot captured — no prior state to compare", severity: "green" },
    ],
  },
  {
    id: "s02",
    date: "2025-10-18",
    time: "09:42",
    scoreBefore: 72,
    scoreAfter: 68,
    findingsAdded: 3,
    findingsRemoved: 0,
    firewall: "fw-hq-01",
    changes: [
      { description: "New rule 'Temp-Access' added with ANY service", severity: "red" },
      { description: "Admin access enabled on WAN interface", severity: "red" },
      { description: "HTTPS management port changed from 4444 to 443", severity: "amber" },
    ],
  },
  {
    id: "s03",
    date: "2025-11-05",
    time: "14:30",
    scoreBefore: 68,
    scoreAfter: 71,
    findingsAdded: 0,
    findingsRemoved: 2,
    firewall: "fw-hq-01",
    changes: [
      { description: "Rule 'Temp-Access' deleted", severity: "green" },
      { description: "Admin access on WAN disabled", severity: "green" },
    ],
  },
  {
    id: "s04",
    date: "2025-11-22",
    time: "11:10",
    scoreBefore: 71,
    scoreAfter: 74,
    findingsAdded: 1,
    findingsRemoved: 3,
    firewall: "fw-hq-01",
    changes: [
      { description: "Rule 'Allow-Web' modified: logging enabled", severity: "green" },
      { description: "IPS policy applied to LAN-to-WAN zone", severity: "green" },
      { description: "Unused rule 'Legacy-VPN' removed", severity: "green" },
      { description: "New scheduled backup rule added", severity: "amber" },
    ],
  },
  {
    id: "s05",
    date: "2025-12-10",
    time: "02:05",
    scoreBefore: 74,
    scoreAfter: 74,
    findingsAdded: 1,
    findingsRemoved: 1,
    firewall: "fw-hq-01",
    changes: [
      {
        description: "SSL/TLS Decrypt rule scope expanded to include guest zone",
        severity: "green",
      },
      { description: "Certificate renewed for decrypt profile", severity: "amber" },
    ],
  },
  {
    id: "s06",
    date: "2026-01-08",
    time: "16:22",
    scoreBefore: 74,
    scoreAfter: 69,
    findingsAdded: 4,
    findingsRemoved: 0,
    firewall: "fw-hq-01",
    changes: [
      { description: "New rule 'Vendor-Remote' added with ANY/ANY source", severity: "red" },
      { description: "NAT rule added exposing internal RDP port", severity: "red" },
      { description: "Firewall log retention reduced from 90 to 7 days", severity: "red" },
      { description: "ATP scanning mode changed from block to monitor", severity: "amber" },
    ],
  },
  {
    id: "s07",
    date: "2026-01-20",
    time: "08:50",
    scoreBefore: 69,
    scoreAfter: 73,
    findingsAdded: 0,
    findingsRemoved: 3,
    firewall: "fw-hq-01",
    changes: [
      { description: "Rule 'Vendor-Remote' tightened to specific IP range", severity: "green" },
      { description: "NAT rule for RDP removed", severity: "green" },
      { description: "Log retention restored to 90 days", severity: "green" },
    ],
  },
  {
    id: "s08",
    date: "2026-02-03",
    time: "10:15",
    scoreBefore: 73,
    scoreAfter: 76,
    findingsAdded: 0,
    findingsRemoved: 2,
    firewall: "fw-hq-01",
    changes: [
      { description: "ATP scanning mode restored to block", severity: "green" },
      { description: "Web filtering policy updated with new category blocks", severity: "green" },
    ],
  },
  {
    id: "s09",
    date: "2026-02-14",
    time: "23:45",
    scoreBefore: 76,
    scoreAfter: 76,
    findingsAdded: 1,
    findingsRemoved: 1,
    firewall: "fw-hq-01",
    changes: [
      { description: "VPN tunnel pre-shared key rotated", severity: "green" },
      { description: "New SNAT rule for cloud egress added", severity: "amber" },
    ],
  },
  {
    id: "s10",
    date: "2026-02-28",
    time: "07:30",
    scoreBefore: 76,
    scoreAfter: 72,
    findingsAdded: 3,
    findingsRemoved: 0,
    firewall: "fw-hq-01",
    changes: [
      {
        description: "SSL/TLS inspection rules modified — exclusion list expanded",
        severity: "red",
      },
      { description: "New rule 'Quick-Fix-DMZ' added with broad source", severity: "red" },
      { description: "HA heartbeat interval changed from 5s to 30s", severity: "amber" },
    ],
  },
  {
    id: "s11",
    date: "2026-03-12",
    time: "15:20",
    scoreBefore: 72,
    scoreAfter: 78,
    findingsAdded: 0,
    findingsRemoved: 5,
    firewall: "fw-hq-01",
    changes: [
      { description: "Rule 'Quick-Fix-DMZ' replaced with scoped policy", severity: "green" },
      { description: "SSL/TLS exclusion list trimmed to essential domains", severity: "green" },
      { description: "HA heartbeat interval restored to 5s", severity: "green" },
      { description: "Unused service objects cleaned up", severity: "green" },
      { description: "Default drop rule logging re-enabled", severity: "green" },
    ],
  },
  {
    id: "s12",
    date: "2026-03-25",
    time: "12:00",
    scoreBefore: 78,
    scoreAfter: 81,
    findingsAdded: 0,
    findingsRemoved: 2,
    firewall: "fw-hq-01",
    changes: [
      { description: "MFA enforced for all admin accounts", severity: "green" },
      { description: "Firmware auto-update schedule configured", severity: "green" },
    ],
  },
];

interface AlertRule {
  id: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_ALERTS: AlertRule[] = [
  { id: "wan-admin", label: "Admin access enabled on WAN", enabled: true },
  { id: "score-drop", label: "Score drops more than 10 points", enabled: true },
  { id: "any-any", label: "Any rule added with ANY/ANY", enabled: false },
  { id: "ssl-mod", label: "SSL/TLS inspection rules modified", enabled: true },
];

function scoreColor(before: number, after: number): string {
  if (after > before) return "#00F2B3";
  if (after < before) return "#EA0022";
  return "#6b7280";
}

function scoreBadge(before: number, after: number) {
  if (after > before) return "text-[#007A5A] dark:text-[#00F2B3]";
  if (after < before) return "text-[#EA0022]";
  return "text-muted-foreground";
}

function severityDot(s: ConfigChange["severity"]) {
  if (s === "green") return "bg-[#00F2B3]";
  if (s === "red") return "bg-[#EA0022]";
  return "bg-[#F29400]";
}

function severityBorder(s: ConfigChange["severity"]) {
  if (s === "green") return "border-[#00F2B3]/30";
  if (s === "red") return "border-[#EA0022]/30";
  return "border-[#F29400]/30";
}

function DriftMonitorInner() {
  const { user, org, isGuest } = useAuth();
  const isDark = useResolvedIsDark();

  const [selectedFirewall, setSelectedFirewall] = useState(FIREWALLS[0].id);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertRule[]>(DEFAULT_ALERTS);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [firewalls, setFirewalls] = useState(FIREWALLS);
  const [allSnapshots, setAllSnapshots] = useState<Snapshot[]>(DEMO_SNAPSHOTS);
  const [loading, setLoading] = useState(true);
  const [baselineDate, setBaselineDate] = useState("2026-03-01");
  const [currentDate, setCurrentDate] = useState("2026-04-02");
  const [compareDone, setCompareDone] = useState(false);
  const [diffOpen, setDiffOpen] = useState<string | null>("rules");
  const [historyCustomer, setHistoryCustomer] = useState<string>("__all__");
  const [showUnchanged, setShowUnchanged] = useState(false);

  useEffect(() => {
    if (!org?.id) {
      setFirewalls(FIREWALLS);
      setAllSnapshots(DEMO_SNAPSHOTS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: agents } = await supabase
          .from("agents")
          .select("id, name, firewall_host, hardware_model")
          .eq("org_id", org.id);

        if (cancelled) return;

        if (agents && agents.length > 0) {
          const fwList = agents.map((a) => ({
            id: a.id,
            label: `${a.hardware_model || "Agent"} — ${a.firewall_host || a.name}`,
          }));
          setFirewalls(fwList);
          setSelectedFirewall(fwList[0].id);

          const { data: submissions } = await supabase
            .from("agent_submissions")
            .select("id, agent_id, overall_score, overall_grade, finding_titles, drift, created_at")
            .eq("org_id", org.id)
            .order("created_at", { ascending: true });

          if (cancelled) return;

          if (submissions && submissions.length > 0) {
            const mapped: Snapshot[] = submissions.map((sub, i) => {
              const prev = i > 0 ? submissions[i - 1] : null;
              const scoreBefore = prev ? prev.overall_score : sub.overall_score;
              const prevTitles = new Set<string>(prev?.finding_titles ?? []);
              const currTitles = new Set<string>(sub.finding_titles ?? []);
              const added = [...currTitles].filter((t) => !prevTitles.has(t));
              const removed = [...prevTitles].filter((t) => !currTitles.has(t));
              const d = new Date(sub.created_at);

              const changes: ConfigChange[] = [];
              for (const t of removed)
                changes.push({ description: `Resolved: ${t}`, severity: "green" });
              for (const t of added)
                changes.push({ description: `New finding: ${t}`, severity: "red" });
              if (changes.length === 0 && prev)
                changes.push({ description: "No significant changes detected", severity: "amber" });

              return {
                id: sub.id,
                date: d.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
                time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
                scoreBefore,
                scoreAfter: sub.overall_score,
                findingsAdded: added.length,
                findingsRemoved: removed.length,
                changes,
                firewall: sub.agent_id,
              };
            });
            setAllSnapshots(mapped);
          } else {
            setAllSnapshots([]);
          }
        } else {
          setFirewalls([]);
          setAllSnapshots([]);
        }
      } catch (err) {
        console.warn("[DriftMonitor] load failed", err);
        setFirewalls(FIREWALLS);
        setAllSnapshots(DEMO_SNAPSHOTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  const snapshots = allSnapshots.filter((s) => s.firewall === selectedFirewall);
  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) ?? null;

  const totalChanges = snapshots.reduce((sum, s) => sum + s.changes.length, 0);
  const firstDate = snapshots[0];
  const lastDate = snapshots[snapshots.length - 1];
  const daysMonitored =
    firstDate && lastDate
      ? Math.round(
          (new Date(lastDate.date).getTime() - new Date(firstDate.date).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;
  const overallTrend = firstDate && lastDate ? lastDate.scoreAfter - firstDate.scoreBefore : 0;

  const toggleAlert = (id: string) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));

  const driftHistoryFiltered = useMemo(() => {
    if (historyCustomer === "__all__") return MOCK_DRIFT_HISTORY;
    return MOCK_DRIFT_HISTORY.filter((h) => h.customer === historyCustomer);
  }, [historyCustomer]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <FireComplyWorkspaceHeader loginShell={isGuest} />
        <WorkspacePrimaryNav />
        <main
          id="main-content"
          className="flex-1 flex items-center justify-center px-4 assist-chrome-pad-bottom"
          data-tour="tour-page-drift"
        >
          <Loader2 className="w-8 h-8 animate-spin text-[#2006F7]" />
        </main>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <FireComplyWorkspaceHeader loginShell={isGuest} />
        <WorkspacePrimaryNav />
        <main
          id="main-content"
          className="flex-1 flex items-center justify-center px-4 assist-chrome-pad-bottom"
          data-tour="tour-page-drift"
        >
          <EmptyState
            className="max-w-md py-12"
            icon={<Server className="h-8 w-8 text-muted-foreground/60" />}
            title="No configuration snapshots yet"
            description="Deploy the connector agent to start tracking changes automatically."
            action={
              <Button asChild>
                <Link to="/">Back to Dashboard</Link>
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <FireComplyWorkspaceHeader loginShell={isGuest} />
      <WorkspacePrimaryNav />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-6xl w-full px-4 md:px-6 pt-8 space-y-8 assist-chrome-pad-bottom"
        data-tour="tour-page-drift"
      >
        {/* Firewall selector */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
          data-tour="tour-drift-selector"
        >
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Server className="w-4 h-4" />
            Firewall
          </label>
          <select
            value={selectedFirewall}
            onChange={(e) => {
              setSelectedFirewall(e.target.value);
              setSelectedSnapshotId(null);
            }}
            className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2006F7]/40 min-w-[280px]"
          >
            {firewalls.map((fw) => (
              <option key={fw.id} value={fw.id}>
                {fw.label}
              </option>
            ))}
          </select>
        </div>

        {/* Manual config compare (spec) */}
        <section
          className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-[0_12px_40px_rgba(32,6,247,0.04)] space-y-4"
          data-tour="tour-drift-compare"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-[#2006F7]" />
              Compare configs
            </h2>
            <p className="text-xs text-muted-foreground">
              Upload baseline and current exports, set effective dates, then run a structured diff
              (demo — uses sample results).
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
            <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-4">
              <Label className="text-xs">Baseline config</Label>
              <Input
                type="file"
                accept=".xml,.conf,.txt,.tar,.gz,.zip"
                className="cursor-pointer text-xs"
              />
              <Label className="text-xs">Config date</Label>
              <Input
                type="date"
                value={baselineDate}
                onChange={(e) => setBaselineDate(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-center py-2 lg:py-0">
              <span className="rounded-full border border-[#2006F7]/40 bg-[#2006F7]/10 px-3 py-1 text-xs font-bold text-[#2006F7]">
                VS
              </span>
            </div>
            <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-4">
              <Label className="text-xs">Current config</Label>
              <Input
                type="file"
                accept=".xml,.conf,.txt,.tar,.gz,.zip"
                className="cursor-pointer text-xs"
              />
              <Label className="text-xs">Config date</Label>
              <Input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => {
              setCompareDone(true);
              toast.success("Comparison complete (demo diff loaded)");
            }}
          >
            Compare configs
          </Button>

          {compareDone ? (
            <div className="space-y-4 pt-2 border-t border-border/40">
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: "Added rules",
                    value: 3,
                    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
                  },
                  {
                    label: "Removed rules",
                    value: 1,
                    cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
                  },
                  {
                    label: "Modified",
                    value: 5,
                    cls: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
                  },
                  {
                    label: "Unchanged",
                    value: 412,
                    cls: "bg-muted/40 text-muted-foreground border-border/60",
                  },
                ].map((b) => (
                  <span
                    key={b.label}
                    className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", b.cls)}
                  >
                    {b.label}: {b.value}
                  </span>
                ))}
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  Change risk analysis
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Overall risk{" "}
                  <span className="font-bold text-amber-700 dark:text-amber-300">Elevated</span> —
                  WAN-facing rule broadened; NAT exposure introduced in current export.
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  <li>Rule &quot;Vendor-Remote&quot;: source set widened from /32 to /16</li>
                  <li>NAT: internal RDP published — verify jump host pattern</li>
                </ul>
                <Button type="button" size="sm" variant="outline" className="mt-1">
                  Generate change report (PDF)
                </Button>
              </div>

              <div className="space-y-2">
                {[
                  {
                    id: "rules",
                    title: "Firewall rules",
                    count: 6,
                    pairs: [
                      {
                        side: "removed" as const,
                        left: "allow tcp any any -> DMZ_WEB (80,443)",
                        right: "—",
                      },
                      {
                        side: "added" as const,
                        left: "—",
                        right: "allow tcp VENDOR_NET any -> DMZ_WEB (22)",
                      },
                      { side: "modified" as const, left: "log: off", right: "log: on" },
                    ],
                  },
                  {
                    id: "nat",
                    title: "NAT",
                    count: 2,
                    pairs: [
                      {
                        side: "added" as const,
                        left: "—",
                        right: "DNAT 203.0.113.4:3389 -> 10.20.4.50",
                      },
                    ],
                  },
                ].map((sec) => (
                  <div key={sec.id} className="rounded-xl border border-border/50 overflow-hidden">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium bg-muted/20 hover:bg-muted/30"
                      onClick={() => setDiffOpen((o) => (o === sec.id ? null : sec.id))}
                    >
                      <span className="flex items-center gap-2">
                        {diffOpen === sec.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        {sec.title}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {sec.count} changes
                      </span>
                    </button>
                    {diffOpen === sec.id ? (
                      <div className="p-3 space-y-2 border-t border-border/40">
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase text-muted-foreground px-1">
                          <span>Baseline</span>
                          <span>Current</span>
                        </div>
                        {sec.pairs.map((p, i) => (
                          <div key={i} className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div
                              className={cn(
                                "rounded-lg border p-2 break-all",
                                p.side === "removed" && "border-red-500/30 bg-red-500/5",
                                p.side === "modified" && "border-amber-500/30 bg-amber-500/5",
                                p.side === "added" && "border-border/40 bg-muted/20",
                              )}
                            >
                              {p.left}
                            </div>
                            <div
                              className={cn(
                                "rounded-lg border p-2 break-all",
                                p.side === "added" && "border-emerald-500/30 bg-emerald-500/5",
                                p.side === "modified" && "border-amber-500/30 bg-amber-500/5",
                                p.side === "removed" && "border-border/40 bg-muted/20",
                              )}
                            >
                              {p.right}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                          onClick={() => setShowUnchanged((v) => !v)}
                        >
                          {showUnchanged ? "Hide" : "Show"} 14 unchanged objects
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="space-y-8" data-tour="tour-drift-timeline">
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Clock className="w-5 h-5 text-[#2006F7]" />}
              label="Total Snapshots"
              value={String(snapshots.length)}
            />
            <StatCard
              icon={<Activity className="w-5 h-5 text-[#00EDFF]" />}
              label="Changes Detected"
              value={String(totalChanges)}
            />
            <StatCard
              icon={
                overallTrend >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-[#00F2B3]" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-[#EA0022]" />
                )
              }
              label="Score Trend"
              value={`${overallTrend >= 0 ? "↑" : "↓"} ${Math.abs(overallTrend)} pts`}
            />
            <StatCard
              icon={<Shield className="w-5 h-5 text-[#F29400]" />}
              label="Days Monitored"
              value={String(daysMonitored)}
            />
          </div>

          {/* Timeline */}
          <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-[0_12px_40px_rgba(32,6,247,0.04)]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6 flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Snapshot Timeline
            </h2>

            <div className="overflow-x-auto pb-2">
              <div className="relative flex items-start gap-0 min-w-max px-4">
                {/* Connecting line */}
                <div
                  className="absolute top-[18px] left-8 right-8 h-[2px] bg-border/60"
                  style={{ zIndex: 0 }}
                />

                {snapshots.map((snap, i) => {
                  const fill = scoreColor(snap.scoreBefore, snap.scoreAfter);
                  const isSelected = snap.id === selectedSnapshotId;
                  return (
                    <button
                      key={snap.id}
                      onClick={() => setSelectedSnapshotId(snap.id)}
                      className="relative flex flex-col items-center group focus:outline-none"
                      style={{
                        minWidth: 80,
                        zIndex: 1,
                      }}
                    >
                      {/* Score delta label */}
                      <span
                        className="text-[10px] font-mono font-medium mb-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: fill }}
                      >
                        {snap.scoreAfter - snap.scoreBefore > 0
                          ? `+${snap.scoreAfter - snap.scoreBefore}`
                          : snap.scoreAfter - snap.scoreBefore === 0
                            ? "±0"
                            : String(snap.scoreAfter - snap.scoreBefore)}
                      </span>

                      {/* Node */}
                      <div
                        className={`w-9 h-9 rounded-full border-[3px] flex items-center justify-center transition-all ${
                          isSelected ? "scale-125 shadow-lg" : "hover:scale-110"
                        }`}
                        style={{
                          borderColor: fill,
                          backgroundColor: isSelected ? fill : "var(--card)",
                        }}
                      >
                        <span
                          className="text-[10px] font-bold"
                          style={{
                            color: isSelected ? (isDark ? "#0a0a0a" : "#fff") : fill,
                          }}
                        >
                          {snap.scoreAfter}
                        </span>
                      </div>

                      {/* Date */}
                      <span className="mt-2 text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(snap.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>

                      {/* Change count */}
                      <span className="text-[9px] text-muted-foreground/60">
                        {snap.changes.length} change{snap.changes.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Snapshot detail */}
          {selectedSnapshot ? (
            <section className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-[0_12px_40px_rgba(32,6,247,0.04)] animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#2006F7]" />
                    {new Date(selectedSnapshot.date).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    <span className="text-muted-foreground font-normal text-sm">
                      {selectedSnapshot.time}
                    </span>
                  </h2>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Score</span>
                    <span className="font-mono font-semibold">{selectedSnapshot.scoreBefore}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <span
                      className={`font-mono font-semibold ${scoreBadge(selectedSnapshot.scoreBefore, selectedSnapshot.scoreAfter)}`}
                    >
                      {selectedSnapshot.scoreAfter}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {selectedSnapshot.findingsAdded > 0 && (
                      <span className="flex items-center gap-1 text-[#EA0022]">
                        <Plus className="w-3 h-3" />
                        {selectedSnapshot.findingsAdded}
                      </span>
                    )}
                    {selectedSnapshot.findingsRemoved > 0 && (
                      <span className="flex items-center gap-1 text-[#007A5A] dark:text-[#00F2B3]">
                        <Minus className="w-3 h-3" />
                        {selectedSnapshot.findingsRemoved}
                      </span>
                    )}
                    {selectedSnapshot.findingsAdded === 0 &&
                      selectedSnapshot.findingsRemoved === 0 && (
                        <span className="text-muted-foreground">No finding delta</span>
                      )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {selectedSnapshot.changes.map((ch, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 bg-background/50 ${severityBorder(ch.severity)}`}
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${severityDot(ch.severity)}`}
                    />
                    <span className="text-sm">{ch.description}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/40 backdrop-blur-sm p-8 text-center text-muted-foreground text-sm">
              Click a snapshot node on the timeline to view change details.
            </div>
          )}
        </div>

        {/* Drift history (customer-scoped, demo) */}
        <section
          className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-[0_12px_40px_rgba(32,6,247,0.04)] space-y-4"
          data-tour="tour-drift-history"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Drift history
            </h2>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Customer</Label>
              <select
                value={historyCustomer}
                onChange={(e) => setHistoryCustomer(e.target.value)}
                className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs min-w-[160px]"
              >
                <option value="__all__">All (demo)</option>
                <option value="Vertex Partners">Vertex Partners</option>
                <option value="Pennine BS">Pennine BS</option>
                <option value="Northern Retail">Northern Retail</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-3 min-w-max">
              {driftHistoryFiltered.map((h) => (
                <div
                  key={h.id}
                  className="shrink-0 rounded-xl border border-border/50 bg-background/60 px-4 py-3 min-w-[140px]"
                >
                  <p className="text-[10px] text-muted-foreground">{h.date}</p>
                  <p className="text-xs font-semibold mt-1">{h.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{h.customer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Drift alerts */}
        <section
          className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-[0_12px_40px_rgba(32,6,247,0.04)]"
          data-tour="tour-drift-alerts"
        >
          <button
            onClick={() => setAlertsExpanded(!alertsExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 text-left focus:outline-none"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Drift Alert Rules
            </h2>
            <ChevronRight
              className={`w-5 h-5 text-muted-foreground transition-transform ${alertsExpanded ? "rotate-90" : ""}`}
            />
          </button>

          {alertsExpanded && (
            <div className="px-6 pb-6 grid gap-3 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {alerts.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-background/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-[#F29400] shrink-0" />
                    <span className="text-sm">{rule.label}</span>
                  </div>
                  <button
                    onClick={() => toggleAlert(rule.id)}
                    className="focus:outline-none"
                    aria-label={`Toggle ${rule.label}`}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-7 h-7 text-[#00F2B3]" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-muted-foreground" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm px-5 py-4 shadow-[0_8px_24px_rgba(32,6,247,0.03)]">
      <div className="flex items-center gap-3 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono">{value}</p>
    </div>
  );
}

export default function DriftMonitor() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <DriftMonitorInner />
    </AuthProvider>
  );
}

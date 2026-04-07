import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFleetCommandQuery } from "@/hooks/queries/use-fleet-command-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Link, useSearchParams } from "react-router-dom";
import {
  Monitor,
  Shield,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  ArrowLeft,
  Activity,
  Wifi,
  WifiOff,
  Server,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  Upload,
  HelpCircle,
  X,
  AlertCircle,
  Users,
  BarChart3,
  GitCompare,
  Cloud,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Zap,
  TrendingDown,
  MapPin,
} from "lucide-react";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/queries/keys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FleetWorldMap } from "@/components/FleetWorldMap";
import {
  COUNTRIES,
  countryFlagEmoji,
  ENVIRONMENT_TYPES,
  US_STATES,
} from "@/lib/compliance-context-options";
import {
  fleetCustomerComplianceScope,
  persistFleetCustomerCompliance,
  persistFleetFirewallCompliance,
} from "@/lib/fleet-firewall-compliance";
import { UNASSIGNED_AGENT_GROUP, agentCustomerGroupTitle } from "@/lib/agent-customer-bucket";
import { toast } from "sonner";
import { extractSections } from "@/lib/extract-sections";
import { analyseConfig } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { parseEntitiesXml } from "@/lib/parse-entities-xml";
import { rawConfigToSections } from "@/lib/raw-config-to-sections";
import { saveScoreSnapshot } from "@/lib/score-history";
import { WorkspaceSettingsStrip } from "@/components/WorkspaceSettingsStrip";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import {
  fleetEffectiveComplianceCountry,
  type FleetFirewall,
  gradeFromScore,
} from "@/lib/fleet-command-data";
import { buildFleetMapSites } from "@/lib/fleet-map-geo";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Main app dashboard with customer + fleet row context for compliance defaults. */
function assessmentDashboardHref(fw: FleetFirewall): string {
  const name = (fw.tenantName || fw.customer || "").trim();
  const params = new URLSearchParams();
  if (name) params.set("customer", name);
  params.set("fleetContext", fw.id);
  return `/?${params.toString()}`;
}

/** Stable group key: Sophos tenant id, agent bucket, or tenant display name (demo / edge). */
function fleetCommandGroupKey(fw: FleetFirewall): string {
  if (fw.tenantId) return `tid:${fw.tenantId}`;
  if (fw.source === "agent") return `a:${fw.agentCustomerBucketKey ?? UNASSIGNED_AGENT_GROUP}`;
  return `tname:${(fw.tenantName ?? fw.customer ?? "unknown").trim()}`;
}

/* ------------------------------------------------------------------ */
/*  Demo data                                                         */
/* ------------------------------------------------------------------ */

const demoCompliance = {
  complianceCountry: "",
  complianceState: "",
  customerComplianceCountry: "",
  complianceEnvironment: "",
} as const;

const COMPLIANCE_NONE = "__none__";

/** Compact country / sector hints on each fleet row when compliance context is set. */
function ComplianceContextChips({ fw }: { fw: FleetFirewall }) {
  const country = fleetEffectiveComplianceCountry(fw);
  const state = (fw.complianceState ?? "").trim();
  const env = (fw.complianceEnvironment ?? "").trim();
  const showState = country === "United States" && Boolean(state);
  const showCountry = Boolean(country);
  if (!showCountry && !env) return null;

  const flag = showCountry ? countryFlagEmoji(country) : "";
  const locationTitle = [country, showState ? state : null].filter(Boolean).join(", ");

  return (
    <span className="flex flex-wrap items-center justify-end gap-1 shrink-0 max-w-[min(100%,220px)]">
      {showCountry ? (
        <span
          className="inline-flex max-w-[120px] items-center gap-0.5 truncate rounded px-1 py-0.5 text-[9px] font-semibold bg-slate-900/[0.06] text-foreground dark:bg-white/[0.08]"
          title={locationTitle}
        >
          <span className="shrink-0" aria-hidden>
            {flag}
          </span>
          <span className="truncate">{showState ? state : country}</span>
        </span>
      ) : null}
      {env ? (
        <span
          className="max-w-[100px] truncate rounded px-1 py-0.5 text-[8px] font-bold bg-[#2006F7]/10 text-[#2006F7] dark:text-[#009CFB]"
          title={`Sector: ${env}`}
        >
          {env}
        </span>
      ) : null}
    </span>
  );
}

const DEMO_FLEET: FleetFirewall[] = [
  {
    ...demoCompliance,
    id: "d1",
    hostname: "fw-london-hq",
    customer: "Vertex Partners",
    score: 92,
    grade: "A",
    findings: 3,
    criticalFindings: 0,
    lastAssessed: new Date(Date.now() - 25 * 60_000).toISOString(),
    status: "online",
    firmware: "SFOS 20.0.2 MR-2",
    model: "XGS 4300",
    serialNumber: "C4401A2B3C4D",
    source: "central",
    configLinked: true,
    tenantName: "Vertex Partners",
  },
  {
    ...demoCompliance,
    id: "d2",
    hostname: "fw-manchester-br",
    customer: "Vertex Partners",
    score: 78,
    grade: "B",
    findings: 7,
    criticalFindings: 1,
    lastAssessed: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    status: "online",
    firmware: "SFOS 20.0.1 MR-1",
    model: "XGS 3300",
    serialNumber: "C3301E5F6G7H",
    source: "both",
    configLinked: true,
    tenantName: "Vertex Partners",
  },
  {
    ...demoCompliance,
    id: "d3",
    hostname: "fw-edge-primary",
    customer: "Cobalt Healthcare",
    score: 85,
    grade: "A",
    findings: 5,
    criticalFindings: 0,
    lastAssessed: new Date(Date.now() - 1 * 3_600_000).toISOString(),
    status: "online",
    firmware: "SFOS 20.0.2 MR-2",
    model: "XGS 4500",
    serialNumber: "C4501I8J9K0L",
    source: "central",
    configLinked: false,
    tenantName: "Cobalt Healthcare",
  },
  {
    ...demoCompliance,
    id: "d4",
    hostname: "fw-dc-north",
    customer: "Meridian Logistics",
    score: 64,
    grade: "C",
    findings: 14,
    criticalFindings: 4,
    lastAssessed: new Date(Date.now() - 8 * 3_600_000).toISOString(),
    status: "online",
    firmware: "SFOS 19.5.4 MR-4",
    model: "XGS 2300",
    serialNumber: "C2301M2N3O4P",
    source: "central",
    configLinked: true,
    tenantName: "Meridian Logistics",
  },
  {
    ...demoCompliance,
    id: "d5",
    hostname: "fw-retail-pos",
    customer: "Apex Retail Group",
    score: 41,
    grade: "D",
    findings: 22,
    criticalFindings: 9,
    lastAssessed: new Date(Date.now() - 36 * 3_600_000).toISOString(),
    status: "stale",
    firmware: "SFOS 19.5.3 MR-3",
    model: "XGS 2100",
    serialNumber: "C2101Q5R6S7T",
    source: "agent",
    configLinked: false,
    agentCustomerBucketKey: "Apex Retail Group",
  },
  {
    ...demoCompliance,
    id: "d6",
    hostname: "fw-campus-main",
    customer: "Northfield Academy",
    score: 88,
    grade: "A",
    findings: 4,
    criticalFindings: 0,
    lastAssessed: new Date(Date.now() - 45 * 60_000).toISOString(),
    status: "online",
    firmware: "SFOS 20.0.2 MR-2",
    model: "XGS 3100",
    serialNumber: "C3101U8V9W0X",
    source: "central",
    configLinked: true,
    tenantName: "Northfield Academy",
  },
  {
    ...demoCompliance,
    id: "d7",
    hostname: "fw-warehouse-gw",
    customer: "Meridian Logistics",
    score: 29,
    grade: "F",
    findings: 31,
    criticalFindings: 12,
    lastAssessed: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    status: "offline",
    firmware: "SFOS 19.0.2 GA",
    model: "XG 135",
    serialNumber: "X1351Y2Z3A4B",
    source: "central",
    configLinked: false,
    tenantName: "Meridian Logistics",
  },
  {
    ...demoCompliance,
    id: "d8",
    hostname: "fw-branch-tokyo",
    customer: "Cobalt Healthcare",
    score: 71,
    grade: "B",
    findings: 9,
    criticalFindings: 2,
    lastAssessed: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    status: "online",
    firmware: "SFOS 20.0.1 MR-1",
    model: "XGS 2300",
    serialNumber: "C2302C5D6E7F",
    source: "both",
    configLinked: true,
    tenantName: "Cobalt Healthcare",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#00F2B3";
    case "B":
      return "#009CFB";
    case "C":
      return "#F29400";
    case "D":
      return "#EA0022";
    case "F":
      return "#EA0022";
    default:
      return "#999";
  }
}

function statusLabel(s: string): string {
  if (s === "online") return "Online";
  if (s === "offline") return "Offline";
  if (s === "suspended") return "Suspended";
  return "Stale";
}

function statusDotColor(s: string): string {
  if (s === "online") return "bg-[#00F2B3]";
  if (s === "offline") return "bg-[#EA0022]";
  if (s === "suspended") return "bg-[#9333EA]";
  return "bg-[#F29400]";
}

function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const glassCard = (isDark: boolean) => ({
  background: isDark
    ? "linear-gradient(145deg, rgba(90,0,255,0.07), rgba(0,237,255,0.025))"
    : "linear-gradient(145deg, rgba(255,255,255,0.99), rgba(247,249,255,0.96))",
});

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  isDark,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  isDark: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm p-5 flex flex-col gap-2 transition-all hover:scale-[1.01]"
      style={glassCard(isDark)}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${accent}18` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span className="text-3xl font-display font-black text-foreground leading-none">{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const bg = `${gradeColor(grade)}20`;
  const color = gradeColor(grade);
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black"
      style={{ background: bg, color }}
    >
      {grade}
    </span>
  );
}

function ScoreRing({ score, grade, size = 56 }: { score: number; grade: string; size?: number }) {
  const r = (size - 12) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-foreground/[0.06]"
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={gradeColor(grade)}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circ} ${circ}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-black"
        style={{ color: gradeColor(grade), fontSize: size > 60 ? 18 : 14 }}
      >
        {grade}
      </span>
    </div>
  );
}

function SourceBadges({ fw }: { fw: FleetFirewall }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {(fw.source === "central" || fw.source === "both") && (
        <span
          className="rounded px-1 py-0.5 text-[8px] font-bold bg-[#2006F7]/10 text-[#2006F7] dark:text-[#009CFB]"
          title="Sophos Central"
        >
          Central
        </span>
      )}
      {(fw.source === "agent" || fw.source === "both") && (
        <span
          className="rounded px-1 py-0.5 text-[8px] font-bold bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]"
          title="Connector Agent"
        >
          Agent
        </span>
      )}
      {fw.configLinked && (
        <span
          className="rounded px-1 py-0.5 text-[8px] font-bold bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B47AFF]"
          title="Config Linked"
        >
          Linked
        </span>
      )}
      <ComplianceContextChips fw={fw} />
    </span>
  );
}

function GridUploadButton({
  fwId,
  onFileUpload,
}: {
  fwId: string;
  onFileUpload: (file: File, id: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".html,.htm,.xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileUpload(f, fwId);
          e.target.value = "";
        }}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          ref.current?.click();
        }}
        className="flex items-center gap-1 rounded-md border border-slate-900/[0.08] dark:border-white/[0.08] bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-[#2006F7]/30 transition-colors"
        title="Upload config"
      >
        <Upload className="h-2.5 w-2.5" />
        Assess
      </button>
    </>
  );
}

function CustomerGroupComplianceBar({
  orgId,
  readOnly,
  sampleFw,
}: {
  orgId: string;
  readOnly: boolean;
  sampleFw: FleetFirewall;
}) {
  const queryClient = useQueryClient();
  const scope = fleetCustomerComplianceScope(sampleFw);
  const [country, setCountry] = useState(sampleFw.customerComplianceCountry);
  const [environment, setEnvironment] = useState(sampleFw.complianceEnvironment);

  useEffect(() => {
    setCountry(sampleFw.customerComplianceCountry);
    setEnvironment(sampleFw.complianceEnvironment);
  }, [
    sampleFw.customerComplianceCountry,
    sampleFw.complianceEnvironment,
    sampleFw.tenantId,
    sampleFw.agentCustomerBucketKey,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!scope) throw new Error("No customer scope");
      await persistFleetCustomerCompliance(orgId, scope, { country, environment });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.org.fleetBundle(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.org.customerDirectory(orgId) });
      toast.success("Customer defaults saved");
    },
    onError: () => toast.error("Could not save customer defaults"),
  });

  if (!scope) return null;

  return (
    <div
      className="flex flex-wrap items-end gap-2 sm:gap-3 border-t border-slate-900/[0.06] dark:border-white/[0.04] px-3 sm:px-4 py-2.5 bg-muted/[0.15]"
      onClick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <span className="w-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-auto sm:mr-1">
        Customer defaults
      </span>
      <div className="space-y-1 min-w-[160px] flex-1 sm:flex-initial">
        <Label className="text-[10px] text-muted-foreground">Default country</Label>
        <Select
          value={country || COMPLIANCE_NONE}
          onValueChange={(v) => setCountry(v === COMPLIANCE_NONE ? "" : v)}
          disabled={readOnly}
        >
          <SelectTrigger className="h-8 text-xs bg-background/80">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={COMPLIANCE_NONE}>Not set</SelectItem>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1 min-w-[180px] flex-1 sm:flex-initial sm:max-w-[240px]">
        <Label className="text-[10px] text-muted-foreground">Sector</Label>
        <Select
          value={environment || COMPLIANCE_NONE}
          onValueChange={(v) => setEnvironment(v === COMPLIANCE_NONE ? "" : v)}
          disabled={readOnly}
        >
          <SelectTrigger className="h-8 text-xs bg-background/80">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={COMPLIANCE_NONE}>Not set</SelectItem>
            {ENVIRONMENT_TYPES.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!readOnly ? (
        <Button
          type="button"
          size="sm"
          className="text-xs h-8 shrink-0"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving…" : "Save customer"}
        </Button>
      ) : null}
    </div>
  );
}

function FleetCustomerGroupHeader({
  name,
  count,
  avgScore,
  collapsed,
  onToggle,
  isDark,
  orgId,
  readOnly,
  sampleFw,
}: {
  name: string;
  count: number;
  avgScore: number;
  collapsed: boolean;
  onToggle: () => void;
  isDark: boolean;
  orgId: string | undefined;
  readOnly: boolean;
  sampleFw: FleetFirewall;
}) {
  const grade = gradeFromScore(avgScore);
  return (
    <div
      className="rounded-xl border border-slate-900/[0.06] dark:border-white/[0.04] backdrop-blur-sm overflow-hidden"
      style={glassCard(isDark)}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-muted/20 text-left"
      >
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${collapsed ? "-rotate-90" : ""}`}
        />
        <span className="text-sm font-display font-bold text-foreground truncate">{name}</span>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {count} firewall{count !== 1 ? "s" : ""}
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0"
          style={{ background: `${gradeColor(grade)}18`, color: gradeColor(grade) }}
        >
          avg {avgScore}
        </span>
      </button>
      {orgId ? (
        <CustomerGroupComplianceBar orgId={orgId} readOnly={readOnly} sampleFw={sampleFw} />
      ) : null}
    </div>
  );
}

function DetailPanel({
  fw,
  isDark,
  orgId,
  isGuest,
  isViewerOnly,
  variant = "list",
}: {
  fw: FleetFirewall;
  isDark: boolean;
  orgId: string | undefined;
  isGuest: boolean;
  isViewerOnly: boolean;
  /** `list`: indented under row. `embedded`: full width in grid card. */
  variant?: "list" | "embedded";
}) {
  const queryClient = useQueryClient();
  const readOnly = isGuest || isViewerOnly || !orgId;
  const [country, setCountry] = useState(fw.complianceCountry);
  const [usState, setUsState] = useState(fw.complianceState);

  useEffect(() => {
    setCountry(fw.complianceCountry);
    setUsState(fw.complianceState);
  }, [fw.id, fw.complianceCountry, fw.complianceState]);

  const deviceCountry = (fw.complianceCountry ?? "").trim();
  const customerDef = (fw.customerComplianceCountry ?? "").trim();
  const countryForState = (country || customerDef).trim();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No org");
      await persistFleetFirewallCompliance(orgId, fw, {
        country,
        state: usState,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.org.fleetBundle(orgId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.org.customerDirectory(orgId!) });
      toast.success("Firewall location saved");
    },
    onError: () => toast.error("Could not save firewall location"),
  });

  return (
    <div
      className={`rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm p-5 space-y-4 animate-in slide-in-from-top-2 duration-200 ${variant === "list" ? "ml-8" : ""}`}
      style={glassCard(isDark)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-xl border border-slate-900/[0.08] dark:border-white/[0.08] bg-background/40 p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Firewall location
        </p>
        <div className="rounded-lg border border-dashed border-slate-900/[0.12] dark:border-white/[0.10] bg-background/50 px-3 py-2.5">
          {deviceCountry ? (
            <p className="text-sm text-foreground">
              <span className="mr-1" aria-hidden>
                {countryFlagEmoji(deviceCountry)}
              </span>
              <span className="font-medium">Selected:</span> {deviceCountry}
              {deviceCountry === "United States" && (usState || "").trim() ? (
                <span className="text-muted-foreground"> — {(usState ?? "").trim()}</span>
              ) : null}
            </p>
          ) : customerDef ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Not selected</span> for this firewall —
              using customer default{" "}
              <span className="text-foreground">
                {countryFlagEmoji(customerDef)} {customerDef}
              </span>
              . Use the dropdown below to set a site-specific country.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Not selected</span> — set a default on
              the customer row above, or choose a country below.
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Default <strong className="font-medium text-foreground">country</strong> and{" "}
          <strong className="font-medium text-foreground">sector</strong> are on the customer
          header. Here you override <strong className="font-medium text-foreground">country</strong>{" "}
          (and US state) for this firewall only. HA peers stay in sync.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Country (this firewall)</Label>
            <Select
              value={country || COMPLIANCE_NONE}
              onValueChange={(v) => setCountry(v === COMPLIANCE_NONE ? "" : v)}
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 text-xs bg-background/80">
                <SelectValue placeholder="Not selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={COMPLIANCE_NONE}>Not selected</SelectItem>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {countryForState === "United States" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">State</Label>
              <Select
                value={usState || COMPLIANCE_NONE}
                onValueChange={(v) => setUsState(v === COMPLIANCE_NONE ? "" : v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 text-xs bg-background/80">
                  <SelectValue placeholder="Not selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COMPLIANCE_NONE}>Not selected</SelectItem>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            className="text-xs"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save firewall location"}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score ring */}
        <div className="flex items-center gap-4">
          {fw.grade === "—" ? (
            <div>
              <p className="text-lg font-display font-bold text-muted-foreground">Not assessed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a config file to get a score
              </p>
            </div>
          ) : (
            <>
              <ScoreRing score={fw.score} grade={fw.grade} size={80} />
              <div>
                <p className="text-3xl font-display font-black text-foreground leading-none">
                  {fw.score}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fw.findings} findings · {fw.criticalFindings} critical
                </p>
              </div>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Firmware</p>
            <p className="text-foreground font-medium truncate">{fw.firmware}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Model</p>
            <p className="text-foreground font-medium">{fw.model}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Serial</p>
            <p className="text-foreground font-medium truncate">{fw.serialNumber || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">HA Role</p>
            <p className="text-foreground font-medium">{fw.haRole ?? "None"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Last Assessed
            </p>
            <p className="text-foreground font-medium">{timeAgo(fw.lastAssessed)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tenant</p>
            <p className="text-foreground font-medium truncate">{fw.tenantName ?? "—"}</p>
          </div>
        </div>

        {/* Actions — use Button asChild so we never nest <button> inside <a> (breaks clicks). */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            asChild
          >
            <Link to={assessmentDashboardHref(fw)} title="Open main dashboard for this customer">
              <Shield className="h-3.5 w-3.5" /> View Assessment
            </Link>
          </Button>
          {fw.latestReportId && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-xs"
              asChild
            >
              <Link to={`/shared/${fw.latestReportId}`}>
                <FileText className="h-3.5 w-3.5" /> Latest Report
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            asChild
          >
            <a href="https://central.sophos.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> View in Central
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function FleetCard({
  fw,
  isDark,
  isSelected,
  onSelect,
  dragOverId,
  analyzingId,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileUpload,
}: {
  fw: FleetFirewall;
  isDark: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  dragOverId: string | null;
  analyzingId: string | null;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onFileUpload: (file: File, fwId: string) => void;
}) {
  const isDragTarget = dragOverId === fw.id;
  const isAnalyzing = analyzingId === fw.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`group rounded-2xl backdrop-blur-sm p-4 transition-all hover:scale-[1.005] hover:shadow-lg hover:shadow-brand-accent/5 cursor-pointer relative ${
        isDragTarget
          ? "border-[#2006F7] border-dashed border-2"
          : isSelected
            ? "border-[#2006F7]/40 border-2"
            : "border border-slate-900/[0.10] dark:border-white/[0.06]"
      }`}
      style={glassCard(isDark)}
      onClick={() => onSelect(fw.id)}
      onDragOver={(e) => onDragOver(e, fw.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, fw.id)}
    >
      {isAnalyzing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-[#2006F7]" />
            <span>Analysing…</span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,.xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileUpload(file, fw.id);
          e.target.value = "";
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] lg:grid-cols-[2fr_1.2fr_auto_auto_auto_auto_auto_auto] items-center gap-3 lg:gap-4">
        {/* Hostname + Customer */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/[0.08]">
            <Server className="h-4 w-4 text-brand-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
              {fw.hostname}
              {fw.haRole && (
                <span className="shrink-0 rounded-full bg-[#009CFB]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#009CFB]">
                  HA
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{fw.customer}</p>
          </div>
        </div>

        {/* Model + Firmware */}
        <div className="hidden sm:block min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{fw.model}</p>
          <p className="text-[11px] text-muted-foreground truncate">{fw.firmware}</p>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          {fw.grade === "—" ? (
            <span className="text-sm text-muted-foreground">Not assessed</span>
          ) : (
            <>
              <span className="text-lg font-display font-black text-foreground">{fw.score}</span>
              <GradeBadge grade={fw.grade} />
            </>
          )}
        </div>

        {/* Findings */}
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-foreground">{fw.findings}</span>
          {fw.criticalFindings > 0 && (
            <span className="ml-1 rounded-full bg-[#EA0022]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#EA0022]">
              {fw.criticalFindings} crit
            </span>
          )}
        </div>

        {/* Last assessed */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs whitespace-nowrap">{timeAgo(fw.lastAssessed)}</span>
        </div>

        {/* Status + source badges */}
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full shrink-0 ${statusDotColor(fw.status)}`}
          />
          <span className="text-xs text-muted-foreground">{statusLabel(fw.status)}</span>
          <SourceBadges fw={fw} />
        </div>

        {/* Upload button */}
        <div className="hidden lg:flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex h-7 items-center gap-1 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-background/60 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-[#2006F7]/30 hover:bg-[#2006F7]/[0.04] transition-colors"
            title="Upload HTML or entities.xml config"
          >
            <Upload className="h-3 w-3" />
            Assess
          </button>
        </div>

        {/* Chevron */}
        <div className="hidden lg:flex items-center justify-end">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${isSelected ? "rotate-90 text-brand-accent" : "text-muted-foreground/40 group-hover:text-brand-accent"}`}
          />
        </div>
      </div>
    </div>
  );
}

type FleetSort = "hostname" | "score_desc" | "score_asc" | "last_assessed" | "customer";

function sortFleetFirewalls(list: FleetFirewall[], sort: FleetSort): FleetFirewall[] {
  const out = [...list];
  const lastTs = (f: FleetFirewall) => (f.lastAssessed ? new Date(f.lastAssessed).getTime() : 0);
  switch (sort) {
    case "score_desc":
      out.sort((a, b) => b.score - a.score || a.hostname.localeCompare(b.hostname));
      break;
    case "score_asc":
      out.sort((a, b) => a.score - b.score || a.hostname.localeCompare(b.hostname));
      break;
    case "last_assessed":
      out.sort((a, b) => lastTs(b) - lastTs(a) || a.hostname.localeCompare(b.hostname));
      break;
    case "customer":
      out.sort(
        (a, b) => a.customer.localeCompare(b.customer) || a.hostname.localeCompare(b.hostname),
      );
      break;
    default:
      out.sort((a, b) => a.hostname.localeCompare(b.hostname));
  }
  return out;
}

/** Demo fleet is only for unauthenticated guest preview — never substitute for a failed org query. */
function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadFleetCsv(rows: FleetFirewall[], filenameHint: string) {
  const header = [
    "hostname",
    "customer",
    "tenant",
    "grade",
    "score",
    "status",
    "critical_findings",
    "findings",
    "config_linked",
    "model",
    "serial",
    "last_assessed",
  ];
  const lines = [
    header.join(","),
    ...rows.map((f) =>
      [
        escapeCsvCell(f.hostname),
        escapeCsvCell(f.customer),
        escapeCsvCell(f.tenantName ?? ""),
        escapeCsvCell(f.grade),
        escapeCsvCell(f.score),
        escapeCsvCell(f.status),
        escapeCsvCell(f.criticalFindings),
        escapeCsvCell(f.findings),
        escapeCsvCell(f.configLinked ? "yes" : "no"),
        escapeCsvCell(f.model),
        escapeCsvCell(f.serialNumber),
        escapeCsvCell(f.lastAssessed ?? ""),
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameHint;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Fleet CSV downloaded");
}

function fleetBundleErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return "Could not load fleet data from the server.";
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

function FleetCommandInner() {
  const { org, isGuest, isViewerOnly } = useAuth();
  const isDark = useResolvedIsDark();
  const [searchParams] = useSearchParams();

  const fleetQuery = useFleetCommandQuery(org?.id, org?.name);
  const baseFleet = useMemo(() => {
    if (!org?.id) return isGuest ? DEMO_FLEET : [];
    if (fleetQuery.isError) return [];
    return fleetQuery.data ?? [];
  }, [org?.id, isGuest, fleetQuery.isError, fleetQuery.data]);

  const fleetLoadFailed = Boolean(org?.id && fleetQuery.isError);

  const [fleet, setFleet] = useState<FleetFirewall[]>([]);
  useEffect(() => {
    setFleet(baseFleet);
  }, [baseFleet]);

  const loading = Boolean(org?.id) && fleetQuery.isPending;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [gradeFilter, setGradeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [fleetSort, setFleetSort] = useState<FleetSort>("hostname");
  const [linkingFilter, setLinkingFilter] = useState<"all" | "linked" | "unlinked">("all");
  /** One-click slices on top of grade/status/link filters. */
  const [fleetSpotlight, setFleetSpotlight] = useState<null | "attention" | "weak">(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** List view: tenant groups start collapsed; names here are expanded after user toggles. */
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const urlSearchHint = searchParams.get("customer")?.trim() || searchParams.get("q")?.trim() || "";
  useEffect(() => {
    if (urlSearchHint) setSearch(urlSearchHint);
  }, [urlSearchHint]);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if (e.key === "/" && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* ---- Drag-and-drop config analysis ---- */
  const handleDragOver = useCallback((e: React.DragEvent, fwId: string) => {
    e.preventDefault();
    setDragOverId(fwId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, fwId: string) => {
      e.preventDefault();
      setDragOverId(null);
      const file = e.dataTransfer.files[0];
      if (!file || !file.name.match(/\.(html|htm|xml)$/i)) return;
      setAnalyzingId(fwId);
      try {
        const text = await file.text();
        const isXml = /\.xml$/i.test(file.name);
        let result;
        if (isXml) {
          const rawConfig = parseEntitiesXml(text);
          const sections = rawConfigToSections(rawConfig);
          result = analyseConfig(sections);
        } else {
          const sections = await extractSections(text);
          result = analyseConfig(sections);
        }
        const riskScore = computeRiskScore(result);
        const targetFw = fleet.find((f) => f.id === fwId);

        setFleet((prev) =>
          prev.map((fw) =>
            fw.id === fwId
              ? {
                  ...fw,
                  score: riskScore.overall,
                  grade: riskScore.grade,
                  findings: result.findings.length,
                  criticalFindings: result.findings.filter((f) => f.severity === "critical").length,
                  lastAssessed: new Date().toISOString(),
                }
              : fw,
          ),
        );

        if (org?.id && targetFw) {
          saveScoreSnapshot(
            org.id,
            targetFw.hostname,
            targetFw.customer,
            riskScore.overall,
            riskScore.grade,
            riskScore.categories.map((c) => ({ label: c.label, score: c.pct })),
            result.findings.length,
          ).catch((err) => console.warn("[FleetCommand] save snapshot failed", err));
        }
      } catch (err) {
        console.warn("[FleetCommand] analysis failed", err);
      } finally {
        setAnalyzingId(null);
      }
    },
    [fleet, org?.id],
  );

  const handleFileUpload = useCallback(
    (file: File, fwId: string) => {
      if (!file.name.match(/\.(html|htm|xml)$/i)) return;
      const syntheticDt = { files: [file] } as unknown as DataTransfer;
      const syntheticEvent = {
        preventDefault: () => {},
        dataTransfer: syntheticDt,
      } as unknown as React.DragEvent;
      handleDrop(syntheticEvent, fwId);
    },
    [handleDrop],
  );

  /* ---- Computed stats ---- */
  const filtered = useMemo(() => {
    let list = fleet;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (f) =>
          f.hostname.toLowerCase().includes(q) ||
          f.customer.toLowerCase().includes(q) ||
          f.model.toLowerCase().includes(q) ||
          (f.tenantName?.toLowerCase().includes(q) ?? false),
      );
    }
    if (gradeFilter !== "All") {
      list = list.filter((f) => f.grade === gradeFilter);
    }
    if (statusFilter !== "All") {
      list = list.filter((f) => f.status === statusFilter.toLowerCase());
    }
    if (linkingFilter === "linked") list = list.filter((f) => f.configLinked);
    if (linkingFilter === "unlinked") list = list.filter((f) => !f.configLinked);
    if (fleetSpotlight === "attention") {
      list = list.filter(
        (f) =>
          f.criticalFindings > 0 ||
          f.status === "offline" ||
          f.status === "stale" ||
          f.status === "suspended",
      );
    }
    if (fleetSpotlight === "weak") {
      list = list.filter((f) => f.grade === "C" || f.grade === "D" || f.grade === "F");
    }
    return list;
  }, [fleet, debouncedSearch, gradeFilter, statusFilter, linkingFilter, fleetSpotlight]);

  const fleetMapSites = useMemo(() => buildFleetMapSites(filtered), [filtered]);

  const tenantGroups = useMemo(() => {
    const groups = new Map<string, FleetFirewall[]>();
    const orgName = org?.name ?? "";
    for (const fw of filtered) {
      const gkey = fleetCommandGroupKey(fw);
      const arr = groups.get(gkey) ?? [];
      arr.push(fw);
      groups.set(gkey, arr);
    }
    function titleFor(first: FleetFirewall): string {
      if (first.tenantId && first.tenantName) return first.tenantName;
      if (first.source === "agent") {
        const b = first.agentCustomerBucketKey ?? UNASSIGNED_AGENT_GROUP;
        return b === UNASSIGNED_AGENT_GROUP
          ? "Unassigned agents"
          : agentCustomerGroupTitle(b, orgName);
      }
      return first.tenantName ?? first.customer ?? "Unknown";
    }
    return [...groups.entries()]
      .map(([key, firewalls]) => ({
        key,
        name: titleFor(firewalls[0]),
        firewalls: sortFleetFirewalls(firewalls, fleetSort),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered, org?.name, fleetSort]);

  const siteCount = useMemo(() => {
    const s = new Set<string>();
    for (const f of fleet) s.add(fleetCommandGroupKey(f));
    return s.size;
  }, [fleet]);

  const totalFirewalls = fleet.length;
  const avgScore = fleet.length
    ? Math.round(fleet.reduce((s, f) => s + f.score, 0) / fleet.length)
    : 0;
  const avgGrade = gradeFromScore(avgScore);
  const totalCritical = fleet.reduce((s, f) => s + f.criticalFindings, 0);
  const licenceAlerts = fleet.filter((f) => f.status === "offline" || f.status === "stale").length;

  const GRADES = ["All", "A", "B", "C", "D", "F"] as const;
  const STATUSES = ["All", "Online", "Offline", "Suspended", "Stale"] as const;

  const toggleTenant = useCallback((name: string) => {
    setExpandedTenants((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  /* ---- Render ---- */
  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader
        loginShell={isGuest}
        headerActions={
          <>
            {isGuest ? (
              <span className="rounded-full bg-[#F29400]/10 px-2 py-0.5 text-[10px] font-bold text-[#F29400] shrink-0">
                Guest
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/18 transition-colors shrink-0"
              aria-label="Help"
              title="Help — status indicators & features"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </>
        }
      />

      <WorkspacePrimaryNav />

      {/* ── Help overlay ── */}
      {showHelp && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHelp(false)}
          />
          <div className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-lg rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.08] bg-background text-foreground shadow-2xl overflow-hidden">
            <div
              className="flex items-center justify-between px-6 py-4 border-b border-border/50"
              style={{
                background: "linear-gradient(90deg, #00163d 0%, #001A47 42%, #10037C 100%)",
              }}
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-[#00EDFF]" />
                <h3 className="text-sm font-display font-black text-white">Fleet Command Guide</h3>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto text-sm">
              <div>
                <h4 className="font-display font-bold text-foreground mb-2">Status Indicators</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#00F2B3] shrink-0" />
                    <div>
                      <span className="font-semibold">Online</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — Connected to Sophos Central and reporting. Active management.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EA0022] shrink-0" />
                    <div>
                      <span className="font-semibold">Offline</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — Not connected to Central. Registration is active but the firewall is
                        unreachable.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#9333EA] shrink-0" />
                    <div>
                      <span className="font-semibold">Suspended</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — Central management registration suspended. Typically means the firewall
                        was deregistered, its licence expired, or it was decommissioned but not
                        removed from Central.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F29400] shrink-0" />
                    <div>
                      <span className="font-semibold">Stale</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — Connected but last sync was more than 24 hours ago. May indicate a
                        connectivity issue.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-4">
                <h4 className="font-display font-bold text-foreground mb-2">Source Badges</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-[#2006F7]/10 text-[#2006F7] dark:text-[#009CFB] shrink-0">
                      Central
                    </span>
                    <span className="text-muted-foreground">
                      Firewall discovered via Sophos Central API.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3] shrink-0">
                      Agent
                    </span>
                    <span className="text-muted-foreground">
                      FireComply connector agent is deployed and reporting.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B47AFF] shrink-0">
                      Linked
                    </span>
                    <span className="text-muted-foreground">
                      An uploaded config file has been linked to this Central firewall.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-[#009CFB]/15 text-[#009CFB] shrink-0">
                      HA
                    </span>
                    <span className="text-muted-foreground">
                      High Availability pair — two firewalls in an active-passive cluster, shown as
                      one entry.
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-4">
                <h4 className="font-display font-bold text-foreground mb-2">
                  Drag &amp; Drop Assessment
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Drop an <strong className="text-foreground">HTML config export</strong> or{" "}
                  <strong className="text-foreground">entities.xml</strong> file onto any firewall
                  card to run an instant security assessment. The score updates in-place and is
                  saved to your score history.
                </p>
              </div>

              <div className="border-t border-border/50 pt-4">
                <h4 className="font-display font-bold text-foreground mb-2">Tenant Grouping</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Firewalls are grouped by Sophos Central tenant, or by agent customer bucket when
                  there is no tenant link. Click a header to collapse or expand. Use{" "}
                  <strong className="text-foreground">Customer defaults</strong> on that row for
                  default country and sector; expand a firewall to override country per site.
                </p>
              </div>

              <div className="border-t border-border/50 pt-4">
                <h4 className="font-display font-bold text-foreground mb-2">Keyboard shortcuts</h4>
                <ul className="space-y-1.5 text-muted-foreground text-sm list-disc pl-4">
                  <li>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      /
                    </kbd>{" "}
                    — Focus fleet search (when you are not typing in a field).
                  </li>
                  <li>
                    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      Esc
                    </kbd>{" "}
                    — Clear the search box and blur it.
                  </li>
                </ul>
              </div>

              <div className="border-t border-border/50 pt-4">
                <h4 className="font-display font-bold text-foreground mb-2">Deep links</h4>
                <p className="text-muted-foreground leading-relaxed">
                  Pre-fill the fleet search from the URL:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    ?customer=
                  </code>{" "}
                  (customer or tenant label) or{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">?q=</code>{" "}
                  (free text). Customer directory cards link here with{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    /command?customer=…
                  </code>
                  .
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Body ── */}
      <main
        className="mx-auto max-w-[1440px] px-4 sm:px-6 pt-6 space-y-6 assist-chrome-pad-bottom"
        data-tour="tour-page-fleet"
      >
        {org?.id && !isGuest && (
          <div className="space-y-3" data-tour="tour-fleet-settings">
            <WorkspaceSettingsStrip variant="fleet" />
          </div>
        )}

        <div
          className="flex flex-wrap gap-2 rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] px-3 py-2.5 text-[11px]"
          style={glassCard(isDark)}
          data-tour="tour-fleet-jump"
        >
          <span className="text-muted-foreground font-medium self-center mr-1">Jump:</span>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" asChild>
            <Link to="/">
              <Shield className="h-3 w-3" />
              Assess
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" asChild>
            <Link to="/customers">
              <Users className="h-3 w-3" />
              Customers
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" asChild>
            <Link to="/central/overview">
              <Cloud className="h-3 w-3" />
              Central
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" asChild>
            <Link to="/reports">
              <FileText className="h-3 w-3" />
              Reports
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" asChild>
            <Link to="/insights">
              <BarChart3 className="h-3 w-3" />
              Insights
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" asChild>
            <Link to="/drift">
              <GitCompare className="h-3 w-3" />
              Drift
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px]" asChild>
            <Link to="/api">
              <Activity className="h-3 w-3" />
              API
            </Link>
          </Button>
        </div>

        {/* ── Stat cards ── */}
        <div
          className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
          data-tour="tour-fleet-stats"
        >
          <StatCard
            icon={Monitor}
            label="Total Firewalls"
            value={totalFirewalls}
            sub={`${fleet.filter((f) => f.status === "online").length} online`}
            accent="#2006F7"
            isDark={isDark}
          />
          <StatCard
            icon={Activity}
            label="Average Score"
            value={avgScore}
            sub={`Fleet grade: ${avgGrade}`}
            accent={gradeColor(avgGrade)}
            isDark={isDark}
          />
          <StatCard
            icon={AlertTriangle}
            label="Critical Findings"
            value={totalCritical}
            sub="Across entire fleet"
            accent="#EA0022"
            isDark={isDark}
          />
          <StatCard
            icon={Wifi}
            label="Licence Alerts"
            value={licenceAlerts}
            sub={licenceAlerts === 0 ? "All clear" : `${licenceAlerts} need attention`}
            accent={licenceAlerts > 0 ? "#F29400" : "#00F2B3"}
            isDark={isDark}
          />
          <StatCard
            icon={Users}
            label="Customer sites"
            value={siteCount}
            sub="Tenant / agent groups"
            accent="#009CFB"
            isDark={isDark}
          />
        </div>

        {/* ── Drag hint ── */}
        <div
          className="flex items-center gap-2 text-[11px] text-muted-foreground px-1"
          data-tour="tour-fleet-drop-hint"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>
            Drop a Sophos config export (.html) onto any firewall card to analyse it instantly
          </span>
        </div>

        <Tabs defaultValue="list" className="w-full space-y-4" data-tour="tour-fleet-tabs">
          <TabsList className="grid h-auto w-full max-w-md grid-cols-2 gap-1 bg-muted/30 p-1">
            <TabsTrigger value="list" className="gap-1.5 text-xs sm:text-sm">
              <List className="h-3.5 w-3.5 shrink-0" />
              Fleet list
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5 text-xs sm:text-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Map
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-0 space-y-4 focus-visible:outline-none">
            {/* ── Filter bar ── */}
            <div
              className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm p-3 sm:p-4"
              style={glassCard(isDark)}
              data-tour="tour-fleet-filters"
            >
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search hostname, customer, model, tenant… (press / to focus)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearch("");
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="h-9 w-full rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-background/60 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                  />
                </div>

                {/* Grade filter */}
                <div className="flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGradeFilter(g)}
                      className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                        gradeFilter === g
                          ? "bg-[#2006F7] text-white"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                        statusFilter === s
                          ? "bg-[#2006F7] text-white"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-0.5 ml-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${viewMode === "list" ? "text-[#2006F7]" : "text-muted-foreground"}`}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${viewMode === "grid" ? "text-[#2006F7]" : "text-muted-foreground"}`}
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] pt-3">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Sort
                  </Label>
                  <Select value={fleetSort} onValueChange={(v) => setFleetSort(v as FleetSort)}>
                    <SelectTrigger className="h-8 w-[200px] text-xs bg-background/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hostname">Hostname (A–Z)</SelectItem>
                      <SelectItem value="customer">Customer, then hostname</SelectItem>
                      <SelectItem value="score_desc">Score (high → low)</SelectItem>
                      <SelectItem value="score_asc">Score (low → high)</SelectItem>
                      <SelectItem value="last_assessed">Last assessed (recent first)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Config link
                  </Label>
                  <Select
                    value={linkingFilter}
                    onValueChange={(v) => setLinkingFilter(v as "all" | "linked" | "unlinked")}
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs bg-background/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All firewalls</SelectItem>
                      <SelectItem value="linked">Linked to upload</SelectItem>
                      <SelectItem value="unlinked">Not linked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-[10px]"
                    onClick={() => setExpandedTenants(new Set(tenantGroups.map((g) => g.key)))}
                    disabled={tenantGroups.length === 0}
                  >
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                    Expand all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-[10px]"
                    onClick={() => setExpandedTenants(new Set())}
                    disabled={tenantGroups.length === 0}
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    Collapse all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-[10px]"
                    disabled={filtered.length === 0}
                    onClick={() =>
                      downloadFleetCsv(
                        filtered,
                        `fleet-command-${new Date().toISOString().slice(0, 10)}.csv`,
                      )
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-900/[0.06] dark:border-white/[0.06] pt-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
                  Spotlight
                </span>
                <button
                  type="button"
                  onClick={() => setFleetSpotlight((s) => (s === "attention" ? null : "attention"))}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                    fleetSpotlight === "attention"
                      ? "border-[#EA0022]/40 bg-[#EA0022]/12 text-[#EA0022] shadow-[0_0_0_1px_rgba(234,0,34,0.15)]"
                      : "border-slate-900/[0.08] bg-background/50 text-muted-foreground hover:text-foreground dark:border-white/[0.08]"
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Needs attention
                </button>
                <button
                  type="button"
                  onClick={() => setFleetSpotlight((s) => (s === "weak" ? null : "weak"))}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                    fleetSpotlight === "weak"
                      ? "border-[#F29400]/45 bg-[#F29400]/12 text-[#F29400]"
                      : "border-slate-900/[0.08] bg-background/50 text-muted-foreground hover:text-foreground dark:border-white/[0.08]"
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  Weak scores (C–F)
                </button>
                {fleetSpotlight ? (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    onClick={() => setFleetSpotlight(null)}
                  >
                    Clear spotlight
                  </button>
                ) : null}
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                  Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
                  {fleet.length} firewall{fleet.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* ── Fleet list ── */}
            <div className="space-y-4" data-tour="tour-fleet-list">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
                </div>
              ) : fleetLoadFailed ? (
                <Alert variant="destructive" className="border-destructive/40">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Could not load your fleet</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p className="text-sm opacity-90">
                      {fleetQuery.error ? fleetBundleErrorMessage(fleetQuery.error) : null} This is
                      not sample data — the request failed. Common causes: network issues, or the
                      database is missing a recent migration (run{" "}
                      <code className="rounded bg-background/80 px-1 py-0.5 text-xs">
                        supabase db push
                      </code>{" "}
                      for self-hosted schema).
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-destructive/40"
                      onClick={() => void fleetQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : filtered.length === 0 && fleet.length === 0 ? (
                <div
                  className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm"
                  style={glassCard(isDark)}
                >
                  <EmptyState
                    className="py-14 px-6"
                    icon={<WifiOff className="h-6 w-6 text-[#2006F7]" />}
                    title="No firewalls discovered yet"
                    description="Connect Sophos Central or deploy the connector agent to start monitoring your fleet."
                    action={
                      <Button className="bg-[#2006F7] hover:bg-[#2006F7]/90 text-white" asChild>
                        <Link to="/">Get started</Link>
                      </Button>
                    }
                  />
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  className="py-14"
                  icon={<Search className="h-6 w-6 text-muted-foreground" />}
                  title="No matches"
                  description="No firewalls match your current filters."
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[#2006F7]"
                      onClick={() => {
                        setSearch("");
                        setGradeFilter("All");
                        setStatusFilter("All");
                        setFleetSort("hostname");
                        setLinkingFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : viewMode === "list" ? (
                <div className="space-y-2">
                  {/* Column headers (lg+ only) */}
                  <div className="hidden lg:grid lg:grid-cols-[2fr_1.2fr_auto_auto_auto_auto_auto] items-center gap-4 px-4 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Firewall
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Model / Firmware
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Score
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Findings
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Last Assessed
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Status
                    </span>
                    <span />
                  </div>

                  {/* Tenant groups */}
                  {tenantGroups.map((group) => {
                    const avg = group.firewalls.length
                      ? Math.round(
                          group.firewalls.reduce((s, f) => s + f.score, 0) / group.firewalls.length,
                        )
                      : 0;
                    const isCollapsed = !expandedTenants.has(group.key);
                    const readOnlyFleet = isGuest || isViewerOnly || !org?.id;

                    return (
                      <div key={group.key} className="space-y-2">
                        <FleetCustomerGroupHeader
                          name={group.name}
                          count={group.firewalls.length}
                          avgScore={avg}
                          collapsed={isCollapsed}
                          onToggle={() => toggleTenant(group.key)}
                          isDark={isDark}
                          orgId={org?.id}
                          readOnly={readOnlyFleet}
                          sampleFw={group.firewalls[0]}
                        />
                        {!isCollapsed &&
                          group.firewalls.map((fw) => (
                            <div key={fw.id} className="space-y-2">
                              <FleetCard
                                fw={fw}
                                isDark={isDark}
                                isSelected={selectedId === fw.id}
                                onSelect={toggleSelected}
                                dragOverId={dragOverId}
                                analyzingId={analyzingId}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onFileUpload={handleFileUpload}
                              />
                              {selectedId === fw.id && (
                                <DetailPanel
                                  fw={fw}
                                  isDark={isDark}
                                  orgId={org?.id}
                                  isGuest={isGuest}
                                  isViewerOnly={isViewerOnly}
                                />
                              )}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-8">
                  {tenantGroups.map((group) => {
                    const avg = group.firewalls.length
                      ? Math.round(
                          group.firewalls.reduce((s, f) => s + f.score, 0) / group.firewalls.length,
                        )
                      : 0;
                    const isCollapsed = !expandedTenants.has(group.key);
                    const readOnlyFleet = isGuest || isViewerOnly || !org?.id;
                    return (
                      <div key={group.key} className="space-y-4">
                        <FleetCustomerGroupHeader
                          name={group.name}
                          count={group.firewalls.length}
                          avgScore={avg}
                          collapsed={isCollapsed}
                          onToggle={() => toggleTenant(group.key)}
                          isDark={isDark}
                          orgId={org?.id}
                          readOnly={readOnlyFleet}
                          sampleFw={group.firewalls[0]}
                        />
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {group.firewalls.map((fw) => (
                              <div
                                key={fw.id}
                                className={`group rounded-2xl backdrop-blur-sm p-5 transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-brand-accent/5 cursor-pointer relative ${
                                  dragOverId === fw.id
                                    ? "border-[#2006F7] border-dashed border-2"
                                    : "border border-slate-900/[0.10] dark:border-white/[0.06]"
                                }`}
                                style={glassCard(isDark)}
                                onClick={() => toggleSelected(fw.id)}
                                onDragOver={(e) => handleDragOver(e, fw.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, fw.id)}
                              >
                                {analyzingId === fw.id && (
                                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm">
                                    <Loader2 className="h-5 w-5 animate-spin text-[#2006F7]" />
                                  </div>
                                )}

                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/[0.08]">
                                      <Server className="h-4 w-4 text-brand-accent" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-foreground truncate">
                                        {fw.hostname}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {fw.customer}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                    <span
                                      className={`inline-block h-2 w-2 rounded-full ${statusDotColor(fw.status)}`}
                                    />
                                    <span className="text-[10px] text-muted-foreground">
                                      {statusLabel(fw.status)}
                                    </span>
                                    <SourceBadges fw={fw} />
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                  {fw.grade === "—" ? (
                                    <div className="text-sm text-muted-foreground py-3">
                                      Not assessed — drop a config to score
                                    </div>
                                  ) : (
                                    <>
                                      <ScoreRing score={fw.score} grade={fw.grade} />
                                      <div>
                                        <p className="text-2xl font-display font-black text-foreground leading-none">
                                          {fw.score}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                          {fw.findings} findings
                                          {fw.criticalFindings > 0 && (
                                            <span className="text-[#EA0022] font-semibold">
                                              {" "}
                                              · {fw.criticalFindings} critical
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-slate-900/[0.06] dark:border-white/[0.04] pt-3">
                                  <span className="truncate">{fw.model}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <GridUploadButton
                                      fwId={fw.id}
                                      onFileUpload={handleFileUpload}
                                    />
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {timeAgo(fw.lastAssessed)}
                                    </span>
                                  </div>
                                </div>

                                {selectedId === fw.id && (
                                  <div
                                    className="mt-4 pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.04]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <DetailPanel
                                      fw={fw}
                                      isDark={isDark}
                                      orgId={org?.id}
                                      isGuest={isGuest}
                                      isViewerOnly={isViewerOnly}
                                      variant="embedded"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Footer count ── */}
              {!loading && filtered.length > 0 && (
                <p className="text-center text-xs text-muted-foreground pt-2 pb-6">
                  Showing {filtered.length} of {fleet.length} firewalls
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="map" className="mt-0 focus-visible:outline-none">
            <div data-tour="tour-fleet-map">
              <FleetWorldMap sites={fleetMapSites} loading={loading} isGuestView={isGuest} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function FleetCommand() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <FleetCommandInner />
    </AuthProvider>
  );
}

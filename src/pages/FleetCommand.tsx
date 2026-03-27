import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
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
  Sun,
  Moon,
  ExternalLink,
  FileText,
  Loader2,
  Upload,
  HelpCircle,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { extractSections } from "@/lib/extract-sections";
import { analyseConfig } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { parseEntitiesXml } from "@/lib/parse-entities-xml";
import { rawConfigToSections } from "@/lib/raw-config-to-sections";
import { saveScoreSnapshot } from "@/lib/score-history";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface FleetFirewall {
  id: string;
  hostname: string;
  customer: string;
  score: number;
  grade: string;
  findings: number;
  criticalFindings: number;
  lastAssessed: string | null;
  status: "online" | "offline" | "stale" | "suspended";
  firmware: string;
  model: string;
  serialNumber: string;
  haRole?: string;
  haClusterId?: string;
  tenantId?: string;
  tenantName?: string;
  source: "central" | "agent" | "both";
  configLinked: boolean;
  latestReportId?: string;
  latestReportDate?: string;
}

/* ------------------------------------------------------------------ */
/*  Demo data                                                         */
/* ------------------------------------------------------------------ */

const DEMO_FLEET: FleetFirewall[] = [
  {
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
  },
  {
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

function gradeFromScore(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

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
  if (!ts) return "Never";
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
    <>
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
    </>
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

function DetailPanel({ fw, isDark }: { fw: FleetFirewall; isDark: boolean }) {
  return (
    <div
      className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm ml-8 p-5 space-y-4 animate-in slide-in-from-top-2 duration-200"
      style={glassCard(isDark)}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score ring */}
        <div className="flex items-center gap-4">
          <ScoreRing score={fw.score} grade={fw.grade} size={80} />
          <div>
            <p className="text-3xl font-display font-black text-foreground leading-none">
              {fw.score}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {fw.findings} findings · {fw.criticalFindings} critical
            </p>
          </div>
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

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
              <Shield className="h-3.5 w-3.5" /> View Assessment
            </Button>
          </Link>
          {fw.latestReportId && (
            <Link to={`/shared/${fw.latestReportId}`}>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                <FileText className="h-3.5 w-3.5" /> Latest Report
              </Button>
            </Link>
          )}
          <a href="https://central.sophos.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
              <ExternalLink className="h-3.5 w-3.5" /> View in Central
            </Button>
          </a>
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
          <span className="text-lg font-display font-black text-foreground">{fw.score}</span>
          <GradeBadge grade={fw.grade} />
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

/* ------------------------------------------------------------------ */
/*  Tenant group header                                               */
/* ------------------------------------------------------------------ */

function TenantHeader({
  name,
  count,
  avgScore,
  collapsed,
  onToggle,
  isDark,
}: {
  name: string;
  count: number;
  avgScore: number;
  collapsed: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  const grade = gradeFromScore(avgScore);
  return (
    <button
      onClick={onToggle}
      className="w-full rounded-xl border border-slate-900/[0.06] dark:border-white/[0.04] backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 transition-colors hover:bg-muted/20"
      style={glassCard(isDark)}
    >
      <ChevronDown
        className={`h-4 w-4 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`}
      />
      <span className="text-sm font-display font-bold text-foreground">{name}</span>
      <span className="text-[11px] text-muted-foreground">
        {count} firewall{count !== 1 ? "s" : ""}
      </span>
      <span
        className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{ background: `${gradeColor(grade)}18`, color: gradeColor(grade) }}
      >
        avg {avgScore}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

function FleetCommandInner() {
  const { org, isGuest } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [fleet, setFleet] = useState<FleetFirewall[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedTenants, setCollapsedTenants] = useState<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  /* ---- Load real data, fall back to demo ---- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!org?.id) {
        if (isGuest) setFleet(DEMO_FLEET);
        else setFleet([]);
        setLoading(false);
        return;
      }

      try {
        const [fwRes, assessRes, agentRes, linksRes, tenantRes, reportsRes] = await Promise.all([
          supabase.from("central_firewalls").select("*").eq("org_id", org.id),
          supabase
            .from("assessments")
            .select("*")
            .eq("org_id", org.id)
            .order("created_at", { ascending: false }),
          supabase.from("agents").select("*").eq("org_id", org.id),
          supabase.from("firewall_config_links").select("*").eq("org_id", org.id),
          supabase.from("central_tenants").select("*").eq("org_id", org.id),
          supabase
            .from("saved_reports")
            .select("id, customer_name, created_at")
            .eq("org_id", org.id)
            .order("created_at", { ascending: false }),
        ]);

        if (cancelled) return;

        const firewalls = fwRes.data ?? [];
        const assessments = assessRes.data ?? [];
        const agents = agentRes.data ?? [];
        const links = linksRes.data ?? [];
        const tenants = tenantRes.data ?? [];
        const reports = reportsRes.data ?? [];

        // 1. configLinkMap: central_firewall_id → config_hostname
        const configLinkMap = new Map<string, string>();
        const configLinkedIds = new Set<string>();
        for (const link of links) {
          const fwId = (link as Record<string, unknown>).central_firewall_id as string | undefined;
          const hostname = (link as Record<string, unknown>).config_hostname as string | undefined;
          if (fwId && hostname) {
            configLinkMap.set(fwId, hostname);
            configLinkedIds.add(fwId);
          }
        }

        // 2. scoreByLabel from assessments.firewalls JSON
        const scoreByLabel = new Map<
          string,
          { score: number; grade: string; date: string; findings: number }
        >();
        for (const a of assessments) {
          const fws = a.firewalls as Array<{
            label?: string;
            hostname?: string;
            riskScore?: { overall: number; grade: string; categories?: unknown[] };
            totalFindings?: number;
            findingCount?: number;
          }> | null;
          if (fws) {
            for (const f of fws) {
              const label = f.label ?? f.hostname ?? a.customer_name;
              if (!scoreByLabel.has(label)) {
                scoreByLabel.set(label, {
                  score: f.riskScore?.overall ?? a.overall_score ?? 0,
                  grade:
                    f.riskScore?.grade ??
                    a.overall_grade ??
                    gradeFromScore(f.riskScore?.overall ?? 0),
                  date: a.created_at,
                  findings: f.totalFindings ?? f.findingCount ?? 0,
                });
              }
            }
          }
          if (!scoreByLabel.has(a.customer_name)) {
            scoreByLabel.set(a.customer_name, {
              score: a.overall_score ?? 0,
              grade: a.overall_grade ?? gradeFromScore(a.overall_score ?? 0),
              date: a.created_at,
              findings: 0,
            });
          }
        }

        // 5. tenantMap: central_tenant_id → name
        const tenantMap = new Map<string, string>();
        for (const t of tenants) {
          const tid = (t as Record<string, unknown>).central_tenant_id as string;
          const name = (t as Record<string, unknown>).name as string;
          if (tid && name) tenantMap.set(tid, name);
        }

        // 5b. agentScoreMap: hostname (no port) → { score, grade, findings, date }
        const agentScoreMap = new Map<
          string,
          { score: number; grade: string; date: string; findings: number }
        >();
        for (const ag of agents) {
          const host = (ag.firewall_host || ag.name || "").split(":")[0].toLowerCase();
          if (host && ag.last_score != null) {
            agentScoreMap.set(host, {
              score: ag.last_score,
              grade: ag.last_grade ?? gradeFromScore(ag.last_score),
              date: ag.last_seen_at ?? "",
              findings: 0,
            });
          }
        }

        // 6. latestReportMap: customer_name → {id, date} (first match = latest due to order)
        const latestReportMap = new Map<string, { id: string; date: string }>();
        for (const r of reports) {
          const cname = (r as Record<string, unknown>).customer_name as string;
          if (cname && !latestReportMap.has(cname)) {
            latestReportMap.set(cname, {
              id: (r as Record<string, unknown>).id as string,
              date: (r as Record<string, unknown>).created_at as string,
            });
          }
        }

        const mapped: FleetFirewall[] = [];
        const seenHostnames = new Set<string>();
        const clusterMembers = new Map<string, typeof firewalls>();

        for (const fw of firewalls) {
          const cluster = fw.cluster_json as { id?: string; mode?: string; status?: string } | null;
          if (cluster?.id) {
            const arr = clusterMembers.get(cluster.id) ?? [];
            arr.push(fw);
            clusterMembers.set(cluster.id, arr);
          }
        }

        const processedClusterIds = new Set<string>();
        const agentHostnames = new Set(
          agents.map((a) => (a.firewall_host || a.name || "").split(":")[0].toLowerCase()),
        );

        for (const fw of firewalls) {
          const hn = fw.hostname || fw.name;
          const cluster = fw.cluster_json as { id?: string; mode?: string; status?: string } | null;
          const fwTenantId = fw.central_tenant_id as string | undefined;
          const rawTenantName = fwTenantId ? tenantMap.get(fwTenantId) : undefined;
          const fwTenantName =
            rawTenantName === "(This tenant)" ? (org?.name ?? rawTenantName) : rawTenantName;

          if (cluster?.id && clusterMembers.get(cluster.id)!.length > 1) {
            if (processedClusterIds.has(cluster.id)) continue;
            processedClusterIds.add(cluster.id);
            const peers = clusterMembers.get(cluster.id)!;
            const primary = peers[0];
            const primaryHn = primary.hostname || primary.name;
            const peerNames = peers.map((p) => p.hostname || p.name);
            seenHostnames.add(primaryHn.toLowerCase());
            for (const p of peers) seenHostnames.add((p.hostname || p.name).toLowerCase());

            // 3. look up score via configLinkMap → scoreByLabel → agentScoreMap
            const configHostname = configLinkMap.get(primary.firewall_id);
            const match =
              (configHostname ? scoreByLabel.get(configHostname) : null) ??
              scoreByLabel.get(primaryHn) ??
              scoreByLabel.get(primary.name) ??
              agentScoreMap.get(primaryHn.toLowerCase());

            const anyOnline = peers.some((p) => {
              const sj = p.status_json as { connected?: boolean } | null;
              return sj?.connected;
            });
            const anySuspended = peers.some((p) => {
              const sj = p.status_json as { suspended?: boolean } | null;
              return sj?.suspended;
            });
            let status: "online" | "offline" | "stale" | "suspended" = anySuspended
              ? "suspended"
              : "offline";
            if (anyOnline) {
              const syncAge = Date.now() - new Date(primary.synced_at).getTime();
              status = syncAge > 24 * 3_600_000 ? "stale" : "online";
            }

            const isLinked = peers.some((p) => configLinkedIds.has(p.firewall_id));
            const hasAgent = peerNames.some((n) => agentHostnames.has(n.toLowerCase()));
            const report =
              latestReportMap.get(peerNames.join(" + ")) ?? latestReportMap.get(primaryHn);

            mapped.push({
              id: primary.id,
              hostname: `${primaryHn} (HA ${peers.length}-node)`,
              customer: peerNames.join(" + "),
              score: match?.score ?? 0,
              grade: match?.grade ?? gradeFromScore(match?.score ?? 0),
              findings: match?.findings ?? 0,
              criticalFindings: 0,
              lastAssessed: match?.date ?? primary.synced_at,
              status,
              firmware: primary.firmware_version,
              model: primary.model,
              serialNumber: peers.map((p) => p.serial_number).join(", "),
              haRole: (cluster.mode ?? "cluster").toUpperCase(),
              haClusterId: cluster.id,
              tenantId: fwTenantId,
              tenantName: fwTenantName,
              source: hasAgent ? "both" : "central",
              configLinked: isLinked,
              latestReportId: report?.id,
              latestReportDate: report?.date,
            });
            continue;
          }

          seenHostnames.add(hn.toLowerCase());

          // 3. look up score via configLinkMap → scoreByLabel → agentScoreMap
          const configHostname = configLinkMap.get(fw.firewall_id);
          const match =
            (configHostname ? scoreByLabel.get(configHostname) : null) ??
            scoreByLabel.get(hn) ??
            scoreByLabel.get(fw.name) ??
            agentScoreMap.get(hn.toLowerCase());

          const statusJson = fw.status_json as { connected?: boolean; suspended?: boolean } | null;
          let status: "online" | "offline" | "stale" | "suspended" = statusJson?.suspended
            ? "suspended"
            : "offline";
          if (statusJson?.connected) {
            const syncAge = Date.now() - new Date(fw.synced_at).getTime();
            status = syncAge > 24 * 3_600_000 ? "stale" : "online";
          }

          const hasAgent = agentHostnames.has(hn.toLowerCase());
          const report = latestReportMap.get(fw.name || hn) ?? latestReportMap.get(hn);

          mapped.push({
            id: fw.id,
            hostname: hn,
            customer: fw.name || fw.hostname,
            score: match?.score ?? 0,
            grade: match?.grade ?? gradeFromScore(match?.score ?? 0),
            findings: match?.findings ?? 0,
            criticalFindings: 0,
            lastAssessed: match?.date ?? fw.synced_at,
            status,
            firmware: fw.firmware_version,
            model: fw.model,
            serialNumber: fw.serial_number,
            tenantId: fwTenantId,
            tenantName: fwTenantName,
            source: hasAgent ? "both" : "central",
            configLinked: configLinkedIds.has(fw.firewall_id),
            latestReportId: report?.id,
            latestReportDate: report?.date,
          });
        }

        // 4. Agent-only firewalls
        for (const ag of agents) {
          const hn = ag.firewall_host || ag.name;
          if (seenHostnames.has(hn.toLowerCase())) continue;
          seenHostnames.add(hn.toLowerCase());
          let status: "online" | "offline" | "stale" | "suspended" = "offline";
          if (ag.status === "online") status = "online";
          else if (ag.last_seen_at) {
            const age = Date.now() - new Date(ag.last_seen_at).getTime();
            status = age > 24 * 3_600_000 ? "stale" : "online";
          }
          const report = latestReportMap.get(ag.customer_name || ag.name || hn);
          mapped.push({
            id: ag.id,
            hostname: hn,
            customer: ag.customer_name || ag.name,
            score: ag.last_score ?? 0,
            grade: ag.last_grade ?? gradeFromScore(ag.last_score ?? 0),
            findings: 0,
            criticalFindings: 0,
            lastAssessed: ag.last_seen_at,
            status,
            firmware: ag.firmware_version ?? "Unknown",
            model: ag.hardware_model ?? "Agent",
            serialNumber: ag.serial_number ?? "",
            source: "agent",
            configLinked: false,
            latestReportId: report?.id,
            latestReportDate: report?.date,
          });
        }

        setFleet(mapped.length > 0 ? mapped : []);
      } catch (err) {
        console.warn("[FleetCommand] data load failed, using demo", err);
        setFleet(DEMO_FLEET);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [org?.id, org?.name, isGuest]);

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
    if (search) {
      const q = search.toLowerCase();
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
    return list;
  }, [fleet, search, gradeFilter, statusFilter]);

  const tenantGroups = useMemo(() => {
    const groups = new Map<string, FleetFirewall[]>();
    for (const fw of filtered) {
      const key = fw.tenantName ?? "__agent__";
      const arr = groups.get(key) ?? [];
      arr.push(fw);
      groups.set(key, arr);
    }
    const sorted: Array<{ name: string; firewalls: FleetFirewall[] }> = [];
    for (const [name, firewalls] of groups) {
      if (name !== "__agent__") sorted.push({ name, firewalls });
    }
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    const agentGroup = groups.get("__agent__");
    if (agentGroup?.length) sorted.push({ name: "Unlinked / Agent", firewalls: agentGroup });
    return sorted;
  }, [filtered]);

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
    setCollapsedTenants((prev) => {
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
      {/* ── Header bar ── */}
      <header
        className="sticky top-0 z-40 w-full border-b border-white/[0.06]"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(0,237,255,0.10), transparent 18%), radial-gradient(circle at top right, rgba(32,6,247,0.20), transparent 24%), linear-gradient(90deg, #00163d 0%, #001A47 42%, #10037C 100%)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs hidden sm:inline">Home</span>
          </Link>

          <div className="mx-2 h-5 w-px bg-white/10" />

          <Shield className="h-5 w-5 text-[#00EDFF]" />
          <h1 className="text-base font-display font-black text-white tracking-tight">
            Fleet Command
          </h1>

          <span className="rounded-full border border-[#00EDFF]/15 bg-[#00EDFF]/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00EDFF] hidden sm:inline-block">
            MSP
          </span>

          <div className="ml-auto flex items-center gap-2">
            {org && <span className="text-xs text-white/50 hidden md:inline">{org.name}</span>}
            {isGuest && (
              <span className="rounded-full bg-[#F29400]/10 px-2 py-0.5 text-[10px] font-bold text-[#F29400]">
                Guest
              </span>
            )}
            <button
              onClick={() => setShowHelp(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Help"
              title="Help — status indicators & features"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

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
                  Firewalls are grouped by their Sophos Central tenant. Click a tenant header to
                  collapse or expand the group. Firewalls from the connector agent that aren&apos;t
                  linked to a Central tenant appear under &quot;Unlinked / Agent&quot;.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Body ── */}
      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 py-6 space-y-6">
        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>

        {/* ── Drag hint ── */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-1">
          <Upload className="h-3.5 w-3.5" />
          <span>
            Drop a Sophos config export (.html) onto any firewall card to analyse it instantly
          </span>
        </div>

        {/* ── Filter bar ── */}
        <div
          className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm p-3 sm:p-4"
          style={glassCard(isDark)}
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search hostname, customer, model, tenant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
        </div>

        {/* ── Fleet list ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
          </div>
        ) : filtered.length === 0 && fleet.length === 0 ? (
          <div
            className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm px-6 py-16 flex flex-col items-center text-center"
            style={glassCard(isDark)}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2006F7]/[0.08] mb-5">
              <WifiOff className="h-7 w-7 text-[#2006F7]" />
            </div>
            <h2 className="text-lg font-display font-black text-foreground mb-2">
              No firewalls discovered yet
            </h2>
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              Connect Sophos Central or deploy the connector agent to start monitoring your fleet.
            </p>
            <Link to="/">
              <Button className="mt-6 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white">
                Get started
              </Button>
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No firewalls match your current filters.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setGradeFilter("All");
                setStatusFilter("All");
              }}
              className="mt-2 text-xs text-[#2006F7] hover:underline"
            >
              Clear filters
            </button>
          </div>
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
              const isCollapsed = collapsedTenants.has(group.name);

              return (
                <div key={group.name} className="space-y-2">
                  <TenantHeader
                    name={group.name}
                    count={group.firewalls.length}
                    avgScore={avg}
                    collapsed={isCollapsed}
                    onToggle={() => toggleTenant(group.name)}
                    isDark={isDark}
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
                        {selectedId === fw.id && <DetailPanel fw={fw} isDark={isDark} />}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((fw) => (
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

                {/* Top: hostname + status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/[0.08]">
                      <Server className="h-4 w-4 text-brand-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {fw.hostname}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{fw.customer}</p>
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

                {/* Score ring */}
                <div className="flex items-center gap-4 mb-4">
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
                </div>

                {/* Meta row + upload */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-slate-900/[0.06] dark:border-white/[0.04] pt-3">
                  <span className="truncate">{fw.model}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <GridUploadButton fwId={fw.id} onFileUpload={handleFileUpload} />
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(fw.lastAssessed)}
                    </span>
                  </div>
                </div>

                {/* Detail panel (grid view) */}
                {selectedId === fw.id && (
                  <div className="mt-4 pt-4 border-t border-slate-900/[0.06] dark:border-white/[0.04] space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                      <div>
                        <p className="text-muted-foreground">Firmware</p>
                        <p className="text-foreground font-medium truncate">{fw.firmware}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Serial</p>
                        <p className="text-foreground font-medium truncate">
                          {fw.serialNumber || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">HA Role</p>
                        <p className="text-foreground font-medium">{fw.haRole ?? "None"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tenant</p>
                        <p className="text-foreground font-medium truncate">
                          {fw.tenantName ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Link to="/">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start gap-2 text-[11px] h-7"
                        >
                          <Shield className="h-3 w-3" /> View Assessment
                        </Button>
                      </Link>
                      {fw.latestReportId && (
                        <Link to={`/shared/${fw.latestReportId}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 text-[11px] h-7"
                          >
                            <FileText className="h-3 w-3" /> Latest Report
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Footer count ── */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-muted-foreground pt-2 pb-6">
            Showing {filtered.length} of {fleet.length} firewalls
          </p>
        )}
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

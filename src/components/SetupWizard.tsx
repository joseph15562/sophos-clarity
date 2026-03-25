import { useState, useMemo, lazy, Suspense } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  Wifi,
  Upload,
  Sparkles,
  Check,
  X,
  RotateCcw,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Settings,
  Eye,
  Download,
  MousePointerClick,
  ChevronDown,
  Shield,
  BarChart3,
  History,
  Users,
  Activity,
  ExternalLink,
  Plug,
  Key,
  RefreshCw,
  Bell,
  Globe,
  Lock,
  Fingerprint,
  Mail,
  Webhook,
  BookOpen,
  UserPlus,
  ShieldCheck,
  Wrench,
  ListChecks,
  Compass,
  GitCompare,
  Calendar,
  Layers,
  Trash2,
  Scale,
  Zap,
  Map,
  Package,
  ClipboardList,
  Play,
  ArrowLeftRight,
  Target,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrandingData } from "@/components/BrandingSetup";

const CentralIntegration = lazy(() =>
  import("@/components/CentralIntegration").then((m) => ({ default: m.CentralIntegration })),
);

const SETUP_KEY = "sophos-firecomply-setup-complete";

export function isSetupComplete(): boolean {
  try {
    return localStorage.getItem(SETUP_KEY) === "true";
  } catch (err) {
    console.warn("[isSetupComplete]", err);
    return false;
  }
}

export function markSetupComplete(): void {
  try {
    localStorage.setItem(SETUP_KEY, "true");
  } catch (err) {
    console.warn("[markSetupComplete]", err);
  }
}

export function resetSetupFlag(): void {
  try {
    localStorage.removeItem(SETUP_KEY);
  } catch (err) {
    console.warn("[resetSetupFlag]", err);
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  branding: BrandingData;
  onBrandingChange: (b: BrandingData) => void;
  orgName?: string;
  isGuest?: boolean;
}

type StepId =
  | "welcome"
  | "branding"
  | "central"
  | "connector-agent"
  | "guide-upload"
  | "guide-pre-ai"
  | "guide-ai-reports"
  | "guide-optimisation"
  | "guide-remediation"
  | "guide-tools"
  | "guide-management"
  | "guide-team-security"
  | "guide-portal-alerts"
  | "done";

interface Step {
  id: StepId;
  title: string;
  icon: typeof Building2;
}

const BASE_STEPS: Step[] = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "branding", title: "Branding", icon: Building2 },
  { id: "central", title: "Sophos Central", icon: Wifi },
  { id: "guide-upload", title: "Uploading Configs", icon: Upload },
  { id: "guide-pre-ai", title: "Pre-AI Assessment", icon: Shield },
  { id: "guide-ai-reports", title: "AI Reports", icon: Sparkles },
  { id: "guide-optimisation", title: "Optimisation", icon: Wrench },
  { id: "guide-remediation", title: "Remediation", icon: ListChecks },
  { id: "guide-tools", title: "Tools & Compare", icon: Compass },
  { id: "guide-management", title: "Management", icon: LayoutDashboard },
  { id: "guide-team-security", title: "Team & Security", icon: Users },
  { id: "guide-portal-alerts", title: "Portal & Alerts", icon: Globe },
  { id: "done", title: "Ready", icon: Check },
];

const AGENT_STEP: Step = { id: "connector-agent", title: "Connector Agent", icon: Plug };

function GuideStep({
  number,
  title,
  description,
  icon,
  color,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-3">
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#2006F7] text-white text-[9px] font-bold">
          {number}
        </span>
        <div className={`h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-muted/40 rounded w-3/4" />
      <div className="h-4 bg-muted/40 rounded w-1/2" />
      <div className="h-32 bg-muted/40 rounded" />
    </div>
  );
}

function SetupPreviewFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,255,0.96))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.14),transparent_35%),linear-gradient(180deg,rgba(13,18,32,0.96),rgba(10,15,28,0.96))] shadow-elevated overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00EDFF]" />
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
            Preview
          </p>
          <p className="text-sm font-semibold text-foreground mt-1">{title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/70 p-3">{children}</div>
      </div>
    </div>
  );
}

/* ── Overlay infrastructure ── */

function FeatureOverlay({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-150">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </div>
  );
}

function FeatureButton({
  icon,
  title,
  desc,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3 text-left hover:border-brand-accent/30 hover:bg-muted/30 transition-all group"
    >
      <div
        className={`h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 ${color} group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-foreground">{title}</p>
        <p className="text-[9px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-[#2006F7] transition-colors shrink-0" />
    </button>
  );
}

/* ── Mock UI components for overlays ── */

function MockGauge({ score, grade, color }: { score: number; grade: string; color: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        className="text-muted/20"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="46"
        textAnchor="middle"
        fill={color}
        fontSize="22"
        fontWeight="700"
        style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
      >
        {score}
      </text>
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fill={color}
        fontSize="10"
        fontWeight="600"
        style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
      >
        Grade {grade}
      </text>
    </svg>
  );
}

function MockRadar() {
  const labels = [
    "Web Filter",
    "IPS",
    "App Control",
    "Auth",
    "Logging",
    "Rule Hygiene",
    "Admin",
    "Anti-Malware",
  ];
  const cx = 90,
    cy = 90,
    r = 70;
  const points = labels.map((_, i) => {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const v = [0.0, 0.0, 1.0, 1.0, 1.0, 0.29, 1.0, 1.0][i];
    return {
      x: cx + r * v * Math.cos(angle),
      y: cy + r * v * Math.sin(angle),
      lx: cx + (r + 14) * Math.cos(angle),
      ly: cy + (r + 14) * Math.sin(angle),
      label: labels[i],
    };
  });
  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" className="mx-auto">
      {[1, 0.75, 0.5, 0.25].map((s) => (
        <polygon
          key={s}
          points={labels
            .map((_, i) => {
              const a = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
              return `${cx + r * s * Math.cos(a)},${cy + r * s * Math.sin(a)}`;
            })
            .join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-muted/30"
        />
      ))}
      <polygon
        points={polyPoints}
        fill="#2006F7"
        fillOpacity="0.15"
        stroke="#2006F7"
        strokeWidth="1.5"
      />
      {points.map((p, i) => (
        <text
          key={i}
          x={p.lx}
          y={p.ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="6"
          fill="currentColor"
          className="text-muted-foreground"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

function MockSeverityBar() {
  const items = [
    { label: "Critical", count: 3, color: "#EA0022", pct: 10 },
    { label: "High", count: 8, color: "#F29400", pct: 25 },
    { label: "Medium", count: 14, color: "#F8E300", pct: 44 },
    { label: "Low", count: 7, color: "#00F2B3", pct: 21 },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden">
        {items.map((s) => (
          <div key={s.label} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-lg font-bold" style={{ color: s.color }}>
              {s.count}
            </p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockInspectionPosture() {
  const stats = [
    { label: "TOTAL", value: "33" },
    { label: "WAN", value: "13" },
    { label: "DISABLED", value: "2" },
    { label: "NAT", value: "6" },
    { label: "HOSTS", value: "41" },
    { label: "INTERFACES", value: "18" },
  ];
  const coverage = [
    { label: "Web Filtering", pct: 0 },
    { label: "Intrusion Prevention", pct: 0 },
    { label: "App Control", pct: 0 },
    { label: "SSL/TLS Inspection", pct: 38 },
  ];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold text-foreground mb-2">Configuration Health</p>
        <div className="grid grid-cols-6 gap-1.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded border border-border bg-muted/20 p-1.5 text-center"
            >
              <p className="text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-[7px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-foreground mb-2">
          Feature Coverage <span className="font-normal text-muted-foreground">13 WAN rules</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {coverage.map((c) => (
            <div key={c.label} className="rounded border border-border bg-muted/20 p-2">
              <p className="text-[9px] text-muted-foreground mb-1">{c.label}</p>
              <p
                className={`text-lg font-bold ${c.pct === 0 ? "text-[#EA0022]" : "text-[#F29400]"}`}
              >
                {c.pct}%
              </p>
              <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${c.pct === 0 ? "bg-[#EA0022]" : "bg-[#F29400]"}`}
                  style={{ width: `${Math.max(c.pct, 3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockComplianceGrid() {
  const frameworks = ["ISO 27001", "NIST CSF", "PCI DSS", "Cyber Essentials"];
  const controls = ["Access Control", "Encryption", "Monitoring", "Incident Resp.", "Config Mgmt"];
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-[9px]">
        <thead>
          <tr className="bg-muted/30">
            <th className="px-2 py-1.5 text-left font-semibold text-foreground">Framework</th>
            {controls.map((c) => (
              <th key={c} className="px-1.5 py-1.5 text-center font-medium text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {frameworks.map((fw, fi) => (
            <tr key={fw} className="hover:bg-muted/10">
              <td className="px-2 py-1.5 font-medium text-foreground">{fw}</td>
              {controls.map((c, ci) => {
                const status = [
                  (fi + ci) % 3 === 0 ? "pass" : (fi + ci) % 3 === 1 ? "fail" : "partial",
                ][0];
                return (
                  <td key={c} className="px-1.5 py-1.5 text-center">
                    <span
                      className={`inline-block w-4 h-4 rounded text-[8px] font-bold leading-4 ${
                        status === "pass"
                          ? "bg-[#00F2B3]/15 text-[#00F2B3]"
                          : status === "fail"
                            ? "bg-[#EA0022]/15 text-[#EA0022]"
                            : "bg-[#F29400]/15 text-[#F29400]"
                      }`}
                    >
                      {status === "pass" ? "\u2713" : status === "fail" ? "\u2717" : "~"}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockReportViewer({ type }: { type: "individual" | "executive" | "compliance" }) {
  const tabs = ["Individual Firewall", "Executive Summary", "Compliance Report"];
  const activeIdx = type === "individual" ? 0 : type === "executive" ? 1 : 2;
  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border pb-0">
        {tabs.map((t, i) => (
          <div
            key={t}
            className={`px-2.5 py-1.5 text-[9px] font-medium border-b-2 ${i === activeIdx ? "border-[#2006F7] text-[#2006F7]" : "border-transparent text-muted-foreground"}`}
          >
            {t}
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
        {type === "individual" && (
          <>
            <div className="h-3 bg-foreground/10 rounded w-2/3" />
            <div className="h-2 bg-foreground/5 rounded w-full" />
            <div className="h-2 bg-foreground/5 rounded w-5/6" />
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-foreground">
                Finding: Admin services exposed to WAN
              </p>
              <p className="text-[9px] text-muted-foreground">
                HTTPS and SSH admin access is enabled on the WAN interface, exposing the management
                console to the internet...
              </p>
              <div className="flex gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#EA0022]/10 text-[#EA0022]">
                  HIGH
                </span>
                <span className="px-1.5 py-0.5 rounded text-[8px] bg-muted text-muted-foreground">
                  Device Hardening
                </span>
              </div>
            </div>
          </>
        )}
        {type === "executive" && (
          <>
            <p className="text-[10px] font-semibold text-foreground">Executive Summary</p>
            <div className="grid grid-cols-3 gap-2 my-2">
              <div className="rounded border border-border/50 bg-card p-2 text-center">
                <p className="text-lg font-bold text-[#F29400]">54</p>
                <p className="text-[8px] text-muted-foreground">Risk Score</p>
              </div>
              <div className="rounded border border-border/50 bg-card p-2 text-center">
                <p className="text-lg font-bold text-[#EA0022]">32</p>
                <p className="text-[8px] text-muted-foreground">Findings</p>
              </div>
              <div className="rounded border border-border/50 bg-card p-2 text-center">
                <p className="text-lg font-bold text-[#00F2B3]">8</p>
                <p className="text-[8px] text-muted-foreground">Recommendations</p>
              </div>
            </div>
            <div className="h-2 bg-foreground/5 rounded w-full" />
            <div className="h-2 bg-foreground/5 rounded w-4/5" />
          </>
        )}
        {type === "compliance" && (
          <>
            <p className="text-[10px] font-semibold text-foreground">
              ISO 27001 Compliance Assessment
            </p>
            <div className="space-y-1.5 mt-2">
              {[
                "A.9 Access Control",
                "A.10 Cryptography",
                "A.12 Operations Security",
                "A.13 Communications Security",
              ].map((c) => (
                <div key={c} className="flex items-center gap-2 text-[9px]">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${c.includes("Crypto") ? "bg-[#EA0022]" : "bg-[#00F2B3]"}`}
                  />
                  <span className="text-foreground flex-1">{c}</span>
                  <span
                    className={`font-bold ${c.includes("Crypto") ? "text-[#EA0022]" : "text-[#00F2B3]"}`}
                  >
                    {c.includes("Crypto") ? "FAIL" : "PASS"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex gap-1.5">
        <div className="px-2 py-1 rounded text-[9px] font-medium bg-brand-accent/10 text-[#2006F7]">
          PDF
        </div>
        <div className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">
          Word
        </div>
        <div className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">
          PPTX
        </div>
        <div className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">
          ZIP
        </div>
      </div>
    </div>
  );
}

function MockTenantDashboard() {
  const customers = [
    { name: "Acme Corp", score: 78, grade: "B", firewalls: 2, color: "#00F2B3" },
    { name: "Global Bank Ltd", score: 54, grade: "D", firewalls: 4, color: "#F29400" },
    { name: "MediHealth", score: 91, grade: "A", firewalls: 1, color: "#00F2B3" },
  ];
  return (
    <div className="space-y-2">
      {customers.map((c) => (
        <div
          key={c.name}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
        >
          <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center">
            <span className="text-sm font-bold" style={{ color: c.color }}>
              {c.score}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{c.name}</p>
            <p className="text-[9px] text-muted-foreground">
              {c.firewalls} firewall{c.firewalls !== 1 ? "s" : ""} · Grade {c.grade}
            </p>
          </div>
          <div className="h-6 w-16 rounded bg-muted/20 overflow-hidden flex items-end">
            {[40, 55, 60, 72, c.score].map((v, i) => (
              <div
                key={i}
                className="flex-1 mx-px rounded-t"
                style={{ height: `${v}%`, backgroundColor: c.color, opacity: 0.3 + i * 0.17 }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MockSavedReports() {
  const reports = [
    { customer: "Acme Corp", type: "Executive", date: "4 Mar 2026", score: 78 },
    { customer: "Global Bank", type: "Compliance", date: "2 Mar 2026", score: 54 },
    { customer: "MediHealth", type: "Individual", date: "28 Feb 2026", score: 91 },
  ];
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_80px_40px] gap-2 px-3 py-1.5 bg-muted/30 text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">
        <span>Customer</span>
        <span>Type</span>
        <span>Date</span>
        <span>Score</span>
      </div>
      {reports.map((r) => (
        <div
          key={r.customer + r.type}
          className="grid grid-cols-[1fr_80px_80px_40px] gap-2 px-3 py-2 border-t border-border items-center"
        >
          <span className="text-[10px] font-medium text-foreground">{r.customer}</span>
          <span className="text-[9px] text-muted-foreground">{r.type}</span>
          <span className="text-[9px] text-muted-foreground">{r.date}</span>
          <span
            className="text-[10px] font-bold"
            style={{ color: r.score >= 75 ? "#00F2B3" : r.score >= 50 ? "#F29400" : "#EA0022" }}
          >
            {r.score}
          </span>
        </div>
      ))}
    </div>
  );
}

function MockHistoryChart() {
  const points = [42, 48, 55, 54, 62, 68, 78];
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const maxV = 100;
  const w = 280,
    h = 100,
    pad = 20;
  const plotW = w - pad * 2,
    plotH = h - pad;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 10}`} className="text-muted-foreground">
      {[25, 50, 75].map((v) => (
        <line
          key={v}
          x1={pad}
          x2={w - pad}
          y1={h - pad - (v / maxV) * plotH}
          y2={h - pad - (v / maxV) * plotH}
          stroke="currentColor"
          strokeWidth="0.5"
          opacity="0.2"
        />
      ))}
      <polyline
        fill="none"
        stroke="#2006F7"
        strokeWidth="2"
        strokeLinejoin="round"
        points={points
          .map(
            (v, i) => `${pad + (i / (points.length - 1)) * plotW},${h - pad - (v / maxV) * plotH}`,
          )
          .join(" ")}
      />
      {points.map((v, i) => (
        <g key={i}>
          <circle
            cx={pad + (i / (points.length - 1)) * plotW}
            cy={h - pad - (v / maxV) * plotH}
            r="3"
            fill="#2006F7"
          />
          <text
            x={pad + (i / (points.length - 1)) * plotW}
            y={h}
            textAnchor="middle"
            fontSize="7"
            fill="currentColor"
          >
            {months[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

function MockSettingsPanel() {
  return (
    <div className="space-y-2">
      {[
        {
          icon: <Wifi className="h-3.5 w-3.5 text-[#005BC8]" />,
          title: "Sophos Central API",
          desc: "Connected · Partner account · Last synced 3m ago",
        },
        {
          icon: <Plug className="h-3.5 w-3.5 text-[#00F2B3]" />,
          title: "Connector Agents",
          desc: "2 agents online · 1 drift alert",
        },
        {
          icon: <Users className="h-3.5 w-3.5 text-[#2006F7]" />,
          title: "Team Management",
          desc: "3 members · 1 pending invite",
        },
        {
          icon: <Globe className="h-3.5 w-3.5 text-[#005BC8]" />,
          title: "Client Portal",
          desc: "Branded customer access",
        },
        {
          icon: <Lock className="h-3.5 w-3.5 text-[#00F2B3]" />,
          title: "Security",
          desc: "MFA enabled · 1 passkey registered",
        },
        {
          icon: <Bell className="h-3.5 w-3.5 text-[#F29400]" />,
          title: "Alerts & Webhooks",
          desc: "3 alert rules · 2 webhooks active",
        },
        {
          icon: <Calendar className="h-3.5 w-3.5 text-[#2006F7]" />,
          title: "Scheduled Reports",
          desc: "2 schedules active · Next: 24 Mar",
        },
        {
          icon: <FileText className="h-3.5 w-3.5 text-[#6B5BFF]" />,
          title: "Report Template",
          desc: "Custom sections and headings",
        },
        {
          icon: <Activity className="h-3.5 w-3.5 text-[#6B5BFF]" />,
          title: "Activity Log",
          desc: "47 events · Last: report.saved 2h ago",
        },
        {
          icon: <BookOpen className="h-3.5 w-3.5 text-[#005BC8]" />,
          title: "API Documentation",
          desc: "REST API reference for automation",
        },
      ].map((s) => (
        <div
          key={s.title}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
        >
          <div className="h-6 w-6 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
            {s.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{s.title}</p>
            <p className="text-[9px] text-muted-foreground">{s.desc}</p>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground/40 -rotate-90" />
        </div>
      ))}
    </div>
  );
}

function MockTeamPanel() {
  const members = [
    { name: "Joseph McDonald", email: "joseph@acme-it.co.uk", role: "Owner", status: "active" },
    { name: "Sarah Chen", email: "sarah@acme-it.co.uk", role: "Engineer", status: "active" },
    { name: "Alex Rivera", email: "alex@acme-it.co.uk", role: "Viewer", status: "pending" },
  ];
  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div
          key={m.email}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
        >
          <div className="h-8 w-8 rounded-full bg-brand-accent/10 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-[#2006F7]">
              {m.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{m.name}</p>
            <p className="text-[9px] text-muted-foreground">{m.email}</p>
          </div>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              m.role === "Owner"
                ? "bg-brand-accent/10 text-[#2006F7]"
                : m.role === "Engineer"
                  ? "bg-[#6B5BFF]/10 text-[#6B5BFF]"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {m.role}
          </span>
          {m.status === "pending" && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#F29400]/10 text-[#F29400] font-medium">
              Pending
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function MockSecurityPanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 bg-card p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#00F2B3]/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4 text-[#00F2B3]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-foreground">Multi-Factor Authentication</p>
          <p className="text-[9px] text-muted-foreground">
            TOTP-based authenticator app verification
          </p>
        </div>
        <div className="px-2 py-1 rounded text-[9px] font-semibold bg-[#00F2B3]/10 text-[#00F2B3]">
          Enabled
        </div>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#6B5BFF]/10 flex items-center justify-center shrink-0">
          <Fingerprint className="h-4 w-4 text-[#6B5BFF]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-foreground">Passkeys</p>
          <p className="text-[9px] text-muted-foreground">
            Passwordless sign-in with biometrics or hardware keys
          </p>
        </div>
        <div className="px-2 py-1 rounded text-[9px] font-semibold bg-[#6B5BFF]/10 text-[#6B5BFF]">
          1 registered
        </div>
      </div>
    </div>
  );
}

function MockAlertPanel() {
  const rules = [
    {
      name: "Critical findings detected",
      channel: "Email",
      icon: <Mail className="h-3 w-3" />,
      color: "#EA0022",
    },
    {
      name: "Agent offline > 24 hours",
      channel: "Email + Webhook",
      icon: <Bell className="h-3 w-3" />,
      color: "#F29400",
    },
    {
      name: "Config drift detected",
      channel: "Webhook",
      icon: <Webhook className="h-3 w-3" />,
      color: "#2006F7",
    },
  ];
  return (
    <div className="space-y-2">
      {rules.map((r) => (
        <div
          key={r.name}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
        >
          <div
            className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0"
            style={{ color: r.color }}
          >
            {r.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{r.name}</p>
            <p className="text-[9px] text-muted-foreground">{r.channel}</p>
          </div>
          <div className="h-4 w-7 rounded-full bg-[#00F2B3] flex items-center justify-end px-0.5">
            <div className="h-3 w-3 rounded-full bg-white" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MockClientPortalPanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-[#001A47] px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-white/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white/70" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold text-white">Acme Corp</p>
            <p className="text-[9px] text-white/60">Security Assessment Portal</p>
          </div>
        </div>
        <div className="p-3 space-y-2 bg-card">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Risk Score", value: "78", color: "#00F2B3" },
              { label: "Findings", value: "14", color: "#F29400" },
              { label: "Reports", value: "3", color: "#2006F7" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded border border-border bg-muted/20 p-2 text-center"
              >
                <p className="text-sm font-bold" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-[8px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <span className="px-2 py-1 rounded text-[9px] font-medium bg-brand-accent/10 text-[#2006F7]">
              Reports
            </span>
            <span className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">
              Compliance
            </span>
            <span className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">
              History
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockRuleOptimiser() {
  const rules = [
    {
      id: "R-14",
      name: "Allow HTTPS outbound",
      status: "shadowed",
      detail: "Shadowed by R-02 (any → any HTTPS)",
      color: "#F29400",
    },
    {
      id: "R-23",
      name: "Legacy VPN rule",
      status: "redundant",
      detail: "Duplicate of R-08 with identical match criteria",
      color: "#EA0022",
    },
    {
      id: "R-31",
      name: "DNS allow internal",
      status: "ok",
      detail: "Unique rule, no overlaps detected",
      color: "#00F2B3",
    },
    {
      id: "R-07",
      name: "Block telnet WAN",
      status: "consolidate",
      detail: "Can merge with R-09 and R-11 (same action, adjacent networks)",
      color: "#2006F7",
    },
  ];
  return (
    <div className="space-y-2">
      {rules.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
        >
          <span className="text-[9px] font-mono text-muted-foreground w-8 shrink-0">{r.id}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{r.name}</p>
            <p className="text-[9px] text-muted-foreground">{r.detail}</p>
          </div>
          <span
            className="px-1.5 py-0.5 rounded text-[8px] font-bold"
            style={{ backgroundColor: r.color + "15", color: r.color }}
          >
            {r.status.toUpperCase()}
          </span>
        </div>
      ))}
      <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-center">
        <p className="text-[10px] font-semibold text-foreground">Consolidation Opportunity</p>
        <p className="text-[9px] text-muted-foreground">33 rules → 24 rules (27% reduction)</p>
      </div>
    </div>
  );
}

function MockPolicyComplexity() {
  const metrics = [
    { label: "Total Rules", value: "33", sub: "across 4 zones" },
    { label: "Avg Conditions", value: "3.2", sub: "per rule" },
    { label: "Nesting Depth", value: "4", sub: "max group depth" },
    { label: "Complexity Score", value: "Medium", sub: "72 / 100" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border/50 bg-card p-2.5 text-center"
          >
            <p className="text-lg font-bold text-foreground">{m.value}</p>
            <p className="text-[9px] font-medium text-foreground">{m.label}</p>
            <p className="text-[8px] text-muted-foreground">{m.sub}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-2.5">
        <p className="text-[9px] text-muted-foreground">
          <strong className="text-foreground">Recommendation:</strong> Consolidate overlapping
          zone-pair rules and reduce group nesting to improve readability and audit compliance.
        </p>
      </div>
    </div>
  );
}

function MockUnusedObjects() {
  const objects = [
    {
      type: "Host",
      name: "old-server-192.168.1.50",
      icon: <Layers className="h-3 w-3 text-[#F29400]" />,
    },
    {
      type: "Service",
      name: "custom-tcp-8443",
      icon: <Package className="h-3 w-3 text-[#EA0022]" />,
    },
    {
      type: "Group",
      name: "deprecated-vpn-users",
      icon: <Users className="h-3 w-3 text-[#2006F7]" />,
    },
    {
      type: "Network",
      name: "legacy-subnet-10.0.99.0/24",
      icon: <Globe className="h-3 w-3 text-[#6B5BFF]" />,
    },
  ];
  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-center mb-2">
        <div className="flex-1 rounded border border-border/50 bg-card p-2">
          <p className="text-lg font-bold text-[#F29400]">12</p>
          <p className="text-[8px] text-muted-foreground">Unused Objects</p>
        </div>
        <div className="flex-1 rounded border border-border/50 bg-card p-2">
          <p className="text-lg font-bold text-[#00F2B3]">89</p>
          <p className="text-[8px] text-muted-foreground">Active Objects</p>
        </div>
      </div>
      {objects.map((o) => (
        <div
          key={o.name}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2"
        >
          <div className="h-6 w-6 rounded bg-muted/30 flex items-center justify-center shrink-0">
            {o.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-foreground truncate">{o.name}</p>
            <p className="text-[8px] text-muted-foreground">
              {o.type} · Not referenced by any rule
            </p>
          </div>
          <Trash2 className="h-3 w-3 text-muted-foreground/40" />
        </div>
      ))}
    </div>
  );
}

function MockRemediationProgress() {
  const severities = [
    { label: "Critical", total: 3, fixed: 2, color: "#EA0022" },
    { label: "High", total: 8, fixed: 5, color: "#F29400" },
    { label: "Medium", total: 14, fixed: 8, color: "#F8E300" },
    { label: "Low", total: 7, fixed: 6, color: "#00F2B3" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-border/50 bg-card p-2">
          <p className="text-lg font-bold text-[#00F2B3]">21</p>
          <p className="text-[8px] text-muted-foreground">Fixed</p>
        </div>
        <div className="rounded border border-border/50 bg-card p-2">
          <p className="text-lg font-bold text-[#F29400]">8</p>
          <p className="text-[8px] text-muted-foreground">In Progress</p>
        </div>
        <div className="rounded border border-border/50 bg-card p-2">
          <p className="text-lg font-bold text-muted-foreground">3</p>
          <p className="text-[8px] text-muted-foreground">Remaining</p>
        </div>
      </div>
      {severities.map((s) => (
        <div key={s.label} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-medium" style={{ color: s.color }}>
              {s.label}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {s.fixed}/{s.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(s.fixed / s.total) * 100}%`, backgroundColor: s.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MockRemediationRoadmap() {
  const phases = [
    {
      phase: "Week 1",
      items: ["Disable WAN admin services", "Change default credentials"],
      severity: "Critical",
      color: "#EA0022",
    },
    {
      phase: "Week 2–3",
      items: ["Enable IPS on WAN rules", "Add web filtering"],
      severity: "High",
      color: "#F29400",
    },
    {
      phase: "Month 2",
      items: ["Enforce TLS 1.2+", "Enable DNS rebinding protection"],
      severity: "Medium",
      color: "#F8E300",
    },
  ];
  return (
    <div className="space-y-2">
      {phases.map((p) => (
        <div key={p.phase} className="rounded-xl border border-border/50 bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-foreground">{p.phase}</span>
            <span
              className="px-1.5 py-0.5 rounded text-[8px] font-bold ml-auto"
              style={{ backgroundColor: p.color + "15", color: p.color }}
            >
              {p.severity}
            </span>
          </div>
          <ul className="space-y-1">
            {p.items.map((item) => (
              <li key={item} className="flex items-center gap-2 text-[9px] text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MockPlaybooks() {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border/50 bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="h-3.5 w-3.5 text-[#EA0022]" />
          <p className="text-[10px] font-semibold text-foreground">Disable WAN Admin Services</p>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#EA0022]/10 text-[#EA0022] ml-auto">
            CRITICAL
          </span>
        </div>
        <div className="space-y-1.5 pl-5">
          {[
            "Navigate to Administration > Device access",
            "Uncheck HTTPS and SSH under WAN zone",
            "Enable admin access only on LAN/VPN zones",
            "Save and verify access is blocked from WAN",
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-[9px]">
              <span className="flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground text-[8px] font-bold shrink-0">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-[#F29400]" />
          <p className="text-[10px] font-semibold text-foreground">Enable IPS on WAN Rules</p>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#F29400]/10 text-[#F29400] ml-auto">
            HIGH
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1 pl-5">4 steps · ~10 min per rule</p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-[#F8E300]" />
          <p className="text-[10px] font-semibold text-foreground">Enforce TLS 1.2+ on VPNs</p>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#F8E300]/10 text-[#F8E300]  ml-auto">
            MEDIUM
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1 pl-5">3 steps · ~5 min</p>
      </div>
    </div>
  );
}

function MockScoreSimulator() {
  const scenarios = [
    { label: "Current Score", score: 54, color: "#F29400" },
    { label: "Fix critical findings", score: 68, color: "#F29400" },
    { label: "Fix critical + high", score: 82, color: "#00F2B3" },
    { label: "All findings fixed", score: 96, color: "#00F2B3" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-[#F29400]">54</p>
          <p className="text-[8px] text-muted-foreground">Current</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className="text-center">
          <p className="text-2xl font-bold text-[#00F2B3]">82</p>
          <p className="text-[8px] text-muted-foreground">Projected</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {scenarios.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground flex-1">{s.label}</span>
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${s.score}%`, backgroundColor: s.color }}
              />
            </div>
            <span className="text-[10px] font-bold w-6 text-right" style={{ color: s.color }}>
              {s.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockAttackSurface() {
  const services = [
    { port: "443", service: "HTTPS (Admin UI)", zone: "WAN", risk: "high", color: "#EA0022" },
    { port: "22", service: "SSH (Management)", zone: "WAN", risk: "high", color: "#EA0022" },
    { port: "500", service: "IKE (IPsec VPN)", zone: "WAN", risk: "medium", color: "#F29400" },
    { port: "4444", service: "User Portal", zone: "WAN", risk: "low", color: "#00F2B3" },
    { port: "8443", service: "Captive Portal", zone: "DMZ", risk: "low", color: "#00F2B3" },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-[50px_1fr_60px_60px] gap-2 px-3 py-1.5 bg-muted/30 text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Port</span>
          <span>Service</span>
          <span>Zone</span>
          <span>Risk</span>
        </div>
        {services.map((s) => (
          <div
            key={s.port + s.zone}
            className="grid grid-cols-[50px_1fr_60px_60px] gap-2 px-3 py-2 border-t border-border items-center"
          >
            <span className="text-[10px] font-mono font-medium text-foreground">{s.port}</span>
            <span className="text-[9px] text-muted-foreground">{s.service}</span>
            <span className="text-[9px] text-muted-foreground">{s.zone}</span>
            <span
              className="px-1.5 py-0.5 rounded text-[8px] font-bold text-center"
              style={{ backgroundColor: s.color + "15", color: s.color }}
            >
              {s.risk.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-border/50 bg-card p-2">
          <p className="text-lg font-bold text-[#EA0022]">5</p>
          <p className="text-[8px] text-muted-foreground">Exposed Services</p>
        </div>
        <div className="rounded border border-border/50 bg-card p-2">
          <p className="text-lg font-bold text-[#F29400]">2</p>
          <p className="text-[8px] text-muted-foreground">High Risk</p>
        </div>
        <div className="rounded border border-border/50 bg-card p-2">
          <p className="text-lg font-bold text-foreground">3</p>
          <p className="text-[8px] text-muted-foreground">Zones</p>
        </div>
      </div>
    </div>
  );
}

function MockConfigCompare() {
  const diffs = [
    { field: "WAN Admin HTTPS", before: "Enabled", after: "Disabled", change: "fixed" },
    { field: "IPS Policy", before: "None", after: "GeneralPolicy", change: "fixed" },
    { field: "Firewall Rules", before: "33", after: "28", change: "improved" },
    { field: "VPN TLS Version", before: "1.0+", after: "1.2+", change: "fixed" },
    { field: "DNS Rebinding", before: "Off", after: "Off", change: "unchanged" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 rounded border border-border/50 bg-card p-2 text-center">
          <p className="text-[9px] text-muted-foreground">Before</p>
          <p className="text-sm font-bold text-[#F29400]">Score 54</p>
        </div>
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 rounded border border-border/50 bg-card p-2 text-center">
          <p className="text-[9px] text-muted-foreground">After</p>
          <p className="text-sm font-bold text-[#00F2B3]">Score 78</p>
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        {diffs.map((d) => (
          <div
            key={d.field}
            className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 text-[9px]"
          >
            <span className="font-medium text-foreground flex-1">{d.field}</span>
            <span className="text-muted-foreground line-through">{d.before}</span>
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40" />
            <span
              className={
                d.change === "fixed"
                  ? "text-[#00F2B3] font-medium"
                  : d.change === "improved"
                    ? "text-[#2006F7] font-medium"
                    : "text-muted-foreground"
              }
            >
              {d.after}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockScheduledReports() {
  const schedules = [
    {
      customer: "Acme Corp",
      frequency: "Monthly",
      next: "1 Apr 2026",
      type: "Compliance",
      active: true,
    },
    {
      customer: "Global Bank",
      frequency: "Weekly",
      next: "24 Mar 2026",
      type: "Executive",
      active: true,
    },
    {
      customer: "MediHealth",
      frequency: "Quarterly",
      next: "1 Jun 2026",
      type: "Full Suite",
      active: false,
    },
  ];
  return (
    <div className="space-y-2">
      {schedules.map((s) => (
        <div
          key={s.customer}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
        >
          <div className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
            <Calendar className="h-3.5 w-3.5 text-[#2006F7]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{s.customer}</p>
            <p className="text-[9px] text-muted-foreground">
              {s.frequency} · {s.type} · Next: {s.next}
            </p>
          </div>
          <div
            className={`h-4 w-7 rounded-full flex items-center px-0.5 ${s.active ? "bg-[#00F2B3] justify-end" : "bg-muted justify-start"}`}
          >
            <div className="h-3 w-3 rounded-full bg-white" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MockWebhookPanel() {
  const hooks = [
    {
      name: "PSA Ticket Creation",
      url: "https://psa.acme-it.co.uk/api/webhook",
      events: "assessment.complete, finding.critical",
      status: "active",
    },
    {
      name: "Slack Notifications",
      url: "https://hooks.slack.com/services/...",
      events: "report.saved, agent.offline",
      status: "active",
    },
  ];
  return (
    <div className="space-y-2">
      {hooks.map((h) => (
        <div key={h.name} className="rounded-xl border border-border/50 bg-card p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Webhook className="h-3.5 w-3.5 text-[#6B5BFF]" />
            <p className="text-[10px] font-semibold text-foreground flex-1">{h.name}</p>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-[#00F2B3]/10 text-[#00F2B3]">
              Active
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground font-mono truncate">{h.url}</p>
          <p className="text-[8px] text-muted-foreground mt-1">Events: {h.events}</p>
        </div>
      ))}
    </div>
  );
}

export function SetupWizard({
  open,
  onClose,
  branding,
  onBrandingChange,
  orgName,
  isGuest,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const steps = useMemo(() => {
    if (isGuest) return BASE_STEPS;
    const s = [...BASE_STEPS];
    const centralIdx = s.findIndex((st) => st.id === "central");
    s.splice(centralIdx + 1, 0, AGENT_STEP);
    return s;
  }, [isGuest]);

  if (!open) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      markSetupComplete();
      onClose();
      return;
    }
    setActiveOverlay(null);
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveOverlay(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleSkip = () => {
    markSetupComplete();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-background rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header with progress */}
          <div className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img
                  src="/sophos-icon-white.svg"
                  alt="Sophos"
                  className="h-5 w-5 hidden dark:block"
                />
                <img
                  src="/sophos-icon-white.svg"
                  alt="Sophos"
                  className="h-5 w-5 dark:hidden brightness-0"
                />
                <span className="text-sm font-display font-bold text-foreground">
                  FireComply Setup
                </span>
              </div>
              <button
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
                title="Skip setup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
                <div key={s.id} className="flex-1 flex items-center gap-1">
                  <div
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      i < currentStep
                        ? "bg-[#00F2B3] dark:bg-[#00F2B3]"
                        : i === currentStep
                          ? "bg-[#2006F7]"
                          : "bg-muted"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-7 w-7 rounded-lg bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center">
                <step.icon className="h-3.5 w-3.5 text-brand-accent" />
              </div>
              <span className="text-xs font-semibold text-foreground">{step.title}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            {step.id === "welcome" && (
              <div className="space-y-5 py-2 max-w-2xl mx-auto">
                {/* Centered hero */}
                <div className="text-center space-y-3">
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#2006F7] to-[#00EDFF] flex items-center justify-center shadow-lg shadow-[#2006F7]/20">
                    <Sparkles className="h-7 w-7 text-white" />
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                    First-time setup
                  </div>
                  <h2 className="text-2xl font-display font-black text-foreground tracking-tight leading-tight">
                    Welcome to Sophos FireComply
                    {orgName ? <span className="text-brand-accent">, {orgName}</span> : null}
                  </h2>
                  <p className="text-sm font-medium text-foreground/75 dark:text-white/70 max-w-md mx-auto leading-relaxed">
                    Get your workspace ready in about 3 minutes. We'll configure branding, connect
                    Sophos Central, and prepare you to assess, report, and remediate.
                  </p>
                </div>

                {/* Feature pills */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-xl border border-border bg-card/70 p-2.5 text-center">
                    <Building2 className="h-5 w-5 text-[#2006F7] dark:text-[#6B5BFF] mx-auto mb-1" />
                    <p className="text-[11px] font-semibold text-foreground leading-tight">
                      Branding
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                      Company & Central
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card/70 p-2.5 text-center">
                    <Shield className="h-5 w-5 text-[#00F2B3] mx-auto mb-1" />
                    <p className="text-[11px] font-semibold text-foreground leading-tight">
                      Analysis
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                      Posture & reports
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card/70 p-2.5 text-center">
                    <ListChecks className="h-5 w-5 text-[#F29400] mx-auto mb-1" />
                    <p className="text-[11px] font-semibold text-foreground leading-tight">
                      Remediation
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                      Priorities & roadmap
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card/70 p-2.5 text-center">
                    <Globe className="h-5 w-5 text-[#005BC8] dark:text-[#00EDFF] mx-auto mb-1" />
                    <p className="text-[11px] font-semibold text-foreground leading-tight">
                      Delivery
                    </p>
                    <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                      Portal & alerts
                    </p>
                  </div>
                </div>

                {/* Compact preview */}
                <SetupPreviewFrame
                  title="What you'll configure"
                  subtitle="Security posture scoring, compliance mapping, and customer-ready reporting from a single config export."
                >
                  <div className="grid gap-3 grid-cols-[110px_1fr] items-start">
                    <div className="flex justify-center">
                      <MockGauge score={82} grade="B" color="#00F2B3" />
                    </div>
                    <div className="space-y-2">
                      <MockSeverityBar />
                      <div className="rounded-lg border border-border bg-muted/20 p-2">
                        <MockInspectionPosture />
                      </div>
                    </div>
                  </div>
                </SetupPreviewFrame>
              </div>
            )}

            {step.id === "branding" && (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] items-start">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                      Report identity
                    </div>
                    <h3 className="text-base font-display tracking-tight font-semibold text-foreground mt-2">
                      Company Branding
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      This information appears on all your reports and assessments. You can change
                      it anytime.
                    </p>
                    <SetupPreviewFrame
                      title="Branded customer deliverables"
                      subtitle="Your company details shape the exported reports and executive packs customers receive."
                    >
                      <MockReportViewer type="executive" />
                    </SetupPreviewFrame>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="setup-company" className="text-xs">
                        Company / MSP Name
                      </Label>
                      <Input
                        id="setup-company"
                        placeholder="e.g. Acme IT Solutions"
                        value={branding.companyName}
                        onChange={(e) =>
                          onBrandingChange({ ...branding, companyName: e.target.value })
                        }
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="setup-prepared" className="text-xs">
                          Prepared By
                        </Label>
                        <Input
                          id="setup-prepared"
                          placeholder="e.g. Joseph McDonald"
                          value={branding.preparedBy ?? ""}
                          onChange={(e) =>
                            onBrandingChange({ ...branding, preparedBy: e.target.value })
                          }
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="setup-footer" className="text-xs">
                          Report Footer
                        </Label>
                        <Input
                          id="setup-footer"
                          placeholder="e.g. Confidential"
                          value={branding.footerText ?? ""}
                          onChange={(e) =>
                            onBrandingChange({ ...branding, footerText: e.target.value })
                          }
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/30 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">Tip:</strong> You can add a logo and set
                        customer-specific details later in the Assessment Context section.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step.id === "central" && (
              <div className="space-y-5">
                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] items-start">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                      Live estate enrichment
                    </div>
                    <h3 className="text-xl font-display font-black tracking-tight text-foreground mt-2">
                      Connect Sophos Central
                    </h3>
                    <p className="text-sm font-medium text-foreground/80 dark:text-white/75 leading-relaxed">
                      Link your Sophos Central Partner or Tenant account to enrich reports with live
                      firewall data, licence info, and alerts. You can skip this and connect later.
                    </p>
                    <SetupPreviewFrame
                      title="Managed estate visibility"
                      subtitle="Linking Sophos Central adds live tenancy, device, and enrichment context to your compliance workflow."
                    >
                      <MockTenantDashboard />
                    </SetupPreviewFrame>
                  </div>
                  <div className="rounded-2xl border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(32,6,247,0.04),rgba(0,242,179,0.03))] dark:bg-[linear-gradient(135deg,rgba(32,6,247,0.10),rgba(0,242,179,0.04))] shadow-card">
                    <Suspense fallback={<Skeleton />}>
                      <CentralIntegration />
                    </Suspense>
                  </div>
                </div>
              </div>
            )}

            {step.id === "connector-agent" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    FireComply Connector Agent
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    The Connector Agent is a lightweight desktop app that sits on your customer's
                    network and automatically pulls firewall configs, runs security assessments, and
                    submits results back to FireComply — on a schedule, with no manual exports
                    needed.
                  </p>
                </div>

                <div className="space-y-3">
                  <GuideStep
                    number={1}
                    title="Register an agent"
                    description="Open the Management Panel > Connector Agents > Register Agent. Enter the firewall details and schedule. An API key is generated for you."
                    icon={<Key className="h-4 w-4" />}
                    color="text-[#2006F7]"
                  />
                  <GuideStep
                    number={2}
                    title="Download & install"
                    description="Download the FireComply Connector for Windows, macOS, or Linux. Install it on a machine that can reach the firewall's admin interface."
                    icon={<Download className="h-4 w-4" />}
                    color="text-[#005BC8]"
                  />
                  <GuideStep
                    number={3}
                    title="Set up the agent"
                    description="Paste your API key into the setup wizard, add the firewall's IP/hostname and API credentials, choose a schedule, and start monitoring."
                    icon={<Plug className="h-4 w-4" />}
                    color="text-[#6B5BFF]"
                  />
                  <GuideStep
                    number={4}
                    title="Automated assessments"
                    description="The agent pulls configs via the Sophos XML API, runs the same deterministic analysis, and submits scores, findings, and drift detection to your dashboard."
                    icon={<RefreshCw className="h-4 w-4" />}
                    color="text-[#00F2B3]"
                  />
                </div>

                {/* Mock agent card */}
                <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    What you'll see in the dashboard
                  </p>
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#00F2B3]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground">HQ Primary Agent</p>
                      <p className="text-[9px] text-muted-foreground">
                        Acme Corp · 192.168.1.1:4444
                      </p>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#009CFB]/10 text-[#009CFB] font-semibold">
                      v22.0
                    </span>
                    <span className="text-[10px] font-bold text-[#00F2B3]">82/B</span>
                    <span className="text-[9px] text-muted-foreground">2h ago</span>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F29400]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground">Branch Office Agent</p>
                      <p className="text-[9px] text-muted-foreground">Acme Corp · 10.0.0.1:4444</p>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F29400]/10 text-[#F29400] font-semibold">
                      v21.0
                    </span>
                    <span className="text-[10px] font-bold text-[#F29400]">58/D</span>
                    <span className="text-[9px] text-muted-foreground">6h ago</span>
                  </div>
                </div>

                <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Optional:</strong> The agent is completely
                    optional. You can always upload firewall configs manually instead. The agent
                    just automates the process for ongoing monitoring.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-upload" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    How to Upload & Assess
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    FireComply analyses Sophos XGS HTML configuration exports. Here's the workflow:
                  </p>
                </div>

                <div className="space-y-3">
                  <GuideStep
                    number={1}
                    title="Export your firewall config"
                    description="In Sophos Firewall, go to Backup & firmware > Import/Export and export as HTML."
                    icon={<Download className="h-4 w-4" />}
                    color="text-[#2006F7]"
                  />
                  <GuideStep
                    number={2}
                    title="Drag & drop the file"
                    description="Drop one or more HTML files into the upload area on the main page. Multi-firewall assessments are supported."
                    icon={<Upload className="h-4 w-4" />}
                    color="text-[#005BC8]"
                  />
                  <GuideStep
                    number={3}
                    title="Instant analysis"
                    description="FireComply automatically parses the config and shows findings, risk scores, compliance mapping, and best practice checks."
                    icon={<Shield className="h-4 w-4" />}
                    color="text-[#00F2B3]"
                  />
                  <GuideStep
                    number={4}
                    title="Link to Sophos Central"
                    description='If connected, click "Link Firewall" to match each config to its Central firewall for live data enrichment.'
                    icon={<Wifi className="h-4 w-4" />}
                    color="text-[#00EDFF]"
                  />
                </div>

                <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> Set the customer name and
                    compliance frameworks in the{" "}
                    <strong className="text-foreground">Assessment Context</strong> section before
                    generating reports — this tailors the AI analysis.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-pre-ai" && (
              <div className="space-y-5 relative">
                {activeOverlay === "risk-score" && (
                  <FeatureOverlay
                    title="Risk Score & Grade"
                    subtitle="A-F rating based on weighted security checks"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <MockGauge score={54} grade="D" color="#F29400" />
                      <MockRadar />
                      <div className="w-full grid grid-cols-4 gap-1.5">
                        {[
                          { label: "Network", pct: 45 },
                          { label: "Access", pct: 62 },
                          { label: "Logging", pct: 80 },
                          { label: "Hardening", pct: 35 },
                        ].map((c) => (
                          <div
                            key={c.label}
                            className="rounded border border-border bg-muted/20 p-2 text-center"
                          >
                            <p className="text-sm font-bold text-foreground">{c.pct}%</p>
                            <p className="text-[8px] text-muted-foreground">{c.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Each security
                        check is weighted by severity. The gauge shows the overall risk score
                        (0–100) and assigns a letter grade. The radar chart breaks down scores by
                        category.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "findings" && (
                  <FeatureOverlay
                    title="Findings & Severity"
                    subtitle="Critical, high, medium, low categorised issues"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockSeverityBar />
                    <div className="mt-4 space-y-1.5">
                      {[
                        {
                          severity: "CRITICAL",
                          title: "Default admin password unchanged",
                          color: "#EA0022",
                        },
                        { severity: "HIGH", title: "WAN admin services exposed", color: "#F29400" },
                        {
                          severity: "MEDIUM",
                          title: "DNS rebinding protection disabled",
                          color: "#F8E300",
                        },
                        {
                          severity: "LOW",
                          title: "SNMP community string is 'public'",
                          color: "#00F2B3",
                        },
                      ].map((f) => (
                        <div
                          key={f.title}
                          className="flex items-center gap-2 rounded border border-border/50 bg-card p-2"
                        >
                          <span
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                            style={{ backgroundColor: f.color + "15", color: f.color }}
                          >
                            {f.severity}
                          </span>
                          <span className="text-[10px] text-foreground">{f.title}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Every parsed
                        configuration item is checked against known security anti-patterns. Findings
                        are categorised by severity and grouped by domain.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "inspection" && (
                  <FeatureOverlay
                    title="Inspection Posture"
                    subtitle="IPS, web filter, app control, SSL/TLS coverage"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockInspectionPosture />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> FireComply
                        examines every firewall rule to determine which security features (IPS, web
                        filter, app control, SSL/TLS inspection) are applied and reports the
                        coverage as a percentage of WAN-facing rules.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "compliance" && (
                  <FeatureOverlay
                    title="Compliance Mapping"
                    subtitle="ISO 27001, NIST, PCI DSS, Cyber Essentials"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockComplianceGrid />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Firewall findings
                        are mapped to controls from selected compliance frameworks. Each control is
                        marked as pass, fail, or partial based on the configuration analysis.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Pre-AI Assessment (Instant)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    As soon as you upload a config, FireComply runs a{" "}
                    <strong className="text-foreground">deterministic analysis</strong> — no AI
                    needed. Click each panel below to preview.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton
                    icon={<Shield className="h-4 w-4" />}
                    title="Risk Score & Grade"
                    desc="A-F rating with radar chart and category scores"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("risk-score")}
                  />
                  <FeatureButton
                    icon={<BarChart3 className="h-4 w-4" />}
                    title="Findings & Severity"
                    desc="Critical, high, medium, low categorised issues"
                    color="text-[#EA0022]"
                    onClick={() => setActiveOverlay("findings")}
                  />
                  <FeatureButton
                    icon={<Eye className="h-4 w-4" />}
                    title="Inspection Posture"
                    desc="IPS, web filter, app control, SSL/TLS coverage"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("inspection")}
                  />
                  <FeatureButton
                    icon={<FileText className="h-4 w-4" />}
                    title="Compliance Mapping"
                    desc="ISO 27001, NIST, PCI DSS, Cyber Essentials"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("compliance")}
                  />
                </div>

                <div className="rounded-lg bg-[#00F2B3]/5 border border-[#00F2B3]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Why Pre-AI?</strong> The deterministic
                    analysis is repeatable and consistent — same config always gives the same score.
                    It's the baseline before AI adds narrative reporting.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-ai-reports" && (
              <div className="space-y-5 relative">
                {activeOverlay === "report-individual" && (
                  <FeatureOverlay
                    title="Individual Firewall Report"
                    subtitle="Deep-dive analysis per firewall with finding-level detail"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockReportViewer type="individual" />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you get:</strong> A detailed,
                        AI-generated narrative for each firewall covering every finding, remediation
                        steps, and priority ranking. If linked to Central, live firmware and alert
                        data is woven in.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "report-executive" && (
                  <FeatureOverlay
                    title="Executive Summary"
                    subtitle="High-level overview for management"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockReportViewer type="executive" />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you get:</strong> A
                        management-friendly document with key metrics, risk posture overview, and
                        prioritised recommendations — ideal for board-level or stakeholder
                        reporting.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "report-compliance" && (
                  <FeatureOverlay
                    title="Compliance Report"
                    subtitle="Maps findings against selected compliance frameworks"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockReportViewer type="compliance" />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you get:</strong> Findings mapped
                        to ISO 27001, NIST CSF, PCI DSS, or Cyber Essentials controls. Each control
                        is assessed as pass, fail, or partial with remediation guidance.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    AI-Powered Reports
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    After the Pre-AI assessment, generate{" "}
                    <strong className="text-foreground">AI narrative reports</strong> for your
                    customers. Click each to preview.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton
                    icon={<FileText className="h-4 w-4" />}
                    title="Individual Firewall Report"
                    desc="Deep-dive analysis per firewall with finding-level detail and remediation"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("report-individual")}
                  />
                  <FeatureButton
                    icon={<BarChart3 className="h-4 w-4" />}
                    title="Executive Summary"
                    desc="High-level overview for management with key metrics and recommendations"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("report-executive")}
                  />
                  <FeatureButton
                    icon={<Shield className="h-4 w-4" />}
                    title="Compliance Report"
                    desc="Maps findings against ISO 27001, NIST, PCI DSS, Cyber Essentials"
                    color="text-[#005BC8]"
                    onClick={() => setActiveOverlay("report-compliance")}
                  />
                </div>

                <div className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-[#2006F7] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Keyboard shortcuts:</strong>{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">
                      Ctrl+G
                    </kbd>{" "}
                    generate all,{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">
                      Ctrl+S
                    </kbd>{" "}
                    save,{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">
                      1-9
                    </kbd>{" "}
                    switch tabs
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-optimisation" && (
              <div className="space-y-5 relative">
                {activeOverlay === "rule-optimiser" && (
                  <FeatureOverlay
                    title="Rule Optimiser"
                    subtitle="Identify redundant, shadowed, and overlapping rules"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockRuleOptimiser />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> FireComply
                        analyses every rule against every other rule to find shadows (a broader rule
                        makes a narrower one unreachable), redundancies (identical match criteria),
                        and consolidation opportunities (adjacent rules that can merge).
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "policy-complexity" && (
                  <FeatureOverlay
                    title="Policy Complexity"
                    subtitle="Measure and reduce policy complexity"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockPolicyComplexity />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Analyses rule
                        count, average conditions per rule, object group nesting depth, and
                        zone-pair distribution to produce a complexity score. Lower complexity means
                        easier auditing and fewer misconfigurations.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "unused-objects" && (
                  <FeatureOverlay
                    title="Unused Objects"
                    subtitle="Find orphaned hosts, services, and groups"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockUnusedObjects />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Scans all network
                        objects, service definitions, and groups in the config and cross-references
                        them against every rule. Objects not referenced by any active rule are
                        flagged for cleanup.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "consistency-checker" && (
                  <FeatureOverlay
                    title="Consistency Checker"
                    subtitle="Cross-firewall rule consistency analysis"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded border border-border/50 bg-card p-2">
                          <p className="text-lg font-bold text-[#00F2B3]">87%</p>
                          <p className="text-[8px] text-muted-foreground">Consistency Score</p>
                        </div>
                        <div className="rounded border border-border/50 bg-card p-2">
                          <p className="text-lg font-bold text-[#F29400]">4</p>
                          <p className="text-[8px] text-muted-foreground">Inconsistencies</p>
                        </div>
                      </div>
                      {[
                        {
                          rule: "IPS Policy",
                          fw1: "GeneralPolicy",
                          fw2: "None",
                          status: "mismatch",
                        },
                        { rule: "Web Filtering", fw1: "Enabled", fw2: "Enabled", status: "match" },
                        {
                          rule: "Admin HTTPS",
                          fw1: "Disabled",
                          fw2: "Enabled",
                          status: "mismatch",
                        },
                        { rule: "SSL Inspection", fw1: "38%", fw2: "42%", status: "match" },
                      ].map((r) => (
                        <div
                          key={r.rule}
                          className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5 text-[9px]"
                        >
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${r.status === "match" ? "bg-[#00F2B3]" : "bg-[#EA0022]"}`}
                          />
                          <span className="font-medium text-foreground flex-1">{r.rule}</span>
                          <span className="text-muted-foreground">FW1: {r.fw1}</span>
                          <span className="text-muted-foreground">FW2: {r.fw2}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> When multiple
                        firewall configs are loaded, FireComply compares security feature settings,
                        rule structures, and policy configurations across devices to identify
                        inconsistencies that could indicate gaps in your security posture.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Optimisation
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    FireComply analyses your firewall rules for{" "}
                    <strong className="text-foreground">redundancy, complexity, and hygiene</strong>{" "}
                    — helping you clean up and streamline your policy. Click each to preview.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton
                    icon={<Wrench className="h-4 w-4" />}
                    title="Rule Optimiser"
                    desc="Identifies redundant, shadowed, and overlapping rules that can be consolidated"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("rule-optimiser")}
                  />
                  <FeatureButton
                    icon={<Layers className="h-4 w-4" />}
                    title="Policy Complexity"
                    desc="Measures rule complexity and suggests simplification opportunities"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("policy-complexity")}
                  />
                  <FeatureButton
                    icon={<Trash2 className="h-4 w-4" />}
                    title="Unused Objects"
                    desc="Finds hosts, services, and groups no longer referenced by any rule"
                    color="text-[#F29400]"
                    onClick={() => setActiveOverlay("unused-objects")}
                  />
                  <FeatureButton
                    icon={<Scale className="h-4 w-4" />}
                    title="Consistency Checker"
                    desc="Cross-firewall rule consistency analysis when multiple configs are loaded"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("consistency-checker")}
                  />
                </div>

                <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> The Optimisation tab appears
                    automatically after uploading a config. Upload multiple configs to enable
                    cross-firewall consistency checking.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-remediation" && (
              <div className="space-y-5 relative">
                {activeOverlay === "remediation-progress" && (
                  <FeatureOverlay
                    title="Remediation Progress"
                    subtitle="Track fix progress across all findings"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockRemediationProgress />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Track remediation
                        status for every finding — mark items as fixed, in progress, or accepted
                        risk. Progress bars show completion by severity so you can focus on what
                        matters most.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "remediation-roadmap" && (
                  <FeatureOverlay
                    title="Remediation Roadmap"
                    subtitle="Prioritised timeline with effort estimates"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockRemediationRoadmap />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Generates a
                        prioritised remediation timeline based on finding severity and estimated
                        effort. Critical issues first, then high, then medium — with suggested
                        timelines for each phase.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "playbooks" && (
                  <FeatureOverlay
                    title="Remediation Playbooks"
                    subtitle="Step-by-step guides for each finding"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockPlaybooks />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Each finding has
                        a step-by-step playbook with exact navigation paths, CLI commands, and
                        verification steps for the Sophos Firewall admin console. Follow along to
                        fix issues quickly and correctly.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Remediation
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Plan, prioritise, and track the work needed to{" "}
                    <strong className="text-foreground">fix security findings</strong> — from
                    individual playbooks to full remediation roadmaps. Click each to preview.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton
                    icon={<TrendingUp className="h-4 w-4" />}
                    title="Progress Tracking"
                    desc="Track fix progress across all findings with completion metrics by severity"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("remediation-progress")}
                  />
                  <FeatureButton
                    icon={<Map className="h-4 w-4" />}
                    title="Remediation Roadmap"
                    desc="Prioritised timeline of recommended fixes with effort estimates"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("remediation-roadmap")}
                  />
                  <FeatureButton
                    icon={<ClipboardList className="h-4 w-4" />}
                    title="Playbooks"
                    desc="Step-by-step remediation guides with exact navigation paths and commands"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("playbooks")}
                  />
                </div>

                <div className="rounded-lg bg-[#00F2B3]/5 border border-[#00F2B3]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> The Remediation tab appears
                    when findings are detected. Use it to demonstrate ongoing security improvements
                    to your customers.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-tools" && (
              <div className="space-y-5 relative">
                {activeOverlay === "score-simulator" && (
                  <FeatureOverlay
                    title="Remediation Impact Simulator"
                    subtitle="See the projected impact of recommended security actions"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockScoreSimulator />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Select
                        recommended remediation actions and instantly see how your risk score,
                        grade, and security coverage would improve. Great for prioritising
                        remediation work and demonstrating ROI to customers.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "attack-surface" && (
                  <FeatureOverlay
                    title="Attack Surface Map"
                    subtitle="Visualise internet-facing services and exposed ports"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockAttackSurface />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Analyses firewall
                        rules to identify every service accessible from external zones. Maps exposed
                        ports, protocols, and admin interfaces to highlight your internet-facing
                        attack surface.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "export-centre" && (
                  <FeatureOverlay
                    title="Export Centre"
                    subtitle="Export reports, risk registers, and evidence"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="space-y-2">
                      {[
                        {
                          format: "PDF",
                          desc: "Branded report ready for client delivery",
                          icon: <FileText className="h-3.5 w-3.5 text-[#EA0022]" />,
                          types: "Individual, Executive, Compliance",
                        },
                        {
                          format: "Word (DOCX)",
                          desc: "Editable document for custom modifications",
                          icon: <FileText className="h-3.5 w-3.5 text-[#2006F7]" />,
                          types: "Individual, Executive, Compliance",
                        },
                        {
                          format: "PowerPoint (PPTX)",
                          desc: "Presentation-ready slides with charts",
                          icon: <FileText className="h-3.5 w-3.5 text-[#F29400]" />,
                          types: "Executive Summary",
                        },
                        {
                          format: "CSV / Excel",
                          desc: "Raw data for analysis and risk registers",
                          icon: <FileText className="h-3.5 w-3.5 text-[#00F2B3]" />,
                          types: "Findings, Risk Register, Evidence",
                        },
                        {
                          format: "ZIP Bundle",
                          desc: "All reports and evidence in a single download",
                          icon: <Package className="h-3.5 w-3.5 text-[#6B5BFF]" />,
                          types: "Full assessment package",
                        },
                      ].map((f) => (
                        <div
                          key={f.format}
                          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
                        >
                          <div className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                            {f.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-foreground">{f.format}</p>
                            <p className="text-[9px] text-muted-foreground">{f.desc}</p>
                            <p className="text-[8px] text-muted-foreground/60 mt-0.5">{f.types}</p>
                          </div>
                          <Download className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> The Export Centre
                        provides one-click downloads in multiple formats. Generate branded PDFs for
                        clients, editable Word docs for customisation, PowerPoint decks for
                        presentations, and CSV exports for data analysis — or download everything as
                        a ZIP bundle.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "config-compare" && (
                  <FeatureOverlay
                    title="Config Compare"
                    subtitle="Side-by-side diff between firewall configurations"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockConfigCompare />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Upload two
                        configs (e.g. before and after remediation) and FireComply shows a detailed
                        diff — changed rules, score impact, and whether findings were resolved. Also
                        available in the Compare tab.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Tools & Compare
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Power tools for deeper analysis —{" "}
                    <strong className="text-foreground">simulate scores</strong>,{" "}
                    <strong className="text-foreground">map your attack surface</strong>,{" "}
                    <strong className="text-foreground">compare configs</strong>, and{" "}
                    <strong className="text-foreground">export everything</strong>. Click each to
                    preview.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton
                    icon={<Zap className="h-4 w-4" />}
                    title="Remediation Simulator"
                    desc="See projected risk reduction from recommended actions"
                    color="text-[#F29400]"
                    onClick={() => setActiveOverlay("score-simulator")}
                  />
                  <FeatureButton
                    icon={<Target className="h-4 w-4" />}
                    title="Attack Surface"
                    desc="Map internet-facing services, ports, and access paths"
                    color="text-[#EA0022]"
                    onClick={() => setActiveOverlay("attack-surface")}
                  />
                  <FeatureButton
                    icon={<GitCompare className="h-4 w-4" />}
                    title="Config Compare"
                    desc="Side-by-side diff between before and after configs"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("config-compare")}
                  />
                  <FeatureButton
                    icon={<Package className="h-4 w-4" />}
                    title="Export Centre"
                    desc="Export reports, risk registers, and evidence in PDF, Word, PPTX"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("export-centre")}
                  />
                </div>

                <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> Upload two configs to enable
                    the Compare tab. The Remediation Impact Simulator and Attack Surface Map are in
                    the Tools tab after uploading any config.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-management" && (
              <div className="space-y-5 relative">
                {activeOverlay === "mgmt-dashboard" && (
                  <FeatureOverlay
                    title="Multi-Tenant Dashboard"
                    subtitle="Overview of all customer assessments"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockTenantDashboard />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you see:</strong> Every customer's
                        latest risk score, grade, firewall count, and score trend at a glance.
                        Includes licence expiry warnings for your managed estate.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-reports" && (
                  <FeatureOverlay
                    title="Saved Reports"
                    subtitle="Browse and reload previously saved reports"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockSavedReports />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you see:</strong> A searchable
                        library of every report your team has saved. Filter by customer, report
                        type, or date. Click any row to reload the full report in the viewer.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-history" && (
                  <FeatureOverlay
                    title="Assessment History"
                    subtitle="Track scores over time per customer"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockHistoryChart />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you see:</strong> A trend line of
                        risk scores for each customer over time. Demonstrate security improvements
                        and track the impact of your remediation work.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-settings" && (
                  <FeatureOverlay
                    title="Settings"
                    subtitle="Central API, security, team, alerts, and more"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockSettingsPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you see:</strong> Manage your
                        Sophos Central API, connector agents, team members and roles, client portal
                        branding, MFA and passkeys, alert rules, custom compliance frameworks, and
                        audit log — all in one place.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    The Management Panel
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Click your <strong className="text-foreground">organisation name</strong> in the
                    top navbar to open it. Click each tab below to preview.
                  </p>
                </div>

                {/* Visual representation of the navbar button */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-[#001A47] px-4 py-2.5 flex items-center gap-3">
                    <img src="/sophos-icon-white.svg" alt="" className="h-5 w-5" />
                    <span className="text-[11px] font-bold text-white flex-1">
                      Sophos FireComply
                    </span>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 border border-white/20">
                      <Building2 className="h-3 w-3 text-white/70" />
                      <span className="text-[10px] font-medium text-white">
                        {orgName || "Your Org"}
                      </span>
                      <ChevronDown className="h-2.5 w-2.5 text-white/70" />
                    </div>
                    <MousePointerClick className="h-4 w-4 text-[#00EDFF] animate-pulse" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton
                    icon={<LayoutDashboard className="h-4 w-4" />}
                    title="Dashboard"
                    desc="Multi-tenant overview of all customer scores and licence expiry"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("mgmt-dashboard")}
                  />
                  <FeatureButton
                    icon={<FileText className="h-4 w-4" />}
                    title="Reports"
                    desc="Browse and reload all previously saved reports"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("mgmt-reports")}
                  />
                  <FeatureButton
                    icon={<History className="h-4 w-4" />}
                    title="History"
                    desc="Track assessment scores over time per customer"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("mgmt-history")}
                  />
                  <FeatureButton
                    icon={<Settings className="h-4 w-4" />}
                    title="Settings"
                    desc="Central API, team management, activity log, and re-run setup"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("mgmt-settings")}
                  />
                </div>
              </div>
            )}

            {step.id === "guide-team-security" && (
              <div className="space-y-5 relative">
                {activeOverlay === "team-mgmt" && (
                  <FeatureOverlay
                    title="Team Management"
                    subtitle="Invite colleagues and assign roles"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockTeamPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Invite team
                        members by email, assign them roles (Owner, Engineer, or Viewer), and
                        collaborate on assessments. Each role has different permissions — Engineers
                        can run assessments and generate reports, while Viewers have read-only
                        access.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mfa" && (
                  <FeatureOverlay
                    title="Multi-Factor Authentication"
                    subtitle="TOTP-based authenticator app"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="space-y-4">
                      <MockSecurityPanel />
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-foreground">Setup Process</p>
                        <div className="space-y-1.5">
                          {[
                            {
                              step: "1",
                              text: "Open Settings \u203a Security and click 'Enable MFA'",
                            },
                            {
                              step: "2",
                              text: "Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)",
                            },
                            { step: "3", text: "Enter the 6-digit code to verify and activate" },
                          ].map((s) => (
                            <div key={s.step} className="flex items-start gap-2 text-[9px]">
                              <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#00F2B3] text-white text-[8px] font-bold shrink-0 mt-0.5">
                                {s.step}
                              </span>
                              <span className="text-muted-foreground">{s.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">Why MFA?</strong> Multi-factor
                        authentication adds a critical second layer of protection to your account.
                        Even if your password is compromised, your account stays secure.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "passkeys" && (
                  <FeatureOverlay
                    title="Passkeys"
                    subtitle="Passwordless sign-in with biometrics"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-3 py-4">
                        <div className="h-14 w-14 rounded-2xl bg-[#6B5BFF]/10 flex items-center justify-center">
                          <Fingerprint className="h-7 w-7 text-[#6B5BFF]" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-semibold text-foreground">
                            Passwordless Authentication
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Sign in with Face ID, Touch ID, Windows Hello, or a hardware security
                            key
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card p-3">
                        <p className="text-[10px] font-semibold text-foreground mb-2">
                          Registered Passkeys
                        </p>
                        <div className="flex items-center gap-3 rounded bg-muted/20 p-2.5">
                          <Fingerprint className="h-4 w-4 text-[#6B5BFF]" />
                          <div className="flex-1">
                            <p className="text-[10px] font-medium text-foreground">
                              MacBook Pro Touch ID
                            </p>
                            <p className="text-[9px] text-muted-foreground">Added 12 Mar 2026</p>
                          </div>
                          <span className="text-[9px] text-[#00F2B3] font-medium">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Passkeys use your
                        device's built-in biometric or hardware security to authenticate. They're
                        phishing-resistant and more secure than traditional passwords. Register one
                        in Settings &gt; Security.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Team & Security
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Invite your team and secure your workspace with{" "}
                    <strong className="text-foreground">multi-factor authentication</strong> and{" "}
                    <strong className="text-foreground">passkeys</strong>. Click each to learn more.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton
                    icon={<UserPlus className="h-4 w-4" />}
                    title="Team Management"
                    desc="Invite colleagues by email and assign Owner, Engineer, or Viewer roles"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("team-mgmt")}
                  />
                  <FeatureButton
                    icon={<Lock className="h-4 w-4" />}
                    title="Multi-Factor Authentication"
                    desc="Add TOTP-based verification via authenticator app for all logins"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("mfa")}
                  />
                  <FeatureButton
                    icon={<Fingerprint className="h-4 w-4" />}
                    title="Passkeys"
                    desc="Passwordless sign-in with Face ID, Touch ID, or hardware security keys"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("passkeys")}
                  />
                </div>

                <div className="rounded-lg bg-[#00F2B3]/5 border border-[#00F2B3]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Recommendation:</strong> Enable MFA or
                    register a passkey for your account as soon as possible. You can set these up in
                    Settings &gt; Security.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-portal-alerts" && (
              <div className="space-y-5 relative">
                {activeOverlay === "client-portal" && (
                  <FeatureOverlay
                    title="Client Portal"
                    subtitle="Branded assessment portal for your customers"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockClientPortalPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Create branded,
                        read-only portals for your customers. Each client gets their own secure view
                        showing risk scores, reports, compliance status, and assessment history —
                        with your MSP branding and logo.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "alerts" && (
                  <FeatureOverlay
                    title="Alerts & Notifications"
                    subtitle="Email and webhook notifications"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockAlertPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Configure alert
                        rules to get notified when critical events happen — new critical findings,
                        agents going offline, configuration drift, or licence expiry. Send alerts
                        via email, webhook (Slack, Teams, etc.), or both.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "scheduled-reports" && (
                  <FeatureOverlay
                    title="Scheduled Reports"
                    subtitle="Automated report delivery to customers"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockScheduledReports />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Schedule
                        automatic report delivery — compliance, executive, or full suite — on a
                        weekly, monthly, or quarterly basis. Reports are generated and emailed
                        directly to your customers with your MSP branding.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "webhooks" && (
                  <FeatureOverlay
                    title="Webhook Integrations"
                    subtitle="POST data to your PSA, RMM, or ticketing system"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockWebhookPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Configure webhook
                        endpoints to receive JSON payloads when key events happen — assessments
                        complete, critical findings detected, reports saved, or agents go offline.
                        Integrate with Slack, Teams, ConnectWise, Datto, or any system that accepts
                        webhooks.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Portal, Alerts & Integrations
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Share results with customers through{" "}
                    <strong className="text-foreground">branded portals</strong>, automate{" "}
                    <strong className="text-foreground">scheduled reports</strong>, stay informed
                    with <strong className="text-foreground">real-time alerts</strong>, and connect
                    to your <strong className="text-foreground">existing tools via webhooks</strong>
                    . Click each to learn more.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton
                    icon={<Globe className="h-4 w-4" />}
                    title="Client Portal"
                    desc="Branded read-only portal for customers with scores and reports"
                    color="text-[#005BC8]"
                    onClick={() => setActiveOverlay("client-portal")}
                  />
                  <FeatureButton
                    icon={<Bell className="h-4 w-4" />}
                    title="Alerts"
                    desc="Email and webhook alerts for critical findings and drift"
                    color="text-[#F29400]"
                    onClick={() => setActiveOverlay("alerts")}
                  />
                  <FeatureButton
                    icon={<Calendar className="h-4 w-4" />}
                    title="Scheduled Reports"
                    desc="Auto-email compliance reports on a weekly, monthly, or quarterly basis"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("scheduled-reports")}
                  />
                  <FeatureButton
                    icon={<Webhook className="h-4 w-4" />}
                    title="Webhooks"
                    desc="POST assessment data to your PSA, RMM, or ticketing system"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("webhooks")}
                  />
                </div>

                <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> Configure all of these from
                    Settings. Client portals and scheduled reports are especially useful for MSPs
                    who want to give customers ongoing visibility into their security posture.
                  </p>
                </div>
              </div>
            )}

            {step.id === "done" && (
              <div className="text-center space-y-5 py-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#00F2B3] to-[#00F2B3] flex items-center justify-center mx-auto shadow-lg shadow-[#00F2B3]/20">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-foreground">
                    You're All Set!
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Your workspace is ready. Upload a Sophos XGS firewall config export to start
                    your first security assessment.
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card p-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-foreground">What's next?</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        <strong className="text-foreground">Upload</strong> a firewall HTML config
                        export
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        <strong className="text-foreground">Review</strong> the automated security
                        assessment
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        <strong className="text-foreground">Generate</strong> AI-powered reports for
                        your customer
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-card flex items-center gap-3 shrink-0">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3 w-3" />
                Back
              </Button>
            )}
            {isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-xs text-muted-foreground"
              >
                Skip setup
              </Button>
            )}
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1.5 text-xs bg-[#2006F7] hover:bg-[#10037C] text-white"
            >
              {isLast ? "Start Using FireComply" : "Continue"}
              {!isLast && <ArrowRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function RerunSetupButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl border border-border/50 bg-card shadow-card hover:bg-muted/20 transition-colors text-left group"
    >
      <div className="h-9 w-9 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0 group-hover:bg-brand-accent/15 dark:group-hover:bg-[#00EDFF]/15 transition-colors">
        <RotateCcw className="h-4.5 w-4.5 text-brand-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-display font-semibold tracking-tight text-foreground">
          Re-run First-Time Setup
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          Walk through the setup wizard again to update branding and connections
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}

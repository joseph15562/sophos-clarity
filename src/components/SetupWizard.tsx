import { useState, useMemo, lazy, Suspense } from "react";
import {
  ArrowRight, ArrowLeft, Building2, Wifi, Upload, Sparkles, Check, X, RotateCcw,
  FileText, LayoutDashboard, Settings, Eye, Download, MousePointerClick,
  ChevronDown, Shield, BarChart3, History, Users, Activity, ExternalLink,
  Plug, Key, RefreshCw, Bell, Globe, Lock, Fingerprint, Mail, Webhook,
  BookOpen, UserPlus, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrandingData } from "@/components/BrandingSetup";

const CentralIntegration = lazy(() => import("@/components/CentralIntegration").then((m) => ({ default: m.CentralIntegration })));

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

type StepId = "welcome" | "branding" | "central" | "connector-agent" | "guide-upload" | "guide-pre-ai" | "guide-ai-reports" | "guide-management" | "guide-team-security" | "guide-portal-alerts" | "done";

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
  { id: "guide-management", title: "Management", icon: LayoutDashboard },
  { id: "guide-team-security", title: "Team & Security", icon: Users },
  { id: "guide-portal-alerts", title: "Portal & Alerts", icon: Globe },
  { id: "done", title: "Ready", icon: Check },
];

const AGENT_STEP: Step = { id: "connector-agent", title: "Connector Agent", icon: Plug };

function GuideStep({ number, title, description, icon, color }: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#2006F7] text-white text-[9px] font-bold">{number}</span>
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

/* ── Overlay infrastructure ── */

function FeatureOverlay({ title, subtitle, onClose, children }: {
  title: string; subtitle: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-150">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card shrink-0">
        <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground" aria-label="Go back">
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

function FeatureButton({ icon, title, desc, color, onClick }: {
  icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:border-[#2006F7]/30 hover:bg-muted/30 transition-all group"
    >
      <div className={`h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 ${color} group-hover:scale-110 transition-transform`}>
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
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/20" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 50 50)" />
      <text x="50" y="46" textAnchor="middle" fill={color} fontSize="22" fontWeight="700">{score}</text>
      <text x="50" y="62" textAnchor="middle" fill={color} fontSize="10" fontWeight="600">Grade {grade}</text>
    </svg>
  );
}

function MockRadar() {
  const labels = ["Web Filter", "IPS", "App Control", "Auth", "Logging", "Rule Hygiene", "Admin", "Anti-Malware"];
  const cx = 90, cy = 90, r = 70;
  const points = labels.map((_, i) => {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const v = [0.0, 0.0, 1.0, 1.0, 1.0, 0.29, 1.0, 1.0][i];
    return { x: cx + r * v * Math.cos(angle), y: cy + r * v * Math.sin(angle), lx: cx + (r + 14) * Math.cos(angle), ly: cy + (r + 14) * Math.sin(angle), label: labels[i] };
  });
  const polyPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" className="mx-auto">
      {[1, 0.75, 0.5, 0.25].map((s) => (
        <polygon key={s} points={labels.map((_, i) => { const a = (Math.PI * 2 * i) / labels.length - Math.PI / 2; return `${cx + r * s * Math.cos(a)},${cy + r * s * Math.sin(a)}`; }).join(" ")} fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted/30" />
      ))}
      <polygon points={polyPoints} fill="#2006F7" fillOpacity="0.15" stroke="#2006F7" strokeWidth="1.5" />
      {points.map((p, i) => (
        <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fontSize="6" fill="currentColor" className="text-muted-foreground">{p.label}</text>
      ))}
    </svg>
  );
}

function MockSeverityBar() {
  const items = [
    { label: "Critical", count: 3, color: "#EA0022", pct: 10 },
    { label: "High", count: 8, color: "#F29400", pct: 25 },
    { label: "Medium", count: 14, color: "#F8E300", pct: 44 },
    { label: "Low", count: 7, color: "#00995a", pct: 21 },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden">
        {items.map((s) => (<div key={s.label} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockInspectionPosture() {
  const stats = [
    { label: "TOTAL", value: "33" }, { label: "WAN", value: "13" }, { label: "DISABLED", value: "2" },
    { label: "NAT", value: "6" }, { label: "HOSTS", value: "41" }, { label: "INTERFACES", value: "18" },
  ];
  const coverage = [
    { label: "Web Filtering", pct: 0 }, { label: "Intrusion Prevention", pct: 0 },
    { label: "App Control", pct: 0 }, { label: "SSL/TLS Inspection", pct: 38 },
  ];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold text-foreground mb-2">Configuration Health</p>
        <div className="grid grid-cols-6 gap-1.5">
          {stats.map((s) => (
            <div key={s.label} className="rounded border border-border bg-muted/20 p-1.5 text-center">
              <p className="text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-[7px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold text-foreground mb-2">Feature Coverage <span className="font-normal text-muted-foreground">13 WAN rules</span></p>
        <div className="grid grid-cols-2 gap-2">
          {coverage.map((c) => (
            <div key={c.label} className="rounded border border-border bg-muted/20 p-2">
              <p className="text-[9px] text-muted-foreground mb-1">{c.label}</p>
              <p className={`text-lg font-bold ${c.pct === 0 ? "text-[#EA0022]" : "text-[#F29400]"}`}>{c.pct}%</p>
              <div className="h-1 rounded-full bg-muted mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${c.pct === 0 ? "bg-[#EA0022]" : "bg-[#F29400]"}`} style={{ width: `${Math.max(c.pct, 3)}%` }} />
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
            {controls.map((c) => (<th key={c} className="px-1.5 py-1.5 text-center font-medium text-muted-foreground">{c}</th>))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {frameworks.map((fw, fi) => (
            <tr key={fw} className="hover:bg-muted/10">
              <td className="px-2 py-1.5 font-medium text-foreground">{fw}</td>
              {controls.map((c, ci) => {
                const status = [(fi + ci) % 3 === 0 ? "pass" : (fi + ci) % 3 === 1 ? "fail" : "partial"][0];
                return (
                  <td key={c} className="px-1.5 py-1.5 text-center">
                    <span className={`inline-block w-4 h-4 rounded text-[8px] font-bold leading-4 ${
                      status === "pass" ? "bg-[#00995a]/15 text-[#00995a]" :
                      status === "fail" ? "bg-[#EA0022]/15 text-[#EA0022]" :
                      "bg-[#F29400]/15 text-[#F29400]"
                    }`}>
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
          <div key={t} className={`px-2.5 py-1.5 text-[9px] font-medium border-b-2 ${i === activeIdx ? "border-[#2006F7] text-[#2006F7]" : "border-transparent text-muted-foreground"}`}>{t}</div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
        {type === "individual" && (
          <>
            <div className="h-3 bg-foreground/10 rounded w-2/3" />
            <div className="h-2 bg-foreground/5 rounded w-full" />
            <div className="h-2 bg-foreground/5 rounded w-5/6" />
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-foreground">Finding: Admin services exposed to WAN</p>
              <p className="text-[9px] text-muted-foreground">HTTPS and SSH admin access is enabled on the WAN interface, exposing the management console to the internet...</p>
              <div className="flex gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#EA0022]/10 text-[#EA0022]">HIGH</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] bg-muted text-muted-foreground">Device Hardening</span>
              </div>
            </div>
          </>
        )}
        {type === "executive" && (
          <>
            <p className="text-[10px] font-semibold text-foreground">Executive Summary</p>
            <div className="grid grid-cols-3 gap-2 my-2">
              <div className="rounded border border-border bg-card p-2 text-center">
                <p className="text-lg font-bold text-[#F29400]">54</p>
                <p className="text-[8px] text-muted-foreground">Risk Score</p>
              </div>
              <div className="rounded border border-border bg-card p-2 text-center">
                <p className="text-lg font-bold text-[#EA0022]">32</p>
                <p className="text-[8px] text-muted-foreground">Findings</p>
              </div>
              <div className="rounded border border-border bg-card p-2 text-center">
                <p className="text-lg font-bold text-[#00995a]">8</p>
                <p className="text-[8px] text-muted-foreground">Recommendations</p>
              </div>
            </div>
            <div className="h-2 bg-foreground/5 rounded w-full" />
            <div className="h-2 bg-foreground/5 rounded w-4/5" />
          </>
        )}
        {type === "compliance" && (
          <>
            <p className="text-[10px] font-semibold text-foreground">ISO 27001 Compliance Assessment</p>
            <div className="space-y-1.5 mt-2">
              {["A.9 Access Control", "A.10 Cryptography", "A.12 Operations Security", "A.13 Communications Security"].map((c) => (
                <div key={c} className="flex items-center gap-2 text-[9px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.includes("Crypto") ? "bg-[#EA0022]" : "bg-[#00995a]"}`} />
                  <span className="text-foreground flex-1">{c}</span>
                  <span className={`font-bold ${c.includes("Crypto") ? "text-[#EA0022]" : "text-[#00995a]"}`}>{c.includes("Crypto") ? "FAIL" : "PASS"}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex gap-1.5">
        <div className="px-2 py-1 rounded text-[9px] font-medium bg-[#2006F7]/10 text-[#2006F7]">PDF</div>
        <div className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">Word</div>
        <div className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">PPTX</div>
        <div className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">ZIP</div>
      </div>
    </div>
  );
}

function MockTenantDashboard() {
  const customers = [
    { name: "Acme Corp", score: 78, grade: "B", firewalls: 2, color: "#00995a" },
    { name: "Global Bank Ltd", score: 54, grade: "D", firewalls: 4, color: "#F29400" },
    { name: "MediHealth", score: 91, grade: "A", firewalls: 1, color: "#00995a" },
  ];
  return (
    <div className="space-y-2">
      {customers.map((c) => (
        <div key={c.name} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center">
            <span className="text-sm font-bold" style={{ color: c.color }}>{c.score}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{c.name}</p>
            <p className="text-[9px] text-muted-foreground">{c.firewalls} firewall{c.firewalls !== 1 ? "s" : ""} · Grade {c.grade}</p>
          </div>
          <div className="h-6 w-16 rounded bg-muted/20 overflow-hidden flex items-end">
            {[40, 55, 60, 72, c.score].map((v, i) => (
              <div key={i} className="flex-1 mx-px rounded-t" style={{ height: `${v}%`, backgroundColor: c.color, opacity: 0.3 + i * 0.17 }} />
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
        <span>Customer</span><span>Type</span><span>Date</span><span>Score</span>
      </div>
      {reports.map((r) => (
        <div key={r.customer + r.type} className="grid grid-cols-[1fr_80px_80px_40px] gap-2 px-3 py-2 border-t border-border items-center">
          <span className="text-[10px] font-medium text-foreground">{r.customer}</span>
          <span className="text-[9px] text-muted-foreground">{r.type}</span>
          <span className="text-[9px] text-muted-foreground">{r.date}</span>
          <span className="text-[10px] font-bold" style={{ color: r.score >= 75 ? "#00995a" : r.score >= 50 ? "#F29400" : "#EA0022" }}>{r.score}</span>
        </div>
      ))}
    </div>
  );
}

function MockHistoryChart() {
  const points = [42, 48, 55, 54, 62, 68, 78];
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const maxV = 100;
  const w = 280, h = 100, pad = 20;
  const plotW = w - pad * 2, plotH = h - pad;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 10}`} className="text-muted-foreground">
      {[25, 50, 75].map((v) => (
        <line key={v} x1={pad} x2={w - pad} y1={h - pad - (v / maxV) * plotH} y2={h - pad - (v / maxV) * plotH} stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      ))}
      <polyline
        fill="none" stroke="#2006F7" strokeWidth="2" strokeLinejoin="round"
        points={points.map((v, i) => `${pad + (i / (points.length - 1)) * plotW},${h - pad - (v / maxV) * plotH}`).join(" ")}
      />
      {points.map((v, i) => (
        <g key={i}>
          <circle cx={pad + (i / (points.length - 1)) * plotW} cy={h - pad - (v / maxV) * plotH} r="3" fill="#2006F7" />
          <text x={pad + (i / (points.length - 1)) * plotW} y={h} textAnchor="middle" fontSize="7" fill="currentColor">{months[i]}</text>
        </g>
      ))}
    </svg>
  );
}

function MockSettingsPanel() {
  return (
    <div className="space-y-2">
      {[
        { icon: <Wifi className="h-3.5 w-3.5 text-[#005BC8]" />, title: "Sophos Central API", desc: "Connected · Partner account · Last synced 3m ago" },
        { icon: <Plug className="h-3.5 w-3.5 text-[#00995a]" />, title: "Connector Agents", desc: "2 agents online · 1 drift alert" },
        { icon: <Users className="h-3.5 w-3.5 text-[#2006F7]" />, title: "Team Management", desc: "3 members · 1 pending invite" },
        { icon: <Globe className="h-3.5 w-3.5 text-[#005BC8]" />, title: "Client Portal", desc: "Branded customer access" },
        { icon: <Lock className="h-3.5 w-3.5 text-[#00995a]" />, title: "Security", desc: "MFA enabled · 1 passkey registered" },
        { icon: <Bell className="h-3.5 w-3.5 text-[#F29400]" />, title: "Alerts", desc: "3 rules active · Email + webhook" },
        { icon: <Activity className="h-3.5 w-3.5 text-[#6B5BFF]" />, title: "Activity Log", desc: "47 events · Last: report.saved 2h ago" },
      ].map((s) => (
        <div key={s.title} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          <div className="h-6 w-6 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">{s.icon}</div>
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
        <div key={m.email} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          <div className="h-8 w-8 rounded-full bg-[#2006F7]/10 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-[#2006F7]">{m.name.split(" ").map((n) => n[0]).join("")}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{m.name}</p>
            <p className="text-[9px] text-muted-foreground">{m.email}</p>
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
            m.role === "Owner" ? "bg-[#2006F7]/10 text-[#2006F7]" :
            m.role === "Engineer" ? "bg-[#6B5BFF]/10 text-[#6B5BFF]" :
            "bg-muted text-muted-foreground"
          }`}>{m.role}</span>
          {m.status === "pending" && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#F29400]/10 text-[#F29400] font-medium">Pending</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MockSecurityPanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#00995a]/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4 text-[#00995a]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-foreground">Multi-Factor Authentication</p>
          <p className="text-[9px] text-muted-foreground">TOTP-based authenticator app verification</p>
        </div>
        <div className="px-2 py-1 rounded text-[9px] font-semibold bg-[#00995a]/10 text-[#00995a]">Enabled</div>
      </div>
      <div className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#6B5BFF]/10 flex items-center justify-center shrink-0">
          <Fingerprint className="h-4 w-4 text-[#6B5BFF]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-foreground">Passkeys</p>
          <p className="text-[9px] text-muted-foreground">Passwordless sign-in with biometrics or hardware keys</p>
        </div>
        <div className="px-2 py-1 rounded text-[9px] font-semibold bg-[#6B5BFF]/10 text-[#6B5BFF]">1 registered</div>
      </div>
    </div>
  );
}

function MockAlertPanel() {
  const rules = [
    { name: "Critical findings detected", channel: "Email", icon: <Mail className="h-3 w-3" />, color: "#EA0022" },
    { name: "Agent offline > 24 hours", channel: "Email + Webhook", icon: <Bell className="h-3 w-3" />, color: "#F29400" },
    { name: "Config drift detected", channel: "Webhook", icon: <Webhook className="h-3 w-3" />, color: "#2006F7" },
  ];
  return (
    <div className="space-y-2">
      {rules.map((r) => (
        <div key={r.name} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
          <div className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0" style={{ color: r.color }}>
            {r.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-foreground">{r.name}</p>
            <p className="text-[9px] text-muted-foreground">{r.channel}</p>
          </div>
          <div className="h-4 w-7 rounded-full bg-[#00995a] flex items-center justify-end px-0.5">
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
              { label: "Risk Score", value: "78", color: "#00995a" },
              { label: "Findings", value: "14", color: "#F29400" },
              { label: "Reports", value: "3", color: "#2006F7" },
            ].map((s) => (
              <div key={s.label} className="rounded border border-border bg-muted/20 p-2 text-center">
                <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[8px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <span className="px-2 py-1 rounded text-[9px] font-medium bg-[#2006F7]/10 text-[#2006F7]">Reports</span>
            <span className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">Compliance</span>
            <span className="px-2 py-1 rounded text-[9px] font-medium bg-muted text-muted-foreground">History</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCustomFrameworkPanel() {
  const controls = [
    { id: "CF-01", name: "Firewall Rule Hygiene", desc: "No disabled or orphaned rules", status: "pass" },
    { id: "CF-02", name: "Admin Access Policy", desc: "No WAN admin services exposed", status: "fail" },
    { id: "CF-03", name: "Encryption Standards", desc: "TLS 1.2+ enforced on all VPNs", status: "pass" },
    { id: "CF-04", name: "Logging Requirements", desc: "All rule actions logged", status: "partial" },
  ];
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <BookOpen className="h-3.5 w-3.5 text-[#6B5BFF]" />
          <p className="text-[10px] font-semibold text-foreground">Internal Security Standard v2.1</p>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#6B5BFF]/10 text-[#6B5BFF] font-medium ml-auto">Custom</span>
        </div>
        <div className="space-y-1.5">
          {controls.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-[9px] rounded bg-muted/20 px-2 py-1.5">
              <span className="font-mono text-muted-foreground w-10 shrink-0">{c.id}</span>
              <div className="flex-1 min-w-0">
                <span className="text-foreground font-medium">{c.name}</span>
                <span className="text-muted-foreground ml-1">— {c.desc}</span>
              </div>
              <span className={`font-bold ${
                c.status === "pass" ? "text-[#00995a]" : c.status === "fail" ? "text-[#EA0022]" : "text-[#F29400]"
              }`}>{c.status === "pass" ? "\u2713" : c.status === "fail" ? "\u2717" : "~"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SetupWizard({ open, onClose, branding, onBrandingChange, orgName, isGuest }: Props) {
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
        <div className="w-full max-w-xl bg-background rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header with progress */}
          <div className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src="/sophos-icon-white.svg" alt="Sophos" className="h-5 w-5 hidden dark:block" />
                <img src="/sophos-icon-white.svg" alt="Sophos" className="h-5 w-5 dark:hidden brightness-0" />
                <span className="text-sm font-display font-bold text-foreground">FireComply Setup</span>
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
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < currentStep ? "bg-[#00995a] dark:bg-[#00F2B3]" :
                    i === currentStep ? "bg-[#2006F7]" :
                    "bg-muted"
                  }`} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-7 w-7 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center">
                <step.icon className="h-3.5 w-3.5 text-[#2006F7] dark:text-[#00EDFF]" />
              </div>
              <span className="text-xs font-semibold text-foreground">{step.title}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Step {currentStep + 1} of {steps.length}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step.id === "welcome" && (
              <div className="text-center space-y-5 py-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2006F7] to-[#00EDFF] flex items-center justify-center mx-auto shadow-lg shadow-[#2006F7]/20">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-foreground">
                    Welcome to Sophos FireComply{orgName ? `, ${orgName}` : ""}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Let's get your workspace set up. This takes about 2 minutes and you can always change these settings later.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg border border-border bg-card p-3 text-center">
                    <Building2 className="h-5 w-5 mx-auto text-[#2006F7] dark:text-[#6B5BFF] mb-1.5" />
                    <p className="text-[10px] font-medium text-foreground">Branding & Central</p>
                    <p className="text-[9px] text-muted-foreground">Company details & API</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 text-center">
                    <Shield className="h-5 w-5 mx-auto text-[#00995a] dark:text-[#00F2B3] mb-1.5" />
                    <p className="text-[10px] font-medium text-foreground">Team & Security</p>
                    <p className="text-[9px] text-muted-foreground">MFA, passkeys, roles</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 text-center">
                    <Globe className="h-5 w-5 mx-auto text-[#005BC8] dark:text-[#00EDFF] mb-1.5" />
                    <p className="text-[10px] font-medium text-foreground">Portal & Alerts</p>
                    <p className="text-[9px] text-muted-foreground">Client portals, notifications</p>
                  </div>
                </div>
              </div>
            )}

            {step.id === "branding" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Company Branding</h3>
                  <p className="text-[11px] text-muted-foreground">
                    This information appears on all your reports and assessments. You can change it anytime.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="setup-company" className="text-xs">Company / MSP Name</Label>
                    <Input
                      id="setup-company"
                      placeholder="e.g. Acme IT Solutions"
                      value={branding.companyName}
                      onChange={(e) => onBrandingChange({ ...branding, companyName: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="setup-prepared" className="text-xs">Prepared By</Label>
                      <Input
                        id="setup-prepared"
                        placeholder="e.g. Joseph McDonald"
                        value={branding.preparedBy ?? ""}
                        onChange={(e) => onBrandingChange({ ...branding, preparedBy: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setup-footer" className="text-xs">Report Footer</Label>
                      <Input
                        id="setup-footer"
                        placeholder="e.g. Confidential"
                        value={branding.footerText ?? ""}
                        onChange={(e) => onBrandingChange({ ...branding, footerText: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border p-3">
                    <p className="text-[10px] text-muted-foreground">
                      <strong className="text-foreground">Tip:</strong> You can add a logo and set customer-specific details later in the Assessment Context section.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step.id === "central" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Connect Sophos Central</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Link your Sophos Central Partner or Tenant account to enrich reports with live firewall data, licence info, and alerts. You can skip this and connect later.
                  </p>
                </div>
                <Suspense fallback={<Skeleton />}>
                  <CentralIntegration />
                </Suspense>
              </div>
            )}

            {step.id === "connector-agent" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">FireComply Connector Agent</h3>
                  <p className="text-[11px] text-muted-foreground">
                    The Connector Agent is a lightweight desktop app that sits on your customer's network and automatically pulls firewall configs, runs security assessments, and submits results back to FireComply — on a schedule, with no manual exports needed.
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
                    color="text-[#00995a]"
                  />
                </div>

                {/* Mock agent card */}
                <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">What you'll see in the dashboard</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#00995a]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground">HQ Primary Agent</p>
                      <p className="text-[9px] text-muted-foreground">Acme Corp · 192.168.1.1:4444</p>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#009CFB]/10 text-[#009CFB] font-semibold">v22.0</span>
                    <span className="text-[10px] font-bold text-[#00995a]">82/B</span>
                    <span className="text-[9px] text-muted-foreground">2h ago</span>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F29400]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground">Branch Office Agent</p>
                      <p className="text-[9px] text-muted-foreground">Acme Corp · 10.0.0.1:4444</p>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F29400]/10 text-[#F29400] font-semibold">v21.0</span>
                    <span className="text-[10px] font-bold text-[#F29400]">58/D</span>
                    <span className="text-[9px] text-muted-foreground">6h ago</span>
                  </div>
                </div>

                <div className="rounded-lg bg-[#2006F7]/5 border border-[#2006F7]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Optional:</strong> The agent is completely optional. You can always upload firewall configs manually instead. The agent just automates the process for ongoing monitoring.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-upload" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">How to Upload & Assess</h3>
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
                    color="text-[#00995a]"
                  />
                  <GuideStep
                    number={4}
                    title="Link to Sophos Central"
                    description='If connected, click "Link Firewall" to match each config to its Central firewall for live data enrichment.'
                    icon={<Wifi className="h-4 w-4" />}
                    color="text-[#00EDFF]"
                  />
                </div>

                <div className="rounded-lg bg-[#2006F7]/5 border border-[#2006F7]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> Set the customer name and compliance frameworks in the <strong className="text-foreground">Assessment Context</strong> section before generating reports — this tailors the AI analysis.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-pre-ai" && (
              <div className="space-y-5 relative">
                {activeOverlay === "risk-score" && (
                  <FeatureOverlay title="Risk Score & Grade" subtitle="A-F rating based on weighted security checks" onClose={() => setActiveOverlay(null)}>
                    <div className="flex flex-col items-center gap-4">
                      <MockGauge score={54} grade="D" color="#F29400" />
                      <MockRadar />
                      <div className="w-full grid grid-cols-4 gap-1.5">
                        {[
                          { label: "Network", pct: 45 }, { label: "Access", pct: 62 },
                          { label: "Logging", pct: 80 }, { label: "Hardening", pct: 35 },
                        ].map((c) => (
                          <div key={c.label} className="rounded border border-border bg-muted/20 p-2 text-center">
                            <p className="text-sm font-bold text-foreground">{c.pct}%</p>
                            <p className="text-[8px] text-muted-foreground">{c.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> Each security check is weighted by severity. The gauge shows the overall risk score (0–100) and assigns a letter grade. The radar chart breaks down scores by category.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "findings" && (
                  <FeatureOverlay title="Findings & Severity" subtitle="Critical, high, medium, low categorised issues" onClose={() => setActiveOverlay(null)}>
                    <MockSeverityBar />
                    <div className="mt-4 space-y-1.5">
                      {[
                        { severity: "CRITICAL", title: "Default admin password unchanged", color: "#EA0022" },
                        { severity: "HIGH", title: "WAN admin services exposed", color: "#F29400" },
                        { severity: "MEDIUM", title: "DNS rebinding protection disabled", color: "#F8E300" },
                        { severity: "LOW", title: "SNMP community string is 'public'", color: "#00995a" },
                      ].map((f) => (
                        <div key={f.title} className="flex items-center gap-2 rounded border border-border bg-card p-2">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: f.color + "15", color: f.color }}>{f.severity}</span>
                          <span className="text-[10px] text-foreground">{f.title}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> Every parsed configuration item is checked against known security anti-patterns. Findings are categorised by severity and grouped by domain.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "inspection" && (
                  <FeatureOverlay title="Inspection Posture" subtitle="IPS, web filter, app control, SSL/TLS coverage" onClose={() => setActiveOverlay(null)}>
                    <MockInspectionPosture />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> FireComply examines every firewall rule to determine which security features (IPS, web filter, app control, SSL/TLS inspection) are applied and reports the coverage as a percentage of WAN-facing rules.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "compliance" && (
                  <FeatureOverlay title="Compliance Mapping" subtitle="ISO 27001, NIST, PCI DSS, Cyber Essentials" onClose={() => setActiveOverlay(null)}>
                    <MockComplianceGrid />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> Firewall findings are mapped to controls from selected compliance frameworks. Each control is marked as pass, fail, or partial based on the configuration analysis.</p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Pre-AI Assessment (Instant)</h3>
                  <p className="text-[11px] text-muted-foreground">
                    As soon as you upload a config, FireComply runs a <strong className="text-foreground">deterministic analysis</strong> — no AI needed. Click each panel below to preview.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton icon={<Shield className="h-4 w-4" />} title="Risk Score & Grade" desc="A-F rating with radar chart and category scores" color="text-[#00995a]" onClick={() => setActiveOverlay("risk-score")} />
                  <FeatureButton icon={<BarChart3 className="h-4 w-4" />} title="Findings & Severity" desc="Critical, high, medium, low categorised issues" color="text-[#EA0022]" onClick={() => setActiveOverlay("findings")} />
                  <FeatureButton icon={<Eye className="h-4 w-4" />} title="Inspection Posture" desc="IPS, web filter, app control, SSL/TLS coverage" color="text-[#2006F7]" onClick={() => setActiveOverlay("inspection")} />
                  <FeatureButton icon={<FileText className="h-4 w-4" />} title="Compliance Mapping" desc="ISO 27001, NIST, PCI DSS, Cyber Essentials" color="text-[#6B5BFF]" onClick={() => setActiveOverlay("compliance")} />
                </div>

                <div className="rounded-lg bg-[#00995a]/5 border border-[#00995a]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Why Pre-AI?</strong> The deterministic analysis is repeatable and consistent — same config always gives the same score. It's the baseline before AI adds narrative reporting.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-ai-reports" && (
              <div className="space-y-5 relative">
                {activeOverlay === "report-individual" && (
                  <FeatureOverlay title="Individual Firewall Report" subtitle="Deep-dive analysis per firewall with finding-level detail" onClose={() => setActiveOverlay(null)}>
                    <MockReportViewer type="individual" />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">What you get:</strong> A detailed, AI-generated narrative for each firewall covering every finding, remediation steps, and priority ranking. If linked to Central, live firmware and alert data is woven in.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "report-executive" && (
                  <FeatureOverlay title="Executive Summary" subtitle="High-level overview for management" onClose={() => setActiveOverlay(null)}>
                    <MockReportViewer type="executive" />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">What you get:</strong> A management-friendly document with key metrics, risk posture overview, and prioritised recommendations — ideal for board-level or stakeholder reporting.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "report-compliance" && (
                  <FeatureOverlay title="Compliance Report" subtitle="Maps findings against selected compliance frameworks" onClose={() => setActiveOverlay(null)}>
                    <MockReportViewer type="compliance" />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">What you get:</strong> Findings mapped to ISO 27001, NIST CSF, PCI DSS, or Cyber Essentials controls. Each control is assessed as pass, fail, or partial with remediation guidance.</p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">AI-Powered Reports</h3>
                  <p className="text-[11px] text-muted-foreground">
                    After the Pre-AI assessment, generate <strong className="text-foreground">AI narrative reports</strong> for your customers. Click each to preview.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton icon={<FileText className="h-4 w-4" />} title="Individual Firewall Report" desc="Deep-dive analysis per firewall with finding-level detail and remediation" color="text-[#2006F7]" onClick={() => setActiveOverlay("report-individual")} />
                  <FeatureButton icon={<BarChart3 className="h-4 w-4" />} title="Executive Summary" desc="High-level overview for management with key metrics and recommendations" color="text-[#6B5BFF]" onClick={() => setActiveOverlay("report-executive")} />
                  <FeatureButton icon={<Shield className="h-4 w-4" />} title="Compliance Report" desc="Maps findings against ISO 27001, NIST, PCI DSS, Cyber Essentials" color="text-[#005BC8]" onClick={() => setActiveOverlay("report-compliance")} />
                </div>

                <div className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-[#2006F7] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Keyboard shortcuts:</strong>{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">Ctrl+G</kbd> generate all,{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">Ctrl+S</kbd> save,{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">1-9</kbd> switch tabs
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-management" && (
              <div className="space-y-5 relative">
                {activeOverlay === "mgmt-dashboard" && (
                  <FeatureOverlay title="Multi-Tenant Dashboard" subtitle="Overview of all customer assessments" onClose={() => setActiveOverlay(null)}>
                    <MockTenantDashboard />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">What you see:</strong> Every customer's latest risk score, grade, firewall count, and score trend at a glance. Includes licence expiry warnings for your managed estate.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-reports" && (
                  <FeatureOverlay title="Saved Reports" subtitle="Browse and reload previously saved reports" onClose={() => setActiveOverlay(null)}>
                    <MockSavedReports />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">What you see:</strong> A searchable library of every report your team has saved. Filter by customer, report type, or date. Click any row to reload the full report in the viewer.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-history" && (
                  <FeatureOverlay title="Assessment History" subtitle="Track scores over time per customer" onClose={() => setActiveOverlay(null)}>
                    <MockHistoryChart />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">What you see:</strong> A trend line of risk scores for each customer over time. Demonstrate security improvements and track the impact of your remediation work.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-settings" && (
                  <FeatureOverlay title="Settings" subtitle="Central API, security, team, alerts, and more" onClose={() => setActiveOverlay(null)}>
                    <MockSettingsPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">What you see:</strong> Manage your Sophos Central API, connector agents, team members and roles, client portal branding, MFA and passkeys, alert rules, custom compliance frameworks, and audit log — all in one place.</p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">The Management Panel</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Click your <strong className="text-foreground">organisation name</strong> in the top navbar to open it. Click each tab below to preview.
                  </p>
                </div>

                {/* Visual representation of the navbar button */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-[#001A47] px-4 py-2.5 flex items-center gap-3">
                    <img src="/sophos-icon-white.svg" alt="" className="h-5 w-5" />
                    <span className="text-[11px] font-bold text-white flex-1">Sophos FireComply</span>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 border border-white/20">
                      <Building2 className="h-3 w-3 text-white/70" />
                      <span className="text-[10px] font-medium text-white">{orgName || "Your Org"}</span>
                      <ChevronDown className="h-2.5 w-2.5 text-white/70" />
                    </div>
                    <MousePointerClick className="h-4 w-4 text-[#00EDFF] animate-pulse" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton icon={<LayoutDashboard className="h-4 w-4" />} title="Dashboard" desc="Multi-tenant overview of all customer scores and licence expiry" color="text-[#2006F7]" onClick={() => setActiveOverlay("mgmt-dashboard")} />
                  <FeatureButton icon={<FileText className="h-4 w-4" />} title="Reports" desc="Browse and reload all previously saved reports" color="text-[#2006F7]" onClick={() => setActiveOverlay("mgmt-reports")} />
                  <FeatureButton icon={<History className="h-4 w-4" />} title="History" desc="Track assessment scores over time per customer" color="text-[#2006F7]" onClick={() => setActiveOverlay("mgmt-history")} />
                  <FeatureButton icon={<Settings className="h-4 w-4" />} title="Settings" desc="Central API, team management, activity log, and re-run setup" color="text-[#2006F7]" onClick={() => setActiveOverlay("mgmt-settings")} />
                </div>
              </div>
            )}

            {step.id === "guide-team-security" && (
              <div className="space-y-5 relative">
                {activeOverlay === "team-mgmt" && (
                  <FeatureOverlay title="Team Management" subtitle="Invite colleagues and assign roles" onClose={() => setActiveOverlay(null)}>
                    <MockTeamPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> Invite team members by email, assign them roles (Owner, Engineer, or Viewer), and collaborate on assessments. Each role has different permissions — Engineers can run assessments and generate reports, while Viewers have read-only access.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mfa" && (
                  <FeatureOverlay title="Multi-Factor Authentication" subtitle="TOTP-based authenticator app" onClose={() => setActiveOverlay(null)}>
                    <div className="space-y-4">
                      <MockSecurityPanel />
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-foreground">Setup Process</p>
                        <div className="space-y-1.5">
                          {[
                            { step: "1", text: "Open Settings > Security and click 'Enable MFA'" },
                            { step: "2", text: "Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)" },
                            { step: "3", text: "Enter the 6-digit code to verify and activate" },
                          ].map((s) => (
                            <div key={s.step} className="flex items-start gap-2 text-[9px]">
                              <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#00995a] text-white text-[8px] font-bold shrink-0 mt-0.5">{s.step}</span>
                              <span className="text-muted-foreground">{s.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">Why MFA?</strong> Multi-factor authentication adds a critical second layer of protection to your account. Even if your password is compromised, your account stays secure.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "passkeys" && (
                  <FeatureOverlay title="Passkeys" subtitle="Passwordless sign-in with biometrics" onClose={() => setActiveOverlay(null)}>
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-3 py-4">
                        <div className="h-14 w-14 rounded-2xl bg-[#6B5BFF]/10 flex items-center justify-center">
                          <Fingerprint className="h-7 w-7 text-[#6B5BFF]" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-semibold text-foreground">Passwordless Authentication</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Sign in with Face ID, Touch ID, Windows Hello, or a hardware security key</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3">
                        <p className="text-[10px] font-semibold text-foreground mb-2">Registered Passkeys</p>
                        <div className="flex items-center gap-3 rounded bg-muted/20 p-2.5">
                          <Fingerprint className="h-4 w-4 text-[#6B5BFF]" />
                          <div className="flex-1">
                            <p className="text-[10px] font-medium text-foreground">MacBook Pro Touch ID</p>
                            <p className="text-[9px] text-muted-foreground">Added 12 Mar 2026</p>
                          </div>
                          <span className="text-[9px] text-[#00995a] font-medium">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> Passkeys use your device's built-in biometric or hardware security to authenticate. They're phishing-resistant and more secure than traditional passwords. Register one in Settings > Security.</p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Team & Security</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Invite your team and secure your workspace with <strong className="text-foreground">multi-factor authentication</strong> and <strong className="text-foreground">passkeys</strong>. Click each to learn more.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton icon={<UserPlus className="h-4 w-4" />} title="Team Management" desc="Invite colleagues by email and assign Owner, Engineer, or Viewer roles" color="text-[#2006F7]" onClick={() => setActiveOverlay("team-mgmt")} />
                  <FeatureButton icon={<Lock className="h-4 w-4" />} title="Multi-Factor Authentication" desc="Add TOTP-based verification via authenticator app for all logins" color="text-[#00995a]" onClick={() => setActiveOverlay("mfa")} />
                  <FeatureButton icon={<Fingerprint className="h-4 w-4" />} title="Passkeys" desc="Passwordless sign-in with Face ID, Touch ID, or hardware security keys" color="text-[#6B5BFF]" onClick={() => setActiveOverlay("passkeys")} />
                </div>

                <div className="rounded-lg bg-[#00995a]/5 border border-[#00995a]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Recommendation:</strong> Enable MFA or register a passkey for your account as soon as possible. You can set these up in Settings &gt; Security.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-portal-alerts" && (
              <div className="space-y-5 relative">
                {activeOverlay === "client-portal" && (
                  <FeatureOverlay title="Client Portal" subtitle="Branded assessment portal for your customers" onClose={() => setActiveOverlay(null)}>
                    <MockClientPortalPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> Create branded, read-only portals for your customers. Each client gets their own secure view showing risk scores, reports, compliance status, and assessment history — with your MSP branding and logo.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "alerts" && (
                  <FeatureOverlay title="Alerts & Notifications" subtitle="Email and webhook notifications" onClose={() => setActiveOverlay(null)}>
                    <MockAlertPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> Configure alert rules to get notified when critical events happen — new critical findings, agents going offline, configuration drift, or licence expiry. Send alerts via email, webhook (Slack, Teams, etc.), or both.</p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "custom-frameworks" && (
                  <FeatureOverlay title="Custom Compliance Frameworks" subtitle="Create your own compliance standards" onClose={() => setActiveOverlay(null)}>
                    <MockCustomFrameworkPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground"><strong className="text-foreground">How it works:</strong> Build custom compliance frameworks with your own controls and assessment criteria. Define pass/fail conditions mapped to firewall configuration checks, then include them in compliance reports alongside standard frameworks like ISO 27001 and NIST CSF.</p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Client Portal & Alerts</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Share results with customers through <strong className="text-foreground">branded portals</strong>, stay informed with <strong className="text-foreground">real-time alerts</strong>, and build <strong className="text-foreground">custom compliance frameworks</strong>. Click each to learn more.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton icon={<Globe className="h-4 w-4" />} title="Client Portal" desc="Branded read-only portal for customers with scores, reports, and compliance" color="text-[#005BC8]" onClick={() => setActiveOverlay("client-portal")} />
                  <FeatureButton icon={<Bell className="h-4 w-4" />} title="Alerts & Notifications" desc="Email and webhook alerts for critical findings, agent status, and drift detection" color="text-[#F29400]" onClick={() => setActiveOverlay("alerts")} />
                  <FeatureButton icon={<BookOpen className="h-4 w-4" />} title="Custom Compliance Frameworks" desc="Create your own standards with custom controls mapped to firewall checks" color="text-[#6B5BFF]" onClick={() => setActiveOverlay("custom-frameworks")} />
                </div>

                <div className="rounded-lg bg-[#2006F7]/5 border border-[#2006F7]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> You can configure all of these from Settings. Client portals are especially useful for MSPs who want to give customers visibility into their security posture without sharing full access.
                  </p>
                </div>
              </div>
            )}

            {step.id === "done" && (
              <div className="text-center space-y-5 py-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#00995a] to-[#00F2B3] flex items-center justify-center mx-auto shadow-lg shadow-[#00995a]/20">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-foreground">You're All Set!</h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Your workspace is ready. Upload a Sophos XGS firewall config export to start your first security assessment.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-foreground">What's next?</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">1</span>
                      <span><strong className="text-foreground">Upload</strong> a firewall HTML config export</span>
                    </li>
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">2</span>
                      <span><strong className="text-foreground">Review</strong> the automated security assessment</span>
                    </li>
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">3</span>
                      <span><strong className="text-foreground">Generate</strong> AI-powered reports for your customer</span>
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
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-xs text-muted-foreground">
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
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-left"
    >
      <div className="h-8 w-8 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
        <RotateCcw className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">Re-run First-Time Setup</p>
        <p className="text-[10px] text-muted-foreground">Walk through the setup wizard again to update branding and connections</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </button>
  );
}

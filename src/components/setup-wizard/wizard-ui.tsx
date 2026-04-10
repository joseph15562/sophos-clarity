import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  Wifi,
  FileText,
  ChevronDown,
  Users,
  Activity,
  ExternalLink,
  Plug,
  Bell,
  Globe,
  Lock,
  Fingerprint,
  Mail,
  Webhook,
  BookOpen,
  ShieldCheck,
  Calendar,
  Layers,
  Trash2,
  Package,
  ClipboardList,
  ArrowLeftRight,
  Clock,
} from "lucide-react";
import { SEVERITY_COLORS } from "@/lib/design-tokens";

export function GuideStep({
  number,
  title,
  description,
  icon,
  color,
}: {
  number: number;
  title: string;
  description: string;
  icon: ReactNode;
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

export function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-muted/40 rounded w-3/4" />
      <div className="h-4 bg-muted/40 rounded w-1/2" />
      <div className="h-32 bg-muted/40 rounded" />
    </div>
  );
}

export function SetupPreviewFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
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

export function FeatureOverlay({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
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

export function FeatureButton({
  icon,
  title,
  desc,
  color,
  onClick,
}: {
  icon: ReactNode;
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

export function MockGauge({
  score,
  grade,
  color,
}: {
  score: number;
  grade: string;
  color: string;
}) {
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

export function MockRadar() {
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

export function MockSeverityBar() {
  const items = [
    { label: "Critical", count: 3, color: SEVERITY_COLORS.critical, pct: 10 },
    { label: "High", count: 8, color: SEVERITY_COLORS.high, pct: 25 },
    { label: "Medium", count: 14, color: SEVERITY_COLORS.medium, pct: 44 },
    { label: "Low", count: 7, color: SEVERITY_COLORS.low, pct: 21 },
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

export function MockInspectionPosture() {
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

export function MockComplianceGrid() {
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

export function MockReportViewer({ type }: { type: "individual" | "executive" | "compliance" }) {
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

export function MockTenantDashboard() {
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

export function MockSavedReports() {
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

export function MockHistoryChart() {
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

export function MockSettingsPanel() {
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

export function MockTeamPanel() {
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

export function MockSecurityPanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 bg-card p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-4 w-4 text-[#00F2B3]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-foreground">Multi-Factor Authentication</p>
          <p className="text-[9px] text-muted-foreground">
            TOTP-based authenticator app verification
          </p>
        </div>
        <div className="px-2 py-1 rounded text-[9px] font-semibold bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#00F2B3]">
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

export function MockAlertPanel() {
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

export function MockClientPortalPanel() {
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

export function MockRuleOptimiser() {
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

export function MockPolicyComplexity() {
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

export function MockUnusedObjects() {
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

export function MockRemediationProgress() {
  const severities = [
    { label: "Critical", total: 3, fixed: 2, color: "#EA0022" },
    { label: "High", total: 8, fixed: 5, color: "#F29400" },
    { label: "Medium", total: 14, fixed: 8, color: "#ca8a04" },
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

export function MockRemediationRoadmap() {
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
      color: "#ca8a04",
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

export function MockPlaybooks() {
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
          <ClipboardList className="h-3.5 w-3.5 text-[#ca8a04]" />
          <p className="text-[10px] font-semibold text-foreground">Enforce TLS 1.2+ on VPNs</p>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#ca8a04]/12 text-[#78350f] dark:bg-[#F8E300]/10 dark:text-[#F8E300] ml-auto">
            MEDIUM
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1 pl-5">3 steps · ~5 min</p>
      </div>
    </div>
  );
}

export function MockScoreSimulator() {
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

export function MockAttackSurface() {
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

export function MockConfigCompare() {
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

export function MockScheduledReports() {
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

export function MockWebhookPanel() {
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
            <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#00F2B3]">
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

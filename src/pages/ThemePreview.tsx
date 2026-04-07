import {
  Shield,
  AlertTriangle,
  FileCheck2,
  TrendingUp,
  Zap,
  Clock,
  Clock3,
  Sparkles,
  Upload,
  Play,
  Lock,
  Cpu,
  ChevronRight,
  BarChart3,
  Globe,
  FileSearch,
  ArrowRight,
  CheckCircle2,
  Moon,
  Gauge,
  Plus,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceSubpageHeader } from "@/components/WorkspaceSubpageHeader";

const BRAND = {
  dark: "#001A47",
  blue: "#2006F7",
  deep: "#10037C",
  purple: "#5A00FF",
  violet: "#B529F7",
  sky: "#009CFB",
  cyan: "#00EDFF",
  green: "#00F2B3",
  red: "#EA0022",
  orange: "#F29400",
  yellow: "#ca8a04",
  neutral: "#EDF2F9",
  grey: "#6A889B",
};

export default function ThemePreview() {
  return (
    <div className="min-h-screen bg-[#00102e] text-white">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#00102e]/95 backdrop-blur-xl"
        data-tour="tour-theme-header"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-[#2006F7]" />
            <span className="text-sm font-display font-bold tracking-tight text-white">
              FireComply
            </span>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-accent/20 text-[#00EDFF] tracking-[0.2em]">
              Preview
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/50">
            <span>Acme Corp</span>
            <span className="h-4 border-r border-white/10" />
            <span className="flex items-center gap-1.5 text-[#00F2B3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00F2B3] animate-pulse" />
              Central Connected
            </span>
            <Moon className="h-4 w-4 text-white/40" />
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        {/* ── Section: Live workspace header (same as /customers, /trust, /changelog) ── */}
        <SectionLabel>Live components — workspace subpage header</SectionLabel>
        <p className="text-xs text-white/45 -mt-6 mb-2 max-w-2xl leading-relaxed">
          Renders real <code className="text-[#00EDFF]/90">WorkspaceSubpageHeader</code> and{" "}
          <code className="text-[#00EDFF]/90">Button</code> on a normal app background. Use your
          theme toggle in the header below (or system theme); the bar matches Report Centre (navy
          gradient) in both modes. Hard-refresh <code className="text-[#00EDFF]/90">/preview</code>{" "}
          to confirm the primary blue stays solid after reload.
        </p>
        <div className="space-y-6" data-tour="tour-theme-workspace">
          <div className="rounded-2xl border border-white/[0.12] overflow-hidden bg-background text-foreground shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
            <WorkspaceSubpageHeader
              title="Customer Management"
              actions={
                <Button type="button" variant="default" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Onboard Customer</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              }
            />
            <div className="px-4 py-3 text-sm text-muted-foreground border-t border-border/60 bg-background">
              Wide bar — same as <code className="text-xs">/customers</code> (
              <code className="text-xs">max-w-7xl</code>).
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.12] overflow-hidden bg-background text-foreground shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
            <WorkspaceSubpageHeader
              title="What's new"
              titleIcon={<ScrollText />}
              container="docs"
            />
            <div className="px-4 py-3 text-sm text-muted-foreground border-t border-border/60 bg-background">
              Docs bar — same as <code className="text-xs">/trust</code> and{" "}
              <code className="text-xs">/changelog</code> (
              <code className="text-xs">max-w-3xl</code>
              ).
            </div>
          </div>
        </div>

        {/* ── Section: Landing Hero + Trust Strip ── */}
        <SectionLabel>Landing Page — First Impression</SectionLabel>
        <section
          data-tour="tour-theme-landing"
          className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(0,237,255,0.10),transparent_35%),linear-gradient(135deg,rgba(0,16,46,0.98),rgba(0,24,64,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.08)] relative overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

          <div className="text-center pt-10 pb-6 px-6 space-y-5">
            <h2 className="text-3xl font-display font-black text-white tracking-tight">
              Turn Sophos Firewall Exports into
              <br />
              <span className="bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00EDFF] bg-clip-text text-transparent">
                Audit-Ready Documentation
              </span>
            </h2>
            <p className="text-sm text-white/50 max-w-xl mx-auto leading-relaxed">
              Drop in your Sophos XGS configuration exports and get instant security findings, risk
              scoring, and compliance mapping — no AI required.
            </p>
            <div className="flex justify-center gap-4 pt-2">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2006F7] hover:bg-[#2006F7]/90 text-sm font-semibold text-white transition-colors shadow-[0_0_24px_rgba(32,6,247,0.3)]">
                <Upload className="h-4 w-4" /> Upload Config
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#00EDFF]/30 hover:bg-[#00EDFF]/10 text-sm font-semibold text-[#00EDFF] transition-colors">
                <Play className="h-4 w-4" /> Try Demo Config
              </button>
            </div>
          </div>

          <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-brand-accent/15 bg-[#2006F7]/[0.04] px-3 py-2 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  Manual review
                </p>
                <p className="text-lg font-black text-white mt-0.5">3–4 hours</p>
              </div>
              <div className="rounded-xl border border-[#00F2B3]/20 bg-[#00F2B3]/[0.05] px-3 py-2 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  With FireComply
                </p>
                <p className="text-lg font-black text-[#00F2B3] mt-0.5">Under 2 minutes</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  Effort saved
                </p>
                <p className="text-lg font-black text-white mt-0.5">90%+</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-white/40 font-medium">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Cpu className="h-4 w-4 text-[#00EDFF]" />
                Client-side extraction — config never leaves your browser
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Shield className="h-4 w-4 text-[#00EDFF]" />
                Deterministic findings before AI
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Lock className="h-4 w-4 text-[#00EDFF]" />
                Full data anonymisation
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <FileCheck2 className="h-4 w-4 text-[#00EDFF]" />
                Export-ready reports in seconds
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Gauge className="h-4 w-4 text-[#00EDFF]" />
                Evidence-backed posture scoring
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Clock className="h-4 w-4 text-[#00EDFF]" />
                Hours of manual review → minutes
              </span>
            </div>
          </div>
        </section>

        {/* ── Section: Hero Outcome Panel ── */}
        <SectionLabel>Hero Outcome Panel — Post-Analysis</SectionLabel>
        <div className="relative overflow-hidden rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.12),transparent_28%),linear-gradient(135deg,rgba(0,16,46,0.98),rgba(0,24,64,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.08)] p-6 sm:p-7 space-y-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="shrink-0 h-24 w-24 rounded-[22px] ring-2 ring-[#EA0022] bg-[#EA0022]/10 flex flex-col items-center justify-center">
                <span className="text-4xl font-black tabular-nums text-[#EA0022]">58</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#EA0022]">
                  D
                </span>
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#00EDFF]">
                  <Sparkles className="h-3 w-3" /> FireComply Outcome Summary
                </div>
                <h3 className="mt-3 text-2xl font-display font-black text-white tracking-tight">
                  Security Posture: <span className="text-[#EA0022]">At Risk</span>
                </h3>
                <p className="text-sm text-white/50 mt-2 max-w-lg">
                  1 firewall assessed with 100% extraction coverage.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 min-w-[340px]">
              <MiniCard label="Manual review" value="3–4 hours" sub="Typical MSP effort" />
              <MiniCard
                label="With FireComply"
                value="< 2 minutes"
                sub="Demo-ready outcome"
                accent="cyan"
              />
              <MiniCard
                label="Effort saved"
                value="90%+"
                sub="Assessment & reporting"
                accent="green"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Pill
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Critical / High"
              value="8"
              color="red"
            />
            <Pill
              icon={<Shield className="h-3.5 w-3.5" />}
              label="Security Coverage"
              value="25%"
              color="red"
            />
            <Pill
              icon={<FileCheck2 className="h-3.5 w-3.5" />}
              label="Compliance"
              value="Mapped"
              color="green"
            />
            <Pill
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Report Readiness"
              value="Generate"
              color="neutral"
            />
          </div>
        </div>

        {/* ── Section: Tab Bar — matches existing app tabs ── */}
        <SectionLabel>Tab Navigation</SectionLabel>
        <div className="rounded-2xl border border-white/[0.06] bg-[#001840] p-4 space-y-4">
          <h2 className="text-sm font-display font-bold text-white tracking-tight px-1 mb-2">
            Detailed Security Analysis
          </h2>
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-white/[0.04] p-1 text-white/40">
            {[
              "Overview",
              "Security Analysis",
              "Compliance",
              "Optimisation",
              "Tools",
              "Remediation",
            ].map((t, i) => (
              <button
                key={t}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all ${i === 0 ? "bg-[#001d4d] text-white shadow" : "hover:bg-white/[0.04] hover:text-white/70"}`}
              >
                {t}
                {i === 0 && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EA0022]/10 text-[#EA0022] tabular-nums">
                    10
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Section: Critical Actions ── */}
        <SectionLabel>Top 5 Critical Actions</SectionLabel>
        <div className="rounded-2xl border border-white/[0.06] bg-[#001840] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#EA0022]/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-[#EA0022]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Top 5 Critical Actions</h3>
              <p className="text-[10px] text-white/40">
                Ranked by severity and expected score improvement
              </p>
            </div>
          </div>
          {[
            {
              sev: "critical",
              title: "3 enabled WAN rules missing web filtering",
              impact: "+12 pts",
              section: "Firewall Rules",
              evidence: "Guest-WiFi, Allow-All-Temp have Web Filter=none",
            },
            {
              sev: "critical",
              title: "4 fully open rules (any source, destination, service)",
              impact: "+10 pts",
              section: "Firewall Rules",
              evidence: "Allow-All-Temp, Old-VPN-Policy have Source=Any",
            },
            {
              sev: "high",
              title: "3 rules with logging disabled",
              impact: "+6 pts",
              section: "Firewall Rules",
              evidence: "Guest-WiFi, Old-VPN-Policy have Log=disabled",
            },
            {
              sev: "high",
              title: "No IPS policy on WAN-facing rules",
              impact: "+5 pts",
              section: "IPS Configuration",
              evidence: "0/7 enabled WAN rules have IPS",
            },
            {
              sev: "high",
              title: "SSL/TLS inspection not configured",
              impact: "+4 pts",
              section: "SSL/TLS Rules",
              evidence: "No SSL/TLS inspection rules found",
            },
          ].map((a, i) => (
            <div
              key={i}
              className={`rounded-xl border border-white/[0.06] border-l-[3px] ${a.sev === "critical" ? "border-l-[#EA0022]" : "border-l-[#F29400]"} bg-[#001d4d] overflow-hidden`}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="shrink-0 text-xs font-black text-white/30 tabular-nums w-5 text-right mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${a.sev === "critical" ? "bg-[#EA0022]/15 text-[#EA0022]" : "bg-[#F29400]/15 text-[#F29400]"}`}
                    >
                      {a.sev}
                    </span>
                    <span className="text-xs font-semibold text-white">{a.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                    <span>{a.section}</span>
                    <span className="text-[#00F2B3] font-semibold">Est. impact: {a.impact}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/35">
                    <FileSearch className="h-3 w-3" />
                    <span className="font-mono">{a.evidence}</span>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-white/20 mt-1 shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* ── Section: Security Stats Row ── */}
        <SectionLabel>Security Overview Cards</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Score" value="58" badge="D" color="red" />
          <StatCard label="Critical Issues" value="8" color="red" />
          <StatCard label="Coverage" value="25%" color="red" />
          <StatCard label="Total Rules" value="14" color="neutral" />
        </div>

        {/* ── Section: Remediation Impact Simulator ── */}
        <SectionLabel>Remediation Impact Simulator</SectionLabel>
        <div className="rounded-2xl border border-white/[0.06] bg-[#001840] p-5 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#5A00FF]/20 to-[#00EDFF]/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-[#00EDFF]" />
            </div>
            <h3 className="text-sm font-bold text-white">Remediation Impact Simulator</h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Enable Web Filtering", checked: true, findings: 3 },
              { label: "Enable IPS", checked: true, findings: 2 },
              { label: "Restrict open rules", checked: false, findings: 4 },
              { label: "Enable logging", checked: true, findings: 3 },
            ].map((t) => (
              <label
                key={t.label}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${t.checked ? "border-[#00EDFF]/30 bg-[#00EDFF]/[0.05]" : "border-white/[0.06] bg-[#001d4d] hover:bg-white/[0.02]"}`}
              >
                <div
                  className={`h-4 w-4 rounded border-2 flex items-center justify-center ${t.checked ? "border-[#00EDFF] bg-[#00EDFF]" : "border-white/20"}`}
                >
                  {t.checked && <CheckCircle2 className="h-3 w-3 text-[#00102e]" />}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white">{t.label}</p>
                  <p className="text-[9px] text-white/40">{t.findings} findings resolved</p>
                </div>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border border-[#00F2B3]/15 bg-[#00F2B3]/[0.03] p-4">
            <div className="text-center">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Score
              </p>
              <p className="text-2xl font-black text-white">
                58 <ArrowRight className="inline h-4 w-4 text-[#00F2B3]" />{" "}
                <span className="text-[#00F2B3]">82</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Grade
              </p>
              <p className="text-2xl font-black text-white">
                D <ArrowRight className="inline h-4 w-4 text-[#00F2B3]" />{" "}
                <span className="text-[#00F2B3]">B</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Findings Resolved
              </p>
              <p className="text-2xl font-black text-[#00F2B3]">8</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Coverage
              </p>
              <p className="text-2xl font-black text-white">
                25% <ArrowRight className="inline h-4 w-4 text-[#00F2B3]" />{" "}
                <span className="text-[#00F2B3]">100%</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Section: Finding Card ── */}
        <SectionLabel>Finding Card — Evidence Traceability</SectionLabel>
        <div className="rounded-2xl border border-white/[0.06] bg-[#001840] p-5 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#001d4d] px-4 py-3">
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#EA0022]/15 text-[#EA0022] mt-0.5">
              critical
            </span>
            <div className="flex-1 space-y-2.5">
              <p className="text-xs font-semibold text-white">
                3 enabled WAN rules missing web filtering
              </p>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Web filtering is not applied to 3 enabled WAN rules with HTTP/HTTPS/ANY service.
                This allows users to access malicious or policy-violating websites without
                protection.
              </p>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                  Evidence Source
                </p>
                <p className="text-[10px] text-white/60">
                  <span className="font-medium text-white/80">Section:</span> Firewall Rules
                  <br />
                  <span className="font-medium text-white/80">Extracted fact:</span>{" "}
                  <span className="font-mono">
                    Rules Guest-WiFi-Internet, Allow-All-Temp, Legacy-Allow-All have Web
                    Filter=none/empty
                  </span>
                </p>
                <span className="inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#00F2B3]/10 text-[#00F2B3] mt-0.5">
                  high confidence
                </span>
              </div>
              <div className="rounded-lg bg-brand-accent/[0.06] border border-brand-accent/15 px-3 py-2">
                <p className="text-[10px] text-white/70">
                  <span className="font-semibold text-[#009CFB]">Remediation:</span> Go to Rules and
                  policies → Firewall rules. Edit each affected rule → expand Web Filtering → set a
                  Web policy.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section: World Map ── */}
        <SectionLabel>Attack Surface Map</SectionLabel>
        <div className="rounded-2xl border border-white/[0.06] bg-[#001840] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-[#00EDFF]" />
            <h3 className="text-sm font-bold text-white">Geo-IP & CVE Correlation</h3>
          </div>
          <div
            className="rounded-xl overflow-hidden border border-white/[0.06]"
            style={{ aspectRatio: "2.5/1", background: "#000d24" }}
          >
            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
              [ World Map Renders Here ]
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#F29400]" /> Exposed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#EA0022]" /> Has CVEs
            </span>
          </div>
        </div>

        {/* ── Section: Export Buttons ── */}
        <SectionLabel>Export Controls</SectionLabel>
        <div className="flex flex-wrap gap-3">
          {[
            "Export Risk Register (CSV)",
            "Export Excel",
            "Export Interactive HTML",
            "Generate All Reports",
          ].map((label, i) => (
            <button
              key={label}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${i === 3 ? "bg-[#2006F7] text-white hover:bg-[#2006F7]/90 shadow-[0_0_16px_rgba(32,6,247,0.25)]" : "border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.04]"}`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Section: Coverage Bars ── */}
        <SectionLabel>Category Score Bars</SectionLabel>
        <div className="rounded-2xl border border-white/[0.06] bg-[#001840] p-5 space-y-3">
          {[
            { label: "Web Filtering", pct: 0, color: BRAND.red },
            { label: "Intrusion Prevention", pct: 0, color: BRAND.red },
            { label: "Application Control", pct: 43, color: BRAND.orange },
            { label: "Authentication", pct: 100, color: BRAND.green },
            { label: "Logging", pct: 57, color: BRAND.orange },
            { label: "Rule Hygiene", pct: 40, color: BRAND.orange },
            { label: "Admin Access", pct: 100, color: BRAND.green },
            { label: "Anti-Malware", pct: 50, color: BRAND.orange },
            { label: "Network Security", pct: 75, color: BRAND.green },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              <span className="text-[11px] text-white/60 w-36 shrink-0 text-right">{c.label}</span>
              <div className="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${c.pct}%`,
                    backgroundColor: c.color,
                    boxShadow: `0 0 8px ${c.color}40`,
                  }}
                />
              </div>
              <span
                className="text-[11px] font-bold tabular-nums w-10 text-right"
                style={{ color: c.color }}
              >
                {c.pct}%
              </span>
            </div>
          ))}
        </div>

        {/* ── Brand Palette ── */}
        <div data-tour="tour-theme-palette">
          <SectionLabel>Sophos Brand Palette</SectionLabel>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
            {Object.entries(BRAND).map(([name, hex]) => (
              <div key={name} className="flex flex-col items-center gap-1.5">
                <div
                  className="h-10 w-10 rounded-lg border border-white/10"
                  style={{ backgroundColor: hex }}
                />
                <span className="text-[9px] text-white/40 font-mono">{name}</span>
                <span className="text-[8px] text-white/25 font-mono">{hex}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-20" />
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <div className="h-px flex-1 bg-gradient-to-r from-[#2006F7]/40 to-transparent" />
      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00EDFF]/60 whitespace-nowrap">
        {children}
      </span>
      <div className="h-px flex-1 bg-gradient-to-l from-[#2006F7]/40 to-transparent" />
    </div>
  );
}

function MiniCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "cyan" | "green";
}) {
  const border =
    accent === "cyan"
      ? "border-[#00EDFF]/20"
      : accent === "green"
        ? "border-[#00F2B3]/20"
        : "border-white/[0.06]";
  const bg =
    accent === "cyan"
      ? "bg-[#00EDFF]/[0.05]"
      : accent === "green"
        ? "bg-[#00F2B3]/[0.05]"
        : "bg-white/[0.02]";
  const valColor =
    accent === "cyan" ? "text-[#00EDFF]" : accent === "green" ? "text-[#00F2B3]" : "text-white";
  return (
    <div className={`rounded-2xl border ${border} ${bg} px-3 py-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className={`mt-1 text-xl font-black tracking-tight ${valColor}`}>{value}</p>
      <p className="text-[10px] text-white/30 mt-0.5">{sub}</p>
    </div>
  );
}

function Pill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "red" | "amber" | "green" | "neutral";
}) {
  const styles = {
    red: { border: "border-[#EA0022]/20", bg: "bg-[#EA0022]/[0.05]", text: "text-[#EA0022]" },
    amber: { border: "border-[#F29400]/20", bg: "bg-[#F29400]/[0.05]", text: "text-[#F29400]" },
    green: { border: "border-[#00F2B3]/20", bg: "bg-[#00F2B3]/[0.05]", text: "text-[#00F2B3]" },
    neutral: { border: "border-white/[0.06]", bg: "bg-white/[0.02]", text: "text-white" },
  };
  const s = styles[color];
  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} px-4 py-3`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
        {icon} {label}
      </div>
      <p className={`text-2xl font-black mt-1 tabular-nums ${s.text}`}>{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  badge,
  color,
}: {
  label: string;
  value: string;
  badge?: string;
  color: "red" | "green" | "neutral";
}) {
  const styles = {
    red: "border-[#EA0022]/20 bg-[#EA0022]/[0.05]",
    green: "border-[#00F2B3]/20 bg-[#00F2B3]/[0.05]",
    neutral: "border-white/[0.06] bg-white/[0.02]",
  };
  const valColor =
    color === "red" ? "text-[#EA0022]" : color === "green" ? "text-[#00F2B3]" : "text-white";
  return (
    <div className={`rounded-2xl border ${styles[color]} p-4`}>
      <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-2xl font-black tabular-nums ${valColor}`}>{value}</span>
        {badge && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color === "red" ? "bg-[#EA0022]/15 text-[#EA0022]" : "bg-[#00F2B3]/15 text-[#00F2B3]"}`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

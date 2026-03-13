import { useState, useRef, useMemo, useCallback } from "react";
import { CheckCircle2, Download, Shield, Globe, Lock, Network, AlertTriangle, Settings, Bug, Eye, Activity, Server, Clock, Key, Database, Wifi, FileWarning, ChevronDown, ChevronRight } from "lucide-react";
import type { AnalysisResult, Severity, Finding, InspectionPosture } from "@/lib/analyse-config";
import { severityIcon } from "@/lib/analyse-config";
import { findingToFrameworks } from "@/lib/compliance-map";
import { downloadCsv, downloadFindingsPdf } from "@/lib/findings-export";

interface EstateOverviewProps {
  fileCount: number;
  analysisResults: Record<string, AnalysisResult>;
  totalFindings: number;
  totalRules: number;
  totalSections: number;
  totalPopulated: number;
  extractionPct: number;
  aggregatedPosture: InspectionPosture;
  selectedFrameworks?: string[];
}

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "text-[#EA0022]",
  high: "text-[#c47800] dark:text-[#F29400]",
  medium: "text-[#b8a200] dark:text-[#F8E300]",
  low: "text-[#00995a] dark:text-[#00F2B3]",
  info: "text-[#0077cc] dark:text-[#009CFB]",
};

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-[#EA0022]",
  high: "border-l-[#c47800] dark:border-l-[#F29400]",
  medium: "border-l-[#b8a200] dark:border-l-[#F8E300]",
  low: "border-l-[#00995a] dark:border-l-[#00F2B3]",
  info: "border-l-[#0077cc] dark:border-l-[#009CFB]",
};

export function EstateOverview({
  fileCount,
  analysisResults,
  totalFindings,
  totalRules,
  totalSections,
  totalPopulated,
  extractionPct,
  aggregatedPosture,
  selectedFrameworks = [],
}: EstateOverviewProps) {
  const findingsRef = useRef<HTMLDivElement>(null);

  const scrollToFindings = useCallback(() => {
    if (!findingsRef.current) return;
    findingsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    findingsRef.current.classList.add("ring-2", "ring-[#F29400]/40");
    setTimeout(() => findingsRef.current?.classList.remove("ring-2", "ring-[#F29400]/40"), 1500);
  }, []);

  return (
    <>
      {/* Estate summary cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon="/icons/sophos-network.svg"
          value={fileCount}
          label={`Firewall${fileCount !== 1 ? "s" : ""}`}
          border="border-[#2006F7]/20 dark:border-[#00EDFF]/20"
          bg="bg-[#2006F7]/[0.04] dark:bg-[#00EDFF]/[0.06]"
          iconBg="bg-[#2006F7]/10 dark:bg-[#00EDFF]/10"
          valueColor="text-[#2006F7] dark:text-[#00EDFF]"
        />
        <StatCard
          icon="/icons/sophos-governance.svg"
          value={totalRules}
          label="Rules Parsed"
          border="border-[#10037C]/15 dark:border-[#2006F7]/20"
          bg="bg-[#10037C]/[0.03] dark:bg-[#2006F7]/[0.06]"
          iconBg="bg-[#10037C]/10 dark:bg-[#2006F7]/10"
          valueColor="text-[#001A47] dark:text-white"
        />
        <StatCard
          icon="/icons/sophos-search.svg"
          value={totalSections}
          label="Sections"
          border="border-[#5A00FF]/15 dark:border-[#5A00FF]/20"
          bg="bg-[#5A00FF]/[0.03] dark:bg-[#5A00FF]/[0.06]"
          iconBg="bg-[#5A00FF]/10 dark:bg-[#5A00FF]/10"
          valueColor="text-[#001A47] dark:text-white"
        />
        <StatCard
          icon="/icons/sophos-alert.svg"
          value={totalFindings}
          label="Issues"
          border={totalFindings > 0 ? "border-[#EA0022]/20 dark:border-[#F29400]/25" : "border-[#00995a]/20 dark:border-[#00F2B3]/20"}
          bg={totalFindings > 0 ? "bg-[#EA0022]/[0.04] dark:bg-[#F29400]/[0.06]" : "bg-[#00995a]/[0.04] dark:bg-[#00F2B3]/[0.06]"}
          iconBg={totalFindings > 0 ? "bg-[#EA0022]/10 dark:bg-[#F29400]/10" : "bg-[#00995a]/10 dark:bg-[#00F2B3]/10"}
          valueColor={totalFindings > 0 ? "text-[#EA0022] dark:text-[#F29400]" : "text-[#00995a] dark:text-[#00F2B3]"}
          onClick={totalFindings > 0 ? scrollToFindings : undefined}
        />
      </section>

      {/* Extraction coverage bar */}
      <ExtractionCoverage
        extractionPct={extractionPct}
        totalPopulated={totalPopulated}
        totalSections={totalSections}
        totalRules={totalRules}
        totalNatRules={Object.values(analysisResults).reduce((s, r) => s + r.stats.totalNatRules, 0)}
        totalInterfaces={Object.values(analysisResults).reduce((s, r) => s + r.stats.interfaces, 0)}
      />

      {/* DPI / Inspection posture dashboard */}
      {aggregatedPosture.totalWanRules > 0 && (
        <InspectionPostureDashboard posture={aggregatedPosture} />
      )}

      {/* Deterministic findings panel */}
      {totalFindings > 0 && (
        <div ref={findingsRef} className="scroll-mt-20 rounded-xl transition-all duration-500">
          <FindingsPanel analysisResults={analysisResults} fileCount={fileCount} selectedFrameworks={selectedFrameworks} />
        </div>
      )}

      {/* Estate risk comparison */}
      {fileCount >= 2 && (
        <EstateRiskComparison analysisResults={analysisResults} />
      )}

      {/* No-findings banner */}
      {totalFindings === 0 && (
        <div className="rounded-md border border-[#00995a]/30 dark:border-[#00F2B3]/30 bg-[#00995a]/5 dark:bg-[#00F2B3]/5 px-4 py-3 flex items-center gap-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-[#00774a] dark:text-[#00F2B3] shrink-0" />
          <span className="text-[#00774a] dark:text-[#00F2B3] font-medium">No issues detected in deterministic analysis.</span>
          <span className="text-muted-foreground">AI-driven assessment will provide deeper coverage.</span>
        </div>
      )}

      {/* Parser diagnostics (collapsible) */}
      <ParserDiagnostics analysisResults={analysisResults} />
    </>
  );
}

function ParserDiagnostics({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="font-semibold uppercase tracking-wider">Parser Diagnostics</span>
        <span>{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-3 border-t border-border text-[10px]">
          {Object.entries(analysisResults).map(([label, r]) => (
            <div key={label} className="space-y-1.5">
              <p className="font-semibold text-foreground">{label}</p>
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  <span className="font-medium">Sections parsed:</span>{" "}
                  {r.stats.sectionNames.join(", ")}
                </p>
                {r.ruleColumns && r.ruleColumns.length > 0 && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Rule columns:</span>{" "}
                    {r.ruleColumns.join(", ")}
                  </p>
                )}
                <p className="text-muted-foreground">
                  <span className="font-medium">WAN rules:</span>{" "}
                  {r.inspectionPosture.totalWanRules} total, {r.inspectionPosture.enabledWanRules} enabled, {r.inspectionPosture.disabledWanRules} disabled
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Web filterable (HTTP/HTTPS/ANY):</span>{" "}
                  {r.inspectionPosture.webFilterableRules} rules, {r.inspectionPosture.withWebFilter} with filter, {r.inspectionPosture.withoutWebFilter} without
                </p>
                <p className={!r.inspectionPosture.dpiEngineEnabled && r.inspectionPosture.totalWanRules > 0 ? "text-[#F29400]" : "text-muted-foreground"}>
                  <span className="font-medium">SSL/TLS Inspection (DPI):</span>{" "}
                  {r.inspectionPosture.withSslInspection === 0
                    ? "No SSL/TLS inspection rules found — DPI is inactive"
                    : `${r.inspectionPosture.withSslInspection} rules (${r.inspectionPosture.sslDecryptRules} Decrypt, ${r.inspectionPosture.sslExclusionRules} exclusions)${r.inspectionPosture.dpiEngineEnabled ? " — DPI active" : " — no Decrypt rules, DPI inactive"}`}
                  {r.inspectionPosture.sslUncoveredZones.length > 0
                    ? ` | Zone gaps: ${r.inspectionPosture.sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")}`
                    : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, border, bg, iconBg, valueColor, onClick }: {
  icon: string; value: number; label: string;
  border: string; bg: string; iconBg: string; valueColor: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      className={`rounded-xl border ${border} ${bg} p-5 flex items-center gap-4 text-left ${onClick ? "cursor-pointer hover:brightness-110 hover:shadow-md transition-all" : ""}`}
      onClick={onClick}
    >
      <div className={`h-12 w-12 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <img src={icon} alt="" className="h-7 w-7 sophos-icon" />
      </div>
      <div>
        <p className={`text-3xl font-extrabold ${valueColor} leading-none`}>{value}</p>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
      </div>
    </Wrapper>
  );
}

function ExtractionCoverage({ extractionPct, totalPopulated, totalSections, totalRules, totalNatRules, totalInterfaces }: {
  extractionPct: number; totalPopulated: number; totalSections: number;
  totalRules: number; totalNatRules: number; totalInterfaces: number;
}) {
  const barColor = extractionPct >= 80
    ? "bg-[#00995a] dark:bg-[#00F2B3]"
    : extractionPct >= 50
    ? "bg-[#b8a200] dark:bg-[#F8E300]"
    : "bg-[#EA0022]";

  const pctColor = extractionPct >= 80
    ? "text-[#00995a] dark:text-[#00F2B3]"
    : extractionPct >= 50
    ? "text-[#b8a200] dark:text-[#F8E300]"
    : "text-[#EA0022]";

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-foreground">Extraction Coverage</span>
          <span className={`text-xs font-bold ${pctColor}`}>{extractionPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${extractionPct}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {totalPopulated} of {totalSections} sections contain parseable data &middot; {totalRules} rules &middot; {totalNatRules} NAT rules &middot; {totalInterfaces} interfaces
        </p>
      </div>
      {extractionPct < 80 && (
        <div className="text-[10px] text-muted-foreground max-w-[180px] leading-tight">
          Some sections parsed empty. This may indicate an unsupported export format or unconfigured areas.
        </div>
      )}
    </div>
  );
}

function InspectionPostureDashboard({ posture }: { posture: InspectionPosture }) {
  const pct = (n: number) => posture.totalWanRules > 0 ? Math.round((n / posture.totalWanRules) * 100) : 0;

  const bar = (label: string, value: number, color: string) => (
    <div key={label} className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold text-foreground">{value}/{posture.totalWanRules} <span className="text-muted-foreground font-normal">({pct(value)}%)</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct(value)}%` }} />
      </div>
    </div>
  );

  const barColor = (value: number) =>
    pct(value) >= 80 ? "bg-[#00995a] dark:bg-[#00F2B3]" : pct(value) >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]";

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <img src="/icons/sophos-security.svg" alt="" className="h-5 w-5 sophos-icon" />
        <h3 className="text-sm font-semibold text-foreground">Inspection Posture</h3>
        <span className="text-[10px] text-muted-foreground">across {posture.totalWanRules} WAN-facing rule{posture.totalWanRules !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {bar("Web Filtering", posture.withWebFilter, barColor(posture.withWebFilter))}
        {bar("IPS / Intrusion Prevention", posture.withIps, barColor(posture.withIps))}
        {bar("Application Control", posture.withAppControl, barColor(posture.withAppControl))}
      </div>
      {!posture.dpiEngineEnabled && posture.totalWanRules > 0 && (
        <div className="rounded-md bg-[#EA0022]/10 px-3 py-2 flex items-center gap-2">
          <span className="text-[#EA0022] font-bold text-[10px]">SSL/TLS INSPECTION OFF</span>
          <span className="text-[10px] text-[#EA0022]/80">
            {posture.withSslInspection === 0
              ? "No SSL/TLS inspection rules configured — encrypted traffic is not being inspected (DPI inactive)"
              : `${posture.withSslInspection} SSL/TLS rule${posture.withSslInspection !== 1 ? "s" : ""} found but all are exclusions (Do not decrypt) — no traffic is being decrypted`}
          </span>
        </div>
      )}
      {posture.disabledWanRules > 0 && (
        <p className="text-[10px] text-[#c47800] dark:text-[#F29400]">
          {posture.disabledWanRules} of {posture.totalWanRules} WAN rules are disabled — coverage scores based on {posture.enabledWanRules} enabled rule{posture.enabledWanRules !== 1 ? "s" : ""}
        </p>
      )}
      {posture.withSslInspection > 0 && (
        <div className="text-[10px] space-y-0.5">
          <p className={posture.dpiEngineEnabled ? "text-muted-foreground" : "text-[#c47800] dark:text-[#F29400]"}>
            {posture.withSslInspection} SSL/TLS inspection rule{posture.withSslInspection !== 1 ? "s" : ""}:
            {posture.sslDecryptRules > 0 ? ` ${posture.sslDecryptRules} Decrypt` : ""}
            {posture.sslExclusionRules > 0 ? `${posture.sslDecryptRules > 0 ? "," : ""} ${posture.sslExclusionRules} Do-not-decrypt` : ""}
            {posture.dpiEngineEnabled ? " (DPI active)" : ""}
          </p>
          {posture.sslUncoveredZones.length > 0 && (
            <p className="text-[#c47800] dark:text-[#F29400]">
              Zone gap: {posture.sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")} → WAN traffic is not covered by any Decrypt rule
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FindingCard({ finding, label, fileCount, selectedFrameworks }: {
  finding: { id: string; severity: Severity; title: string; detail: string; section: string; remediation?: string };
  label: string; fileCount: number; selectedFrameworks: string[];
}) {
  const [open, setOpen] = useState(false);
  const frameworks = selectedFrameworks.length > 0
    ? findingToFrameworks(finding.title, selectedFrameworks)
    : [];

  return (
    <div className={`rounded-lg border border-border border-l-4 ${SEVERITY_BORDER[finding.severity]} bg-card shadow-sm overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-lg shrink-0" title={finding.severity}>{severityIcon(finding.severity)}</span>
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          <span className={`font-bold text-sm ${SEVERITY_COLOR[finding.severity]}`}>{finding.title}</span>
          {fileCount > 1 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">{label}</span>
          )}
          {frameworks.map((fw) => (
            <span key={fw} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#EA0022]/10 text-[#EA0022] dark:bg-[#EA0022]/20 dark:text-[#ff6b6b]">
              {fw}
            </span>
          ))}
        </div>
        <span className="text-muted-foreground text-xs shrink-0">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3.5 pl-[3.25rem] space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{finding.detail}</p>
          {finding.remediation && (
            <div className="px-3 py-2 rounded bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] border border-[#2006F7]/10 dark:border-[#2006F7]/20">
              <p className="text-[10px] text-foreground leading-relaxed"><span className="font-semibold text-[#10037C] dark:text-[#009CFB]">Remediation:</span> {finding.remediation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Firewall Rules": Shield,
  "NAT Rules": Network,
  "SSL/TLS Inspection": Lock,
  "Intrusion Prevention": Eye,
  "Application Control": Activity,
  "Web Filter Policies": Globe,
  "Local Service ACL": Server,
  "Authentication & OTP": Key,
  "Admin Settings": Settings,
  "Virus Scanning": Bug,
  "High Availability": Database,
  "Active Threat Response": AlertTriangle,
  "Backup & Restore": Database,
  "Notification Settings": Settings,
  "Pattern Downloads": Download,
  "Time Settings": Clock,
  "Authentication Servers": Key,
  "Hotfix Settings": Settings,
  "Application Classification": Activity,
  "Extraction": FileWarning,
  "Wireless": Wifi,
};

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEV_BADGE: Record<Severity, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-[#EA0022]/10", text: "text-[#EA0022]", label: "C" },
  high: { bg: "bg-[#F29400]/10", text: "text-[#c47800] dark:text-[#F29400]", label: "H" },
  medium: { bg: "bg-[#F8E300]/10", text: "text-[#b8a200] dark:text-[#F8E300]", label: "M" },
  low: { bg: "bg-[#00995a]/10", text: "text-[#00995a] dark:text-[#00F2B3]", label: "L" },
  info: { bg: "bg-[#009CFB]/10", text: "text-[#0077cc] dark:text-[#009CFB]", label: "I" },
};

interface SectionGroupData {
  section: string;
  findings: (Finding & { firewall: string })[];
  sevCounts: Record<Severity, number>;
  highestSeverity: number;
}

function FindingsPanel({ analysisResults, fileCount, selectedFrameworks }: {
  analysisResults: Record<string, AnalysisResult>; fileCount: number; selectedFrameworks: string[];
}) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const groups: SectionGroupData[] = useMemo(() => {
    const map = new Map<string, (Finding & { firewall: string })[]>();
    for (const [label, result] of Object.entries(analysisResults)) {
      for (const f of result.findings) {
        const key = f.section;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ ...f, firewall: label });
      }
    }
    return [...map.entries()]
      .map(([section, findings]) => {
        const sevCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        for (const f of findings) sevCounts[f.severity]++;
        const highestSeverity = SEV_ORDER.findIndex((s) => sevCounts[s] > 0);
        return { section, findings, sevCounts, highestSeverity: highestSeverity === -1 ? 99 : highestSeverity };
      })
      .sort((a, b) => a.highestSeverity - b.highestSeverity || b.findings.length - a.findings.length);
  }, [analysisResults]);

  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setOpenSections(new Set(groups.map((g) => g.section)));
  }, [groups]);

  const collapseAll = useCallback(() => setOpenSections(new Set()), []);

  const totalCount = groups.reduce((s, g) => s + g.findings.length, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <img src="/icons/sophos-alert.svg" alt="" className="h-5 w-5 sophos-icon" />
        <h3 className="text-sm font-semibold text-foreground">Deterministic Findings</h3>
        <span className="text-xs text-muted-foreground">{totalCount} issues across {groups.length} sections</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={openSections.size > 0 ? collapseAll : expandAll}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors"
          >
            {openSections.size > 0 ? "Collapse all" : "Expand all"}
          </button>
          <button
            onClick={() => downloadCsv(analysisResults)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors"
            title="Export findings as CSV"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
          <button
            onClick={() => downloadFindingsPdf(analysisResults)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors"
            title="Export findings as printable PDF"
          >
            <Download className="h-3 w-3" /> PDF
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {groups.map((g) => {
          const isOpen = openSections.has(g.section);
          const Icon = SECTION_ICONS[g.section] ?? AlertTriangle;
          const borderSev = SEV_ORDER[g.highestSeverity] ?? "info";
          return (
            <div key={g.section} className={`rounded-xl border border-border border-l-4 ${SEVERITY_BORDER[borderSev]} bg-card overflow-hidden transition-all`}>
              <button
                onClick={() => toggleSection(g.section)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">{g.section}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {SEV_ORDER.map((sev) => {
                    const count = g.sevCounts[sev];
                    if (count === 0) return null;
                    const badge = SEV_BADGE[sev];
                    return (
                      <span key={sev} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                        {count}{badge.label}
                      </span>
                    );
                  })}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-6 text-right">{g.findings.length}</span>
                {isOpen
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                }
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-border/50 pt-2">
                  {g.findings.map((f, i) => (
                    <FindingCard
                      key={`${f.firewall}-${f.id}-${i}`}
                      finding={f}
                      label={f.firewall}
                      fileCount={fileCount}
                      selectedFrameworks={selectedFrameworks}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EstateRiskComparison({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const weight = (r: AnalysisResult) =>
    r.findings.reduce((s, f) => s + (f.severity === "critical" ? 10 : f.severity === "high" ? 5 : f.severity === "medium" ? 2 : f.severity === "low" ? 1 : 0), 0);

  const maxScore = Math.max(1, ...Object.values(analysisResults).map(weight));

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <img src="/icons/sophos-orchestration.svg" alt="" className="h-5 w-5 sophos-icon" />
        <h3 className="text-sm font-semibold text-foreground">Estate Risk Comparison</h3>
      </div>
      <div className="space-y-2">
        {Object.entries(analysisResults)
          .sort(([, a], [, b]) => weight(b) - weight(a))
          .map(([label, result], idx) => {
            const criticals = result.findings.filter((f) => f.severity === "critical").length;
            const highs = result.findings.filter((f) => f.severity === "high").length;
            const mediums = result.findings.filter((f) => f.severity === "medium").length;
            const score = criticals * 10 + highs * 5 + mediums * 2;
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-muted-foreground w-5 text-right">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-foreground truncate">{label}</span>
                    <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                      {criticals > 0 && <span className="text-[#EA0022] font-bold" title={`${criticals} Critical finding${criticals !== 1 ? "s" : ""}`}>{criticals}C</span>}
                      {highs > 0 && <span className="text-[#c47800] dark:text-[#F29400] font-bold" title={`${highs} High finding${highs !== 1 ? "s" : ""}`}>{highs}H</span>}
                      {mediums > 0 && <span className="text-[#b8a200] dark:text-[#F8E300] font-bold" title={`${mediums} Medium finding${mediums !== 1 ? "s" : ""}`}>{mediums}M</span>}
                      <span className="text-muted-foreground" title={`${result.stats.totalRules} rules parsed`}>{result.stats.totalRules}r</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${score === 0 ? "bg-[#00995a] dark:bg-[#00F2B3]" : score <= 5 ? "bg-[#F8E300]" : score <= 15 ? "bg-[#F29400]" : "bg-[#EA0022]"}`} style={{ width: `${Math.max(3, Math.round((score / maxScore) * 100))}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p><span className="text-[#EA0022] font-semibold">C</span> = Critical &middot; <span className="text-[#c47800] dark:text-[#F29400] font-semibold">H</span> = High &middot; <span className="text-[#b8a200] dark:text-[#F8E300] font-semibold">M</span> = Medium &middot; <span className="font-semibold">r</span> = rules parsed</p>
        <p>Ranked by weighted risk score: Critical &times;10, High &times;5, Medium &times;2, Low &times;1</p>
      </div>
    </div>
  );
}

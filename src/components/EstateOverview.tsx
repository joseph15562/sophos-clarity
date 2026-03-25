import { useState, useRef, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Download,
  Shield,
  Globe,
  Lock,
  Network,
  AlertTriangle,
  Settings,
  Bug,
  Eye,
  Activity,
  Server,
  Clock,
  Key,
  Database,
  Wifi,
  FileWarning,
  ChevronRight,
  Lightbulb,
  Scale,
  ShieldCheck,
  Search,
  GitBranch,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
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
  onExplainFinding?: (title: string) => void;
}

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "text-[#EA0022]",
  high: "text-[#c47800] dark:text-[#F29400]",
  medium: "text-[#b8a200] dark:text-[#F8E300]",
  low: "text-[#00F2B3] dark:text-[#00F2B3]",
  info: "text-[#0077cc] dark:text-[#009CFB]",
};

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-[#EA0022]",
  high: "border-l-[#c47800] dark:border-l-[#F29400]",
  medium: "border-l-[#b8a200] dark:border-l-[#F8E300]",
  low: "border-l-[#00F2B3] dark:border-l-[#00F2B3]",
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
  onExplainFinding,
}: EstateOverviewProps) {
  const findingsRef = useRef<HTMLDivElement>(null);

  const scrollToFindings = useCallback(() => {
    if (!findingsRef.current) return;
    findingsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    findingsRef.current.classList.add("ring-2", "ring-[#F29400]/40");
    setTimeout(() => findingsRef.current?.classList.remove("ring-2", "ring-[#F29400]/40"), 1500);
  }, []);

  return (
    <div className="space-y-6">
      {/* Estate summary cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Network className="h-7 w-7 text-brand-accent" />}
          value={fileCount}
          label={`Firewall${fileCount !== 1 ? "s" : ""}`}
          border="border-brand-accent/20 dark:border-[#00EDFF]/20"
          bg="bg-[#2006F7]/[0.04] dark:bg-[#00EDFF]/[0.06]"
          iconBg="bg-brand-accent/10 dark:bg-[#00EDFF]/10"
          valueColor="text-brand-accent"
        />
        <StatCard
          icon={<Scale className="h-7 w-7 text-brand-accent" />}
          value={totalRules}
          label="Rules Parsed"
          border="border-[#10037C]/15 dark:border-brand-accent/20"
          bg="bg-[#10037C]/[0.03] dark:bg-brand-accent/[0.06]"
          iconBg="bg-[#10037C]/10 dark:bg-brand-accent/10"
          valueColor="text-[#001A47] dark:text-white"
        />
        <StatCard
          icon={<Search className="h-7 w-7 text-brand-accent" />}
          value={totalSections}
          label="Sections"
          border="border-[#5A00FF]/15 dark:border-[#5A00FF]/20"
          bg="bg-[#5A00FF]/[0.03] dark:bg-[#5A00FF]/[0.06]"
          iconBg="bg-[#5A00FF]/10 dark:bg-[#5A00FF]/10"
          valueColor="text-[#001A47] dark:text-white"
        />
        <StatCard
          icon={<AlertTriangle className="h-7 w-7 text-brand-accent" />}
          value={totalFindings}
          label="Issues"
          border={
            totalFindings > 0
              ? "border-[#EA0022]/20 dark:border-[#F29400]/25"
              : "border-[#00F2B3]/20 dark:border-[#00F2B3]/20"
          }
          bg={
            totalFindings > 0
              ? "bg-[#EA0022]/[0.04] dark:bg-[#F29400]/[0.06]"
              : "bg-[#00F2B3]/[0.04] dark:bg-[#00F2B3]/[0.06]"
          }
          iconBg={
            totalFindings > 0
              ? "bg-[#EA0022]/10 dark:bg-[#F29400]/10"
              : "bg-[#00F2B3]/10 dark:bg-[#00F2B3]/10"
          }
          valueColor={
            totalFindings > 0
              ? "text-[#EA0022] dark:text-[#F29400]"
              : "text-[#00F2B3] dark:text-[#00F2B3]"
          }
          onClick={totalFindings > 0 ? scrollToFindings : undefined}
        />
      </section>

      {/* Extraction coverage bar */}
      <ExtractionCoverage
        extractionPct={extractionPct}
        totalPopulated={totalPopulated}
        totalSections={totalSections}
        totalRules={totalRules}
        totalNatRules={Object.values(analysisResults).reduce(
          (s, r) => s + r.stats.totalNatRules,
          0,
        )}
        totalInterfaces={Object.values(analysisResults).reduce((s, r) => s + r.stats.interfaces, 0)}
      />

      {/* DPI / Inspection posture dashboard */}
      {aggregatedPosture.totalWanRules > 0 && (
        <InspectionPostureDashboard posture={aggregatedPosture} />
      )}

      {/* Deterministic findings panel */}
      {totalFindings > 0 && (
        <div ref={findingsRef} className="scroll-mt-20 rounded-xl transition-all duration-500">
          <FindingsPanel
            analysisResults={analysisResults}
            fileCount={fileCount}
            selectedFrameworks={selectedFrameworks}
            onExplainFinding={onExplainFinding}
          />
        </div>
      )}

      {/* Estate risk comparison */}
      {fileCount >= 2 && <EstateRiskComparison analysisResults={analysisResults} />}

      {/* No-findings banner */}
      {totalFindings === 0 && (
        <div className="rounded-md border border-[#00F2B3]/30 dark:border-[#00F2B3]/30 bg-[#00F2B3]/5 dark:bg-[#00F2B3]/5 px-4 py-3 flex items-center gap-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-[#00774a] dark:text-[#00F2B3] shrink-0" />
          <span className="text-[#00774a] dark:text-[#00F2B3] font-medium">
            No issues detected in deterministic analysis.
          </span>
          <span className="text-muted-foreground">
            AI-driven assessment will provide deeper coverage.
          </span>
        </div>
      )}

      {/* Parser diagnostics (collapsible) */}
      <ParserDiagnostics analysisResults={analysisResults} />
    </div>
  );
}

function ParserDiagnostics({
  analysisResults,
}: {
  analysisResults: Record<string, AnalysisResult>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border/50 bg-card">
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
                    <span className="font-medium">Rule columns:</span> {r.ruleColumns.join(", ")}
                  </p>
                )}
                <p className="text-muted-foreground">
                  <span className="font-medium">WAN rules:</span>{" "}
                  {r.inspectionPosture.totalWanRules} total, {r.inspectionPosture.enabledWanRules}{" "}
                  enabled, {r.inspectionPosture.disabledWanRules} disabled
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Web filterable (HTTP/HTTPS/ANY):</span>{" "}
                  {r.inspectionPosture.webFilterableRules} rules,{" "}
                  {r.inspectionPosture.withWebFilter} with filter,{" "}
                  {r.inspectionPosture.withoutWebFilter} without
                </p>
                <p
                  className={
                    !r.inspectionPosture.dpiEngineEnabled && r.inspectionPosture.totalWanRules > 0
                      ? "text-[#F29400]"
                      : "text-muted-foreground"
                  }
                >
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

function ExtractionCoverage({
  extractionPct,
  totalPopulated,
  totalSections,
  totalRules,
  totalNatRules,
  totalInterfaces,
}: {
  extractionPct: number;
  totalPopulated: number;
  totalSections: number;
  totalRules: number;
  totalNatRules: number;
  totalInterfaces: number;
}) {
  const barColor =
    extractionPct >= 80
      ? "bg-[#00F2B3] dark:bg-[#00F2B3]"
      : extractionPct >= 50
        ? "bg-[#b8a200] dark:bg-[#F8E300]"
        : "bg-[#EA0022]";

  const pctColor =
    extractionPct >= 80
      ? "text-[#00F2B3] dark:text-[#00F2B3]"
      : extractionPct >= 50
        ? "text-[#b8a200] dark:text-[#F8E300]"
        : "text-[#EA0022]";

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-foreground">Extraction Coverage</span>
          <span className={`text-xs font-bold ${pctColor}`}>{extractionPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${extractionPct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {totalPopulated} of {totalSections} sections contain parseable data &middot; {totalRules}{" "}
          rules &middot; {totalNatRules} NAT rules &middot; {totalInterfaces} interfaces
        </p>
        {extractionPct >= 80 && totalRules > 0 && (
          <p
            className="text-[10px] text-[#00F2B3] dark:text-[#00F2B3] font-medium mt-1"
            role="status"
          >
            Parsed {totalSections} sections, {totalRules} firewall rules successfully.
          </p>
        )}
      </div>
      {extractionPct < 80 && (
        <div className="text-[10px] text-muted-foreground max-w-[180px] leading-tight" role="alert">
          Some sections parsed empty. This may indicate an unsupported export format or unconfigured
          areas.
        </div>
      )}
    </div>
  );
}

function InspectionPostureDashboard({ posture }: { posture: InspectionPosture }) {
  const pct = (n: number) =>
    posture.totalWanRules > 0 ? Math.round((n / posture.totalWanRules) * 100) : 0;

  const barColor = (value: number) =>
    pct(value) >= 80 ? "bg-[#00F2B3]" : pct(value) >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]";

  const barGlow = (value: number) =>
    pct(value) >= 80
      ? "shadow-[0_0_8px_rgba(0,242,179,0.3)]"
      : pct(value) >= 50
        ? "shadow-[0_0_8px_rgba(242,148,0,0.3)]"
        : "shadow-[0_0_8px_rgba(234,0,34,0.3)]";

  const pctColor = (value: number) =>
    pct(value) >= 80 ? "text-[#00F2B3]" : pct(value) >= 50 ? "text-[#F29400]" : "text-[#EA0022]";

  const bar = (label: string, value: number, color: string) => {
    const p = pct(value);
    return (
      <div
        key={label}
        className="rounded-lg bg-muted/20 dark:bg-muted/10 border border-border/30 px-3.5 py-3 space-y-2"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-display font-semibold tracking-tight text-foreground">
            {label}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-sm font-display font-bold tabular-nums ${pctColor(value)}`}>
              {value}/{posture.totalWanRules}
            </span>
            <span className={`text-[10px] font-medium tabular-nums ${pctColor(value)}/70`}>
              ({p}%)
            </span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted/60 dark:bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${color} ${barGlow(value)}`}
            style={{ width: `${Math.max(2, p)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 sm:p-6 space-y-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-accent/10 dark:bg-[#00EDFF]/10">
          <ShieldCheck className="h-4.5 w-4.5 text-brand-accent" />
        </div>
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-base font-display font-bold tracking-tight text-foreground">
            Inspection Posture
          </h3>
          <span className="text-xs text-muted-foreground/70 font-medium">
            across {posture.totalWanRules} WAN-facing rule{posture.totalWanRules !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {bar("Web Filtering", posture.withWebFilter, barColor(posture.withWebFilter))}
        {bar("IPS / Intrusion Prevention", posture.withIps, barColor(posture.withIps))}
        {bar("Application Control", posture.withAppControl, barColor(posture.withAppControl))}
      </div>

      {!posture.dpiEngineEnabled && posture.totalWanRules > 0 && (
        <div className="rounded-lg bg-[#EA0022]/8 dark:bg-[#EA0022]/10 border border-[#EA0022]/20 px-4 py-3 flex items-start gap-3">
          <span className="mt-0.5 h-2 w-2 rounded-full bg-[#EA0022] shrink-0 animate-pulse" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-display font-bold text-[#EA0022] uppercase tracking-wide">
              SSL/TLS Inspection Off
            </span>
            <p className="text-[11px] text-[#EA0022]/70 dark:text-[#EA0022]/60 leading-relaxed">
              {posture.withSslInspection === 0
                ? "No SSL/TLS inspection rules configured — encrypted traffic is not being inspected (DPI inactive)"
                : `${posture.withSslInspection} SSL/TLS rule${posture.withSslInspection !== 1 ? "s" : ""} found but all are exclusions (Do not decrypt) — no traffic is being decrypted`}
            </p>
          </div>
        </div>
      )}

      {posture.disabledWanRules > 0 && (
        <div className="rounded-lg bg-[#F29400]/5 dark:bg-[#F29400]/8 border border-[#F29400]/15 px-4 py-2.5 flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F29400] shrink-0" />
          <p className="text-[11px] text-[#c47800] dark:text-[#F29400] leading-relaxed">
            {posture.disabledWanRules} of {posture.totalWanRules} WAN rules are disabled — coverage
            scores based on {posture.enabledWanRules} enabled rule
            {posture.enabledWanRules !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {posture.withSslInspection > 0 && (
        <div className="rounded-lg bg-muted/20 dark:bg-muted/10 border border-border/30 px-4 py-2.5 space-y-1">
          <p
            className={`text-[11px] leading-relaxed ${posture.dpiEngineEnabled ? "text-muted-foreground" : "text-[#c47800] dark:text-[#F29400]"}`}
          >
            {posture.withSslInspection} SSL/TLS inspection rule
            {posture.withSslInspection !== 1 ? "s" : ""}:
            {posture.sslDecryptRules > 0 ? ` ${posture.sslDecryptRules} Decrypt` : ""}
            {posture.sslExclusionRules > 0
              ? `${posture.sslDecryptRules > 0 ? "," : ""} ${posture.sslExclusionRules} Do-not-decrypt`
              : ""}
            {posture.dpiEngineEnabled ? " (DPI active)" : ""}
          </p>
          {posture.sslUncoveredZones.length > 0 && (
            <p className="text-[11px] text-[#c47800] dark:text-[#F29400] leading-relaxed">
              Zone gap: {posture.sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")} → WAN
              traffic is not covered by any Decrypt rule
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const SEV_DOT_BG: Record<Severity, string> = {
  critical: "bg-[#EA0022]",
  high: "bg-[#F29400]",
  medium: "bg-[#F8C300]",
  low: "bg-[#00F2B3]",
  info: "bg-[#009CFB]",
};

const SEV_BADGE_INLINE: Record<Severity, string> = {
  critical: "bg-[#EA0022]/15 text-[#EA0022] border-[#EA0022]/20",
  high: "bg-[#F29400]/15 text-[#c47800] dark:text-[#F29400] border-[#F29400]/20",
  medium: "bg-[#F8C300]/15 text-[#b8a200] dark:text-[#F8C300] border-[#F8C300]/20",
  low: "bg-[#00F2B3]/15 text-[#00b386] dark:text-[#00F2B3] border-[#00F2B3]/20",
  info: "bg-[#009CFB]/15 text-[#0077cc] dark:text-[#009CFB] border-[#009CFB]/20",
};

function FindingCard({
  finding,
  label,
  fileCount,
  selectedFrameworks,
  onExplainFinding,
}: {
  finding: {
    id: string;
    severity: Severity;
    title: string;
    detail: string;
    section: string;
    remediation?: string;
    confidence?: string;
    evidence?: string;
  };
  label: string;
  fileCount: number;
  selectedFrameworks: string[];
  onExplainFinding?: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const frameworks =
    selectedFrameworks.length > 0 ? findingToFrameworks(finding.title, selectedFrameworks) : [];

  return (
    <div
      className={`rounded-xl border border-border/50 border-l-[3px] ${SEVERITY_BORDER[finding.severity]} bg-card shadow-card overflow-hidden transition-all`}
    >
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors min-w-0 group"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${SEV_DOT_BG[finding.severity]} shrink-0 shadow-[0_0_6px_rgba(0,0,0,0.15)]`}
            title={finding.severity}
          />
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <span
              className={`font-display font-semibold text-[13px] tracking-tight ${SEVERITY_COLOR[finding.severity]}`}
            >
              {finding.title}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${SEV_BADGE_INLINE[finding.severity]}`}
            >
              {finding.severity}
            </span>
            {fileCount > 1 && (
              <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md font-medium border border-border/40">
                {label}
              </span>
            )}
            {frameworks.map((fw) => (
              <span
                key={fw}
                className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#EA0022]/10 text-[#EA0022] dark:bg-[#EA0022]/15 dark:text-[#ff6b6b] border border-[#EA0022]/15"
              >
                {fw}
              </span>
            ))}
          </div>
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          />
        </button>
        {onExplainFinding && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExplainFinding(finding.title);
            }}
            className="p-2.5 mr-1 shrink-0 text-muted-foreground/50 hover:text-[#2006F7] dark:hover:text-[#00EDFF] hover:bg-muted/40 rounded-lg transition-colors"
            title="Explain this finding"
            aria-label="Explain this finding"
          >
            <Lightbulb className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="px-4 pb-4 pl-[3.25rem] space-y-3 border-t border-border/30 pt-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{finding.detail}</p>

          <div className="rounded-lg bg-muted/30 dark:bg-muted/20 border border-border/40 px-3.5 py-2.5 space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
              Evidence Source
            </p>
            <p className="text-[11px] text-foreground/90 leading-relaxed">
              <span className="font-semibold">Section:</span> {finding.section}
              {finding.evidence && (
                <>
                  <br />
                  <span className="font-semibold">Extracted fact:</span>{" "}
                  <span className="font-mono text-[10px] text-foreground/70">
                    {finding.evidence}
                  </span>
                </>
              )}
            </p>
            {finding.confidence && (
              <span
                className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md mt-0.5 border ${
                  finding.confidence === "high"
                    ? "bg-[#00F2B3]/10 text-[#00b386] dark:text-[#00F2B3] border-[#00F2B3]/20"
                    : finding.confidence === "medium"
                      ? "bg-[#F29400]/10 text-[#F29400] border-[#F29400]/20"
                      : "bg-muted text-muted-foreground border-border/40"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    finding.confidence === "high"
                      ? "bg-[#00F2B3]"
                      : finding.confidence === "medium"
                        ? "bg-[#F29400]"
                        : "bg-muted-foreground"
                  }`}
                />
                {finding.confidence} confidence
              </span>
            )}
          </div>

          {finding.remediation && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#2006F7]/[0.04] dark:bg-brand-accent/[0.08] border border-brand-accent/15 dark:border-brand-accent/25">
              <p className="text-[11px] text-foreground/90 leading-relaxed">
                <span className="font-bold text-[#2006F7] dark:text-[#009CFB]">Remediation:</span>{" "}
                {finding.remediation}
              </p>
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
  Extraction: FileWarning,
  Wireless: Wifi,
};

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEV_BADGE: Record<Severity, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-[#EA0022]/10", text: "text-[#EA0022]", label: "C" },
  high: { bg: "bg-[#F29400]/10", text: "text-[#c47800] dark:text-[#F29400]", label: "H" },
  medium: { bg: "bg-[#F8E300]/10", text: "text-[#b8a200] dark:text-[#F8E300]", label: "M" },
  low: { bg: "bg-[#00F2B3]/10", text: "text-[#00F2B3] dark:text-[#00F2B3]", label: "L" },
  info: { bg: "bg-[#009CFB]/10", text: "text-[#0077cc] dark:text-[#009CFB]", label: "I" },
};

interface SectionGroupData {
  section: string;
  findings: (Finding & { firewall: string })[];
  sevCounts: Record<Severity, number>;
  highestSeverity: number;
}

function FindingsPanel({
  analysisResults,
  fileCount,
  selectedFrameworks,
  onExplainFinding,
}: {
  analysisResults: Record<string, AnalysisResult>;
  fileCount: number;
  selectedFrameworks: string[];
  onExplainFinding?: (title: string) => void;
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
        const sevCounts: Record<Severity, number> = {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        };
        for (const f of findings) sevCounts[f.severity]++;
        const highestSeverity = SEV_ORDER.findIndex((s) => sevCounts[s] > 0);
        return {
          section,
          findings,
          sevCounts,
          highestSeverity: highestSeverity === -1 ? 99 : highestSeverity,
        };
      })
      .sort(
        (a, b) => a.highestSeverity - b.highestSeverity || b.findings.length - a.findings.length,
      );
  }, [analysisResults]);

  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setOpenSections(new Set(groups.map((g) => g.section)));
  }, [groups]);

  const collapseAll = useCallback(() => setOpenSections(new Set()), []);

  const totalCount = groups.reduce((s, g) => s + g.findings.length, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#EA0022]/10 dark:bg-[#EA0022]/15">
          <AlertTriangle className="h-4.5 w-4.5 text-[#EA0022]" />
        </div>
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-base font-display font-bold tracking-tight text-foreground">
            Deterministic Findings
          </h3>
          <span className="text-xs text-muted-foreground/70 font-medium tabular-nums">
            {totalCount} issues across {groups.length} sections
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={openSections.size > 0 ? collapseAll : expandAll}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-colors"
          >
            {openSections.size > 0 ? "Collapse all" : "Expand all"}
          </button>
          <button
            onClick={() => downloadCsv(analysisResults)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-colors"
            title="Export findings as CSV"
          >
            <Download className="h-3 w-3" /> CSV
          </button>
          <button
            onClick={() => downloadFindingsPdf(analysisResults)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-border transition-colors"
            title="Export findings as printable PDF"
          >
            <Download className="h-3 w-3" /> PDF
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {groups.map((g) => {
          const isOpen = openSections.has(g.section);
          const Icon = SECTION_ICONS[g.section] ?? AlertTriangle;
          const borderSev = SEV_ORDER[g.highestSeverity] ?? "info";
          return (
            <div
              key={g.section}
              className={`rounded-xl border border-border/60 border-l-[3px] ${SEVERITY_BORDER[borderSev]} bg-card shadow-card overflow-hidden transition-all`}
            >
              <button
                onClick={() => toggleSection(g.section)}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors group"
              >
                <Icon className="h-4 w-4 text-muted-foreground/70 group-hover:text-foreground/80 transition-colors shrink-0" />
                <span className="text-[13px] font-display font-semibold tracking-tight text-foreground flex-1 min-w-0 truncate">
                  {g.section}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {SEV_ORDER.map((sev) => {
                    const count = g.sevCounts[sev];
                    if (count === 0) return null;
                    const badge = SEV_BADGE[sev];
                    return (
                      <span
                        key={sev}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badge.bg} ${badge.text}`}
                      >
                        {count}
                        {badge.label}
                      </span>
                    );
                  })}
                </span>
                <span className="text-xs font-semibold text-muted-foreground/60 tabular-nums shrink-0 w-6 text-right">
                  {g.findings.length}
                </span>
                <ChevronRight
                  className={`h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-border/40 pt-2.5">
                  {g.findings.map((f, i) => (
                    <FindingCard
                      key={`${f.firewall}-${f.id}-${i}`}
                      finding={f}
                      label={f.firewall}
                      fileCount={fileCount}
                      selectedFrameworks={selectedFrameworks}
                      onExplainFinding={onExplainFinding}
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

function EstateRiskComparison({
  analysisResults,
}: {
  analysisResults: Record<string, AnalysisResult>;
}) {
  const weight = (r: AnalysisResult) =>
    r.findings.reduce(
      (s, f) =>
        s +
        (f.severity === "critical"
          ? 10
          : f.severity === "high"
            ? 5
            : f.severity === "medium"
              ? 2
              : f.severity === "low"
                ? 1
                : 0),
      0,
    );

  const maxScore = Math.max(1, ...Object.values(analysisResults).map(weight));

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-brand-accent" />
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Estate Risk Comparison
        </h3>
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
                <span className="text-[10px] font-bold text-muted-foreground w-5 text-right">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-foreground truncate">{label}</span>
                    <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                      {criticals > 0 && (
                        <span
                          className="text-[#EA0022] font-bold"
                          title={`${criticals} Critical finding${criticals !== 1 ? "s" : ""}`}
                        >
                          {criticals}C
                        </span>
                      )}
                      {highs > 0 && (
                        <span
                          className="text-[#c47800] dark:text-[#F29400] font-bold"
                          title={`${highs} High finding${highs !== 1 ? "s" : ""}`}
                        >
                          {highs}H
                        </span>
                      )}
                      {mediums > 0 && (
                        <span
                          className="text-[#b8a200] dark:text-[#F8E300] font-bold"
                          title={`${mediums} Medium finding${mediums !== 1 ? "s" : ""}`}
                        >
                          {mediums}M
                        </span>
                      )}
                      <span
                        className="text-muted-foreground"
                        title={`${result.stats.totalRules} rules parsed`}
                      >
                        {result.stats.totalRules}r
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${score === 0 ? "bg-[#00F2B3] dark:bg-[#00F2B3]" : score <= 5 ? "bg-[#F8E300]" : score <= 15 ? "bg-[#F29400]" : "bg-[#EA0022]"}`}
                      style={{ width: `${Math.max(3, Math.round((score / maxScore) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p>
          <span className="text-[#EA0022] font-semibold">C</span> = Critical &middot;{" "}
          <span className="text-[#c47800] dark:text-[#F29400] font-semibold">H</span> = High
          &middot; <span className="text-[#b8a200] dark:text-[#F8E300] font-semibold">M</span> =
          Medium &middot; <span className="font-semibold">r</span> = rules parsed
        </p>
        <p>
          Ranked by weighted risk score: Critical &times;10, High &times;5, Medium &times;2, Low
          &times;1
        </p>
      </div>
    </div>
  );
}

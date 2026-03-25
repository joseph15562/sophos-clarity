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
  low: "text-[#007A5A] dark:text-[#00F2B3]",
  info: "text-[#0077cc] dark:text-[#009CFB]",
};

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-[#EA0022]",
  high: "border-l-[#c47800] dark:border-l-[#F29400]",
  medium: "border-l-[#b8a200] dark:border-l-[#F8E300]",
  low: "border-l-[#00F2B3] dark:border-l-[#00F2B3]",
  info: "border-l-[#0077cc] dark:border-l-[#009CFB]",
};

const SEV_HEX: Record<Severity, string> = {
  critical: "#EA0022",
  high: "#F29400",
  medium: "#F8E300",
  low: "#00F2B3",
  info: "#009CFB",
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
    const y = findingsRef.current.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: y, behavior: "smooth" });
    findingsRef.current.classList.add("ring-2", "ring-[#F29400]/40");
    setTimeout(() => findingsRef.current?.classList.remove("ring-2", "ring-[#F29400]/40"), 1500);
  }, []);

  return (
    <div className="space-y-6">
      {/* Estate summary cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Network className="h-7 w-7" style={{ color: "#2006F7" }} />}
          value={fileCount}
          label={`Firewall${fileCount !== 1 ? "s" : ""}`}
          hex="#2006F7"
          border=""
          bg=""
          iconBg=""
          valueColor=""
        />
        <StatCard
          icon={<Scale className="h-7 w-7" style={{ color: "#5A00FF" }} />}
          value={totalRules}
          label="Rules Parsed"
          hex="#5A00FF"
          border=""
          bg=""
          iconBg=""
          valueColor=""
        />
        <StatCard
          icon={<Search className="h-7 w-7" style={{ color: "#00EDFF" }} />}
          value={totalSections}
          label="Sections"
          hex="#00EDFF"
          border=""
          bg=""
          iconBg=""
          valueColor=""
        />
        <StatCard
          icon={
            <AlertTriangle
              className="h-7 w-7"
              style={{ color: totalFindings > 0 ? "#EA0022" : "#00F2B3" }}
            />
          }
          value={totalFindings}
          label="Issues"
          hex={totalFindings > 0 ? "#EA0022" : "#00F2B3"}
          border=""
          bg=""
          iconBg=""
          valueColor=""
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
        <div className="rounded-md border border-[#008F69]/35 dark:border-[#00F2B3]/30 dark:border-[#008F69]/35 dark:border-[#00F2B3]/30 bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 dark:bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 px-4 py-3 flex items-center gap-3 text-sm">
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
    <div
      className="group relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] transition-all duration-200 hover:border-slate-900/[0.14] dark:hover:border-white/[0.10]"
      style={{
        background: "linear-gradient(145deg, rgba(0,237,255,0.04), rgba(90,0,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Top shimmer */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,237,255,0.2), rgba(90,0,255,0.12), transparent)",
        }}
      />

      <button
        onClick={() => setOpen(!open)}
        className="relative w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center border border-slate-900/[0.12] dark:border-white/[0.08] shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(0,237,255,0.12), rgba(90,0,255,0.08))",
          }}
        >
          <Settings
            className="h-3.5 w-3.5 text-[#00EDFF]"
            style={{ filter: "drop-shadow(0 0 3px rgba(0,237,255,0.4))" }}
          />
        </div>
        <span className="text-[10px] font-display font-black text-muted-foreground uppercase tracking-wider flex-1">
          Parser Diagnostics
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-900/[0.10] dark:border-white/[0.06] px-5 pb-4 pt-3 space-y-3 text-[10px]">
          {Object.entries(analysisResults).map(([label, r]) => {
            const dpiWarn =
              !r.inspectionPosture.dpiEngineEnabled && r.inspectionPosture.totalWanRules > 0;
            return (
              <div
                key={label}
                className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-4 space-y-2 transition-all duration-200 hover:border-slate-900/[0.14] dark:hover:border-white/[0.10]"
                style={{
                  background: "linear-gradient(145deg, rgba(0,237,255,0.04), rgba(90,0,255,0.015))",
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-px pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(0,237,255,0.15), transparent)",
                  }}
                />
                <p className="relative font-display font-bold text-[11px] text-foreground">
                  {label}
                </p>
                <div className="relative space-y-1.5 text-muted-foreground/70 leading-relaxed">
                  <p>
                    <span className="font-bold text-muted-foreground">Sections parsed:</span>{" "}
                    {r.stats.sectionNames.join(", ")}
                  </p>
                  {r.ruleColumns && r.ruleColumns.length > 0 && (
                    <p>
                      <span className="font-bold text-muted-foreground">Rule columns:</span>{" "}
                      {r.ruleColumns.join(", ")}
                    </p>
                  )}
                  <p>
                    <span className="font-bold text-muted-foreground">WAN rules:</span>{" "}
                    {r.inspectionPosture.totalWanRules} total, {r.inspectionPosture.enabledWanRules}{" "}
                    enabled, {r.inspectionPosture.disabledWanRules} disabled
                  </p>
                  <p>
                    <span className="font-bold text-muted-foreground">
                      Web filterable (HTTP/HTTPS/ANY):
                    </span>{" "}
                    {r.inspectionPosture.webFilterableRules} rules,{" "}
                    {r.inspectionPosture.withWebFilter} with filter,{" "}
                    {r.inspectionPosture.withoutWebFilter} without
                  </p>
                  <p className={dpiWarn ? "font-bold text-[#F29400]" : ""}>
                    <span className={dpiWarn ? "" : "font-bold text-muted-foreground"}>
                      SSL/TLS Inspection (DPI):
                    </span>{" "}
                    {r.inspectionPosture.withSslInspection === 0
                      ? "No SSL/TLS inspection rules found — DPI is inactive"
                      : `${r.inspectionPosture.withSslInspection} rules (${r.inspectionPosture.sslDecryptRules} Decrypt, ${r.inspectionPosture.sslExclusionRules} exclusions)${r.inspectionPosture.dpiEngineEnabled ? " — DPI active" : " — no Decrypt rules, DPI inactive"}`}
                    {r.inspectionPosture.sslUncoveredZones.length > 0
                      ? ` | Zone gaps: ${r.inspectionPosture.sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")}`
                      : ""}
                  </p>
                </div>
              </div>
            );
          })}
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
  const barHex = extractionPct >= 80 ? "#00F2B3" : extractionPct >= 50 ? "#F8E300" : "#EA0022";

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-4 flex items-center gap-4 shadow-card transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{ background: `linear-gradient(135deg, ${barHex}0A, ${barHex}03)` }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-4 -right-4 h-12 w-12 rounded-full blur-[24px] opacity-20"
          style={{ backgroundColor: barHex }}
        />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${barHex}28, transparent)` }}
      />
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-foreground">Extraction Coverage</span>
          <span className="text-sm font-black tabular-nums" style={{ color: barHex }}>
            {extractionPct}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-white/80 dark:bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${extractionPct}%`,
              background: `linear-gradient(90deg, ${barHex}90, ${barHex})`,
              boxShadow: `0 0 10px ${barHex}40`,
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/80 mt-1.5">
          {totalPopulated} of {totalSections} sections contain parseable data &middot; {totalRules}{" "}
          rules &middot; {totalNatRules} NAT rules &middot; {totalInterfaces} interfaces
        </p>
        {extractionPct >= 80 && totalRules > 0 && (
          <p className="text-[10px] font-bold mt-1" style={{ color: barHex }} role="status">
            Parsed {totalSections} sections, {totalRules} firewall rules successfully.
          </p>
        )}
      </div>
      {extractionPct < 80 && (
        <div
          className="relative text-[10px] text-muted-foreground max-w-[180px] leading-tight"
          role="alert"
        >
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

  const barHex = (value: number) =>
    pct(value) >= 80 ? "#00F2B3" : pct(value) >= 50 ? "#F29400" : "#EA0022";

  const bar = (label: string, value: number) => {
    const p = pct(value);
    const hex = barHex(value);
    return (
      <div
        key={label}
        className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3.5 space-y-2 transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
        style={{ background: `linear-gradient(135deg, ${hex}0C, ${hex}03)` }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-4 -right-4 h-10 w-10 rounded-full blur-[20px] opacity-15"
            style={{ backgroundColor: hex }}
          />
        </div>
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${hex}25, transparent)` }}
        />
        <div className="relative flex items-center justify-between">
          <span className="text-[11px] font-display font-bold tracking-tight text-foreground">
            {label}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-display font-black tabular-nums" style={{ color: hex }}>
              {value}/{posture.totalWanRules}
            </span>
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{ color: hex, opacity: 0.7 }}
            >
              ({p}%)
            </span>
          </div>
        </div>
        <div className="relative h-2.5 rounded-full bg-white/80 dark:bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.max(2, p)}%`,
              background: `linear-gradient(90deg, ${hex}90, ${hex})`,
              boxShadow: `0 0 10px ${hex}40`,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 sm:p-6 space-y-4 shadow-card"
      style={{ background: "linear-gradient(145deg, rgba(32,6,247,0.06), rgba(32,6,247,0.015))" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full blur-[32px] opacity-15 bg-brand-accent" />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(32,6,247,0.2), transparent)",
        }}
      />

      <div className="relative flex items-center gap-3">
        <div
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08]"
          style={{ backgroundColor: "rgba(32,6,247,0.12)" }}
        >
          <ShieldCheck className="h-4.5 w-4.5 text-brand-accent" />
        </div>
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-base font-display font-black tracking-tight text-foreground">
            Inspection Posture
          </h3>
          <span className="text-xs text-muted-foreground/70 font-medium">
            across {posture.totalWanRules} WAN-facing rule{posture.totalWanRules !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="relative grid gap-3 sm:grid-cols-2">
        {bar("Web Filtering", posture.withWebFilter)}
        {bar("IPS / Intrusion Prevention", posture.withIps)}
        {bar("Application Control", posture.withAppControl)}
      </div>

      {!posture.dpiEngineEnabled && posture.totalWanRules > 0 && (
        <div
          className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3 flex items-start gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(234,0,34,0.10), rgba(234,0,34,0.03))",
          }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-3 -left-3 h-10 w-10 rounded-full blur-[20px] opacity-20 bg-[#EA0022]" />
          </div>
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, rgba(234,0,34,0.3), transparent 60%)" }}
          />
          <span className="relative mt-0.5 h-2.5 w-2.5 rounded-full bg-[#EA0022] shrink-0 animate-pulse" />
          <div className="relative space-y-0.5">
            <span className="text-[11px] font-display font-black text-[#EA0022] uppercase tracking-wider">
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
        <div
          className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-2.5 flex items-center gap-2.5"
          style={{
            background: "linear-gradient(135deg, rgba(242,148,0,0.08), rgba(242,148,0,0.02))",
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, rgba(242,148,0,0.25), transparent 60%)" }}
          />
          <span className="relative h-2 w-2 rounded-full bg-[#F29400] shrink-0" />
          <p className="relative text-[11px] text-[#c47800] dark:text-[#F29400] leading-relaxed">
            {posture.disabledWanRules} of {posture.totalWanRules} WAN rules are disabled — coverage
            scores based on {posture.enabledWanRules} enabled rule
            {posture.enabledWanRules !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {posture.withSslInspection > 0 && (
        <div
          className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-2.5 space-y-1"
          style={{
            background: "linear-gradient(135deg, rgba(32,6,247,0.05), rgba(32,6,247,0.015))",
          }}
        >
          <p
            className={`relative text-[11px] leading-relaxed ${posture.dpiEngineEnabled ? "text-muted-foreground" : "text-[#c47800] dark:text-[#F29400]"}`}
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
            <p className="relative text-[11px] text-[#c47800] dark:text-[#F29400] leading-relaxed">
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
  low: "bg-[#00F2B3]/15 text-[#00b386] dark:text-[#00F2B3] border-[#008F69]/30 dark:border-[#00F2B3]/20",
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

  const sevHex = SEV_HEX[finding.severity];
  const confHex =
    finding.confidence === "high"
      ? "#00F2B3"
      : finding.confidence === "medium"
        ? "#F29400"
        : "#888888";

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] border-l-[3px] transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{
        borderLeftColor: sevHex,
        background: `linear-gradient(135deg, ${sevHex}08, ${sevHex}02)`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-3 -left-3 h-8 w-8 rounded-full blur-[16px] opacity-12"
          style={{ backgroundColor: sevHex }}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(!open)}
          className="relative flex-1 flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02] transition-colors min-w-0 group"
        >
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: sevHex, boxShadow: `0 0 8px ${sevHex}50` }}
            title={finding.severity}
          />
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-[13px] tracking-tight text-foreground">
              {finding.title}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border"
              style={{
                color: sevHex,
                backgroundColor: `${sevHex}14`,
                borderColor: `${sevHex}25`,
              }}
            >
              {finding.severity}
            </span>
            {fileCount > 1 && (
              <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-md font-medium border border-slate-900/[0.12] dark:border-white/[0.08] bg-white/75 dark:bg-white/[0.04]">
                {label}
              </span>
            )}
            {frameworks.map((fw) => (
              <span
                key={fw}
                className="text-[9px] font-bold px-2 py-0.5 rounded-md border"
                style={{
                  color: "#EA0022",
                  backgroundColor: "rgba(234,0,34,0.12)",
                  borderColor: "rgba(234,0,34,0.2)",
                }}
              >
                {fw}
              </span>
            ))}
          </div>
          <ChevronRight
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            style={{ color: sevHex, opacity: 0.5 }}
          />
        </button>
        {onExplainFinding && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExplainFinding(finding.title);
            }}
            className="relative p-2.5 mr-1 shrink-0 text-muted-foreground/50 hover:text-brand-accent rounded-lg transition-all duration-200 hover:bg-brand-accent/[0.08]"
            title="Explain this finding"
            aria-label="Explain this finding"
          >
            <Lightbulb className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="relative px-4 pb-4 pl-[3.25rem] space-y-3 border-t border-slate-900/[0.10] dark:border-white/[0.06] pt-3">
          <p className="text-xs text-muted-foreground/90 leading-relaxed">{finding.detail}</p>

          <div
            className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3 space-y-1.5"
            style={{
              background: "linear-gradient(145deg, rgba(32,6,247,0.05), rgba(32,6,247,0.015))",
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px pointer-events-none"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(32,6,247,0.18), transparent)",
              }}
            />
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-accent">
              Evidence Source
            </p>
            <p className="text-[11px] text-foreground/90 leading-relaxed">
              <span className="font-bold">Section:</span> {finding.section}
              {finding.evidence && (
                <>
                  <br />
                  <span className="font-bold">Extracted fact:</span>{" "}
                  <span className="font-mono text-[10px] text-foreground/70">
                    {finding.evidence}
                  </span>
                </>
              )}
            </p>
            {finding.confidence && (
              <span
                className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-md mt-0.5 border"
                style={{
                  color: confHex,
                  backgroundColor: `${confHex}14`,
                  borderColor: `${confHex}22`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: confHex, boxShadow: `0 0 6px ${confHex}50` }}
                />
                {finding.confidence} confidence
              </span>
            )}
          </div>

          {finding.remediation && (
            <div
              className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3"
              style={{
                background: "linear-gradient(145deg, rgba(32,6,247,0.06), rgba(32,6,247,0.02))",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(32,6,247,0.2), transparent)",
                }}
              />
              <p className="relative text-[11px] text-foreground/90 leading-relaxed">
                <span className="font-bold text-brand-accent">Remediation:</span>{" "}
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
  low: {
    bg: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10",
    text: "text-[#007A5A] dark:text-[#00F2B3]",
    label: "L",
  },
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
    <section
      className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 sm:p-6 space-y-4 shadow-card"
      style={{ background: "linear-gradient(145deg, rgba(234,0,34,0.05), rgba(234,0,34,0.012))" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full blur-[32px] opacity-12 bg-[#EA0022]" />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(234,0,34,0.18), transparent)",
        }}
      />

      <div className="relative flex items-center gap-3 flex-wrap">
        <div
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08]"
          style={{ backgroundColor: "rgba(234,0,34,0.12)" }}
        >
          <AlertTriangle className="h-4.5 w-4.5 text-[#EA0022]" />
        </div>
        <div className="flex items-baseline gap-2.5">
          <h3 className="text-base font-display font-black tracking-tight text-foreground">
            Deterministic Findings
          </h3>
          <span className="text-xs text-muted-foreground/70 font-medium tabular-nums">
            {totalCount} issues across {groups.length} sections
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={openSections.size > 0 ? collapseAll : expandAll}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-slate-900/[0.12] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] hover:bg-slate-950/[0.06] dark:hover:bg-white/[0.06] hover:border-slate-900/[0.18] dark:hover:border-white/[0.15] transition-all duration-200"
          >
            {openSections.size > 0 ? "Collapse all" : "Expand all"}
          </button>
          <button
            onClick={() => downloadCsv(analysisResults)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-slate-900/[0.12] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] hover:bg-slate-950/[0.06] dark:hover:bg-white/[0.06] hover:border-slate-900/[0.18] dark:hover:border-white/[0.15] transition-all duration-200"
            title="Export findings as CSV"
          >
            <Download className="h-3 w-3 text-brand-accent" /> CSV
          </button>
          <button
            onClick={() => downloadFindingsPdf(analysisResults)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-slate-900/[0.12] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] hover:bg-slate-950/[0.06] dark:hover:bg-white/[0.06] hover:border-slate-900/[0.18] dark:hover:border-white/[0.15] transition-all duration-200"
            title="Export findings as printable PDF"
          >
            <Download className="h-3 w-3 text-brand-accent" /> PDF
          </button>
        </div>
      </div>

      <div className="relative space-y-2">
        {groups.map((g) => {
          const isOpen = openSections.has(g.section);
          const Icon = SECTION_ICONS[g.section] ?? AlertTriangle;
          const borderSev = SEV_ORDER[g.highestSeverity] ?? "info";
          const hex = SEV_HEX[borderSev];
          return (
            <div
              key={g.section}
              className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] border-l-[3px] transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
              style={{
                borderLeftColor: hex,
                background: `linear-gradient(135deg, ${hex}08, ${hex}02)`,
              }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute -top-3 -left-3 h-8 w-8 rounded-full blur-[16px] opacity-15"
                  style={{ backgroundColor: hex }}
                />
              </div>
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                style={{ background: `linear-gradient(90deg, ${hex}25, transparent 50%)` }}
              />
              <button
                onClick={() => toggleSection(g.section)}
                className="relative w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02] transition-colors group"
              >
                <Icon
                  className="h-4 w-4 transition-colors shrink-0"
                  style={{ color: hex, opacity: 0.7 }}
                />
                <span className="text-[13px] font-display font-bold tracking-tight text-foreground flex-1 min-w-0 truncate">
                  {g.section}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {SEV_ORDER.map((sev) => {
                    const count = g.sevCounts[sev];
                    if (count === 0) return null;
                    const badge = SEV_BADGE[sev];
                    const sevHex = SEV_HEX[sev];
                    return (
                      <span
                        key={sev}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                        style={{
                          color: sevHex,
                          backgroundColor: `${sevHex}14`,
                          borderColor: `${sevHex}25`,
                        }}
                      >
                        {count}
                        {badge.label}
                      </span>
                    );
                  })}
                </span>
                <span
                  className="text-xs font-bold tabular-nums shrink-0 w-6 text-right"
                  style={{ color: hex, opacity: 0.6 }}
                >
                  {g.findings.length}
                </span>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                  style={{ color: hex, opacity: 0.5 }}
                />
              </button>
              {isOpen && (
                <div className="relative px-3 pb-3 space-y-1.5 border-t border-slate-900/[0.10] dark:border-white/[0.06] pt-2.5">
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
    <div
      className="group relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 sm:p-6 space-y-4 transition-all duration-200 hover:border-slate-900/[0.14] dark:hover:border-white/[0.10] hover:shadow-[0_8px_40px_rgba(32,6,247,0.12)]"
      style={{
        background: "linear-gradient(145deg, rgba(90,0,255,0.07), rgba(0,237,255,0.025))",
        boxShadow: "0 12px 40px rgba(32,6,247,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Corner glow */}
      <div
        className="absolute -top-10 -right-10 h-28 w-28 rounded-full blur-[50px] opacity-20 transition-opacity duration-300 group-hover:opacity-35 pointer-events-none"
        style={{ background: "radial-gradient(circle, #5A00FF 0%, transparent 70%)" }}
      />
      {/* Top shimmer */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(90,0,255,0.35), rgba(0,237,255,0.2), transparent)",
        }}
      />

      {/* Header */}
      <div className="relative flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center border border-slate-900/[0.12] dark:border-white/[0.08]"
          style={{
            background: "linear-gradient(135deg, rgba(90,0,255,0.18), rgba(0,237,255,0.10))",
          }}
        >
          <GitBranch
            className="h-4 w-4 text-[#00EDFF]"
            style={{ filter: "drop-shadow(0 0 4px rgba(0,237,255,0.5))" }}
          />
        </div>
        <h3 className="text-base font-display font-black tracking-tight text-foreground">
          Estate Risk Comparison
        </h3>
      </div>

      {/* Firewall rows */}
      <div className="relative space-y-2.5">
        {Object.entries(analysisResults)
          .sort(([, a], [, b]) => weight(b) - weight(a))
          .map(([label, result], idx) => {
            const criticals = result.findings.filter((f) => f.severity === "critical").length;
            const highs = result.findings.filter((f) => f.severity === "high").length;
            const mediums = result.findings.filter((f) => f.severity === "medium").length;
            const score = criticals * 10 + highs * 5 + mediums * 2;
            const barHex =
              score === 0
                ? "#00F2B3"
                : score <= 5
                  ? "#F8E300"
                  : score <= 15
                    ? "#F29400"
                    : "#EA0022";
            const pct = Math.max(3, Math.round((score / maxScore) * 100));

            return (
              <div
                key={label}
                className="group/row relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3.5 transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated hover:scale-[1.01]"
                style={{ background: `linear-gradient(145deg, ${barHex}0C, ${barHex}03)` }}
              >
                {/* Row glow */}
                <div
                  className="absolute -top-4 -right-4 h-12 w-12 rounded-full blur-[20px] opacity-0 transition-opacity duration-200 group-hover/row:opacity-25 pointer-events-none"
                  style={{ backgroundColor: barHex }}
                />
                <div
                  className="absolute inset-x-0 top-0 h-px pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${barHex}25, transparent)`,
                  }}
                />

                <div className="relative flex items-center gap-3">
                  {/* Rank */}
                  <span
                    className="text-lg font-display font-black tabular-nums w-6 text-center shrink-0"
                    style={{ color: barHex, opacity: 0.4 }}
                  >
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-display font-bold text-foreground truncate">
                        {label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {criticals > 0 && (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-md border"
                            style={{
                              color: "#EA0022",
                              backgroundColor: "rgba(234,0,34,0.12)",
                              borderColor: "rgba(234,0,34,0.2)",
                            }}
                            title={`${criticals} Critical`}
                          >
                            {criticals}C
                          </span>
                        )}
                        {highs > 0 && (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-md border"
                            style={{
                              color: "#F29400",
                              backgroundColor: "rgba(242,148,0,0.12)",
                              borderColor: "rgba(242,148,0,0.2)",
                            }}
                            title={`${highs} High`}
                          >
                            {highs}H
                          </span>
                        )}
                        {mediums > 0 && (
                          <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-md border"
                            style={{
                              color: "#F8E300",
                              backgroundColor: "rgba(248,227,0,0.10)",
                              borderColor: "rgba(248,227,0,0.18)",
                            }}
                            title={`${mediums} Medium`}
                          >
                            {mediums}M
                          </span>
                        )}
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-900/[0.12] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] text-muted-foreground"
                          title={`${result.stats.totalRules} rules parsed`}
                        >
                          {result.stats.totalRules}r
                        </span>
                      </div>
                    </div>
                    {/* Risk bar */}
                    <div className="h-2.5 rounded-full bg-white/80 dark:bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${barHex}90, ${barHex})`,
                          boxShadow: `0 0 12px ${barHex}40`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Legend */}
      <div
        className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3 space-y-1"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(90,0,255,0.15), transparent)",
          }}
        />
        <p className="relative text-[10px] text-muted-foreground">
          <span className="font-black text-[#EA0022]">C</span> = Critical &middot;{" "}
          <span className="font-black text-[#F29400]">H</span> = High &middot;{" "}
          <span className="font-black text-[#F8E300]">M</span> = Medium &middot;{" "}
          <span className="font-bold">r</span> = rules parsed
        </p>
        <p className="relative text-[10px] text-muted-foreground/60">
          Ranked by weighted risk score: Critical &times;10, High &times;5, Medium &times;2, Low
          &times;1
        </p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrandingData } from "./BrandingSetup";
import type { AnalysisResult, Severity } from "@/lib/analyse-config";
import { severityIcon } from "@/lib/analyse-config";
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";
import { mapToFramework, type FrameworkMapping } from "@/lib/compliance-map";
import {
  Loader2,
  Download,
  FileText,
  RefreshCw,
  Archive,
  Shield,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  TrendingUp,
  Share2,
  Copy,
  Bug,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/SafeHtml";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractTocHeadings, buildReportHtml } from "@/lib/report-html";
import { findingToFrameworks } from "@/lib/compliance-map";
import { saveAs } from "file-saver";
import { generateShareToken, saveSharedReport } from "@/lib/share-report";
import {
  buildPdfHtml,
  generateWordBlob,
  generatePptxBlob,
  type ReportExportTheme,
} from "@/lib/report-export";
import JSZip from "jszip";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import { FlowStatusCard } from "@/components/FlowStatusCard";

export type ReportEntry = {
  id: string;
  label: string;
  markdown: string;
  /** Shown in the failed state so you can see why generation failed */
  errorMessage?: string;
  /** Shown under the spinner during loading for diagnosis */
  loadingStatus?: string;
};

type Props = {
  reports: ReportEntry[];
  activeReportId: string;
  onActiveChange: (id: string) => void;
  isLoading: boolean;
  loadingReportIds: Set<string>;
  failedReportIds: Set<string>;
  onRetry: (reportId: string) => void;
  branding: BrandingData;
  /** Rendered at the top when reports exist (e.g. Add Compliance Report) */
  topActions?: ReactNode;
  /** Per-firewall analysis results for evidence verification sidebar */
  analysisResults?: Record<string, AnalysisResult>;
  /** Selected frameworks for control traceability in evidence verification */
  selectedFrameworks?: string[];
  /** Backend debug info from parse-config (when debug: true). */
  backendDebugInfo?: Record<string, unknown> | null;
  /** Fetch backend debug for the currently active report. */
  onFetchBackendDebug?: () => void;
};

function ReportToc({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  const headings = useMemo(() => extractTocHeadings(markdown), [markdown]);

  if (headings.length < 3) return null;

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setOpen(false);
    }
  };

  return (
    <div className="no-print mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs font-semibold text-[#2006F7] dark:text-[#009CFB] hover:underline flex items-center gap-1.5"
      >
        <FileText className="h-3.5 w-3.5 text-brand-accent" />
        {open ? "Hide" : "Show"} Table of Contents ({headings.length} sections)
      </button>
      {open && (
        <nav className="mt-2 rounded-lg border border-border bg-muted/30 p-3 max-h-64 overflow-y-auto space-y-0.5">
          {headings.map((h, i) => (
            <button
              key={`${h.id}-${i}`}
              onClick={() => scrollTo(h.id)}
              className={`block w-full text-left text-xs hover:text-[#2006F7] dark:hover:text-[#009CFB] transition-colors truncate ${
                h.level === 2
                  ? "font-semibold text-foreground py-1"
                  : "text-muted-foreground pl-4 py-0.5"
              }`}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

const SEVERITY_COLORS: Record<Severity, { bg: string; text: string; border: string }> = {
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/20",
  },
  high: {
    bg: "bg-pink-600/10",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-500/20",
  },
  medium: {
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-500/20",
  },
  low: {
    bg: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-500/20",
  },
  info: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
  },
};

function GradeRing({ grade, score }: { grade: string; score: number }) {
  const r = 36,
    c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color =
    score >= 90 ? "#00F2B3" : score >= 75 ? "#2006F7" : score >= 60 ? "#F29400" : "#e53e3e";
  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          className="text-border"
        />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 44 44)"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black" style={{ color }}>
          {grade}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">{score}%</span>
      </div>
    </div>
  );
}

function ReportSummaryHeader({
  reportId,
  analysisResults,
  branding,
}: {
  reportId: string;
  analysisResults?: Record<string, AnalysisResult>;
  branding: BrandingData;
}) {
  if (!analysisResults || Object.keys(analysisResults).length === 0) return null;

  const isExecutive = reportId === "report-executive";
  const isCompliance = reportId === "report-compliance";
  const isIndividual = !isExecutive && !isCompliance;

  if (isIndividual) {
    const reportLabel = reportId.replace(/^report-/, "");
    const result =
      Object.entries(analysisResults).find(
        ([key]) => key === reportLabel || reportId.endsWith(key.replace(/\s+/g, "-").toLowerCase()),
      )?.[1] ?? Object.values(analysisResults)[0];
    if (!result) return null;

    const riskScore = computeRiskScore(result);
    const severityCounts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    result.findings.forEach((f) => {
      severityCounts[f.severity]++;
    });

    return (
      <div className="mb-6 rounded-xl border border-border bg-muted/20 p-5 no-print">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[#2006F7] dark:text-[#009CFB]" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Firewall Assessment Summary
          </p>
        </div>
        <div className="flex items-start gap-6 flex-wrap">
          <GradeRing grade={riskScore.grade} score={riskScore.overall} />
          <div className="flex-1 min-w-[200px] space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rules</p>
                <p className="text-lg font-bold text-foreground">{result.stats.totalRules}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Findings
                </p>
                <p className="text-lg font-bold text-foreground">{result.findings.length}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  WAN Rules
                </p>
                <p className="text-lg font-bold text-foreground">
                  {result.inspectionPosture.enabledWanRules}
                  <span className="text-xs text-muted-foreground font-normal">
                    /{result.inspectionPosture.totalWanRules}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => {
                const count = severityCounts[s];
                if (count === 0) return null;
                const c = SEVERITY_COLORS[s];
                return (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}
                  >
                    {count} {s}
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {riskScore.categories.slice(0, 4).map((cat) => (
                <div key={cat.label} className="flex items-center gap-1.5">
                  <div className="w-14 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${cat.pct}%`,
                        backgroundColor:
                          cat.pct >= 80 ? "#00F2B3" : cat.pct >= 50 ? "#F29400" : "#e53e3e",
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {cat.label} <span className="font-semibold text-foreground">{cat.pct}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isExecutive) {
    const allResults = Object.values(analysisResults);
    const totalRules = allResults.reduce((s, r) => s + r.stats.totalRules, 0);
    const totalFindings = allResults.reduce((s, r) => s + r.findings.length, 0);
    const scores = allResults.map((r) => computeRiskScore(r));
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((s, r) => s + r.overall, 0) / scores.length) : 0;
    const avgGrade: RiskScoreResult["grade"] =
      avgScore >= 90
        ? "A"
        : avgScore >= 75
          ? "B"
          : avgScore >= 60
            ? "C"
            : avgScore >= 40
              ? "D"
              : "F";

    const severityCounts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    allResults.forEach((r) =>
      r.findings.forEach((f) => {
        severityCounts[f.severity]++;
      }),
    );

    const worstFw =
      scores.length > 0
        ? scores.reduce((w, s, i) => (s.overall < w.score ? { score: s.overall, idx: i } : w), {
            score: 101,
            idx: 0,
          })
        : null;
    const bestFw =
      scores.length > 0
        ? scores.reduce((b, s, i) => (s.overall > b.score ? { score: s.overall, idx: i } : b), {
            score: -1,
            idx: 0,
          })
        : null;

    return (
      <div className="mb-6 rounded-xl border border-border bg-muted/20 p-5 no-print">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-[#5A00FF] dark:text-[#B529F7]" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Executive Overview — {allResults.length} Firewall{allResults.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-start gap-6 flex-wrap">
          <GradeRing grade={avgGrade} score={avgScore} />
          <div className="flex-1 min-w-[200px] space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Firewalls
                </p>
                <p className="text-lg font-bold text-foreground">{allResults.length}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Total Rules
                </p>
                <p className="text-lg font-bold text-foreground">{totalRules}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Total Findings
                </p>
                <p className="text-lg font-bold text-foreground">{totalFindings}</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card px-3 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Avg Score
                </p>
                <p className="text-lg font-bold text-foreground">{avgScore}%</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => {
                const count = severityCounts[s];
                if (count === 0) return null;
                const c = SEVERITY_COLORS[s];
                return (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}
                  >
                    {count} {s}
                  </span>
                );
              })}
            </div>
            {scores.length >= 2 && worstFw && bestFw && (
              <div className="flex gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="h-3 w-3 text-[#00F2B3]" />
                  Best:{" "}
                  <span className="font-semibold text-foreground">
                    {Object.keys(analysisResults)[bestFw.idx]}
                  </span>{" "}
                  ({bestFw.score}%)
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 text-[#F29400]" />
                  Needs work:{" "}
                  <span className="font-semibold text-foreground">
                    {Object.keys(analysisResults)[worstFw.idx]}
                  </span>{" "}
                  ({worstFw.score}%)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isCompliance) {
    const allResults = Object.values(analysisResults);
    const mergedResult: AnalysisResult = {
      stats: {
        totalRules: allResults.reduce((s, r) => s + r.stats.totalRules, 0),
        totalSections: allResults.reduce((s, r) => s + r.stats.totalSections, 0),
        totalHosts: allResults.reduce((s, r) => s + r.stats.totalHosts, 0),
        totalNatRules: allResults.reduce((s, r) => s + r.stats.totalNatRules, 0),
        interfaces: allResults.reduce((s, r) => s + r.stats.interfaces, 0),
        populatedSections: allResults.reduce((s, r) => s + r.stats.populatedSections, 0),
        emptySections: allResults.reduce((s, r) => s + r.stats.emptySections, 0),
        sectionNames: [...new Set(allResults.flatMap((r) => r.stats.sectionNames))],
      },
      findings: allResults.flatMap((r) => r.findings),
      inspectionPosture:
        allResults.length === 1
          ? allResults[0].inspectionPosture
          : (allResults[0]?.inspectionPosture ?? {
              totalWanRules: 0,
              enabledWanRules: 0,
              disabledWanRules: 0,
              webFilterableRules: 0,
              withWebFilter: 0,
              withoutWebFilter: 0,
              withAppControl: 0,
              withIps: 0,
              withSslInspection: 0,
              sslDecryptRules: 0,
              sslExclusionRules: 0,
              sslRules: [],
              sslUncoveredZones: [],
              sslUncoveredNetworks: [],
              allWanSourceZones: [],
              allWanSourceNetworks: [],
              wanRuleNames: [],
              wanWebServiceRuleNames: [],
              wanMissingWebFilterRuleNames: [],
              totalDisabledRules: 0,
              dpiEngineEnabled: false,
            }),
    };

    const frameworks =
      branding.selectedFrameworks.length > 0 ? branding.selectedFrameworks : ["Cyber Essentials"];

    const frameworkMappings: FrameworkMapping[] = frameworks.map((fw) =>
      mapToFramework(fw, mergedResult),
    );

    const totalPass = frameworkMappings.reduce((s, m) => s + m.summary.pass, 0);
    const totalPartial = frameworkMappings.reduce((s, m) => s + m.summary.partial, 0);
    const totalFail = frameworkMappings.reduce((s, m) => s + m.summary.fail, 0);
    const totalControls = totalPass + totalPartial + totalFail;
    const compliancePct = totalControls > 0 ? Math.round((totalPass / totalControls) * 100) : 0;

    return (
      <div className="mb-6 rounded-xl border border-border bg-muted/20 p-5 no-print">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="h-4 w-4 text-[#009CFB] dark:text-[#00EDFF]" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Compliance Summary — {frameworks.length} Framework{frameworks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-start gap-6 flex-wrap">
          <div className="relative flex items-center justify-center shrink-0">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle
                cx="44"
                cy="44"
                r="36"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                className="text-border"
              />
              <circle
                cx="44"
                cy="44"
                r="36"
                fill="none"
                stroke="#00F2B3"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 - (compliancePct / 100) * 2 * Math.PI * 36}
                transform="rotate(-90 44 44)"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-[#00F2B3]">{compliancePct}%</span>
              <span className="text-[10px] text-muted-foreground font-medium">compliant</span>
            </div>
          </div>
          <div className="flex-1 min-w-[200px] space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 px-3 py-2 text-center">
                <p className="text-lg font-bold text-[#00F2B3]">{totalPass}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Pass</p>
              </div>
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-center">
                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {totalPartial}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Partial</p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-center">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{totalFail}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Fail</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {frameworkMappings.map((fm) => {
                const fwTotal = fm.summary.pass + fm.summary.partial + fm.summary.fail;
                const fwPct = fwTotal > 0 ? Math.round((fm.summary.pass / fwTotal) * 100) : 0;
                return (
                  <div key={fm.framework} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-32 truncate shrink-0">
                      {fm.framework}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full flex">
                        {fm.summary.pass > 0 && (
                          <div
                            className="bg-[#00F2B3] h-full"
                            style={{ width: `${(fm.summary.pass / (fwTotal || 1)) * 100}%` }}
                          />
                        )}
                        {fm.summary.partial > 0 && (
                          <div
                            className="bg-yellow-500 h-full"
                            style={{ width: `${(fm.summary.partial / (fwTotal || 1)) * 100}%` }}
                          />
                        )}
                        {fm.summary.fail > 0 && (
                          <div
                            className="bg-red-500 h-full"
                            style={{ width: `${(fm.summary.fail / (fwTotal || 1)) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-foreground w-8 text-right">
                      {fwPct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ShareReportDialog({
  open,
  onOpenChange,
  shareUrl,
  expiresAt,
  onCopy,
  onCreateLink,
  markdown,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  expiresAt: string;
  onCopy: () => void;
  onCreateLink?: (allowDownload: boolean, advisorNotes?: string) => Promise<void>;
  markdown?: string;
  error?: string;
}) {
  const [allowDownload, setAllowDownload] = useState(true);
  const [creating, setCreating] = useState(false);
  const [advisorNotes, setAdvisorNotes] = useState("");

  useEffect(() => {
    if (!open) setAdvisorNotes("");
  }, [open]);

  const hasLink = shareUrl.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-brand-accent" />
            Share Report
          </DialogTitle>
          <DialogDescription>
            {hasLink
              ? `Anyone with this link can view the report. It expires on ${new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
              : "Create a link that recipients can use to view this report. You can choose whether they can download/export."}
          </DialogDescription>
        </DialogHeader>
        {!hasLink && onCreateLink && markdown ? (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-[#EA0022]/20 bg-[#EA0022]/5 px-3 py-2 text-xs text-[#EA0022]">
                {error}
              </div>
            )}
            <div className="rounded-2xl border border-border/50 bg-card/80 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="share-allow-download"
                  checked={allowDownload}
                  onCheckedChange={(checked) => setAllowDownload(Boolean(checked))}
                  className="mt-0.5 rounded-md border-border/80"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="share-allow-download"
                    className="cursor-pointer text-sm font-semibold text-foreground"
                  >
                    Allow recipients to download and export
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable Word and PDF export for customer-facing handovers. Disable this for
                    view-only board or advisor review links.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 rounded-2xl border border-border/50 bg-muted/20 p-4">
              <label
                htmlFor="share-advisor-notes"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Note for your customer
              </label>
              <p className="text-xs text-muted-foreground">
                Add short delivery context, next steps, or meeting guidance. This appears at the top
                of the shared report.
              </p>
              <Textarea
                id="share-advisor-notes"
                value={advisorNotes}
                onChange={(e) => setAdvisorNotes(e.target.value)}
                placeholder="Short context for the recipient — appears at the top of the shared report."
                className="min-h-[72px] text-sm resize-y"
                maxLength={2000}
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={creating}
              onClick={async () => {
                setCreating(true);
                try {
                  const note = advisorNotes.trim();
                  await onCreateLink(allowDownload, note || undefined);
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Creating link…" : "Create link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-border/50 bg-card/90 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Share link ready
                </p>
                <p className="text-xs text-muted-foreground">
                  Copy this customer-facing link and send it directly.
                </p>
              </div>
              <div className="rounded-full border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 px-2.5 py-1 text-[10px] font-semibold text-[#00a67a] dark:text-[#00F2B3]">
                Expires{" "}
                {new Date(expiresAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
            <Input readOnly value={shareUrl} className="font-mono text-xs" />
            <Button size="sm" variant="secondary" onClick={onCopy} className="gap-1.5 shrink-0">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportContent({
  markdown,
  isLoading,
  isFailed,
  onRetry,
  branding,
  pdfFilename,
  errorMessage,
  loadingStatus,
  reportId,
  reportLabel,
  analysisResults,
}: {
  markdown: string;
  isLoading: boolean;
  isFailed: boolean;
  onRetry: () => void;
  branding: BrandingData;
  pdfFilename: string;
  errorMessage?: string;
  loadingStatus?: string;
  reportId?: string;
  reportLabel?: string;
  analysisResults?: Record<string, AnalysisResult>;
}) {
  const docRef = useRef<HTMLDivElement>(null);
  const isDark = useResolvedIsDark();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareExpiresAt, setShareExpiresAt] = useState("");
  const [shareError, setShareError] = useState("");
  const [extractedOpen, setExtractedOpen] = useState(false);
  const exportTheme: ReportExportTheme = isDark ? "dark" : "light";

  const activeResult = reportLabel && analysisResults ? analysisResults[reportLabel] : undefined;
  const html = useMemo(() => {
    const footer = activeResult
      ? `Generated from Sophos FireComply · ${activeResult.stats.totalSections} sections, ${activeResult.stats.totalRules} rules`
      : undefined;
    return buildReportHtml(markdown, { footer });
  }, [markdown, activeResult]);

  const reportTruncated = Boolean(
    activeResult && activeResult.stats.totalRules > 150 && /150|more rules|truncat/i.test(markdown),
  );

  const handlePdf = async () => {
    const el = docRef.current;
    if (!el || !markdown) return;

    const title = pdfFilename.replace(/\.pdf$/i, "");
    /** CI / Playwright: real .pdf bytes so E2E can assert download (see VITE_E2E_PDF_DOWNLOAD). */
    if (import.meta.env.VITE_E2E_PDF_DOWNLOAD === "1") {
      const { generateExecutiveReportPdfBlob } = await import("@/lib/executive-report-pdfmake");
      const blob = await generateExecutiveReportPdfBlob(markdown, title);
      saveAs(blob, pdfFilename);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(buildPdfHtml(el.innerHTML, title, branding, { theme: exportTheme }));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleWord = async () => {
    if (!markdown) return;
    const blob = await generateWordBlob(markdown, branding);
    const wordFilename = pdfFilename.replace(/\.pdf$/, ".docx");
    saveAs(blob, wordFilename);
  };

  const handleShare = () => {
    setShareUrl("");
    setShareExpiresAt("");
    setShareError("");
    setShareOpen(true);
  };

  const handleCreateShareLink = async (allowDownload: boolean, advisorNotes?: string) => {
    setShareError("");
    const token = generateShareToken();
    try {
      const report = await saveSharedReport(
        token,
        markdown,
        branding.customerName || "Customer",
        7,
        allowDownload,
        advisorNotes,
      );
      setShareUrl(`${window.location.origin}/shared/${token}`);
      setShareExpiresAt(report.expiresAt);
    } catch (error) {
      setShareUrl("");
      setShareExpiresAt("");
      setShareError(error instanceof Error ? error.message : "Unable to create share link.");
    }
  };

  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Could add toast here if desired
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2 no-print">
        {isFailed && (
          <Button variant="destructive" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        )}
        {markdown && !isLoading && !isFailed && (
          <>
            <Button
              variant="secondary"
              onClick={handleShare}
              className="gap-2 shrink-0 whitespace-nowrap"
              data-tour="share-report"
            >
              <Share2 className="h-4 w-4 shrink-0" /> Share Report
            </Button>
            <Button
              variant="secondary"
              onClick={handleWord}
              className="gap-2 shrink-0 whitespace-nowrap"
              data-tour="export-word"
              data-testid="export-download-word"
            >
              <FileText className="h-4 w-4 shrink-0" /> Download Word
            </Button>
            <Button
              onClick={handlePdf}
              className="gap-2 shrink-0 whitespace-nowrap"
              data-tour="export-pdf"
              data-testid="export-download-pdf"
              title="Opens print preview in a new tab. Choose Save as PDF. If the dialog has orientation or layout, pick Landscape to match the export."
            >
              <Download className="h-4 w-4 shrink-0" /> Download PDF
            </Button>
          </>
        )}
      </div>

      <ShareReportDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareUrl={shareUrl}
        expiresAt={shareExpiresAt}
        onCopy={handleCopyShareUrl}
        onCreateLink={handleCreateShareLink}
        markdown={markdown}
        error={shareError}
      />

      {/* Enterprise document studio shell */}
      <div className="rounded-xl border border-border shadow-card overflow-hidden doc-section">
        <div className="bg-[#001A47] dark:bg-[#000d24] px-6 md:px-10 py-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <img
              src="/sophos-icon-white.svg"
              alt=""
              className="h-5 w-5 opacity-60"
              loading="lazy"
              decoding="async"
            />
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-widest">
              Sophos FireComply — Document
            </span>
          </div>
          <span className="text-[10px] text-white/40">
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <div ref={docRef} className="bg-card p-8 md:p-12">
          {(branding.companyName || branding.logoUrl) && (
            <div className="report-pdf-brand-block flex items-center gap-4 mb-8 pb-6 border-b-2 border-brand-accent/20 dark:border-brand-accent/30">
              {branding.logoUrl && (
                <img
                  src={branding.logoUrl}
                  alt="Company logo"
                  className="report-pdf-brand-logo h-14 w-auto max-w-[200px] object-contain"
                />
              )}
              <div className="flex-1">
                {branding.companyName && (
                  <p className="text-lg font-display font-bold text-foreground">
                    {branding.companyName}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Firewall Configuration Assessment Report
                </p>
              </div>
            </div>
          )}

          {reportId && markdown && !isLoading && (
            <ReportSummaryHeader
              reportId={reportId}
              analysisResults={analysisResults}
              branding={branding}
            />
          )}

          {isLoading && !markdown && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-6 text-primary" />
              <p className="text-lg font-semibold text-foreground mb-4">Analysing configuration</p>
              <div className="flex items-center gap-2 text-xs">
                {["Sending request", "Waiting for response", "Generating"].map((step, i) => {
                  const currentIdx = !loadingStatus
                    ? -1
                    : loadingStatus.startsWith("Sending")
                      ? 0
                      : loadingStatus.startsWith("Waiting")
                        ? 1
                        : loadingStatus.startsWith("Generating")
                          ? 2
                          : -1;
                  const isActive = i === currentIdx;
                  const isDone = i < currentIdx;
                  return (
                    <span key={step} className="flex items-center gap-1.5">
                      {i > 0 && (
                        <span
                          className={`w-6 h-px ${isDone ? "bg-[#00A878] dark:bg-[#00F2B3]" : "bg-border"}`}
                        />
                      )}
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${isDone ? "bg-[#00F2B3]/15 text-[#00F2B3] dark:bg-[#00F2B3]/15 dark:text-[#00F2B3]" : isActive ? "bg-primary/15 text-primary ring-2 ring-primary/30" : "bg-muted text-muted-foreground"}`}
                      >
                        {isDone ? "✓" : i + 1}
                      </span>
                      <span
                        className={`${isActive ? "font-semibold text-foreground" : isDone ? "text-[#007A5A] dark:text-[#00F2B3]" : "text-muted-foreground"}`}
                      >
                        {step}
                      </span>
                    </span>
                  );
                })}
              </div>
              {loadingStatus && (
                <p
                  className="text-[11px] mt-3 font-medium text-foreground/80"
                  role="status"
                  aria-live="polite"
                >
                  {loadingStatus}
                </p>
              )}
              <p className="text-xs mt-4 text-muted-foreground">
                This may take a minute or two for large configs.
              </p>
              <p className="text-[10px] mt-3 text-muted-foreground/80 max-w-sm text-center">
                To see backend activity: Supabase Dashboard → Edge Functions →{" "}
                <strong className="font-mono text-foreground/70">parse-config</strong> →{" "}
                <strong className="text-foreground/70">Invocations</strong> or{" "}
                <strong className="text-foreground/70">Logs</strong>.
              </p>
            </div>
          )}

          {isFailed && !markdown && (
            <div className="py-10 px-4 md:px-8">
              <FlowStatusCard
                variant="error"
                title="Report generation failed"
                description="The AI or edge service could not finish this report. Try again, or generate individual firewall reports first if the estate is large."
                errorDetail={errorMessage}
                onRetry={onRetry}
                retryLabel="Retry generation"
              />
            </div>
          )}

          {isFailed && markdown && (
            <div className="mb-4 rounded-lg border border-[#F29400]/30 bg-[#F29400]/5 dark:bg-[#F29400]/10 px-4 py-3 flex items-center gap-3 no-print">
              <span className="text-[#c47800] dark:text-[#F29400] text-lg">⚠</span>
              <div className="flex-1 text-sm">
                <p className="font-semibold text-[#c47800] dark:text-[#F29400]">
                  Partial output recovered
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {errorMessage ||
                    "Generation was interrupted. The content below may be incomplete."}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5 shrink-0">
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
            </div>
          )}

          {html && !isLoading && <ReportToc markdown={markdown} />}
          {activeResult && !isLoading && (
            <div className="no-print mb-4">
              <button
                type="button"
                onClick={() => setExtractedOpen((o) => !o)}
                className="text-xs font-semibold text-[#2006F7] dark:text-[#009CFB] hover:underline flex items-center gap-1.5"
              >
                {extractedOpen ? "Hide" : "Show"} extracted structure
              </button>
              {extractedOpen && (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
                  <p>
                    <span className="font-semibold text-foreground">
                      {activeResult.stats.totalSections}
                    </span>{" "}
                    sections ·{" "}
                    <span className="font-semibold text-foreground">
                      {activeResult.stats.totalRules}
                    </span>{" "}
                    firewall rules
                  </p>
                  {reportTruncated && (
                    <p className="text-[#F29400] dark:text-[#F8E300]">
                      Report documents first 150 rules; extracted config has{" "}
                      {activeResult.stats.totalRules} rules.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {html && <SafeHtml html={html} />}

          {isLoading && markdown && (
            <div className="flex items-center gap-2 text-muted-foreground mt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Still generating...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SeverityFilterValue = "all" | "critical-high" | "critical";

function EvidenceVerification({
  analysisResults,
  reportLabel,
  selectedFrameworks = [],
  severityFilter = "all",
}: {
  analysisResults?: Record<string, AnalysisResult>;
  reportLabel: string;
  selectedFrameworks?: string[];
  severityFilter?: SeverityFilterValue;
}) {
  if (!analysisResults) return null;
  const result = analysisResults[reportLabel];
  if (!result) {
    const totalRules = Object.values(analysisResults).reduce((s, r) => s + r.stats.totalRules, 0);
    let totalFindings = Object.values(analysisResults).reduce((s, r) => s + r.findings.length, 0);
    if (severityFilter !== "all") {
      const allowed = severityFilter === "critical" ? ["critical"] : ["critical", "high"];
      totalFindings = Object.values(analysisResults).reduce(
        (s, r) => s + r.findings.filter((f) => allowed.includes(f.severity)).length,
        0,
      );
    }
    if (totalRules === 0 && totalFindings === 0) return null;
    return (
      <div className="no-print rounded-lg border border-border bg-muted/30 px-4 py-3 mt-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          Evidence Verification — Estate
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              {Object.keys(analysisResults).length}
            </span>{" "}
            firewalls
          </span>
          <span>
            <span className="font-semibold text-foreground">{totalRules}</span> rules parsed
          </span>
          <span>
            <span className="font-semibold text-foreground">{totalFindings}</span> findings
            {severityFilter !== "all"
              ? ` (${severityFilter === "critical" ? "Critical only" : "Critical & High"})`
              : ""}
          </span>
        </div>
      </div>
    );
  }
  const { stats, findings, inspectionPosture } = result;
  const allowedSeverities =
    severityFilter === "all"
      ? null
      : severityFilter === "critical"
        ? ["critical"]
        : ["critical", "high"];
  const filteredFindings = allowedSeverities
    ? findings.filter((f) => allowedSeverities.includes(f.severity))
    : findings;
  const mappedFrameworks =
    selectedFrameworks.length > 0 && filteredFindings.length > 0
      ? [
          ...new Set(
            filteredFindings.flatMap((f) => findingToFrameworks(f.title, selectedFrameworks)),
          ),
        ]
      : [];
  const sevStyle: Record<string, string> = {
    critical: "bg-[#EA0022]/10 text-[#EA0022]",
    high: "bg-[#DB2777]/10 text-[#b91c72] dark:text-[#F472B6]",
    medium: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
    low: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]",
    info: "bg-[#009CFB]/10 text-[#009CFB]",
  };
  return (
    <div className="no-print rounded-lg border border-border bg-muted/30 px-4 py-3 mt-3">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        Evidence Verification — {reportLabel}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{stats.totalRules}</span> rules
        </span>
        <span>
          <span className="font-semibold text-foreground">{stats.totalNatRules}</span> NAT rules
        </span>
        <span>
          <span className="font-semibold text-foreground">{stats.interfaces}</span> interfaces
        </span>
        <span>
          <span className="font-semibold text-foreground">{stats.totalHosts}</span> hosts/networks
        </span>
        <span>
          <span className="font-semibold text-foreground">
            {stats.populatedSections}/{stats.totalSections}
          </span>{" "}
          sections
        </span>
        <span>
          <span className="font-semibold text-foreground">{filteredFindings.length}</span> findings
          {severityFilter !== "all"
            ? ` (${severityFilter === "critical" ? "Critical only" : "Critical & High"})`
            : ""}
        </span>
        {inspectionPosture.totalWanRules > 0 && (
          <span>
            <span className="font-semibold text-foreground">
              {inspectionPosture.withWebFilter}/{inspectionPosture.totalWanRules}
            </span>{" "}
            WAN rules filtered
          </span>
        )}
      </div>
      {filteredFindings.length > 0 && (
        <ul className="mt-2 pt-2 border-t border-border space-y-1.5 max-h-48 overflow-y-auto text-[11px] list-none pl-0">
          {filteredFindings.map((f) => (
            <li key={f.id} className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5" title={f.severity}>
                {severityIcon(f.severity)}
              </span>
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${sevStyle[f.severity] ?? ""}`}
              >
                {f.severity}
              </span>
              <span className="text-foreground min-w-0">{f.title}</span>
            </li>
          ))}
        </ul>
      )}
      {mappedFrameworks.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">
          Findings map to framework controls: {mappedFrameworks.join(", ")}.
        </p>
      )}
    </div>
  );
}

function BackendDebugPanel({
  backendDebugInfo,
  onFetchBackendDebug,
}: {
  backendDebugInfo?: Record<string, unknown> | null;
  onFetchBackendDebug?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!onFetchBackendDebug) return;
    setLoading(true);
    setError(null);
    try {
      await (onFetchBackendDebug as () => Promise<void>)();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
      setOpen(true);
    }
  };

  if (!onFetchBackendDebug) return null;
  return (
    <div className="no-print rounded-lg border border-border bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Bug className="h-3.5 w-3.5 text-muted-foreground" />
        Backend debug — input and processing summary
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground mt-2">
            Fetches what the <code className="rounded bg-muted px-1 font-mono">parse-config</code>{" "}
            function received and will send to the AI (no report is generated).
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFetch}
            disabled={loading}
            className="gap-1.5"
          >
            <Bug className="h-3 w-3" />
            {loading ? "Fetching…" : "Fetch debug for this report"}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {backendDebugInfo && (
            <pre className="text-[10px] bg-muted/50 rounded p-3 overflow-auto max-h-80 border border-border font-mono text-foreground">
              {JSON.stringify(backendDebugInfo, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function DocumentPreview({
  reports,
  activeReportId,
  onActiveChange,
  isLoading,
  loadingReportIds,
  failedReportIds,
  onRetry,
  branding,
  topActions,
  analysisResults,
  selectedFrameworks,
  backendDebugInfo,
  onFetchBackendDebug,
}: Props) {
  const exportTheme: ReportExportTheme = useResolvedIsDark() ? "dark" : "light";
  const [severityFilter, setSeverityFilter] = useState<SeverityFilterValue>("all");

  if (reports.length === 0 && !isLoading) return null;

  const allDone =
    reports.length > 0 &&
    !isLoading &&
    reports.every((r) => r.markdown && !failedReportIds.has(r.id));

  const handleDownloadAll = async () => {
    if (!allDone) return;
    const zip = new JSZip();
    const reportsFolder = zip.folder("reports")!;
    const presentationsFolder = zip.folder("presentations")!;

    for (const report of reports) {
      const baseName = report.label
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase();

      // Word
      const wordBlob = await generateWordBlob(report.markdown, branding);
      reportsFolder.file(`${baseName}-report.docx`, wordBlob);

      // Styled HTML report
      const sanitized = buildReportHtml(report.markdown);
      const pdfHtml = buildPdfHtml(sanitized, baseName, branding, { theme: exportTheme });
      reportsFolder.file(`${baseName}-report.html`, pdfHtml);

      // PowerPoint presentation
      const pptxBlob = await generatePptxBlob(report.markdown, report.label, branding);
      presentationsFolder.file(`${baseName}-presentation.pptx`, pptxBlob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipName = branding.companyName
      ? `${branding.companyName.replace(/\s+/g, "-").toLowerCase()}-firewall-reports.zip`
      : "firewall-reports.zip";
    saveAs(zipBlob, zipName);
  };

  if (reports.length === 1 && !isLoading) {
    const r = reports[0];
    const oneReportDone = r.markdown && !failedReportIds.has(r.id);
    return (
      <div className="space-y-4">
        {topActions}
        <BackendDebugPanel
          backendDebugInfo={backendDebugInfo}
          onFetchBackendDebug={onFetchBackendDebug}
        />
        <div className="flex items-center justify-between no-print">
          <h2 className="text-xl font-bold text-foreground">Document Preview</h2>
          {oneReportDone && (
            <div className="flex flex-col items-end gap-1">
              <Button onClick={handleDownloadAll} className="gap-2" data-tour="export-zip">
                <Archive className="h-4 w-4" /> Download All (.zip)
              </Button>
              <p className="text-xs text-muted-foreground">
                Powerpoint presentations, HTML reports and Docx reports
              </p>
            </div>
          )}
        </div>
        <ReportContent
          markdown={r.markdown}
          isLoading={loadingReportIds.has(r.id)}
          isFailed={failedReportIds.has(r.id)}
          onRetry={() => onRetry(r.id)}
          branding={branding}
          pdfFilename={`${r.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`}
          errorMessage={r.errorMessage}
          loadingStatus={r.loadingStatus}
          reportId={r.id}
          analysisResults={analysisResults}
        />
        {r.markdown && !loadingReportIds.has(r.id) && (
          <>
            <div className="no-print flex items-center gap-2 mt-2 mb-1">
              <span className="text-[10px] text-muted-foreground">Findings:</span>
              <Select
                value={severityFilter}
                onValueChange={(v) => setSeverityFilter(v as SeverityFilterValue)}
              >
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical-high">Critical & High</SelectItem>
                  <SelectItem value="critical">Critical only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <EvidenceVerification
              analysisResults={analysisResults}
              reportLabel={r.label}
              severityFilter={severityFilter}
            />
          </>
        )}
      </div>
    );
  }

  if (reports.length === 0 && isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground no-print">Document Preview</h2>
        <BackendDebugPanel
          backendDebugInfo={backendDebugInfo}
          onFetchBackendDebug={onFetchBackendDebug}
        />
        <ReportContent
          markdown=""
          isLoading={true}
          isFailed={false}
          onRetry={() => {}}
          branding={branding}
          pdfFilename="report.pdf"
          loadingStatus="Starting…"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topActions}
      <BackendDebugPanel
        backendDebugInfo={backendDebugInfo}
        onFetchBackendDebug={onFetchBackendDebug}
      />
      <div className="flex items-center justify-between no-print">
        <h2 className="text-xl font-bold text-foreground">Document Preview</h2>
        {allDone && (
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleDownloadAll} className="gap-2" data-tour="export-zip">
              <Archive className="h-4 w-4" /> Download All (.zip)
            </Button>
            <p className="text-xs text-muted-foreground">
              Powerpoint presentations, HTML reports and Docx reports
            </p>
          </div>
        )}
      </div>
      <Tabs value={activeReportId} onValueChange={onActiveChange} className="no-print-tabs">
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-border mb-4">
          <div className="flex items-center gap-0 flex-1 min-w-0">
            {reports.map((r) => {
              const done = r.markdown && !loadingReportIds.has(r.id) && !failedReportIds.has(r.id);
              const isActive = r.id === activeReportId;
              return (
                <button
                  key={r.id}
                  onClick={() => onActiveChange(r.id)}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? "border-[#2006F7] text-brand-accent dark:border-[#00EDFF]"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {r.label}
                  {loadingReportIds.has(r.id) && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  )}
                  {failedReportIds.has(r.id) && (
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-destructive/10 text-destructive text-[10px]">
                      ✕
                    </span>
                  )}
                  {done && (
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#00F2B3]/15 text-[#00F2B3] dark:bg-[#00F2B3]/15 dark:text-[#00F2B3] text-[10px]">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {reports.some((r) => r.markdown && !loadingReportIds.has(r.id)) && (
            <div className="flex items-center gap-2 pb-2">
              <span className="text-[10px] text-muted-foreground">Findings:</span>
              <Select
                value={severityFilter}
                onValueChange={(v) => setSeverityFilter(v as SeverityFilterValue)}
              >
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical-high">Critical & High</SelectItem>
                  <SelectItem value="critical">Critical only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {reports.map((r) => (
          <TabsContent key={r.id} value={r.id}>
            <ReportContent
              markdown={r.markdown}
              isLoading={loadingReportIds.has(r.id)}
              isFailed={failedReportIds.has(r.id)}
              onRetry={() => onRetry(r.id)}
              branding={branding}
              pdfFilename={`${r.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`}
              errorMessage={r.errorMessage}
              loadingStatus={r.loadingStatus}
              reportId={r.id}
              reportLabel={r.label}
              analysisResults={analysisResults}
            />
            {r.markdown && !loadingReportIds.has(r.id) && (
              <EvidenceVerification
                analysisResults={analysisResults}
                reportLabel={r.label}
                selectedFrameworks={selectedFrameworks}
                severityFilter={severityFilter}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

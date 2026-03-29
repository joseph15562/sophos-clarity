import {
  LogIn,
  Play,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock3,
  Save,
  FileText,
  BarChart3,
  Scale,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileUpload, UploadedFile } from "@/components/FileUpload";
import { BrandingSetup, BrandingData } from "@/components/BrandingSetup";
import { ReportCards } from "@/components/ReportCards";
import { AgentFleetPanel } from "@/components/AgentFleetPanel";
import type { AnalysisResult } from "@/lib/analyse-config";
import type { ParsedFile } from "@/hooks/use-report-generation";
import type { OrgInfo } from "@/hooks/use-auth";
import { Suspense } from "react";
import { FirewallLinker } from "@/components/FirewallLinker";
import { WelcomeBackCard } from "@/components/WelcomeBackCard";
import { TrustStrip } from "@/components/TrustStrip";

export interface ParsingProgress {
  current: number;
  total: number;
  phase: string;
}

export interface UploadSectionProps {
  files: ParsedFile[];
  onFilesChange: (uploaded: UploadedFile[]) => void;
  parsingProgress?: ParsingProgress | null;
  branding: BrandingData;
  setBranding: React.Dispatch<React.SetStateAction<BrandingData>>;
  analysisResult: Record<string, AnalysisResult>;
  configMetas: Array<{
    label: string;
    hostname?: string;
    serialNumber?: string;
    configHash: string;
    fromUpload?: boolean;
  }>;
  hasFiles: boolean;
  hasReports: boolean;
  reports: Array<{ id: string; label: string; markdown: string }>;
  isGuest: boolean;
  onShowAuth?: () => void;
  org: OrgInfo | null;
  localMode: boolean;
  onGenerateIndividual: () => void;
  onGenerateExecutive: () => void;
  onGenerateExecutiveOnePager: () => void;
  onGenerateCompliance: () => void;
  onGenerateAll: () => void;
  /** Opens Analysis → Compliance (Insurance Readiness widget). */
  onOpenInsuranceReadiness?: () => void;
  setViewingReports: (v: boolean) => void;
  onLoadAgentAssessment: (
    label: string,
    analysis: AnalysisResult,
    customerName: string,
    rawConfig?: Record<string, unknown>,
    agentMeta?: { serialNumber?: string; hostname?: string; model?: string; tenantName?: string },
  ) => void;
  activeTenantName?: string;
  setCentralEnriched: (v: boolean | ((prev: boolean) => boolean)) => void;
  saveError: string;
  savingReports: boolean;
  reportsSaved: boolean;
  onSaveReports: (includeReports: boolean) => void;
  totalFindings: number;
  isViewerOnly?: boolean;
  /** Rendered above the Generate Reports section */
  beforeReports?: React.ReactNode;
  onLoadDemo?: () => void;
  contextRef?: React.RefObject<HTMLDivElement | null>;
  reportsRef?: React.RefObject<HTMLDivElement | null>;
  /** Step 1 upload area — always mounted so deep links can scroll before configs exist */
  workbenchRef?: React.RefObject<HTMLDivElement | null>;
}

export function UploadSection({
  files,
  onFilesChange,
  parsingProgress,
  branding,
  setBranding,
  analysisResult,
  configMetas,
  hasFiles,
  hasReports,
  reports,
  isGuest,
  onShowAuth,
  org,
  localMode,
  onGenerateIndividual,
  onGenerateExecutive,
  onGenerateExecutiveOnePager,
  onGenerateCompliance,
  onGenerateAll,
  onOpenInsuranceReadiness,
  setViewingReports,
  onLoadAgentAssessment,
  activeTenantName,
  setCentralEnriched,
  saveError,
  savingReports,
  reportsSaved,
  onSaveReports,
  totalFindings,
  isViewerOnly = false,
  beforeReports,
  onLoadDemo,
  contextRef,
  reportsRef,
  workbenchRef,
}: UploadSectionProps) {
  return (
    <>
      {/* Landing hero */}
      {!hasFiles && (
        <section className="relative overflow-hidden rounded-[32px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.14),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] shadow-panel px-6 py-8 sm:px-8 sm:py-10 space-y-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

          <div className="text-center space-y-4 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-accent">
              <Sparkles className="h-3.5 w-3.5" />
              AI-assisted Sophos firewall assessment
            </div>

            <h2 className="text-3xl sm:text-5xl font-display font-black text-foreground tracking-tight leading-[1.05] max-w-3xl mx-auto">
              Turn Sophos Firewall Exports into{" "}
              <span className="text-brand-accent">Audit-Ready Reports</span> in Minutes
            </h2>

            <p className="text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
              Upload a Sophos XGS config export and instantly get deterministic security findings,
              posture scoring, compliance mapping, and client-ready deliverables — before AI turns
              the evidence into polished reports.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 max-w-3xl mx-auto">
            <div className="info-pill text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                Manual review
              </p>
              <p className="text-2xl font-black text-foreground mt-1">3–4 hours</p>
            </div>
            <div className="rounded-2xl border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.06] px-4 py-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                With FireComply
              </p>
              <p className="text-2xl font-black text-[#00774a] dark:text-[#00F2B3] mt-1">
                Under 2 minutes
              </p>
            </div>
            <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/[0.05] px-4 py-3 text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                Effort saved
              </p>
              <p className="text-2xl font-black text-foreground mt-1">90%+</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {onLoadDemo && (
              <Button
                size="lg"
                onClick={onLoadDemo}
                className="gap-2 rounded-xl px-5 shadow-sm bg-[#2006F7] hover:bg-[#10037C] text-white"
              >
                <Play className="h-4 w-4" />
                Try Demo Config
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="gap-2 rounded-xl px-5 border-brand-accent/25 dark:border-[#00EDFF]/30 hover:bg-brand-accent/10 dark:hover:bg-[#00EDFF]/10"
              onClick={() =>
                document
                  .querySelector<HTMLElement>('[data-tour="step-upload"]')
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              Upload Firewall Export
              <ArrowRight className="h-4 w-4" />
            </Button>
            {!isGuest && org && (
              <Button
                variant="outline"
                size="lg"
                className="gap-2 rounded-xl px-5 border-[#00F2B3]/25 dark:border-[#008F69]/35 dark:border-[#00F2B3]/30 hover:bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#00774a] dark:text-[#00F2B3]"
                onClick={() =>
                  document
                    .getElementById("firecomply-agent-fleet-panel")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <Wifi className="h-4 w-4" />
                Connected Firewalls
              </Button>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-6 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-brand-accent" /> Technical Reports
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-brand-accent" /> Executive Briefs
            </span>
            <span className="flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-brand-accent" /> Compliance Reports
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand-accent" /> Deterministic Findings
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-brand-accent" /> Export-Ready Outputs
            </span>
          </div>

          {onLoadDemo && (
            <p className="text-center text-[11px] text-muted-foreground -mt-2">
              Demo uses a synthetic sample configuration — no real customer data.
            </p>
          )}

          <TrustStrip />
        </section>
      )}

      {/* Guest sign-in prompt */}
      {!hasFiles && org && !isGuest && (
        <WelcomeBackCard
          orgId={org.id}
          onUpload={() => {
            document.querySelector<HTMLElement>('[data-tour="step-upload"]')?.click();
          }}
          onLoadAgent={() => {
            document
              .getElementById("firecomply-agent-fleet-panel")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {!hasFiles && isGuest && onShowAuth && (
        <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.96),rgba(12,18,34,0.96))] px-5 py-4 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 border border-brand-accent/15 flex items-center justify-center shrink-0">
            <LogIn className="h-4 w-4 text-brand-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Sign in to unlock the full experience
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Connect Sophos Central, use automated agents, save reports, and manage your firewall
              estate from a single assessment workspace.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={onShowAuth}
          >
            <LogIn className="h-3 w-3" /> Sign In / Register
          </Button>
        </div>
      )}

      {/* Firewall configs — loaded cards + upload zone */}
      <section ref={workbenchRef} className="space-y-4 scroll-mt-24">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-[#2006F7] to-[#5A00FF] text-white text-xs font-bold ring-4 ring-[#2006F7]/20 dark:ring-[#00EDFF]/20 shadow-[0_0_18px_rgba(32,6,247,0.35)]">
                1
              </span>
              <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-[#2006F7] dark:to-[#00EDFF] bg-clip-text text-transparent">
                {hasFiles ? "Firewall Configs" : "Upload Firewall Exports"}
              </h2>
              {hasFiles && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#2006F7]/10 text-[#2006F7] dark:bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3]">
                  {files.length} loaded
                </span>
              )}
            </div>
            <p className="text-base font-medium text-foreground/85 dark:text-white/75 max-w-3xl leading-relaxed">
              Upload Sophos HTML or XML exports to create a{" "}
              <span className="text-brand-accent font-semibold">
                deterministic security baseline
              </span>
              , map controls, and prepare{" "}
              <span className="text-foreground dark:text-white font-semibold">
                customer-ready reports
              </span>{" "}
              with <span className="text-brand-accent font-semibold">evidence-backed findings</span>
              .
            </p>
          </div>

          {!hasFiles && (
            <div className="grid gap-2 sm:grid-cols-2 min-w-full lg:min-w-[340px] lg:max-w-[420px]">
              <div className="info-pill">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                  Supported inputs
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">HTML, HTM, XML</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  SFOS HTML exports and entities-style XML —{" "}
                  <a
                    href="/supported-sfos-versions.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                  >
                    supported export matrix
                  </a>
                  .
                </p>
              </div>
              <div className="rounded-2xl border border-brand-accent/15 bg-brand-accent/[0.05] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                  Best use
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  Single firewall or estate comparison
                </p>
              </div>
            </div>
          )}
        </div>
        {parsingProgress && (
          <div className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(247,249,255,0.96))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(12,18,34,0.92))] px-4 py-3 space-y-2 shadow-sm">
            <p className="text-xs font-semibold text-foreground">
              {parsingProgress.phase === "parsing"
                ? `Parsing file ${parsingProgress.current} of ${parsingProgress.total}...`
                : "Analysing configuration..."}
            </p>
            <Progress
              value={
                parsingProgress.phase === "parsing"
                  ? (parsingProgress.current / parsingProgress.total) * 100
                  : 90
              }
              className="h-1.5"
            />
          </div>
        )}
        <FileUpload
          files={files}
          onFilesChange={onFilesChange}
          onFirewallLinked={() => setCentralEnriched(false)}
        />

        {/* Connected firewalls — add from agent fleet (authenticated only) */}
        {!isGuest && org && (
          <div id="firecomply-agent-fleet-panel" className="space-y-4">
            {hasFiles && (
              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 border-t border-border" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
                  Add from connected agents
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}
            {!hasFiles && (
              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Or
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}

            <div className="relative overflow-hidden rounded-[32px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.10),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.10)] p-5 sm:p-6 space-y-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

              <div className="flex items-start justify-between gap-5 flex-wrap">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-accent">
                    Managed estate mode
                  </div>
                  <h3 className="text-2xl sm:text-[1.9rem] font-display font-black text-foreground tracking-tight leading-tight">
                    Connected Firewalls for{" "}
                    <span className="text-brand-accent">live managed assessments</span>
                  </h3>
                  <p className="text-base font-medium text-foreground/85 dark:text-white/75 leading-relaxed">
                    Pull{" "}
                    <span className="text-brand-accent font-semibold">
                      fresh assessments directly from connected agents
                    </span>{" "}
                    to refresh customer posture, compare sites side-by-side, and{" "}
                    <span className="text-foreground dark:text-white font-semibold">
                      scale reviews across your managed firewall estate
                    </span>{" "}
                    without waiting for manual exports.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 min-w-full lg:min-w-[360px] lg:max-w-[430px]">
                  <div className="info-pill">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                      Best for
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      Multi-site customers, recurring reviews, estate-wide posture
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.05] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                      Outcome
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      Fresh posture without manual export dependency
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="info-pill">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                    Compare
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    Rank sites and customers side-by-side
                  </p>
                </div>
                <div className="info-pill">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                    Refresh
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    Re-run posture checks without chasing exports
                  </p>
                </div>
                <div className="info-pill">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                    Scale
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    Turn one-off reviews into an MSP workflow
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium text-foreground/80 dark:text-white/75 rounded-xl border border-border/50 bg-card/60 px-4 py-3 leading-relaxed">
                <span className="font-semibold text-foreground dark:text-white">
                  Why this matters:
                </span>{" "}
                <span className="text-brand-accent font-semibold">
                  manual upload is perfect for one-off reviews
                </span>
                ; connected firewalls unlock{" "}
                <span className="text-foreground dark:text-white font-semibold">
                  continuous assessment across a managed estate
                </span>
                .
              </p>

              <AgentFleetPanel
                onLoadAssessment={onLoadAgentAssessment}
                filterTenantName={activeTenantName}
                loadedLabels={new Set(files.map((f) => f.label))}
              />
            </div>
          </div>
        )}
      </section>

      {/* Step 2 — Assessment Context (before findings so compliance tags are dynamic) */}
      {hasFiles && (
        <section ref={contextRef} className="space-y-4" data-tour="step-context">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-[#2006F7] to-[#5A00FF] text-white text-xs font-bold ring-4 ring-[#2006F7]/20 dark:ring-[#00EDFF]/20 shadow-[0_0_18px_rgba(32,6,247,0.35)]">
              2
            </span>
            <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-[#2006F7] dark:to-[#00EDFF] bg-clip-text text-transparent">
              Assessment Context
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-accent rounded-full border border-brand-accent/20 dark:border-[#00EDFF]/30 px-2 py-0.5">
              Optional: frameworks tagging
            </span>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.99),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.08),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.08)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-5 flex-wrap">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-accent">
                    Executive-ready setup
                  </div>
                  <h3 className="text-2xl sm:text-[1.9rem] font-display font-black text-foreground tracking-tight leading-tight">
                    Shape the assessment into a{" "}
                    <span className="text-brand-accent">customer-ready outcome</span>
                  </h3>
                  <p className="text-base font-medium text-foreground/85 dark:text-white/75 leading-relaxed">
                    <span className="text-brand-accent font-semibold">Add the client context</span>,
                    brand the output, and select the frameworks that matter so{" "}
                    <span className="text-foreground dark:text-white font-semibold">
                      findings, reports, and executive summaries land with the right audience
                    </span>
                    .
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 min-w-full lg:min-w-[360px] lg:max-w-[430px]">
                  <div className="info-pill">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                      Best for
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      Customer-specific reports, executive packs, compliance-aligned reviews
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.05] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                      Outcome
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      Sharper findings, clearer story, more credible deliverables
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="info-pill">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                    Brand
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    Tailor outputs for the customer and stakeholder audience
                  </p>
                </div>
                <div className="info-pill">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                    Align
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    Map findings to the frameworks that drive remediation
                  </p>
                </div>
                <div className="info-pill">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                    Elevate
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    Turn technical output into boardroom-ready reporting
                  </p>
                </div>
              </div>

              <p className="text-sm font-medium text-foreground/80 dark:text-white/75 rounded-xl border border-border/50 bg-card/60 px-4 py-3 leading-relaxed">
                <span className="font-semibold text-foreground dark:text-white">
                  Why this matters:
                </span>{" "}
                <span className="text-brand-accent font-semibold">
                  the analysis is deterministic
                </span>
                , but the context determines how clearly it speaks to{" "}
                <span className="text-foreground dark:text-white font-semibold">
                  customers, auditors, and executives
                </span>
                .
              </p>

              <Card className="border-border/50 bg-card/80 shadow-card">
                <CardContent className="pt-6">
                  <BrandingSetup branding={branding} onChange={setBranding} />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* Sophos Central Firewall Linking — hidden in local mode */}
      {hasFiles && !isGuest && !localMode && configMetas.length > 0 && (
        <Suspense fallback={null}>
          <FirewallLinker
            configs={configMetas}
            customerName={branding.customerName}
            analysisResults={analysisResult}
            onLink={() => setCentralEnriched(false)}
          />
        </Suspense>
      )}

      {/* Privacy banner */}
      {hasFiles && (
        <div className="rounded-[24px] border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,255,251,0.98))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.96),rgba(10,26,24,0.96))] px-5 py-4 flex items-start gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 border border-[#00F2B3]/15 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="h-5 w-5 text-brand-accent" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-[#00774a] dark:text-[#00F2B3] tracking-tight">
              Data Privacy Protected
            </p>
            <p className="text-sm font-medium text-foreground/80 dark:text-white/75 leading-relaxed">
              All IP addresses, customer names, and firewall identifiers are automatically
              anonymised before being sent to the AI. Sensitive network data stays in the browser;
              only sanitised structural data is used for AI-assisted report generation, and real
              values are restored locally in the final report.
            </p>
          </div>
        </div>
      )}

      {hasFiles && beforeReports}

      {/* Generate Reports — AI reports disabled in local mode */}
      {hasFiles && !isGuest && (
        <div ref={reportsRef} data-tour="step-reports">
          <ReportCards
            fileCount={files.length}
            localMode={localMode}
            isViewerOnly={isViewerOnly}
            onGenerateIndividual={onGenerateIndividual}
            onGenerateExecutive={onGenerateExecutive}
            onGenerateExecutiveOnePager={onGenerateExecutiveOnePager}
            onGenerateCompliance={onGenerateCompliance}
            onGenerateAll={onGenerateAll}
            onOpenInsuranceReadiness={onOpenInsuranceReadiness}
          />
        </div>
      )}

      {/* Guest sign-in prompt for reports */}
      {hasFiles && isGuest && onShowAuth && (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-[#2006F7] to-[#5A00FF] text-white text-xs font-bold ring-4 ring-[#2006F7]/20 dark:ring-[#00EDFF]/20 shadow-[0_0_18px_rgba(32,6,247,0.35)]">
              3
            </span>
            <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-[#2006F7] dark:to-[#00EDFF] bg-clip-text text-transparent">
              Generate Reports
            </h2>
          </div>
          <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.96),rgba(12,18,34,0.96))] px-5 py-4 flex items-center gap-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 border border-brand-accent/15 flex items-center justify-center shrink-0">
              <LogIn className="h-4 w-4 text-brand-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Sign in to generate reports</p>
              <p className="text-sm font-medium text-foreground/80 dark:text-white/75 leading-relaxed">
                Create an account or sign in to generate{" "}
                <span className="text-brand-accent font-semibold">
                  technical reports, executive briefs, and compliance packs
                </span>{" "}
                from your analysis.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs"
              onClick={onShowAuth}
            >
              <LogIn className="h-3 w-3" /> Sign In
            </Button>
          </div>
        </section>
      )}

      {/* View Reports banner — shown when reports exist but user is on dashboard (authenticated only) */}
      {hasReports && !isGuest && (
        <div className="rounded-[24px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.96),rgba(12,18,34,0.96))] px-5 py-4 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 border border-brand-accent/15 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-brand-accent" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {reports.length} Report{reports.length !== 1 ? "s" : ""} Ready
            </p>
            <p className="text-[11px] text-muted-foreground">
              Your generated reports are available to view, print, or save.
            </p>
          </div>
          <Button onClick={() => setViewingReports(true)} className="gap-2">
            <FileText className="h-4 w-4" />
            View Reports
          </Button>
        </div>
      )}

      {/* Save Assessment (pre-AI) — authenticated only */}
      {hasFiles && totalFindings > 0 && !hasReports && !isViewerOnly && !isGuest && (
        <div className="flex items-center justify-end gap-3">
          {saveError && <span className="text-[10px] text-[#EA0022]">{saveError}</span>}
          <button
            onClick={() => onSaveReports(false)}
            disabled={savingReports}
            className={`no-print relative overflow-hidden flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md ${
              reportsSaved
                ? "border-[#00F2B3]/25 text-[#00F2B3]"
                : "border-slate-900/[0.12] dark:border-white/[0.08] text-brand-accent hover:border-slate-900/[0.18] dark:hover:border-white/[0.15]"
            }`}
            style={{
              background: reportsSaved
                ? "linear-gradient(135deg, rgba(0,242,179,0.12), rgba(0,242,179,0.04))"
                : "linear-gradient(135deg, rgba(32,6,247,0.10), rgba(32,6,247,0.03))",
            }}
          >
            <Save
              className="h-3.5 w-3.5"
              style={{
                filter: reportsSaved
                  ? "drop-shadow(0 0 4px rgba(0,242,179,0.4))"
                  : "drop-shadow(0 0 4px rgba(32,6,247,0.3))",
              }}
            />
            {reportsSaved ? "Saved!" : savingReports ? "Saving…" : "Save Assessment (Pre-AI)"}
          </button>
        </div>
      )}
    </>
  );
}

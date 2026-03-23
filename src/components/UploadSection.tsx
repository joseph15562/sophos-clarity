import { LogIn, Play, ArrowRight, Sparkles, ShieldCheck, Clock3 } from "lucide-react";
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
import { Save } from "lucide-react";
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
  configMetas: Array<{ label: string; hostname?: string; serialNumber?: string; configHash: string; fromUpload?: boolean }>;
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
  setViewingReports: (v: boolean) => void;
  onLoadAgentAssessment: (label: string, analysis: AnalysisResult, customerName: string, rawConfig?: Record<string, unknown>, agentMeta?: { serialNumber?: string; hostname?: string; model?: string; tenantName?: string }) => void;
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
}: UploadSectionProps) {
  return (
    <>
      {/* Landing hero */}
      {!hasFiles && (
        <section className="relative overflow-hidden rounded-[32px] border border-[#2006F7]/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.14),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_25px_80px_rgba(32,6,247,0.12)] px-6 py-8 sm:px-8 sm:py-10 space-y-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

          <div className="text-center space-y-4 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2006F7]/15 bg-[#2006F7]/[0.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#2006F7] dark:text-[#00EDFF]">
              <Sparkles className="h-3.5 w-3.5" />
              AI-assisted Sophos firewall assessment
            </div>

            <h2 className="text-3xl sm:text-5xl font-display font-black text-foreground tracking-tight leading-[1.05] max-w-3xl mx-auto">
              Turn Sophos Firewall Exports into <span className="text-[#2006F7] dark:text-[#00EDFF]">Audit-Ready Reports</span> in Minutes
            </h2>

            <p className="text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
              Upload a Sophos XGS config export and instantly get deterministic security findings, posture scoring, compliance mapping, and client-ready deliverables — before AI turns the evidence into polished reports.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Manual review</p>
              <p className="text-2xl font-black text-foreground mt-1">3–4 hours</p>
            </div>
            <div className="rounded-2xl border border-[#00F2B3]/20 bg-[#00F2B3]/[0.06] px-4 py-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">With FireComply</p>
              <p className="text-2xl font-black text-[#00774a] dark:text-[#00F2B3] mt-1">Under 2 minutes</p>
            </div>
            <div className="rounded-2xl border border-[#2006F7]/15 bg-[#2006F7]/[0.05] px-4 py-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Effort saved</p>
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
              className="gap-2 rounded-xl px-5 border-[#2006F7]/25 dark:border-[#00EDFF]/30 hover:bg-[#2006F7]/10 dark:hover:bg-[#00EDFF]/10"
              onClick={() => document.querySelector<HTMLElement>('[data-tour="step-upload"]')?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              Upload Firewall Export
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><img src="/icons/sophos-document.svg" alt="" className="h-4 w-4 sophos-icon" /> Technical Reports</span>
            <span className="flex items-center gap-1.5"><img src="/icons/sophos-chart.svg" alt="" className="h-4 w-4 sophos-icon" /> Executive Briefs</span>
            <span className="flex items-center gap-1.5"><img src="/icons/sophos-governance.svg" alt="" className="h-4 w-4 sophos-icon" /> Compliance Reports</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" /> Deterministic Findings</span>
            <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" /> Export-Ready Outputs</span>
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
            document.getElementById("firecomply-agent-fleet-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {!hasFiles && isGuest && onShowAuth && (
        <div className="rounded-xl border border-[#2006F7]/20 dark:border-[#00EDFF]/20 bg-[#2006F7]/[0.04] dark:bg-[#00EDFF]/[0.04] px-5 py-4 flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
            <LogIn className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Sign in to unlock the full experience</p>
            <p className="text-[10px] text-muted-foreground">
              Connect your Sophos Central account, use automated agents, save reports, and manage your firewall estate — all included.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-xs border-[#2006F7]/30 dark:border-[#00EDFF]/30 hover:bg-[#2006F7]/10 dark:hover:bg-[#00EDFF]/10"
            onClick={onShowAuth}
          >
            <LogIn className="h-3 w-3" /> Sign In / Register
          </Button>
        </div>
      )}

      {/* Firewall configs — loaded cards + upload zone */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">1</span>
              <h2 className="text-lg font-display font-bold text-foreground">
                {hasFiles ? "Firewall Configs" : "Upload Firewall Exports"}
              </h2>
              {hasFiles && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]">
                  {files.length} loaded
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Upload Sophos HTML or XML exports to create a deterministic security baseline, map controls, and prepare customer-ready reports with evidence-backed findings.
            </p>
          </div>

          {!hasFiles && (
            <div className="grid gap-2 sm:grid-cols-2 min-w-full lg:min-w-[340px] lg:max-w-[420px]">
              <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Supported inputs</p>
                <p className="text-sm font-semibold text-foreground mt-1">HTML, HTM, XML</p>
              </div>
              <div className="rounded-2xl border border-[#2006F7]/15 bg-[#2006F7]/[0.05] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Best use</p>
                <p className="text-sm font-semibold text-foreground mt-1">Single firewall or estate comparison</p>
              </div>
            </div>
          )}
        </div>
        {parsingProgress && (
          <div className="rounded-lg border border-[#2006F7]/20 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-foreground">
              {parsingProgress.phase === "parsing"
                ? `Parsing file ${parsingProgress.current} of ${parsingProgress.total}...`
                : "Analysing configuration..."}
            </p>
            <Progress
              value={parsingProgress.phase === "parsing"
                ? (parsingProgress.current / parsingProgress.total) * 100
                : 90}
              className="h-1.5"
            />
          </div>
        )}
        <FileUpload files={files} onFilesChange={onFilesChange} onFirewallLinked={() => setCentralEnriched(false)} />

        {/* Connected firewalls — add from agent fleet (authenticated only) */}
        {!isGuest && org && (
          <div id="firecomply-agent-fleet-panel" className="space-y-4">
            {hasFiles && (
              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Add from connected agents
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}
            {!hasFiles && (
              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Or</span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}

            <div className="relative overflow-hidden rounded-[32px] border border-[#2006F7]/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.10),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.10)] p-5 sm:p-6 space-y-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

              <div className="flex items-start justify-between gap-5 flex-wrap">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#2006F7]/15 bg-[#2006F7]/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#2006F7] dark:text-[#00EDFF]">
                    Managed estate mode
                  </div>
                  <h3 className="text-2xl sm:text-[1.9rem] font-display font-black text-foreground tracking-tight leading-tight">
                    Connected Firewalls for <span className="text-[#2006F7] dark:text-[#00EDFF]">live managed assessments</span>
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Pull fresh assessments directly from connected agents to refresh customer posture, compare sites side-by-side, and scale reviews across your managed firewall estate without waiting for manual exports.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 min-w-full lg:min-w-[360px] lg:max-w-[430px]">
                  <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Best for</p>
                    <p className="text-sm font-semibold text-foreground mt-1">Multi-site customers, recurring reviews, estate-wide posture</p>
                  </div>
                  <div className="rounded-2xl border border-[#00F2B3]/20 bg-[#00F2B3]/[0.05] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Outcome</p>
                    <p className="text-sm font-semibold text-foreground mt-1">Fresh posture without manual export dependency</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Compare</p>
                  <p className="text-sm font-semibold text-foreground mt-1">Rank sites and customers side-by-side</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Refresh</p>
                  <p className="text-sm font-semibold text-foreground mt-1">Re-run posture checks without chasing exports</p>
                </div>
                <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scale</p>
                  <p className="text-sm font-semibold text-foreground mt-1">Turn one-off reviews into an MSP workflow</p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground rounded-xl border border-border/60 bg-card/60 px-4 py-3">
                <span className="font-semibold text-foreground">Why this matters:</span> manual upload is perfect for one-off reviews; connected firewalls unlock continuous assessment across a managed estate.
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
        <section className="space-y-4" data-tour="step-context">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">2</span>
            <h2 className="text-lg font-display font-bold text-foreground">Assessment Context</h2>
            <span className="text-xs text-muted-foreground">(optional — select frameworks to tag findings)</span>
          </div>
          <Card>
            <CardContent className="pt-6">
              <BrandingSetup branding={branding} onChange={setBranding} />
            </CardContent>
          </Card>
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
        <div className="rounded-xl border border-[#00F2B3]/20 dark:border-[#00F2B3]/20 border-l-4 border-l-[#00F2B3] dark:border-l-[#00F2B3] bg-[#00F2B3]/[0.04] dark:bg-[#00F2B3]/[0.04] px-5 py-4 flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-[#00F2B3]/10 dark:bg-[#00F2B3]/10 flex items-center justify-center shrink-0 mt-0.5">
            <img src="/icons/sophos-security.svg" alt="" className="h-5 w-5 sophos-icon" />
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-bold text-[#00774a] dark:text-[#00F2B3]">Data Privacy Protected</span> — All IP addresses, customer names, and firewall identifiers are automatically anonymised before being sent to the AI. Your sensitive network data never leaves the browser; only sanitised structural data is transmitted for analysis. Real values are restored locally in the final report.
          </div>
        </div>
      )}

      {hasFiles && beforeReports}

      {/* Generate Reports — AI reports disabled in local mode */}
      {hasFiles && !isGuest && (
        <div data-tour="step-reports">
        <ReportCards
          fileCount={files.length}
          localMode={localMode}
          isViewerOnly={isViewerOnly}
          onGenerateIndividual={onGenerateIndividual}
          onGenerateExecutive={onGenerateExecutive}
          onGenerateExecutiveOnePager={onGenerateExecutiveOnePager}
          onGenerateCompliance={onGenerateCompliance}
          onGenerateAll={onGenerateAll}
        />
        </div>
      )}

      {/* Guest sign-in prompt for reports */}
      {hasFiles && isGuest && onShowAuth && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">3</span>
            <h2 className="text-lg font-display font-bold text-foreground">Generate Reports</h2>
          </div>
          <div className="rounded-xl border border-[#2006F7]/20 dark:border-[#00EDFF]/20 bg-[#2006F7]/[0.04] dark:bg-[#00EDFF]/[0.04] px-5 py-4 flex items-center gap-4">
            <div className="h-9 w-9 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
              <LogIn className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Sign in to generate reports</p>
              <p className="text-[10px] text-muted-foreground">
                Create an account or sign in to generate technical reports, executive briefs, and compliance packs from your analysis.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-[#2006F7]/30 dark:border-[#00EDFF]/30 hover:bg-[#2006F7]/10 dark:hover:bg-[#00EDFF]/10"
              onClick={onShowAuth}
            >
              <LogIn className="h-3 w-3" /> Sign In
            </Button>
          </div>
        </section>
      )}

      {/* View Reports banner — shown when reports exist but user is on dashboard (authenticated only) */}
      {hasReports && !isGuest && (
        <div className="rounded-xl border border-[#2006F7]/20 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] px-5 py-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
            <img src="/icons/sophos-document.svg" alt="" className="h-5 w-5 sophos-icon" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {reports.length} Report{reports.length !== 1 ? "s" : ""} Ready
            </p>
            <p className="text-[10px] text-muted-foreground">
              Your generated reports are available to view, print, or save.
            </p>
          </div>
          <Button onClick={() => setViewingReports(true)} className="gap-2 bg-[#2006F7] hover:bg-[#10037C] text-white">
            <img src="/icons/sophos-document.svg" alt="" className="h-4 w-4 brightness-0 invert" />
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
            className={`no-print flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
              reportsSaved
                ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                : "bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF] hover:bg-[#2006F7]/20"
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {reportsSaved ? "Saved!" : savingReports ? "Saving…" : "Save Assessment (Pre-AI)"}
          </button>
        </div>
      )}
    </>
  );
}

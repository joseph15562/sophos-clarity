import { LogIn } from "lucide-react";
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
  configMetas: Array<{ label: string; hostname?: string; serialNumber?: string; configHash: string }>;
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
}: UploadSectionProps) {
  return (
    <>
      {/* Landing hero */}
      {!hasFiles && (
        <section className="text-center py-6 space-y-4">
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">
            Turn Sophos Firewall Exports into Audit-Ready Documentation
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
            Drop in your Sophos XGS configuration exports and get instant security findings, risk scoring,
            and compliance mapping — no AI required. Generate branded reports, remediation playbooks,
            and readiness reports ready for customer handoff or audit.
          </p>
          <div className="flex flex-wrap justify-center gap-6 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><img src="/icons/sophos-document.svg" alt="" className="h-4 w-4 sophos-icon" /> Technical Reports</span>
            <span className="flex items-center gap-1.5"><img src="/icons/sophos-chart.svg" alt="" className="h-4 w-4 sophos-icon" /> Executive Briefs</span>
            <span className="flex items-center gap-1.5"><img src="/icons/sophos-governance.svg" alt="" className="h-4 w-4 sophos-icon" /> Compliance Reports</span>
            <span className="flex items-center gap-1.5"><img src="/icons/sophos-security.svg" alt="" className="h-4 w-4 sophos-icon" /> Data Anonymised</span>
          </div>
        </section>
      )}

      {/* Guest sign-in prompt */}
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

      {/* Step 1 — Choose a connected firewall */}
      {!isGuest && org && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">1</span>
            <h2 className="text-lg font-display font-bold text-foreground">
              {hasFiles ? "Add Another Firewall" : "Choose a Firewall"}
            </h2>
          </div>
          <AgentFleetPanel onLoadAssessment={onLoadAgentAssessment} filterTenantName={activeTenantName} />
        </section>
      )}

      {/* "Or" divider between fleet panel and upload */}
      {!isGuest && org && (
        <div className="flex items-center gap-4 py-1">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Or</span>
          <div className="flex-1 border-t border-border" />
        </div>
      )}

      {/* Upload Firewall Exports */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">1</span>
          <h2 className="text-lg font-display font-bold text-foreground">Upload Firewall Exports</h2>
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
        <FileUpload files={files} onFilesChange={onFilesChange} />
      </section>

      {/* Step 2 — Assessment Context (before findings so compliance tags are dynamic) */}
      {hasFiles && (
        <section className="space-y-4">
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
        <div className="rounded-xl border border-[#00995a]/20 dark:border-[#00F2B3]/20 border-l-4 border-l-[#00995a] dark:border-l-[#00F2B3] bg-[#00995a]/[0.04] dark:bg-[#00F2B3]/[0.04] px-5 py-4 flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-[#00995a]/10 dark:bg-[#00F2B3]/10 flex items-center justify-center shrink-0 mt-0.5">
            <img src="/icons/sophos-security.svg" alt="" className="h-5 w-5 sophos-icon" />
          </div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-bold text-[#00774a] dark:text-[#00F2B3]">Data Privacy Protected</span> — All IP addresses, customer names, and firewall identifiers are automatically anonymised before being sent to the AI. Your sensitive network data never leaves the browser; only sanitised structural data is transmitted for analysis. Real values are restored locally in the final report.
          </div>
        </div>
      )}

      {/* Generate Reports — AI reports disabled in local mode */}
      {hasFiles && (
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
      )}

      {/* View Reports banner — shown when reports exist but user is on dashboard */}
      {hasReports && (
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

      {/* Save Assessment (pre-AI) */}
      {hasFiles && totalFindings > 0 && !hasReports && !isViewerOnly && (
        <div className="flex items-center justify-end gap-3">
          {saveError && <span className="text-[10px] text-[#EA0022]">{saveError}</span>}
          <button
            onClick={() => onSaveReports(false)}
            disabled={savingReports}
            className={`no-print flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
              reportsSaved
                ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]"
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

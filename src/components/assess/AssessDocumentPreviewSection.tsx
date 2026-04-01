import { Suspense, lazy, type ReactNode } from "react";
import { ArrowLeftRight, BarChart3, Save, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlowStatusCard } from "@/components/FlowStatusCard";
import type { ReportEntry } from "@/components/DocumentPreview";
import type { BrandingData } from "@/components/BrandingSetup";
import type { AnalysisResult } from "@/lib/analyse-config";

const DocumentPreview = lazy(() =>
  import("@/components/DocumentPreview").then((m) => ({ default: m.DocumentPreview })),
);

export interface AssessDocumentPreviewSectionProps {
  hasReports: boolean;
  isLoading: boolean;
  viewingReports: boolean;
  onBackToDashboard: () => void;
  filesLength: number;
  reports: ReportEntry[];
  findExecutiveReport: boolean;
  findComplianceReport: boolean;
  onGenerateExecutive: () => void;
  onGenerateCompliance: () => void;
  localMode: boolean;
  isViewerOnly: boolean;
  totalRules: number;
  analysisResults: Record<string, AnalysisResult>;
  activeReportId: string;
  onActiveReportChange: (id: string) => void;
  loadingReportIds: Set<string>;
  failedReportIds: Set<string>;
  onRetryReport: (id: string) => void;
  branding: BrandingData;
  backendDebugInfo: Record<string, unknown> | null;
  onFetchBackendDebug?: () => void;
  savingReports: boolean;
  reportsSaved: boolean;
  onSaveReports: (includeReports: boolean) => void;
  onStartOver: () => void;
  saveError: string;
  onRetrySave: () => void;
  /** Optional strip above the preview (e.g. FlowStatusCard) */
  statusSlot?: ReactNode;
}

/**
 * Extracted Assess report shell: chrome around {@link DocumentPreview} to shrink {@link Index}.
 */
export function AssessDocumentPreviewSection({
  hasReports,
  isLoading,
  viewingReports,
  onBackToDashboard,
  filesLength,
  reports,
  findExecutiveReport,
  findComplianceReport,
  onGenerateExecutive,
  onGenerateCompliance,
  localMode,
  isViewerOnly,
  totalRules,
  analysisResults,
  activeReportId,
  onActiveReportChange,
  loadingReportIds,
  failedReportIds,
  onRetryReport,
  branding,
  backendDebugInfo,
  onFetchBackendDebug,
  savingReports,
  reportsSaved,
  onSaveReports,
  onStartOver,
  saveError,
  onRetrySave,
  statusSlot,
}: AssessDocumentPreviewSectionProps) {
  if (!viewingReports && !isLoading) return null;

  return (
    <>
      {hasReports && !isLoading && (
        <div className="no-print flex flex-wrap items-center gap-3 mb-2">
          <Button variant="outline" onClick={onBackToDashboard} className="gap-2">
            <ArrowLeftRight className="h-3.5 w-3.5 rotate-180" />
            Back to Dashboard
          </Button>
          <div className="flex-1" />
          {!localMode && !isViewerOnly && (
            <div className="flex flex-wrap gap-2">
              {filesLength >= 2 && !findExecutiveReport && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onGenerateExecutive}
                  className="gap-1.5 text-xs"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-brand-accent" /> Add Executive Brief
                </Button>
              )}
              {!findComplianceReport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGenerateCompliance}
                  className="gap-1.5 text-xs"
                >
                  <Scale className="h-3.5 w-3.5 text-brand-accent" /> Add Compliance Report
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {statusSlot}

      {hasReports && !isLoading && (
        <div
          className="no-print flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-[11px]"
          data-tour="stats-bar"
        >
          <span className="font-semibold text-foreground mr-1">
            {reports.length} report{reports.length !== 1 ? "s" : ""}
          </span>
          <span className="w-px h-3 bg-border" />
          <span className="text-muted-foreground">
            {filesLength} firewall{filesLength !== 1 ? "s" : ""}
          </span>
          <span className="w-px h-3 bg-border" />
          <span className="text-muted-foreground">{totalRules} rules</span>
          {(() => {
            const totalFindings = Object.values(analysisResults).reduce(
              (n, r) => n + r.findings.length,
              0,
            );
            if (totalFindings <= 0) return null;
            const counts: Record<string, number> = {};
            Object.values(analysisResults).forEach((r) =>
              r.findings.forEach((f) => {
                counts[f.severity] = (counts[f.severity] || 0) + 1;
              }),
            );
            return (
              <>
                <span className="w-px h-3 bg-border" />
                {Object.entries(counts).map(([sev, count]) => (
                  <span
                    key={sev}
                    className={`px-1.5 py-0.5 rounded font-medium ${
                      sev === "critical"
                        ? "bg-[#EA0022]/10 text-[#EA0022]"
                        : sev === "high"
                          ? "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]"
                          : sev === "medium"
                            ? "bg-[#ca8a04]/12 text-[#78350f] dark:bg-[#F8E300]/10 dark:text-[#F8E300]"
                            : sev === "low"
                              ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                              : "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]"
                    }`}
                  >
                    {count} {sev}
                  </span>
                ))}
              </>
            );
          })()}
        </div>
      )}

      <Suspense fallback={null}>
        <DocumentPreview
          reports={reports}
          activeReportId={activeReportId}
          onActiveChange={onActiveReportChange}
          isLoading={isLoading}
          loadingReportIds={loadingReportIds}
          failedReportIds={failedReportIds}
          onRetry={onRetryReport}
          branding={branding}
          analysisResults={analysisResults}
          selectedFrameworks={branding.selectedFrameworks}
          backendDebugInfo={backendDebugInfo}
          onFetchBackendDebug={onFetchBackendDebug}
        />
      </Suspense>

      {hasReports && !isLoading && (
        <div className="no-print space-y-3">
          {saveError && (
            <FlowStatusCard
              variant="error"
              title="Could not save reports"
              description="Your generated content is still in the browser. Fix the issue and try again."
              errorDetail={saveError}
              onRetry={onRetrySave}
              retryLabel="Retry save"
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={onBackToDashboard} className="gap-2">
              <ArrowLeftRight className="h-3.5 w-3.5 rotate-180" />
              Back to Dashboard
            </Button>
            {!isViewerOnly && (
              <button
                onClick={() => onSaveReports(true)}
                disabled={savingReports}
                className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
                  reportsSaved
                    ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                    : "bg-[#2006F7] text-white hover:bg-[#10037C]"
                }`}
              >
                <Save className="h-3.5 w-3.5" />
                {reportsSaved ? "Reports Saved!" : savingReports ? "Saving…" : "Save Reports"}
              </button>
            )}
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onStartOver}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Start Over
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

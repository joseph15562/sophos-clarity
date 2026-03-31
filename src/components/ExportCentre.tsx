import { useMemo } from "react";
import { FileText, FileSpreadsheet, Download, FileJson, Table, AlertTriangle } from "lucide-react";
import { downloadRiskRegisterCSV, downloadRiskRegisterExcel } from "@/lib/risk-register";
import type { AnalysisResult } from "@/lib/analyse-config";
import type { ComplianceFramework } from "@/components/BrandingSetup";
import { ALL_FRAMEWORK_NAMES } from "@/lib/compliance-map";
import { exportFindingsCsv, type FindingsCsvReviewerSignoff } from "@/lib/findings-export";
import { collectFindingExportValidationIssues } from "@/lib/report-export-validation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  branding: { customerName: string; selectedFrameworks: ComplianceFramework[] };
  /** When set, appended as comment rows on the findings CSV (cloud assessment sign-off). */
  reviewerSignoff?: FindingsCsvReviewerSignoff | null;
}

export function ExportCentre({ analysisResults, branding, reviewerSignoff }: Props) {
  const hasResults = Object.keys(analysisResults).length > 0;
  const frameworks = useMemo(
    () => (branding.selectedFrameworks?.length ? branding.selectedFrameworks : ALL_FRAMEWORK_NAMES),
    [branding.selectedFrameworks],
  );

  const validationIssues = useMemo(
    () => (hasResults ? collectFindingExportValidationIssues(analysisResults, frameworks) : []),
    [analysisResults, frameworks, hasResults],
  );

  const downloadFindingsComplianceCsv = () => {
    const csv = exportFindingsCsv(analysisResults, frameworks, reviewerSignoff ?? undefined);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `findings-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function downloadConfigSnapshot(ar: Record<string, AnalysisResult>): void {
    const json = JSON.stringify(ar, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `config-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const exportCards = [
    {
      id: "risk-csv",
      icon: FileText,
      title: "Risk Register CSV",
      description: "Export risk register as CSV for spreadsheets",
      onClick: () => downloadRiskRegisterCSV(analysisResults, branding.customerName),
    },
    {
      id: "risk-excel",
      icon: FileSpreadsheet,
      title: "Risk Register Excel",
      description: "Export risk register as Excel workbook",
      onClick: () => downloadRiskRegisterExcel(analysisResults, branding.customerName),
    },
    {
      id: "findings-csv",
      icon: Table,
      title: "Findings Summary (CSV)",
      description: "Framework control IDs, remediation, optional reviewer sign-off block",
      onClick: downloadFindingsComplianceCsv,
    },
    {
      id: "config-json",
      icon: FileJson,
      title: "Config Snapshot (JSON)",
      description: "Export full analysis results as JSON",
      onClick: () => downloadConfigSnapshot(analysisResults),
    },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card space-y-4">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        Export Centre
      </h3>
      {validationIssues.length > 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/[0.06]">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">
            Export checklist ({validationIssues.length})
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs text-muted-foreground">
              {validationIssues.slice(0, 6).map((iss, i) => (
                <li key={`${iss.message}-${i}`}>
                  {iss.message}
                  {iss.findingTitle ? (
                    <span className="text-muted-foreground/80"> — {iss.findingTitle}</span>
                  ) : null}
                </li>
              ))}
              {validationIssues.length > 6 && (
                <li className="list-none text-muted-foreground/70">
                  +{validationIssues.length - 6} more (export still allowed)
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {exportCards.map((card) => (
          <button
            key={card.id}
            type="button"
            disabled={!hasResults}
            onClick={() => card.onClick()}
            className="flex flex-col items-start gap-2 rounded-xl border border-border/50 bg-card p-4 text-left transition-colors hover:bg-accent/50 cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            <card.icon className="h-6 w-6 text-muted-foreground" />
            <span className="font-medium">{card.title}</span>
            <span className="text-xs text-muted-foreground">{card.description}</span>
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <Download className="h-3 w-3" />
              Download
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

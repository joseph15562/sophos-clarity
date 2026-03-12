import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { ArrowLeftRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUpload, UploadedFile } from "@/components/FileUpload";
import { BrandingSetup, BrandingData } from "@/components/BrandingSetup";
import { AppHeader } from "@/components/AppHeader";
import { EstateOverview } from "@/components/EstateOverview";
import { ReportCards } from "@/components/ReportCards";
import { extractSections } from "@/lib/extract-sections";
import { useReportGeneration, ParsedFile } from "@/hooks/use-report-generation";
import { useFirewallAnalysis } from "@/hooks/use-firewall-analysis";
import { useAutoSave, loadSession, clearSession } from "@/hooks/use-session-persistence";

const DocumentPreview = lazy(() => import("@/components/DocumentPreview").then((m) => ({ default: m.DocumentPreview })));
const ConfigDiff = lazy(() => import("@/components/ConfigDiff").then((m) => ({ default: m.ConfigDiff })));
const RiskScoreDashboard = lazy(() => import("@/components/RiskScoreDashboard").then((m) => ({ default: m.RiskScoreDashboard })));
const RemediationPlaybooks = lazy(() => import("@/components/RemediationPlaybooks").then((m) => ({ default: m.RemediationPlaybooks })));
const ComplianceHeatmap = lazy(() => import("@/components/ComplianceHeatmap").then((m) => ({ default: m.ComplianceHeatmap })));
const AssessmentHistory = lazy(() => import("@/components/AssessmentHistory").then((m) => ({ default: m.AssessmentHistory })));
const AIChatPanel = lazy(() => import("@/components/AIChatPanel").then((m) => ({ default: m.AIChatPanel })));

type DiffSelection = { beforeIdx: number; afterIdx: number } | null;

const Index = () => {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [branding, setBranding] = useState<BrandingData>({ companyName: "", logoUrl: null, customerName: "", environment: "", country: "", selectedFrameworks: [] });
  const [diffSelection, setDiffSelection] = useState<DiffSelection>(null);
  const [restoredSession, setRestoredSession] = useState(false);

  const {
    reports, setReports, activeReportId, setActiveReportId,
    isLoading, loadingReportIds, failedReportIds,
    generateIndividual, generateExecutive, generateCompliance, generateAll, handleRetry,
  } = useReportGeneration(files, branding);

  const {
    analysisResults, totalFindings, totalRules, totalSections,
    totalPopulated, extractionPct, aggregatedPosture,
  } = useFirewallAnalysis(files);

  useAutoSave(branding, reports, activeReportId);

  // Restore session on mount
  useEffect(() => {
    const session = loadSession();
    if (session && session.reports.length > 0) {
      setBranding(session.branding);
      setReports(session.reports);
      setActiveReportId(session.activeReportId);
      setRestoredSession(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilesChange = useCallback((uploaded: UploadedFile[]) => {
    const parsed: ParsedFile[] = uploaded.map((f) => {
      const existing = files.find((pf) => pf.id === f.id);
      if (existing) return { ...existing, label: f.label };
      const extractedData = extractSections(f.content);
      return { ...f, extractedData };
    });
    setFiles(parsed);
    if (reports.length > 0) {
      setReports([]);
      setActiveReportId("");
    }
  }, [files, reports.length, setReports, setActiveReportId]);

  const handleStartOver = useCallback(() => {
    setReports([]);
    setActiveReportId("");
    setFiles([]);
    setRestoredSession(false);
    clearSession();
  }, [setReports, setActiveReportId]);

  const hasReports = reports.length > 0;
  const hasFiles = files.length > 0;
  const inDiffMode = diffSelection !== null;

  const fileLabel = (f: ParsedFile) => f.label || f.fileName.replace(/\.(html|htm)$/i, "");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        hasFiles={hasFiles}
        fileCount={files.length}
        customerName={branding.customerName}
        environment={branding.environment}
        selectedFrameworks={branding.selectedFrameworks}
        reportCount={reports.length}
      />

      <main className={`mx-auto px-4 py-8 space-y-8 ${hasReports ? "max-w-full w-full" : "max-w-5xl"}`}>
        {/* Restored session banner */}
        {restoredSession && hasReports && !isLoading && (
          <div className="no-print rounded-lg border border-[#2006F7]/20 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] px-4 py-2.5 flex items-center gap-3 text-sm">
            <RotateCcw className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF] shrink-0" />
            <span className="text-foreground">Previous session restored — {reports.length} report{reports.length !== 1 ? "s" : ""} recovered.</span>
            <span className="text-muted-foreground text-xs">Reports are saved locally for 24 hours.</span>
          </div>
        )}

        {/* Config Diff Mode */}
        {inDiffMode && (
          <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Loading diff viewer…</div>}>
            <ConfigDiff
              beforeLabel={fileLabel(files[diffSelection.beforeIdx])}
              afterLabel={fileLabel(files[diffSelection.afterIdx])}
              beforeSections={files[diffSelection.beforeIdx].extractedData}
              afterSections={files[diffSelection.afterIdx].extractedData}
              onClose={() => setDiffSelection(null)}
            />
          </Suspense>
        )}

        {!hasReports && !isLoading && !inDiffMode && (
          <>
            {/* Landing hero */}
            {!hasFiles && (
              <section className="text-center py-6 space-y-4">
                <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">
                  Turn Sophos Firewall Exports into Audit-Ready Documentation
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
                  Upload one or more Sophos XGS configuration HTML exports. Sophos FireComply extracts every rule,
                  setting, and policy, runs a deterministic security analysis, then generates branded technical reports,
                  executive summaries, and compliance evidence packs — ready for customer handoff or audit.
                </p>
                <div className="flex flex-wrap justify-center gap-6 pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><img src="/icons/sophos-document.svg" alt="" className="h-4 w-4 sophos-icon" /> Technical Reports</span>
                  <span className="flex items-center gap-1.5"><img src="/icons/sophos-chart.svg" alt="" className="h-4 w-4 sophos-icon" /> Executive Briefs</span>
                  <span className="flex items-center gap-1.5"><img src="/icons/sophos-governance.svg" alt="" className="h-4 w-4 sophos-icon" /> Compliance Packs</span>
                  <span className="flex items-center gap-1.5"><img src="/icons/sophos-security.svg" alt="" className="h-4 w-4 sophos-icon" /> Data Anonymised</span>
                </div>
              </section>
            )}

            {/* Step 1 — Upload */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">1</span>
                <h2 className="text-lg font-display font-bold text-foreground">Upload Firewall Exports</h2>
              </div>
              <FileUpload files={files} onFilesChange={handleFilesChange} />
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

            {hasFiles && (
              <EstateOverview
                fileCount={files.length}
                analysisResults={analysisResults}
                totalFindings={totalFindings}
                totalRules={totalRules}
                totalSections={totalSections}
                totalPopulated={totalPopulated}
                extractionPct={extractionPct}
                aggregatedPosture={aggregatedPosture}
                selectedFrameworks={branding.selectedFrameworks}
              />
            )}

            {/* Risk Score Dashboard */}
            {hasFiles && (
              <Suspense fallback={null}>
                <RiskScoreDashboard analysisResults={analysisResults} />
              </Suspense>
            )}

            {/* Remediation Playbooks */}
            {hasFiles && totalFindings > 0 && (
              <Suspense fallback={null}>
                <RemediationPlaybooks analysisResults={analysisResults} />
              </Suspense>
            )}

            {/* Compliance Heatmap */}
            {hasFiles && (
              <Suspense fallback={null}>
                <ComplianceHeatmap
                  analysisResults={analysisResults}
                  selectedFrameworks={branding.selectedFrameworks}
                />
              </Suspense>
            )}

            {/* Assessment History */}
            {hasFiles && (
              <Suspense fallback={null}>
                <AssessmentHistory
                  analysisResults={analysisResults}
                  customerName={branding.customerName}
                  environment={branding.environment}
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

            {/* Step 3 — Generate reports */}
            {hasFiles && (
              <ReportCards
                fileCount={files.length}
                onGenerateIndividual={() => generateIndividual()}
                onGenerateExecutive={() => generateExecutive()}
                onGenerateCompliance={generateCompliance}
                onGenerateAll={generateAll}
              />
            )}

            {/* Config diff — compare two configs */}
            {files.length >= 2 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#10037C] text-white text-xs font-bold ring-4 ring-[#10037C]/15 dark:ring-[#10037C]/25">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="text-lg font-display font-bold text-foreground">Compare Configurations</h2>
                  <span className="text-xs text-muted-foreground">(side-by-side diff)</span>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Select two configurations to compare. Useful for tracking changes between firmware upgrades, pre/post change reviews, or auditing drift across your estate.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Before (baseline)</label>
                      <select
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                        value={diffSelection?.beforeIdx ?? 0}
                        onChange={(e) => setDiffSelection((prev) => ({
                          beforeIdx: Number(e.target.value),
                          afterIdx: prev?.afterIdx ?? Math.min(1, files.length - 1),
                        }))}
                      >
                        {files.map((f, i) => (
                          <option key={f.id} value={i}>{fileLabel(f)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">After (current)</label>
                      <select
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                        value={diffSelection?.afterIdx ?? Math.min(1, files.length - 1)}
                        onChange={(e) => setDiffSelection((prev) => ({
                          beforeIdx: prev?.beforeIdx ?? 0,
                          afterIdx: Number(e.target.value),
                        }))}
                      >
                        {files.map((f, i) => (
                          <option key={f.id} value={i}>{fileLabel(f)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setDiffSelection({
                      beforeIdx: diffSelection?.beforeIdx ?? 0,
                      afterIdx: diffSelection?.afterIdx ?? Math.min(1, files.length - 1),
                    })}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Compare
                  </Button>
                </div>
              </section>
            )}
          </>
        )}

        <Suspense fallback={null}>
          <DocumentPreview
            reports={reports}
            activeReportId={activeReportId}
            onActiveChange={setActiveReportId}
            isLoading={isLoading}
            loadingReportIds={loadingReportIds}
            failedReportIds={failedReportIds}
            onRetry={handleRetry}
            branding={branding}
            analysisResults={analysisResults}
            topActions={
              hasReports && !isLoading ? (
                <div className="no-print space-y-3 mb-4">
                  <div className="flex flex-wrap gap-3">
                    {files.length >= 2 && !reports.find((r) => r.id === "report-executive") && (
                      <Button variant="secondary" onClick={() => generateExecutive()} className="gap-2">
                        <img src="/icons/sophos-chart.svg" alt="" className="h-4 w-4 sophos-icon" /> Add Executive Brief
                      </Button>
                    )}
                    {!reports.find((r) => r.id === "report-compliance") && (
                      <Button variant="outline" onClick={generateCompliance} className="gap-2">
                        <img src="/icons/sophos-governance.svg" alt="" className="h-4 w-4 sophos-icon" /> Add Compliance Evidence Pack
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-[11px]">
                    <span className="font-semibold text-foreground mr-1">{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
                    <span className="w-px h-3 bg-border" />
                    <span className="text-muted-foreground">{files.length} firewall{files.length !== 1 ? "s" : ""}</span>
                    <span className="w-px h-3 bg-border" />
                    <span className="text-muted-foreground">{totalRules} rules</span>
                    {totalFindings > 0 && (
                      <>
                        <span className="w-px h-3 bg-border" />
                        {(() => {
                          const counts: Record<string, number> = {};
                          Object.values(analysisResults).forEach((r) =>
                            r.findings.forEach((f) => { counts[f.severity] = (counts[f.severity] || 0) + 1; })
                          );
                          return Object.entries(counts).map(([sev, count]) => (
                            <span key={sev} className={`px-1.5 py-0.5 rounded font-medium ${sev === "critical" ? "bg-[#EA0022]/10 text-[#EA0022]" : sev === "high" ? "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]" : sev === "medium" ? "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]" : sev === "low" ? "bg-[#00F2B3]/10 text-[#00995a] dark:text-[#00F2B3]" : "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]"}`}>
                              {count} {sev}
                            </span>
                          ));
                        })()}
                      </>
                    )}
                  </div>
                </div>
              ) : null
            }
          />
        </Suspense>

        {hasReports && !isLoading && (
          <div className="no-print flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleStartOver}>
              ← Start Over
            </Button>
          </div>
        )}
      </main>

      {/* AI Chat — floating panel, available whenever files are loaded */}
      {hasFiles && (
        <Suspense fallback={null}>
          <AIChatPanel
            sections={files[0]?.extractedData ?? {}}
            analysisResults={analysisResults}
            reports={reports}
            customerName={branding.customerName}
            environment={branding.environment}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Index;

import { useState, useCallback, useMemo } from "react";
import { BookOpen, ClipboardCheck, Moon, Sun, CheckCircle2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUpload, UploadedFile } from "@/components/FileUpload";
import { BrandingSetup, BrandingData } from "@/components/BrandingSetup";
import { DocumentPreview, ReportEntry } from "@/components/DocumentPreview";
import { streamConfigParse } from "@/lib/stream-ai";
import { extractSections, ExtractedSections } from "@/lib/extract-sections";
import { analyseConfig, severityIcon, type AnalysisResult, type Severity, type InspectionPosture } from "@/lib/analyse-config";
import { useToast } from "@/hooks/use-toast";

type ParsedFile = UploadedFile & { extractedData: ExtractedSections };

const Index = () => {
  const { toast } = useToast();
  const { setTheme, resolvedTheme } = useTheme();
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [branding, setBranding] = useState<BrandingData>({ companyName: "", logoUrl: null, customerName: "", environment: "", country: "", selectedFrameworks: [] });
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [activeReportId, setActiveReportId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingReportIds, setLoadingReportIds] = useState<Set<string>>(new Set());
  const [failedReportIds, setFailedReportIds] = useState<Set<string>>(new Set());

  const handleFilesChange = useCallback((uploaded: UploadedFile[]) => {
    const parsed: ParsedFile[] = uploaded.map((f) => {
      const existing = files.find((pf) => pf.id === f.id);
      if (existing) return { ...existing, label: f.label };
      const extractedData = extractSections(f.content);
      console.log(`Extracted ${Object.keys(extractedData).length} sections from ${f.fileName}`);
      return { ...f, extractedData };
    });
    setFiles(parsed);
    if (reports.length > 0) {
      setReports([]);
      setActiveReportId("");
    }
  }, [files, reports.length]);

  /** Generate a single report by reportId — used for initial gen and retry */
  const generateSingleReport = useCallback(async (
    reportId: string,
    sections: ExtractedSections,
    opts?: { executive?: boolean; firewallLabels?: string[]; compliance?: boolean }
  ) => {
    setLoadingReportIds((prev) => new Set(prev).add(reportId));
    setFailedReportIds((prev) => { const n = new Set(prev); n.delete(reportId); return n; });
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, markdown: "", errorMessage: undefined, loadingStatus: undefined } : r));

    const MAX_RETRIES = 2;
    let attempt = 0;
    let succeeded = false;

    while (attempt <= MAX_RETRIES && !succeeded) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, markdown: "", errorMessage: undefined, loadingStatus: undefined } : r));
      }

      succeeded = await new Promise<boolean>((resolve) => {
        streamConfigParse({
          sections,
          environment: branding.environment || undefined,
          country: branding.country || undefined,
          customerName: branding.customerName || undefined,
          selectedFrameworks: branding.selectedFrameworks.length > 0 ? branding.selectedFrameworks : undefined,
          executive: opts?.executive,
          firewallLabels: opts?.firewallLabels,
          compliance: opts?.compliance,
          onDelta: (text) => setReports((prev) =>
            prev.map((r) => r.id === reportId ? { ...r, markdown: r.markdown + text } : r)
          ),
          onDone: () => resolve(true),
          onError: (err) => {
            setReports((prev) => prev.map((r) => r.id === reportId ? {
              ...r,
              errorMessage: r.markdown
                ? `Generation interrupted after partial output. ${err}`
                : err,
            } : r));
            console.error(`Report ${reportId} attempt ${attempt + 1} failed:`, err);
            if (attempt >= MAX_RETRIES) {
              const isExecutive = reportId === "report-executive";
              const description = isExecutive
                ? `Executive summary uses data from all firewalls and often hits API limits. ${err} Try retry in a few minutes or use fewer configs.`
                : `${err} — use the retry button to try again.`;
              toast({ title: "Error", description, variant: "destructive" });
            }
            resolve(false);
          },
          onStatus: (status) => setReports((prev) =>
            prev.map((r) => r.id === reportId ? { ...r, loadingStatus: status } : r)
          ),
        });
      });
      attempt++;
    }

    if (!succeeded) {
      setFailedReportIds((prev) => new Set(prev).add(reportId));
    }
    setLoadingReportIds((prev) => { const n = new Set(prev); n.delete(reportId); return n; });
    return succeeded;
  }, [branding, toast]);

  const generateIndividual = async (keepLoading = false) => {
    if (files.length === 0) return;
    setIsLoading(true);
    setFailedReportIds(new Set());

    // Create all report entries upfront
    const newReports: ReportEntry[] = files.map((f) => ({
      id: `report-${f.id}`,
      label: f.label || f.fileName.replace(/\.(html|htm)$/i, ""),
      markdown: "",
    }));
    setReports(newReports);
    setActiveReportId(newReports[0].id);

    // Generate one at a time to stay under Gemini's 250K tokens/minute limit
    for (const f of files) {
      const reportId = `report-${f.id}`;
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      await generateSingleReport(reportId, f.extractedData, { firewallLabels: [label] });
      if (files.length > 1) await new Promise((r) => setTimeout(r, 2000));
    }

    if (!keepLoading) setIsLoading(false);
  };

  const generateExecutive = async (existingReports?: boolean) => {
    if (files.length < 2) return;
    if (!existingReports) setIsLoading(true);

    const mergedSections: Record<string, ExtractedSections> = {};
    const labels: string[] = [];
    files.forEach((f) => {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      labels.push(label);
      mergedSections[label] = f.extractedData;
    });

    const execId = "report-executive";
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== execId);
      const existing = prev.find((r) => r.id === execId);
      const keepPlaceholder = existing?.markdown?.includes("Waiting for API quota");
      return [...without, { id: execId, label: "📋 Executive Summary", markdown: keepPlaceholder ? existing!.markdown : "" }];
    });
    setActiveReportId(execId);

    await generateSingleReport(execId, mergedSections as unknown as ExtractedSections, {
      executive: true,
      firewallLabels: labels,
    });

    setIsLoading(false);
  };

  const generateCompliance = async () => {
    if (files.length === 0) return;
    setIsLoading(true);

    // Merge all firewall data for compliance pack
    const mergedSections: Record<string, ExtractedSections> = {};
    const labels: string[] = [];
    files.forEach((f) => {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      labels.push(label);
      mergedSections[label] = f.extractedData;
    });

    const complianceId = "report-compliance";
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== complianceId);
      return [...without, { id: complianceId, label: "🛡️ Compliance Evidence Pack", markdown: "" }];
    });
    setActiveReportId(complianceId);

    await generateSingleReport(
      complianceId,
      files.length === 1 ? files[0].extractedData : mergedSections as unknown as ExtractedSections,
      { compliance: true, firewallLabels: labels }
    );

    setIsLoading(false);
  };

  const generateAll = async () => {
    if (files.length < 2) return;
    setIsLoading(true);
    setFailedReportIds(new Set());

    // Create all report entries upfront (individual + executive)
    const newReports: ReportEntry[] = files.map((f) => ({
      id: `report-${f.id}`,
      label: f.label || f.fileName.replace(/\.(html|htm)$/i, ""),
      markdown: "",
    }));
    setReports(newReports);
    setActiveReportId(newReports[0].id);

    // Generate individual reports one at a time to stay under 250K TPM
    for (const f of files) {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      await generateSingleReport(`report-${f.id}`, f.extractedData, { firewallLabels: [label] });
      if (files.length > 1) await new Promise((r) => setTimeout(r, 2000));
    }

    // Then executive summary (no delay — tier 1 has higher limits)
    const execId = "report-executive";
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== execId);
      return [...without, { id: execId, label: "📋 Executive Summary", markdown: "" }];
    });
    setActiveReportId(execId);
    await generateExecutive(true);
  };

  const handleRetry = useCallback((reportId: string) => {
    // Find what to regenerate
    if (reportId === "report-executive") {
      const mergedSections: Record<string, ExtractedSections> = {};
      const labels: string[] = [];
      files.forEach((f) => {
        const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
        labels.push(label);
        mergedSections[label] = f.extractedData;
      });
      generateSingleReport(reportId, mergedSections as unknown as ExtractedSections, {
        executive: true,
        firewallLabels: labels,
      });
    } else if (reportId === "report-compliance") {
      const mergedSections: Record<string, ExtractedSections> = {};
      const labels: string[] = [];
      files.forEach((f) => {
        const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
        labels.push(label);
        mergedSections[label] = f.extractedData;
      });
      generateSingleReport(
        reportId,
        files.length === 1 ? files[0].extractedData : mergedSections as unknown as ExtractedSections,
        { compliance: true, firewallLabels: labels }
      );
    } else {
      const file = files.find((f) => `report-${f.id}` === reportId);
      if (file) {
        const label = file.label || file.fileName.replace(/\.(html|htm)$/i, "");
        generateSingleReport(reportId, file.extractedData, { firewallLabels: [label] });
      }
    }
  }, [files, generateSingleReport]);

  const hasReports = reports.length > 0;
  const hasFiles = files.length > 0;

  // Deterministic pre-AI analysis — runs client-side on extracted data
  const analysisResults = useMemo<Record<string, AnalysisResult>>(() => {
    const results: Record<string, AnalysisResult> = {};
    for (const f of files) {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      results[label] = analyseConfig(f.extractedData);
    }
    return results;
  }, [files]);

  const totalFindings = useMemo(
    () => Object.values(analysisResults).reduce((sum, r) => sum + r.findings.length, 0),
    [analysisResults],
  );
  const totalRules = useMemo(
    () => Object.values(analysisResults).reduce((sum, r) => sum + r.stats.totalRules, 0),
    [analysisResults],
  );
  const totalSections = useMemo(
    () => Object.values(analysisResults).reduce((sum, r) => sum + r.stats.totalSections, 0),
    [analysisResults],
  );
  const totalPopulated = useMemo(
    () => Object.values(analysisResults).reduce((sum, r) => sum + r.stats.populatedSections, 0),
    [analysisResults],
  );
  const extractionPct = totalSections > 0 ? Math.round((totalPopulated / totalSections) * 100) : 0;

  const severityColor: Record<Severity, string> = {
    critical: "text-[#EA0022]",
    high: "text-[#c47800] dark:text-[#F29400]",
    medium: "text-[#b8a200] dark:text-[#F8E300]",
    low: "text-[#00995a] dark:text-[#00F2B3]",
    info: "text-[#0077cc] dark:text-[#009CFB]",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sophos branded header */}
      <header className="border-b border-[#10037C]/20 bg-[#001A47] sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
          <div className="flex-1">
            <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">
              Sophos FireComply
            </h1>
            <p className="text-[11px] text-[#6A889B]">
              Firewall Configuration Assessment & Compliance Reporting
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="shrink-0 text-[#6A889B] hover:text-white hover:bg-[#10037C]/40"
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Workspace context strip — persistent when context exists */}
      {(hasFiles || branding.customerName || branding.selectedFrameworks.length > 0) && (
        <div className="border-b border-border bg-muted/50 no-print">
          <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-4 text-[11px] text-muted-foreground overflow-x-auto">
            {branding.customerName && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="font-semibold text-foreground">{branding.customerName}</span>
                {branding.environment && <span className="opacity-60">· {branding.environment}</span>}
              </span>
            )}
            {hasFiles && (
              <span className="flex items-center gap-1 shrink-0">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00995a] dark:bg-[#00F2B3]" />
                {files.length} firewall{files.length !== 1 ? "s" : ""} loaded
              </span>
            )}
            {branding.selectedFrameworks.length > 0 && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="opacity-60">Frameworks:</span>
                {branding.selectedFrameworks.map((fw) => (
                  <span key={fw} className="px-1.5 py-0.5 rounded bg-[#2006F7]/10 dark:bg-[#2006F7]/20 text-[#10037C] dark:text-[#009CFB] font-medium">
                    {fw}
                  </span>
                ))}
              </span>
            )}
            {reports.length > 0 && (
              <span className="flex items-center gap-1 shrink-0 ml-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2006F7]" />
                {reports.length} report{reports.length !== 1 ? "s" : ""} generated
              </span>
            )}
          </div>
        </div>
      )}

      <main className={`mx-auto px-4 py-8 space-y-8 ${reports.length > 0 ? "max-w-full w-full" : "max-w-5xl"}`}>
        {!hasReports && !isLoading && (
          <>
            {/* Landing hero — only when no files uploaded */}
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

            {/* Estate summary cards — after upload */}
            {hasFiles && (
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-[#2006F7]/20 dark:border-[#00EDFF]/20 bg-[#2006F7]/[0.04] dark:bg-[#00EDFF]/[0.06] p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
                    <img src="/icons/sophos-network.svg" alt="" className="h-7 w-7 sophos-icon" />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-[#2006F7] dark:text-[#00EDFF] leading-none">{files.length}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">Firewall{files.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#10037C]/15 dark:border-[#2006F7]/20 bg-[#10037C]/[0.03] dark:bg-[#2006F7]/[0.06] p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-[#10037C]/10 dark:bg-[#2006F7]/10 flex items-center justify-center shrink-0">
                    <img src="/icons/sophos-governance.svg" alt="" className="h-7 w-7 sophos-icon" />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-[#001A47] dark:text-white leading-none">{totalRules}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">Rules Parsed</p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#5A00FF]/15 dark:border-[#5A00FF]/20 bg-[#5A00FF]/[0.03] dark:bg-[#5A00FF]/[0.06] p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-[#5A00FF]/10 dark:bg-[#5A00FF]/10 flex items-center justify-center shrink-0">
                    <img src="/icons/sophos-search.svg" alt="" className="h-7 w-7 sophos-icon" />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-[#001A47] dark:text-white leading-none">{totalSections}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">Sections</p>
                  </div>
                </div>
                <div className={`rounded-xl border p-5 flex items-center gap-4 ${totalFindings > 0 ? "border-[#EA0022]/20 dark:border-[#F29400]/25 bg-[#EA0022]/[0.04] dark:bg-[#F29400]/[0.06]" : "border-[#00995a]/20 dark:border-[#00F2B3]/20 bg-[#00995a]/[0.04] dark:bg-[#00F2B3]/[0.06]"}`}>
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${totalFindings > 0 ? "bg-[#EA0022]/10 dark:bg-[#F29400]/10" : "bg-[#00995a]/10 dark:bg-[#00F2B3]/10"}`}>
                    <img src="/icons/sophos-alert.svg" alt="" className="h-7 w-7 sophos-icon" />
                  </div>
                  <div>
                    <p className={`text-3xl font-extrabold leading-none ${totalFindings > 0 ? "text-[#EA0022] dark:text-[#F29400]" : "text-[#00995a] dark:text-[#00F2B3]"}`}>{totalFindings}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">Issues</p>
                  </div>
                </div>
              </section>
            )}

            {/* Extraction coverage bar */}
            {hasFiles && (
              <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">Extraction Coverage</span>
                    <span className={`text-xs font-bold ${extractionPct >= 80 ? "text-[#00995a] dark:text-[#00F2B3]" : extractionPct >= 50 ? "text-[#b8a200] dark:text-[#F8E300]" : "text-[#EA0022]"}`}>{extractionPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${extractionPct >= 80 ? "bg-[#00995a] dark:bg-[#00F2B3]" : extractionPct >= 50 ? "bg-[#b8a200] dark:bg-[#F8E300]" : "bg-[#EA0022]"}`}
                      style={{ width: `${extractionPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {totalPopulated} of {totalSections} sections contain parseable data &middot; {totalRules} rules &middot; {Object.values(analysisResults).reduce((s, r) => s + r.stats.totalNatRules, 0)} NAT rules &middot; {Object.values(analysisResults).reduce((s, r) => s + r.stats.interfaces, 0)} interfaces
                  </p>
                </div>
                {extractionPct < 80 && (
                  <div className="text-[10px] text-muted-foreground max-w-[180px] leading-tight">
                    Some sections parsed empty. This may indicate an unsupported export format or unconfigured areas.
                  </div>
                )}
              </div>
            )}

            {/* DPI / Inspection posture dashboard */}
            {hasFiles && (() => {
              const agg: InspectionPosture = {
                totalWanRules: 0, withWebFilter: 0, withoutWebFilter: 0,
                withAppControl: 0, withIps: 0, withSslInspection: 0, wanRuleNames: [],
              };
              for (const r of Object.values(analysisResults)) {
                agg.totalWanRules += r.inspectionPosture.totalWanRules;
                agg.withWebFilter += r.inspectionPosture.withWebFilter;
                agg.withoutWebFilter += r.inspectionPosture.withoutWebFilter;
                agg.withAppControl += r.inspectionPosture.withAppControl;
                agg.withIps += r.inspectionPosture.withIps;
                agg.withSslInspection += r.inspectionPosture.withSslInspection;
              }
              if (agg.totalWanRules === 0) return null;
              const pct = (n: number) => agg.totalWanRules > 0 ? Math.round((n / agg.totalWanRules) * 100) : 0;
              const bar = (label: string, value: number, color: string) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <span className="font-bold text-foreground">{value}/{agg.totalWanRules} <span className="text-muted-foreground font-normal">({pct(value)}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct(value)}%` }} />
                  </div>
                </div>
              );
              return (
                <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <img src="/icons/sophos-security.svg" alt="" className="h-5 w-5 sophos-icon" />
                    <h3 className="text-sm font-semibold text-foreground">Inspection Posture</h3>
                    <span className="text-[10px] text-muted-foreground">across {agg.totalWanRules} WAN-facing rule{agg.totalWanRules !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {bar("Web Filtering", agg.withWebFilter, pct(agg.withWebFilter) >= 80 ? "bg-[#00995a] dark:bg-[#00F2B3]" : pct(agg.withWebFilter) >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]")}
                    {bar("IPS / Intrusion Prevention", agg.withIps, pct(agg.withIps) >= 80 ? "bg-[#00995a] dark:bg-[#00F2B3]" : pct(agg.withIps) >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]")}
                    {bar("Application Control", agg.withAppControl, pct(agg.withAppControl) >= 80 ? "bg-[#00995a] dark:bg-[#00F2B3]" : pct(agg.withAppControl) >= 50 ? "bg-[#F29400]" : "bg-[#EA0022]")}
                  </div>
                  {agg.withSslInspection > 0 ? (
                    <p className="text-[10px] text-muted-foreground">{agg.withSslInspection} SSL/TLS inspection rule{agg.withSslInspection !== 1 ? "s" : ""} configured</p>
                  ) : (
                    <p className="text-[10px] text-[#c47800] dark:text-[#F29400]">No SSL/TLS inspection rules detected — encrypted traffic is not being inspected</p>
                  )}
                </div>
              );
            })()}

            {/* Pre-AI findings panel */}
            {hasFiles && totalFindings > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <img src="/icons/sophos-alert.svg" alt="" className="h-5 w-5 sophos-icon" />
                  <h3 className="text-sm font-semibold text-foreground">Deterministic Findings</h3>
                  <span className="text-xs text-muted-foreground">(rule-based analysis — pre-AI)</span>
                </div>
                <div className="grid gap-2.5">
                  {Object.entries(analysisResults).map(([label, result]) =>
                    result.findings.map((f) => {
                      const borderMap: Record<Severity, string> = {
                        critical: "border-l-[#EA0022]",
                        high: "border-l-[#c47800] dark:border-l-[#F29400]",
                        medium: "border-l-[#b8a200] dark:border-l-[#F8E300]",
                        low: "border-l-[#00995a] dark:border-l-[#00F2B3]",
                        info: "border-l-[#0077cc] dark:border-l-[#009CFB]",
                      };
                      return (
                        <div key={`${label}-${f.id}`} className={`rounded-lg border border-border border-l-4 ${borderMap[f.severity]} bg-card px-4 py-3.5 flex items-start gap-3 text-sm shadow-sm`}>
                          <span className="mt-0.5 text-lg shrink-0" title={f.severity}>{severityIcon(f.severity)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className={`font-bold text-sm ${severityColor[f.severity]}`}>{f.title}</span>
                              {files.length > 1 && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">{label}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{f.detail}</p>
                            {f.remediation && (
                              <div className="mt-2 px-3 py-2 rounded bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] border border-[#2006F7]/10 dark:border-[#2006F7]/20">
                                <p className="text-[10px] text-foreground leading-relaxed"><span className="font-semibold text-[#10037C] dark:text-[#009CFB]">Remediation:</span> {f.remediation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {/* Estate risk comparison — per-firewall ranking */}
            {hasFiles && files.length >= 2 && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <img src="/icons/sophos-orchestration.svg" alt="" className="h-5 w-5 sophos-icon" />
                  <h3 className="text-sm font-semibold text-foreground">Estate Risk Comparison</h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(analysisResults)
                    .sort(([, a], [, b]) => {
                      const weight = (r: AnalysisResult) => r.findings.reduce((s, f) => s + (f.severity === "critical" ? 10 : f.severity === "high" ? 5 : f.severity === "medium" ? 2 : f.severity === "low" ? 1 : 0), 0);
                      return weight(b) - weight(a);
                    })
                    .map(([label, result], idx) => {
                      const criticals = result.findings.filter((f) => f.severity === "critical").length;
                      const highs = result.findings.filter((f) => f.severity === "high").length;
                      const mediums = result.findings.filter((f) => f.severity === "medium").length;
                      const score = criticals * 10 + highs * 5 + mediums * 2;
                      const maxScore = Math.max(1, ...Object.values(analysisResults).map((r) => r.findings.reduce((s, f) => s + (f.severity === "critical" ? 10 : f.severity === "high" ? 5 : f.severity === "medium" ? 2 : f.severity === "low" ? 1 : 0), 0)));
                      return (
                        <div key={label} className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-muted-foreground w-5 text-right">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-semibold text-foreground truncate">{label}</span>
                              <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                                {criticals > 0 && <span className="text-[#EA0022] font-bold">{criticals}C</span>}
                                {highs > 0 && <span className="text-[#c47800] dark:text-[#F29400] font-bold">{highs}H</span>}
                                {mediums > 0 && <span className="text-[#b8a200] dark:text-[#F8E300] font-bold">{mediums}M</span>}
                                <span className="text-muted-foreground">{result.stats.totalRules}r</span>
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
                <p className="text-[10px] text-muted-foreground">Ranked by weighted risk score: Critical ×10, High ×5, Medium ×2, Low ×1</p>
              </div>
            )}

            {hasFiles && totalFindings === 0 && (
              <div className="rounded-md border border-[#00995a]/30 dark:border-[#00F2B3]/30 bg-[#00995a]/5 dark:bg-[#00F2B3]/5 px-4 py-3 flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-[#00774a] dark:text-[#00F2B3] shrink-0" />
                <span className="text-[#00774a] dark:text-[#00F2B3] font-medium">No issues detected in deterministic analysis.</span>
                <span className="text-muted-foreground">AI-driven assessment will provide deeper coverage.</span>
              </div>
            )}

            {/* Step 2 — Assessment Context */}
            {hasFiles && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">2</span>
                <h2 className="text-lg font-display font-bold text-foreground">Assessment Context</h2>
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <BrandingSetup branding={branding} onChange={setBranding} />
                  </CardContent>
                </Card>
              </section>
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

            {/* Step 3 — Generate reports (report mode hierarchy) */}
            {hasFiles && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">3</span>
                <h2 className="text-lg font-display font-bold text-foreground">Generate Reports</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Technical Report */}
                  <div
                    className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-[#2006F7]/30 dark:hover:border-[#2006F7]/40 transition-all duration-200 cursor-pointer group overflow-hidden"
                    onClick={() => generateIndividual()}
                  >
                    <div className="h-1 bg-gradient-to-r from-[#2006F7] to-[#5A00FF]" />
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center shrink-0 group-hover:bg-[#2006F7]/15 dark:group-hover:bg-[#2006F7]/25 transition-colors">
                          <img src="/icons/sophos-document.svg" alt="" className="h-6 w-6 sophos-icon" />
                        </div>
                        <span className="font-display font-bold text-foreground text-[15px]">Technical Report</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Comprehensive per-firewall assessment covering rules, NAT, interfaces, hosts, policies, and security posture. Includes prioritised findings, NCSC-aligned recommendations, and remediation guidance.
                      </p>
                      <Button size="sm" className="w-full gap-2 bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white shadow-sm">
                        <img src="/icons/sophos-ai-white.svg" alt="" className="h-4 w-4" />
                        {files.length === 1 ? "Generate Report" : `Generate ${files.length} Reports`}
                      </Button>
                    </div>
                  </div>

                  {/* Executive Brief */}
                  <div
                    className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 ${files.length >= 2 ? "hover:shadow-md hover:border-[#5A00FF]/30 dark:hover:border-[#5A00FF]/40 cursor-pointer group" : "opacity-45 pointer-events-none"}`}
                    onClick={files.length >= 2 ? () => generateExecutive() : undefined}
                  >
                    <div className="h-1 bg-gradient-to-r from-[#5A00FF] to-[#B529F7]" />
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg bg-[#5A00FF]/10 dark:bg-[#5A00FF]/15 flex items-center justify-center shrink-0">
                          <img src="/icons/sophos-chart.svg" alt="" className="h-6 w-6 sophos-icon" />
                        </div>
                        <span className="font-display font-bold text-foreground text-[15px]">Executive Brief</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {files.length >= 2
                          ? "Consolidated estate summary comparing all firewalls. Risk matrix, cross-estate findings, strategic recommendations — designed for management and stakeholder reporting."
                          : "Upload 2+ firewall exports to unlock the consolidated executive brief across your estate."}
                      </p>
                      <Button size="sm" variant="secondary" className="w-full gap-2" disabled={files.length < 2}>
                        <BookOpen className="h-3.5 w-3.5" /> Generate Executive Brief
                      </Button>
                    </div>
                  </div>

                  {/* Compliance Evidence Pack */}
                  <div
                    className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-[#009CFB]/30 dark:hover:border-[#009CFB]/40 transition-all duration-200 cursor-pointer group overflow-hidden"
                    onClick={generateCompliance}
                  >
                    <div className="h-1 bg-gradient-to-r from-[#009CFB] to-[#00EDFF]" />
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg bg-[#009CFB]/10 dark:bg-[#009CFB]/15 flex items-center justify-center shrink-0 group-hover:bg-[#009CFB]/15 dark:group-hover:bg-[#009CFB]/25 transition-colors">
                          <img src="/icons/sophos-governance.svg" alt="" className="h-6 w-6 sophos-icon" />
                        </div>
                        <span className="font-display font-bold text-foreground text-[15px]">Compliance Evidence Pack</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Audit-ready evidence appendix mapping firewall controls to your selected compliance frameworks. Includes control status assessment, gap analysis, residual risk register, and remediation priorities.
                      </p>
                      <Button size="sm" variant="outline" className="w-full gap-2">
                        <ClipboardCheck className="h-3.5 w-3.5" /> Generate Compliance Pack
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Generate All — only when 2+ firewalls */}
                {files.length >= 2 && (
                  <Button size="lg" onClick={generateAll} className="w-full gap-2 text-base bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white">
                    <img src="/icons/sophos-orchestration-white.svg" alt="" className="h-5 w-5" /> Generate All Reports + Executive Brief
                  </Button>
                )}
              </section>
            )}
          </>
        )}

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
                {/* Report summary strip */}
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

        {hasReports && !isLoading && (
          <div className="no-print flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setReports([]);
                setActiveReportId("");
                setFiles([]);
                setFailedReportIds(new Set());
              }}
            >
              ← Start Over
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;

import { useState, useCallback } from "react";
import { Shield, Sparkles, FileStack, BookOpen, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUpload, UploadedFile } from "@/components/FileUpload";
import { BrandingSetup, BrandingData } from "@/components/BrandingSetup";
import { DocumentPreview, ReportEntry } from "@/components/DocumentPreview";
import { streamConfigParse } from "@/lib/stream-ai";
import { extractSections, ExtractedSections } from "@/lib/extract-sections";
import { useToast } from "@/hooks/use-toast";

type ParsedFile = UploadedFile & { extractedData: ExtractedSections };

const Index = () => {
  const { toast } = useToast();
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
    // Reset markdown for this report
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, markdown: "" } : r));

    const MAX_RETRIES = 2;
    let attempt = 0;
    let succeeded = false;

    while (attempt <= MAX_RETRIES && !succeeded) {
      if (attempt > 0) {
        // Wait before retry with exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, markdown: "" } : r));
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
            console.error(`Report ${reportId} attempt ${attempt + 1} failed:`, err);
            if (attempt >= MAX_RETRIES) {
              toast({ title: "Error", description: `${err} — use the retry button to try again.`, variant: "destructive" });
            }
            resolve(false);
          },
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

    // Generate all in parallel
    await Promise.all(
      files.map((f) => {
        const reportId = `report-${f.id}`;
        return generateSingleReport(reportId, f.extractedData);
      })
    );

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
      return [...without, { id: execId, label: "📋 Executive Summary", markdown: "" }];
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

    // Generate all individual in parallel
    await Promise.all(
      files.map((f) => generateSingleReport(`report-${f.id}`, f.extractedData))
    );

    // Then executive
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
        generateSingleReport(reportId, file.extractedData);
      }
    }
  }, [files, generateSingleReport]);

  const hasReports = reports.length > 0;
  const hasFiles = files.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">
              Sophos Config Documenter
            </h1>
            <p className="text-xs text-muted-foreground">
              Transform firewall exports into readable documentation
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {!hasReports && !isLoading && (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                <h2 className="text-lg font-semibold text-foreground">Upload Config Exports</h2>
              </div>
              <FileUpload files={files} onFilesChange={handleFilesChange} />
              {files.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  {files.length} firewalls loaded — you can generate individual reports and a combined executive summary.
                </p>
              )}
            </section>

            {hasFiles && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                  <h2 className="text-lg font-semibold text-foreground">Branding & Context (Optional)</h2>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <BrandingSetup branding={branding} onChange={setBranding} />
                  </CardContent>
                </Card>
              </section>
            )}

            {hasFiles && (
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => generateIndividual()} className="gap-2 text-base">
                  <Sparkles className="h-5 w-5" />
                  {files.length === 1 ? "Generate Documentation" : `Generate ${files.length} Individual Reports`}
                </Button>
                {files.length >= 2 && (
                  <>
                    <Button size="lg" variant="secondary" onClick={() => generateExecutive()} className="gap-2 text-base">
                      <BookOpen className="h-5 w-5" /> Executive Summary Only
                    </Button>
                    <Button size="lg" onClick={generateAll} className="gap-2 text-base bg-gradient-to-r from-primary to-primary/80">
                      <FileStack className="h-5 w-5" /> Generate All Reports + Executive
                    </Button>
                  </>
                )}
                <Button size="lg" variant="outline" onClick={generateCompliance} className="gap-2 text-base">
                  <ClipboardCheck className="h-5 w-5" /> Compliance Evidence Pack
                </Button>
              </div>
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
            {files.length >= 2 && !reports.find((r) => r.id === "report-executive") && (
              <Button variant="secondary" onClick={() => generateExecutive()} className="gap-2">
                <BookOpen className="h-4 w-4" /> Add Executive Summary
              </Button>
            )}
            {!reports.find((r) => r.id === "report-compliance") && (
              <Button variant="outline" onClick={generateCompliance} className="gap-2">
                <ClipboardCheck className="h-4 w-4" /> Add Compliance Evidence Pack
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;

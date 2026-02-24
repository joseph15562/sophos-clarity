import { useState, useCallback } from "react";
import { Shield, Sparkles, FileStack, BookOpen } from "lucide-react";
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
  const [branding, setBranding] = useState<BrandingData>({ companyName: "", logoUrl: null, customerName: "", environment: "", country: "" });
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [activeReportId, setActiveReportId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  const handleFilesChange = useCallback((uploaded: UploadedFile[]) => {
    // Parse any new files
    const parsed: ParsedFile[] = uploaded.map((f) => {
      // Check if already parsed
      const existing = files.find((pf) => pf.id === f.id);
      if (existing) return existing;
      const extractedData = extractSections(f.content);
      console.log(`Extracted ${Object.keys(extractedData).length} sections from ${f.fileName}`);
      return { ...f, extractedData };
    });
    setFiles(parsed);
    // Clear reports when files change
    if (reports.length > 0) {
      setReports([]);
      setActiveReportId("");
    }
  }, [files, reports.length]);

  const generateIndividual = async (keepLoading = false) => {
    if (files.length === 0) return;
    setIsLoading(true);
    setReports([]);

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const reportId = `report-${f.id}`;
      const label = f.fileName.replace(/\.(html|htm)$/i, "");

      setReports((prev) => [...prev, { id: reportId, label, markdown: "" }]);
      if (i === 0) setActiveReportId(reportId);
      setLoadingReportId(reportId);

      await new Promise<void>((resolve) => {
        streamConfigParse({
          sections: f.extractedData,
          environment: branding.environment || undefined,
          country: branding.country || undefined,
          customerName: branding.customerName || undefined,
          onDelta: (text) => setReports((prev) =>
            prev.map((r) => r.id === reportId ? { ...r, markdown: r.markdown + text } : r)
          ),
          onDone: () => resolve(),
          onError: (err) => {
            toast({ title: "Error", description: err, variant: "destructive" });
            resolve();
          },
        });
      });
    }

    setLoadingReportId(null);
    if (!keepLoading) setIsLoading(false);
  };

  const generateExecutive = async (existingReports?: boolean) => {
    if (files.length < 2) return;
    if (!existingReports) {
      setIsLoading(true);
    }

    // Merge all sections under labelled keys
    const mergedSections: Record<string, ExtractedSections> = {};
    const labels: string[] = [];
    files.forEach((f) => {
      const label = f.fileName.replace(/\.(html|htm)$/i, "");
      labels.push(label);
      mergedSections[label] = f.extractedData;
    });

    const execId = "report-executive";
    // Add or reset executive report
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== execId);
      return [...without, { id: execId, label: "📋 Executive Summary", markdown: "" }];
    });
    setActiveReportId(execId);
    setLoadingReportId(execId);

    await new Promise<void>((resolve) => {
      streamConfigParse({
        sections: mergedSections as unknown as ExtractedSections,
        environment: branding.environment || undefined,
        country: branding.country || undefined,
        customerName: branding.customerName || undefined,
        executive: true,
        firewallLabels: labels,
        onDelta: (text) => setReports((prev) =>
          prev.map((r) => r.id === execId ? { ...r, markdown: r.markdown + text } : r)
        ),
        onDone: () => resolve(),
        onError: (err) => {
          toast({ title: "Error", description: err, variant: "destructive" });
          resolve();
        },
      });
    });

    setLoadingReportId(null);
    setIsLoading(false);
  };

  const generateAll = async () => {
    if (files.length < 2) return;
    await generateIndividual(true);
    await generateExecutive(true);
  };

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
        {/* Upload + Branding — hide once reports are showing */}
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
              </div>
            )}
          </>
        )}

        {/* Reports */}
        <DocumentPreview
          reports={reports}
          activeReportId={activeReportId}
          onActiveChange={setActiveReportId}
          isLoading={isLoading}
          loadingReportId={loadingReportId}
          branding={branding}
        />

        {/* Start over */}
        {hasReports && !isLoading && (
          <div className="no-print flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setReports([]);
                setActiveReportId("");
                setFiles([]);
              }}
            >
              ← Start Over
            </Button>
            {files.length >= 2 && !reports.find((r) => r.id === "report-executive") && (
              <Button variant="secondary" onClick={() => generateExecutive()} className="gap-2">
                <BookOpen className="h-4 w-4" /> Add Executive Summary
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;

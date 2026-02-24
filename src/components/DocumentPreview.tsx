import { useMemo, useRef } from "react";
import { BrandingData } from "./BrandingSetup";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { marked } from "marked";

export type ReportEntry = {
  id: string;
  label: string;
  markdown: string;
};

type Props = {
  reports: ReportEntry[];
  activeReportId: string;
  onActiveChange: (id: string) => void;
  isLoading: boolean;
  loadingReportId: string | null;
  branding: BrandingData;
};

function ReportContent({ markdown, isLoading, branding, pdfFilename }: { markdown: string; isLoading: boolean; branding: BrandingData; pdfFilename: string }) {
  const docRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    if (!markdown) return "";
    return marked.parse(markdown, { async: false }) as string;
  }, [markdown]);

  const handlePdf = async () => {
    const el = docRef.current;
    if (!el) return;
    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: pdfFilename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    }).from(el).save();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end no-print">
        {markdown && !isLoading && (
          <Button onClick={handlePdf} className="gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        )}
      </div>

      <div ref={docRef} className="bg-card rounded-xl border border-border shadow-sm p-8 md:p-12 doc-section">
        {(branding.companyName || branding.logoUrl) && (
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt="Company logo" className="h-14 w-auto max-w-[200px] object-contain" />
            )}
            {branding.companyName && (
              <div>
                <p className="text-lg font-bold text-foreground">{branding.companyName}</p>
                <p className="text-sm text-muted-foreground">Firewall Configuration Report</p>
              </div>
            )}
          </div>
        )}

        {isLoading && !markdown && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-lg font-medium">Analysing configuration...</p>
            <p className="text-sm">This may take a minute for large configs</p>
          </div>
        )}

        {html && <div dangerouslySetInnerHTML={{ __html: html }} />}

        {isLoading && markdown && (
          <div className="flex items-center gap-2 text-muted-foreground mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Still generating...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentPreview({ reports, activeReportId, onActiveChange, isLoading, loadingReportId, branding }: Props) {
  if (reports.length === 0 && !isLoading) return null;

  // Single report — no tabs needed
  if (reports.length === 1 && !isLoading) {
    const r = reports[0];
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground no-print">Document Preview</h2>
        <ReportContent
          markdown={r.markdown}
          isLoading={loadingReportId === r.id}
          branding={branding}
          pdfFilename={`${r.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`}
        />
      </div>
    );
  }

  // If still loading the very first report with no content yet
  if (reports.length === 0 && isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground no-print">Document Preview</h2>
        <ReportContent markdown="" isLoading={true} branding={branding} pdfFilename="report.pdf" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground no-print">Document Preview</h2>
      <Tabs value={activeReportId} onValueChange={onActiveChange} className="no-print-tabs">
        <TabsList className="no-print flex-wrap h-auto gap-1">
          {reports.map((r) => (
            <TabsTrigger key={r.id} value={r.id} className="text-xs">
              {r.label}
              {loadingReportId === r.id && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
            </TabsTrigger>
          ))}
        </TabsList>
        {reports.map((r) => (
          <TabsContent key={r.id} value={r.id}>
            <ReportContent
              markdown={r.markdown}
              isLoading={loadingReportId === r.id}
              branding={branding}
              pdfFilename={`${r.label.replace(/\s+/g, "-").toLowerCase()}-report.pdf`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

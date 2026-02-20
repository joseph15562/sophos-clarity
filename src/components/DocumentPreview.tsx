import { useMemo, useRef } from "react";
import { BrandingData } from "./BrandingSetup";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marked } from "marked";

type Props = {
  markdown: string;
  isLoading: boolean;
  branding: BrandingData;
};

export function DocumentPreview({ markdown, isLoading, branding }: Props) {
  const docRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    if (!markdown) return "";
    return marked.parse(markdown, { async: false }) as string;
  }, [markdown]);

  const handlePdf = async () => {
    const el = docRef.current;
    if (!el) return;

    const html2pdf = (await import("html2pdf.js")).default;
    const opt = {
      margin: [10, 10, 10, 10],
      filename: "sophos-config-report.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };

    html2pdf().set(opt).from(el).save();
  };

  if (!markdown && !isLoading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <h2 className="text-xl font-bold text-foreground">Document Preview</h2>
        {markdown && !isLoading && (
          <Button onClick={handlePdf} className="gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        )}
      </div>

      <div
        ref={docRef}
        className="bg-card rounded-xl border border-border shadow-sm p-8 md:p-12 doc-section"
      >
        {/* Branding header */}
        {(branding.companyName || branding.logoUrl) && (
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt="Company logo"
                className="h-14 w-auto max-w-[200px] object-contain"
              />
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

        {html && (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}

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

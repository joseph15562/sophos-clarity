import { useState, useCallback } from "react";
import { Shield, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/FileUpload";
import { BrandingSetup, BrandingData } from "@/components/BrandingSetup";
import { DocumentPreview } from "@/components/DocumentPreview";
import { streamConfigParse } from "@/lib/stream-ai";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { toast } = useToast();
  const [htmlContent, setHtmlContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [branding, setBranding] = useState<BrandingData>({ companyName: "", logoUrl: null });
  const [markdown, setMarkdown] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onFileLoaded = useCallback((content: string, name: string) => {
    setHtmlContent(content);
    setFileName(name);
    setMarkdown("");
  }, []);

  const generate = async () => {
    if (!htmlContent) return;
    setIsLoading(true);
    setMarkdown("");

    await streamConfigParse({
      htmlContent,
      onDelta: (text) => setMarkdown((prev) => prev + text),
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setIsLoading(false);
        toast({ title: "Error", description: err, variant: "destructive" });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        {/* Step 1 — Upload */}
        {!markdown && !isLoading && (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                <h2 className="text-lg font-semibold text-foreground">Upload Config Export</h2>
              </div>
              <FileUpload onFileLoaded={onFileLoaded} />
            </section>

            {/* Step 2 — Branding */}
            {htmlContent && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                  <h2 className="text-lg font-semibold text-foreground">Branding (Optional)</h2>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <BrandingSetup branding={branding} onChange={setBranding} />
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Generate button */}
            {htmlContent && (
              <Button size="lg" onClick={generate} className="gap-2 text-base">
                <Sparkles className="h-5 w-5" /> Generate Documentation
              </Button>
            )}
          </>
        )}

        {/* Document preview + loading */}
        <DocumentPreview markdown={markdown} isLoading={isLoading} branding={branding} />

        {/* Start over */}
        {markdown && !isLoading && (
          <div className="no-print">
            <Button
              variant="outline"
              onClick={() => {
                setMarkdown("");
                setHtmlContent("");
                setFileName("");
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

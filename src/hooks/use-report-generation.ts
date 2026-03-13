import { useState, useCallback } from "react";
import type { ReportEntry } from "@/components/DocumentPreview";
import type { BrandingData } from "@/components/BrandingSetup";
import type { ExtractedSections } from "@/lib/extract-sections";
import { streamConfigParse, type CentralEnrichment } from "@/lib/stream-ai";
import { useToast } from "@/hooks/use-toast";

export type ParsedFile = {
  id: string;
  label: string;
  fileName: string;
  content: string;
  extractedData: ExtractedSections;
  centralEnrichment?: CentralEnrichment;
};

export function useReportGeneration(files: ParsedFile[], branding: BrandingData) {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [activeReportId, setActiveReportId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingReportIds, setLoadingReportIds] = useState<Set<string>>(new Set());
  const [failedReportIds, setFailedReportIds] = useState<Set<string>>(new Set());

  const generateSingleReport = useCallback(
    async (
      reportId: string,
      sections: ExtractedSections,
      opts?: { executive?: boolean; firewallLabels?: string[]; compliance?: boolean; centralEnrichment?: CentralEnrichment }
    ) => {
      setLoadingReportIds((prev) => new Set(prev).add(reportId));
      setFailedReportIds((prev) => {
        const n = new Set(prev);
        n.delete(reportId);
        return n;
      });
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, markdown: "", errorMessage: undefined, loadingStatus: undefined }
            : r
        )
      );

      const MAX_RETRIES = 2;
      let attempt = 0;
      let succeeded = false;

      while (attempt <= MAX_RETRIES && !succeeded) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
          setReports((prev) =>
            prev.map((r) =>
              r.id === reportId
                ? { ...r, markdown: "", errorMessage: undefined, loadingStatus: undefined }
                : r
            )
          );
        }

        succeeded = await new Promise<boolean>((resolve) => {
          streamConfigParse({
            sections,
            environment: branding.environment || undefined,
            country: branding.country || undefined,
            customerName: branding.customerName || undefined,
            selectedFrameworks:
              branding.selectedFrameworks.length > 0 ? branding.selectedFrameworks : undefined,
            executive: opts?.executive,
            firewallLabels: opts?.firewallLabels,
            compliance: opts?.compliance,
            centralEnrichment: opts?.centralEnrichment,
            onDelta: (text) =>
              setReports((prev) =>
                prev.map((r) => (r.id === reportId ? { ...r, markdown: r.markdown + text } : r))
              ),
            onDone: () => resolve(true),
            onError: (err) => {
              setReports((prev) =>
                prev.map((r) =>
                  r.id === reportId
                    ? {
                        ...r,
                        errorMessage: r.markdown
                          ? `Generation interrupted after partial output. ${err}`
                          : err,
                      }
                    : r
                )
              );
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
            onStatus: (status) =>
              setReports((prev) =>
                prev.map((r) =>
                  r.id === reportId ? { ...r, loadingStatus: status } : r
                )
              ),
          });
        });
        attempt++;
      }

      if (!succeeded) {
        setFailedReportIds((prev) => new Set(prev).add(reportId));
      }
      setLoadingReportIds((prev) => {
        const n = new Set(prev);
        n.delete(reportId);
        return n;
      });
      return succeeded;
    },
    [branding, toast]
  );

  const generateIndividual = async (keepLoading = false) => {
    if (files.length === 0) return;
    setIsLoading(true);
    setFailedReportIds(new Set());

    const newReports: ReportEntry[] = files.map((f) => ({
      id: `report-${f.id}`,
      label: f.label || f.fileName.replace(/\.(html|htm)$/i, ""),
      markdown: "",
    }));
    setReports(newReports);
    setActiveReportId(newReports[0].id);

    for (const f of files) {
      const reportId = `report-${f.id}`;
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      await generateSingleReport(reportId, f.extractedData, { firewallLabels: [label], centralEnrichment: f.centralEnrichment });
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
      return [
        ...without,
        {
          id: execId,
          label: "📋 Executive Summary",
          markdown: keepPlaceholder ? existing!.markdown : "",
        },
      ];
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
      files.length === 1
        ? files[0].extractedData
        : (mergedSections as unknown as ExtractedSections),
      { compliance: true, firewallLabels: labels }
    );

    setIsLoading(false);
  };

  const generateAll = async () => {
    if (files.length === 0) return;
    setIsLoading(true);
    setFailedReportIds(new Set());

    const newReports: ReportEntry[] = files.map((f) => ({
      id: `report-${f.id}`,
      label: f.label || f.fileName.replace(/\.(html|htm)$/i, ""),
      markdown: "",
    }));
    setReports(newReports);
    setActiveReportId(newReports[0].id);

    for (const f of files) {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      await generateSingleReport(`report-${f.id}`, f.extractedData, { firewallLabels: [label] });
      if (files.length > 1) await new Promise((r) => setTimeout(r, 2000));
    }

    if (files.length >= 2) {
      const execId = "report-executive";
      setReports((prev) => {
        const without = prev.filter((r) => r.id !== execId);
        return [...without, { id: execId, label: "📋 Executive Summary", markdown: "" }];
      });
      setActiveReportId(execId);
      await generateExecutive(true);
    }

    const complianceId = "report-compliance";
    const labels = files.map((f) => f.label || f.fileName.replace(/\.(html|htm)$/i, ""));
    const mergedSections: Record<string, ExtractedSections> = {};
    files.forEach((f) => {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      mergedSections[label] = f.extractedData;
    });
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== complianceId);
      return [...without, { id: complianceId, label: "🛡️ Compliance Evidence Pack", markdown: "" }];
    });
    setActiveReportId(complianceId);
    await generateSingleReport(
      complianceId,
      files.length === 1
        ? files[0].extractedData
        : (mergedSections as unknown as ExtractedSections),
      { compliance: true, firewallLabels: labels }
    );

    setIsLoading(false);
  };

  const handleRetry = useCallback(
    (reportId: string) => {
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
          files.length === 1
            ? files[0].extractedData
            : (mergedSections as unknown as ExtractedSections),
          { compliance: true, firewallLabels: labels }
        );
      } else {
        const file = files.find((f) => `report-${f.id}` === reportId);
        if (file) {
          const label = file.label || file.fileName.replace(/\.(html|htm)$/i, "");
          generateSingleReport(reportId, file.extractedData, { firewallLabels: [label] });
        }
      }
    },
    [files, generateSingleReport]
  );

  return {
    reports,
    setReports,
    activeReportId,
    setActiveReportId,
    isLoading,
    loadingReportIds,
    failedReportIds,
    generateIndividual,
    generateExecutive,
    generateCompliance,
    generateAll,
    handleRetry,
  };
}

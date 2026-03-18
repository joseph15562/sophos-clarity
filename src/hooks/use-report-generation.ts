import { useState, useCallback, useRef, useEffect } from "react";
import type { ReportEntry } from "@/components/DocumentPreview";
import type { BrandingData } from "@/components/BrandingSetup";
import type { ExtractedSections } from "@/lib/extract-sections";
import { streamConfigParse, type CentralEnrichment } from "@/lib/stream-ai";
import type { ParsedFile } from "@/types/parsed-file";
import { toast } from "sonner";
import { analyseConfig, type AnalysisResult, type Finding } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { getFileLabel } from "@/lib/utils";
import { REPORT_ID, reportIdForFile } from "@/constants/app";

const COVER_DISCLAIMER = "Results should be validated by a qualified security professional.";

/** Build branded cover page markdown for reports */
export function buildCoverPageMarkdown(branding: BrandingData): string {
  const lines: string[] = [];
  if (branding.logoUrl) {
    lines.push(`![Company Logo](${branding.logoUrl})`);
    lines.push("");
  }
  if (branding.customerName) {
    lines.push(`# ${branding.customerName}`);
    lines.push("");
  }
  lines.push(`**Date:** ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`);
  lines.push("");
  if (branding.preparedBy?.trim()) {
    lines.push(`**Prepared by:** ${branding.preparedBy.trim()}`);
    lines.push("");
  }
  lines.push(`*${COVER_DISCLAIMER}*`);
  if (branding.footerText?.trim()) {
    lines.push("");
    lines.push(`*${branding.footerText.trim()}*`);
  }
  return lines.join("\n");
}

/** Template-based executive one-pager markdown (no AI call) */
export function buildExecutiveOnePagerMarkdown(
  analysisResults: Record<string, AnalysisResult>,
  _branding: BrandingData,
  customerName: string
): string {
  const allFindings: Finding[] = Object.values(analysisResults).flatMap((r) => r.findings);
  const scores = Object.values(analysisResults).map((r) => computeRiskScore(r));
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((s, r) => s + r.overall, 0) / scores.length)
    : 0;
  const grade = avgScore >= 90 ? "A" : avgScore >= 75 ? "B" : avgScore >= 60 ? "C" : avgScore >= 40 ? "D" : "F";

  const severityOrder: Finding["severity"][] = ["critical", "high", "medium", "low", "info"];
  const sorted = [...allFindings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );
  const top5 = sorted.slice(0, 5);

  const lines: string[] = [];
  lines.push(`# Executive One-Pager${customerName ? ` — ${customerName}` : ""}`);
  lines.push("");
  lines.push(`**Overall Score:** ${avgScore}/100 | **Grade:** ${grade}`);
  lines.push("");
  lines.push("## Top 5 Risks");
  lines.push("");
  if (top5.length === 0) {
    lines.push("No findings identified.");
  } else {
    top5.forEach((f, i) => {
      lines.push(`${i + 1}. **${f.title}** — *${f.severity}*`);
    });
  }
  lines.push("");
  lines.push("## Recommended Next Steps");
  lines.push("");
  lines.push("1. Address critical and high severity findings first.");
  lines.push("2. Review and remediate the top 5 risks listed above.");
  lines.push("3. Schedule a follow-up assessment after remediation.");
  lines.push("");
  lines.push(`*${COVER_DISCLAIMER}*`);
  return lines.join("\n");
}

export type { ParsedFile } from "@/types/parsed-file";

export function useReportGeneration(files: ParsedFile[], branding: BrandingData) {
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

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
      if (!mountedRef.current) return;
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
          if (!mountedRef.current) return;
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
            onDelta: (text) => {
              if (!mountedRef.current) return;
              setReports((prev) =>
                prev.map((r) => {
                  if (r.id !== reportId) return r;
                  const cover = buildCoverPageMarkdown(branding);
                  const isFirstChunk = r.markdown === "";
                  const newContent = isFirstChunk ? cover + "\n\n---\n\n" + text : text;
                  return { ...r, markdown: r.markdown + newContent };
                })
              );
            },
            onDone: () => resolve(true),
            onError: (err) => {
              if (mountedRef.current) {
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
              }
              console.error(`Report ${reportId} attempt ${attempt + 1} failed:`, err);
              if (attempt >= MAX_RETRIES) {
                const isExecutive = reportId === REPORT_ID.EXECUTIVE;
                const description = isExecutive
                  ? `Executive summary uses data from all firewalls and often hits API limits. ${err} Try retry in a few minutes or use fewer configs.`
                  : `${err} — use the retry button to try again.`;
                toast.error(description);
              }
              resolve(false);
            },
            onStatus: (status) => {
              if (!mountedRef.current) return;
              setReports((prev) =>
                prev.map((r) =>
                  r.id === reportId ? { ...r, loadingStatus: status } : r
                )
              );
            },
          });
        });
        attempt++;
      }

      if (!mountedRef.current) return;
      if (!succeeded) {
        setFailedReportIds((prev) => new Set(prev).add(reportId));
      }
      if (!mountedRef.current) return succeeded;
      setLoadingReportIds((prev) => {
        const n = new Set(prev);
        n.delete(reportId);
        return n;
      });
      return succeeded;
    },
    [branding]
  );

  const generateIndividual = async (keepLoading = false) => {
    if (files.length === 0) return;
    setIsLoading(true);
    setFailedReportIds(new Set());

    const newReports: ReportEntry[] = files.map((f) => ({
      id: reportIdForFile(f.id),
      label: getFileLabel(f),
      markdown: "",
    }));
    setReports(newReports);
    setActiveReportId(newReports[0].id);

    for (const f of files) {
      const reportId = reportIdForFile(f.id);
      const label = getFileLabel(f);
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
      const label = getFileLabel(f);
      labels.push(label);
      mergedSections[label] = f.extractedData;
    });

    const execId = REPORT_ID.EXECUTIVE;
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

  const generateExecutiveOnePager = useCallback(() => {
    if (files.length === 0) return;
    const analysisResults: Record<string, AnalysisResult> = {};
    files.forEach((f) => {
      const label = getFileLabel(f);
      analysisResults[label] = analyseConfig(f.extractedData, {
        centralLinked: !!f.centralEnrichment,
      });
    });
    const customerName = branding.customerName || "Assessment";
    const body = buildExecutiveOnePagerMarkdown(analysisResults, branding, customerName);
    const cover = buildCoverPageMarkdown(branding);
    const fullMarkdown = cover + "\n\n---\n\n" + body;

    const execOnePagerId = REPORT_ID.EXECUTIVE_ONE_PAGER;
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== execOnePagerId);
      return [...without, { id: execOnePagerId, label: "📄 Executive One-Pager", markdown: fullMarkdown }];
    });
    setActiveReportId(execOnePagerId);
  }, [files, branding]);

  const generateCompliance = async () => {
    if (files.length === 0) return;
    setIsLoading(true);

    const mergedSections: Record<string, ExtractedSections> = {};
    const labels: string[] = [];
    files.forEach((f) => {
      const label = getFileLabel(f);
      labels.push(label);
      mergedSections[label] = f.extractedData;
    });

    const complianceId = REPORT_ID.COMPLIANCE;
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== complianceId);
      return [...without, { id: complianceId, label: "🛡️ Compliance Readiness Report", markdown: "" }];
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
      id: reportIdForFile(f.id),
      label: getFileLabel(f),
      markdown: "",
    }));
    setReports(newReports);
    setActiveReportId(newReports[0].id);

    for (const f of files) {
      const label = getFileLabel(f);
      await generateSingleReport(reportIdForFile(f.id), f.extractedData, { firewallLabels: [label] });
      if (files.length > 1) await new Promise((r) => setTimeout(r, 2000));
    }

    if (files.length >= 2) {
      const execId = REPORT_ID.EXECUTIVE;
      setReports((prev) => {
        const without = prev.filter((r) => r.id !== execId);
        return [...without, { id: execId, label: "📋 Executive Summary", markdown: "" }];
      });
      setActiveReportId(execId);
      await generateExecutive(true);
    }

    const complianceId = REPORT_ID.COMPLIANCE;
    const labels = files.map((f) => getFileLabel(f));
    const mergedSections: Record<string, ExtractedSections> = {};
    files.forEach((f) => {
      const label = getFileLabel(f);
      mergedSections[label] = f.extractedData;
    });
    setReports((prev) => {
      const without = prev.filter((r) => r.id !== complianceId);
      return [...without, { id: complianceId, label: "🛡️ Compliance Readiness Report", markdown: "" }];
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
      if (reportId === REPORT_ID.EXECUTIVE) {
        const mergedSections: Record<string, ExtractedSections> = {};
        const labels: string[] = [];
        files.forEach((f) => {
          const label = getFileLabel(f);
          labels.push(label);
          mergedSections[label] = f.extractedData;
        });
        generateSingleReport(reportId, mergedSections as unknown as ExtractedSections, {
          executive: true,
          firewallLabels: labels,
        });
      } else if (reportId === REPORT_ID.EXECUTIVE_ONE_PAGER) {
        generateExecutiveOnePager();
      } else if (reportId === REPORT_ID.COMPLIANCE) {
        const mergedSections: Record<string, ExtractedSections> = {};
        const labels: string[] = [];
        files.forEach((f) => {
          const label = getFileLabel(f);
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
        const file = files.find((f) => reportIdForFile(f.id) === reportId);
        if (file) {
          const label = file.label || file.fileName.replace(/\.(html|htm)$/i, "");
          generateSingleReport(reportId, file.extractedData, { firewallLabels: [label] });
        }
      }
    },
    [files, generateSingleReport, generateExecutiveOnePager]
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
    generateExecutiveOnePager,
    generateCompliance,
    generateAll,
    handleRetry,
  };
}

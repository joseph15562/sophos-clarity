import { useMemo } from "react";
import { analyseConfig, type AnalysisResult, type InspectionPosture } from "@/lib/analyse-config";
import type { ExtractedSections } from "@/lib/extract-sections";

type ParsedFile = { id: string; label: string; fileName: string; extractedData: ExtractedSections };

export function useFirewallAnalysis(files: ParsedFile[]) {
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

  const aggregatedPosture = useMemo<InspectionPosture>(() => {
    const agg: InspectionPosture = {
      totalWanRules: 0,
      withWebFilter: 0,
      withoutWebFilter: 0,
      withAppControl: 0,
      withIps: 0,
      withSslInspection: 0,
      wanRuleNames: [],
    };
    for (const r of Object.values(analysisResults)) {
      agg.totalWanRules += r.inspectionPosture.totalWanRules;
      agg.withWebFilter += r.inspectionPosture.withWebFilter;
      agg.withoutWebFilter += r.inspectionPosture.withoutWebFilter;
      agg.withAppControl += r.inspectionPosture.withAppControl;
      agg.withIps += r.inspectionPosture.withIps;
      agg.withSslInspection += r.inspectionPosture.withSslInspection;
    }
    return agg;
  }, [analysisResults]);

  return {
    analysisResults,
    totalFindings,
    totalRules,
    totalSections,
    totalPopulated,
    extractionPct,
    aggregatedPosture,
  };
}

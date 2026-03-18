import { useMemo } from "react";
import { analyseConfig, type AnalysisResult, type InspectionPosture } from "@/lib/analyse-config";
import type { ExtractedSections } from "@/lib/extract-sections";
import { getFileLabel } from "@/lib/utils";
import type { ParsedFile } from "@/types/parsed-file";

export function useFirewallAnalysis(files: ParsedFile[]) {
  const fileList = Array.isArray(files) ? files : [];
  const analysisResults = useMemo<Record<string, AnalysisResult>>(() => {
    const results: Record<string, AnalysisResult> = {};
    for (const f of fileList) {
      const label = getFileLabel(f);
      results[label] = analyseConfig(f.extractedData, {
        centralLinked: !!f.centralEnrichment,
      });
    }
    return results;
  }, [fileList]);

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
      totalWanRules: 0, enabledWanRules: 0, disabledWanRules: 0,
      webFilterableRules: 0, withWebFilter: 0, withoutWebFilter: 0,
      withAppControl: 0, withIps: 0, withSslInspection: 0,
      sslDecryptRules: 0, sslExclusionRules: 0, sslRules: [], sslUncoveredZones: [],
      wanRuleNames: [], totalDisabledRules: 0, dpiEngineEnabled: false,
    };
    for (const r of Object.values(analysisResults)) {
      const ip = r.inspectionPosture;
      agg.totalWanRules += ip.totalWanRules;
      agg.enabledWanRules += ip.enabledWanRules;
      agg.disabledWanRules += ip.disabledWanRules;
      agg.webFilterableRules += ip.webFilterableRules;
      agg.withWebFilter += ip.withWebFilter;
      agg.withoutWebFilter += ip.withoutWebFilter;
      agg.withAppControl += ip.withAppControl;
      agg.withIps += ip.withIps;
      agg.withSslInspection += ip.withSslInspection;
      agg.sslDecryptRules += ip.sslDecryptRules;
      agg.sslExclusionRules += ip.sslExclusionRules;
      agg.sslRules.push(...ip.sslRules);
      agg.sslUncoveredZones.push(...ip.sslUncoveredZones);
      agg.totalDisabledRules += ip.totalDisabledRules;
    }
    // DPI is active if any firewall has SSL/TLS Decrypt rules
    agg.dpiEngineEnabled = agg.sslDecryptRules > 0;
    agg.sslUncoveredZones = [...new Set(agg.sslUncoveredZones)];
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

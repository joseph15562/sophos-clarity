import { useMemo } from "react";
import { analyseConfig, type AnalysisResult, type InspectionPosture } from "@/lib/analyse-config";
import type { ExtractedSections } from "@/lib/extract-sections";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";

type ParsedFile = {
  id: string;
  label: string;
  fileName: string;
  extractedData: ExtractedSections;
  centralEnrichment?: { licences?: unknown } | null;
};

export type FirewallAnalysisHookOptions = {
  dpiExemptZones?: string[];
  dpiExemptNetworks?: string[];
  webFilterComplianceMode?: WebFilterComplianceMode;
  webFilterExemptRuleNames?: string[];
};

export function useFirewallAnalysis(files: ParsedFile[], hookOpts?: FirewallAnalysisHookOptions) {
  const analysisResults = useMemo<Record<string, AnalysisResult>>(() => {
    const results: Record<string, AnalysisResult> = {};
    for (const f of files) {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      results[label] = analyseConfig(f.extractedData, {
        centralLinked: !!f.centralEnrichment,
        dpiExemptZones: hookOpts?.dpiExemptZones,
        dpiExemptNetworks: hookOpts?.dpiExemptNetworks,
        webFilterComplianceMode: hookOpts?.webFilterComplianceMode,
        webFilterExemptRuleNames: hookOpts?.webFilterExemptRuleNames,
      });
    }
    return results;
  }, [files, hookOpts?.dpiExemptZones, hookOpts?.dpiExemptNetworks, hookOpts?.webFilterComplianceMode, hookOpts?.webFilterExemptRuleNames]);

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
      sslDecryptRules: 0, sslExclusionRules: 0, sslRules: [], sslUncoveredZones: [], sslUncoveredNetworks: [],
      allWanSourceZones: [], allWanSourceNetworks: [],
      wanRuleNames: [], wanWebServiceRuleNames: [], wanMissingWebFilterRuleNames: [], totalDisabledRules: 0, dpiEngineEnabled: false,
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
      agg.sslUncoveredNetworks.push(...ip.sslUncoveredNetworks);
      agg.allWanSourceZones.push(...ip.allWanSourceZones);
      agg.allWanSourceNetworks.push(...ip.allWanSourceNetworks);
      agg.wanRuleNames.push(...ip.wanRuleNames);
      agg.wanWebServiceRuleNames.push(...ip.wanWebServiceRuleNames);
      agg.wanMissingWebFilterRuleNames.push(...ip.wanMissingWebFilterRuleNames);
      agg.totalDisabledRules += ip.totalDisabledRules;
    }
    agg.dpiEngineEnabled = agg.sslDecryptRules > 0;
    agg.sslUncoveredZones = [...new Set(agg.sslUncoveredZones)];
    agg.sslUncoveredNetworks = [...new Set(agg.sslUncoveredNetworks)];
    agg.allWanSourceZones = [...new Set(agg.allWanSourceZones)];
    agg.allWanSourceNetworks = [...new Set(agg.allWanSourceNetworks)];
    agg.wanWebServiceRuleNames = [...new Set(agg.wanWebServiceRuleNames)];
    agg.wanMissingWebFilterRuleNames = [...new Set(agg.wanMissingWebFilterRuleNames)];
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

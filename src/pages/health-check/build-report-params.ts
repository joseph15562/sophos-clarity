import type { BrandingData } from "@/components/BrandingSetup";
import type { ParsedFile } from "@/hooks/use-report-generation";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import type { AnalysisResult } from "@/lib/analyse-config";
import type { BaselineResult } from "@/lib/policy-baselines";
import {
  computeSophosBPScore,
  type LicenceSelection,
  type SophosBPScore,
} from "@/lib/sophos-licence";
import {
  healthCheckFirewallLabel,
  loadSeHealthCheckBpOverrides,
  seCentralAutoForLabel,
} from "@/lib/se-health-check-bp-v2";

/** Payload for SE Health Check PDF/HTML/ZIP exports (aligned with `SEHealthCheckReportParams` in `se-health-check-report-html-v2`). */
export interface HealthCheckReportParams {
  labels: string[];
  files: ParsedFile[];
  analysisResults: Record<string, AnalysisResult>;
  baselineResults: Record<string, BaselineResult>;
  bpByLabel: Record<string, SophosBPScore>;
  licence: LicenceSelection;
  customerName: string;
  preparedFor?: string;
  preparedBy: string;
  dpiExemptZones: string[];
  dpiExemptNetworks: string[];
  webFilterComplianceMode: WebFilterComplianceMode;
  webFilterExemptRuleNames: string[];
  seAckMdrThreatFeeds: boolean;
  seAckNdrEssentials: boolean;
  seAckDnsProtection: boolean;
  seExcludeSecurityHeartbeat: boolean;
  centralValidated: boolean;
  generatedAt: Date;
  appVersion?: string;
  seNotes?: string;
}

export function validateRequiredFields(fields: {
  customerName: string;
  customerEmail: string;
  preparedFor: string;
}): string[] {
  const missing: string[] = [];
  if (!fields.customerName.trim()) missing.push("Customer Name");
  if (!fields.customerEmail.trim()) missing.push("Customer Email");
  if (!fields.preparedFor.trim()) missing.push("Prepared For");
  return missing;
}

export function buildHealthCheckReportParams(deps: {
  files: ParsedFile[];
  analysisResults: Record<string, AnalysisResult>;
  baselineResults: Record<string, BaselineResult>;
  licence: LicenceSelection;
  customerName: string;
  preparedFor: string;
  preparedBy: string;
  dpiExemptZones: string[];
  dpiExemptNetworks: string[];
  webFilterComplianceMode: WebFilterComplianceMode;
  webFilterExemptRuleNames: string[];
  seAckMdrThreatFeeds: boolean;
  seAckNdrEssentials: boolean;
  seAckDnsProtection: boolean;
  seExcludeSecurityHeartbeat: boolean;
  centralValidated: boolean;
  seCentralHaLabels: Set<string>;
  seThreatResponseAck: Set<string> | undefined;
  seExcludedBpChecks: Set<string> | undefined;
  seNotes: string;
  generatedAt?: Date;
}): { reportParams: HealthCheckReportParams; branding: BrandingData; labels: string[] } {
  const labels = deps.files
    .map((f) => healthCheckFirewallLabel(f))
    .filter((l) => deps.analysisResults[l]);

  const manualOverrides = loadSeHealthCheckBpOverrides();
  const bpByLabel: Record<string, SophosBPScore> = {};
  for (const label of labels) {
    const ar = deps.analysisResults[label];
    if (ar) {
      const centralAuto = seCentralAutoForLabel(deps.centralValidated, label, deps.seCentralHaLabels);
      bpByLabel[label] = computeSophosBPScore(
        ar,
        deps.licence,
        manualOverrides,
        centralAuto,
        deps.seThreatResponseAck,
        deps.seExcludedBpChecks,
      );
    }
  }

  const reportParams: HealthCheckReportParams = {
    labels,
    files: deps.files,
    analysisResults: deps.analysisResults,
    baselineResults: deps.baselineResults,
    bpByLabel,
    licence: deps.licence,
    customerName: deps.customerName,
    preparedFor: deps.preparedFor.trim() || deps.customerName.trim() || undefined,
    preparedBy: deps.preparedBy,
    dpiExemptZones: deps.dpiExemptZones,
    dpiExemptNetworks: deps.dpiExemptNetworks,
    webFilterComplianceMode: deps.webFilterComplianceMode,
    webFilterExemptRuleNames: deps.webFilterExemptRuleNames,
    seAckMdrThreatFeeds: deps.seAckMdrThreatFeeds,
    seAckNdrEssentials: deps.seAckNdrEssentials,
    seAckDnsProtection: deps.seAckDnsProtection,
    seExcludeSecurityHeartbeat: deps.seExcludeSecurityHeartbeat,
    centralValidated: deps.centralValidated,
    generatedAt: deps.generatedAt ?? new Date(),
    appVersion:
      typeof import.meta.env.VITE_APP_VERSION === "string" ? import.meta.env.VITE_APP_VERSION : undefined,
    seNotes: deps.seNotes.trim() || undefined,
  };

  const branding: BrandingData = {
    companyName: "Sophos FireComply",
    customerName: deps.customerName.trim(),
    logoUrl: null,
    environment: "",
    country: "",
    selectedFrameworks: [],
    preparedBy: deps.preparedBy,
    confidential: true,
  };

  return { reportParams, branding, labels };
}

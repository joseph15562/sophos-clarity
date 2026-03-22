/**
 * Persisted SE Health Check session for reopen + HTML/PDF export from history.
 * Stored under `summary_json.snapshot` on `se_health_checks`.
 */

import type { BrandingData } from "@/components/BrandingSetup";
import type { ParsedFile } from "@/hooks/use-report-generation";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import type { AnalysisResult } from "@/lib/analyse-config";
import { analyseConfig } from "@/lib/analyse-config";
import type { ExtractedSections } from "@/lib/extract-sections";
import { evaluateBaseline, BASELINE_TEMPLATES } from "@/lib/policy-baselines";
import type { LicenceSelection, SophosBPScore } from "@/lib/sophos-licence";
import { computeSophosBPScore } from "@/lib/sophos-licence";
import type { SEHealthCheckReportParams } from "@/lib/se-health-check-report-html-v2";
import {
  buildSeHeartbeatExclusionSet,
  buildSeThreatResponseAckSet,
  seCentralAutoForLabel,
} from "@/lib/se-health-check-bp-v2";

export const SE_HEALTH_CHECK_SNAPSHOT_VERSION = 1 as const;

export type SeHealthCheckSnapshotV1 = {
  version: typeof SE_HEALTH_CHECK_SNAPSHOT_VERSION;
  customerName: string;
  files: Array<{
    id: string;
    label: string;
    fileName: string;
    extractedData: ExtractedSections;
    serialNumber?: string;
    agentHostname?: string;
    hardwareModel?: string;
    source?: ParsedFile["source"];
  }>;
  licence: LicenceSelection;
  dpiExemptZones: string[];
  dpiExemptNetworks: string[];
  webFilterComplianceMode: WebFilterComplianceMode;
  webFilterExemptRuleNames: string[];
  seMdrThreatFeedsAck: boolean;
  seNdrEssentialsAck: boolean;
  seDnsProtectionAck?: boolean;
  seExcludeSecurityHeartbeat: boolean;
  /** Preserves Central-linked BP auto-checks from the saved session (no live API). */
  replayCentralLinked: boolean;
  seCentralHaLabels: string[];
  manualBpOverrideIds: string[];
};

const SOPHOS_BP_TEMPLATE = BASELINE_TEMPLATES.find((t) => t.id === "sophos-best-practice") ?? BASELINE_TEMPLATES[0];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function parseSeHealthCheckSnapshotFromSummaryJson(summaryJson: unknown): SeHealthCheckSnapshotV1 | null {
  if (!isRecord(summaryJson)) return null;
  const snap = summaryJson.snapshot;
  if (!isRecord(snap)) return null;
  if (snap.version !== SE_HEALTH_CHECK_SNAPSHOT_VERSION) return null;
  if (!Array.isArray(snap.files) || snap.files.length === 0) return null;
  if (!isRecord(snap.licence)) return null;
  const firstFile = snap.files[0];
  if (!isRecord(firstFile) || firstFile.extractedData == null || typeof firstFile.extractedData !== "object") {
    return null;
  }
  return snap as unknown as SeHealthCheckSnapshotV1;
}

export function snapshotFilesToParsedFiles(files: SeHealthCheckSnapshotV1["files"]): ParsedFile[] {
  return files.map((f) => ({
    id: f.id,
    label: f.label,
    fileName: f.fileName,
    content: "",
    extractedData: f.extractedData,
    serialNumber: f.serialNumber,
    agentHostname: f.agentHostname,
    hardwareModel: f.hardwareModel,
    source: f.source,
  }));
}

export function buildAnalysisResultsFromSnapshot(snapshot: SeHealthCheckSnapshotV1): Record<string, AnalysisResult> {
  const out: Record<string, AnalysisResult> = {};
  const centralLinked = snapshot.replayCentralLinked;
  for (const f of snapshot.files) {
    const label = f.label || f.fileName.replace(/\.(html|htm|xml)$/i, "");
    out[label] = analyseConfig(f.extractedData, {
      centralLinked,
      dpiExemptZones: snapshot.dpiExemptZones,
      dpiExemptNetworks: snapshot.dpiExemptNetworks,
      webFilterComplianceMode: snapshot.webFilterComplianceMode,
      webFilterExemptRuleNames: snapshot.webFilterExemptRuleNames,
    });
  }
  return out;
}

export function buildSeHealthCheckExportBundle(
  snapshot: SeHealthCheckSnapshotV1,
  preparedBy: string,
  generatedAt: Date = new Date(),
): { reportParams: SEHealthCheckReportParams; branding: BrandingData } {
  const files = snapshotFilesToParsedFiles(snapshot.files);
  const analysisResults = buildAnalysisResultsFromSnapshot(snapshot);
  const labels = snapshot.files.map((f) => f.label || f.fileName.replace(/\.(html|htm|xml)$/i, ""));
  const baselineResults: Record<string, ReturnType<typeof evaluateBaseline>> = {};
  for (const label of labels) {
    const ar = analysisResults[label];
    if (ar) baselineResults[label] = evaluateBaseline(SOPHOS_BP_TEMPLATE, ar);
  }
  const manualOverrides = new Set(snapshot.manualBpOverrideIds);
  const haLabels = new Set(snapshot.seCentralHaLabels);
  const threatAck = buildSeThreatResponseAckSet(snapshot.seMdrThreatFeedsAck, snapshot.seNdrEssentialsAck, snapshot.seDnsProtectionAck ?? false);
  const excluded = buildSeHeartbeatExclusionSet(snapshot.seExcludeSecurityHeartbeat);
  const bpByLabel: Record<string, SophosBPScore> = {};
  for (const label of labels) {
    const ar = analysisResults[label];
    if (ar) {
      const centralAuto = seCentralAutoForLabel(snapshot.replayCentralLinked, label, haLabels);
      bpByLabel[label] = computeSophosBPScore(
        ar,
        snapshot.licence,
        manualOverrides,
        centralAuto,
        threatAck,
        excluded,
      );
    }
  }
  const customerName = snapshot.customerName.trim();
  const reportParams: SEHealthCheckReportParams = {
    labels,
    files,
    analysisResults,
    baselineResults,
    bpByLabel,
    licence: snapshot.licence,
    customerName,
    preparedFor: customerName || undefined,
    preparedBy: preparedBy.trim() || "Sales Engineer",
    dpiExemptZones: snapshot.dpiExemptZones,
    dpiExemptNetworks: snapshot.dpiExemptNetworks,
    webFilterComplianceMode: snapshot.webFilterComplianceMode,
    webFilterExemptRuleNames: snapshot.webFilterExemptRuleNames,
    seAckMdrThreatFeeds: snapshot.seMdrThreatFeedsAck,
    seAckNdrEssentials: snapshot.seNdrEssentialsAck,
    seExcludeSecurityHeartbeat: snapshot.seExcludeSecurityHeartbeat,
    centralValidated: snapshot.replayCentralLinked,
    generatedAt,
    appVersion: typeof import.meta.env.VITE_APP_VERSION === "string" ? import.meta.env.VITE_APP_VERSION : undefined,
  };
  const branding: BrandingData = {
    companyName: "Sophos FireComply",
    customerName,
    logoUrl: null,
    environment: "",
    country: "",
    selectedFrameworks: [],
    preparedBy: preparedBy.trim() || "",
    confidential: true,
  };
  return { reportParams, branding };
}

export function buildSeHealthCheckSnapshotV1(args: {
  customerName: string;
  files: ParsedFile[];
  licence: LicenceSelection;
  dpiExemptZones: string[];
  dpiExemptNetworks: string[];
  webFilterComplianceMode: WebFilterComplianceMode;
  webFilterExemptRuleNames: string[];
  seMdrThreatFeedsAck: boolean;
  seNdrEssentialsAck: boolean;
  seDnsProtectionAck?: boolean;
  seExcludeSecurityHeartbeat: boolean;
  replayCentralLinked: boolean;
  seCentralHaLabels: Set<string>;
  manualBpOverrideIds: string[];
}): SeHealthCheckSnapshotV1 {
  return {
    version: SE_HEALTH_CHECK_SNAPSHOT_VERSION,
    customerName: args.customerName,
    files: args.files.map((f) => ({
      id: f.id,
      label: f.label,
      fileName: f.fileName,
      extractedData: f.extractedData,
      serialNumber: f.serialNumber,
      agentHostname: f.agentHostname,
      hardwareModel: f.hardwareModel,
      source: f.source,
    })),
    licence: args.licence,
    dpiExemptZones: [...args.dpiExemptZones],
    dpiExemptNetworks: [...args.dpiExemptNetworks],
    webFilterComplianceMode: args.webFilterComplianceMode,
    webFilterExemptRuleNames: [...args.webFilterExemptRuleNames],
    seMdrThreatFeedsAck: args.seMdrThreatFeedsAck,
    seNdrEssentialsAck: args.seNdrEssentialsAck,
    seDnsProtectionAck: args.seDnsProtectionAck ?? false,
    seExcludeSecurityHeartbeat: args.seExcludeSecurityHeartbeat,
    replayCentralLinked: args.replayCentralLinked,
    seCentralHaLabels: [...args.seCentralHaLabels],
    manualBpOverrideIds: [...args.manualBpOverrideIds],
  };
}

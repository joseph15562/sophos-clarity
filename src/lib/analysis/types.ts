/**
 * Shared types for deterministic config analysis.
 * Re-exported from analyse-config.ts for backward compatibility.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface ConfigStats {
  totalRules: number;
  totalSections: number;
  totalHosts: number;
  totalNatRules: number;
  interfaces: number;
  populatedSections: number;
  emptySections: number;
  sectionNames: string[];
}

export interface SslTlsRule {
  name: string;
  action: "decrypt" | "exclude";
  sourceZones: string[];
  destZones: string[];
  sourceNetworks: string[];
  destNetworks: string[];
  enabled: boolean;
}

export interface InspectionPosture {
  totalWanRules: number;
  enabledWanRules: number;
  disabledWanRules: number;
  webFilterableRules: number;
  withWebFilter: number;
  withoutWebFilter: number;
  withAppControl: number;
  withIps: number;
  withSslInspection: number;
  sslDecryptRules: number;
  sslExclusionRules: number;
  sslRules: SslTlsRule[];
  sslUncoveredZones: string[];
  sslUncoveredNetworks: string[];
  allWanSourceZones: string[];
  allWanSourceNetworks: string[];
  wanRuleNames: string[];
  /** Enabled WAN rules with HTTP/HTTPS/ANY service — candidates for web filter checks / exemptions */
  wanWebServiceRuleNames: string[];
  /** Enabled WAN + web-capable service rules with no web filter applied (UI scope for exemptions) */
  wanMissingWebFilterRuleNames: string[];
  totalDisabledRules: number;
  dpiEngineEnabled: boolean;
}

export type Confidence = "high" | "medium" | "low";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  section: string;
  remediation?: string;
  confidence?: Confidence;
  evidence?: string;
}

export interface AtpStatus {
  enabled: boolean;
  policy: string;
}

export interface ThreatStatus {
  firmwareVersion: string;
  atp: { enabled: boolean; policy: string; inspectContent: string } | null;
  mdr: { enabled: boolean; policy: string; connected: boolean } | null;
  ndr: {
    enabled: boolean;
    interfaces: string[];
    dataCenter: string;
    minThreatScore: string;
    iocCount?: number;
  } | null;
  thirdPartyFeeds: Array<{
    name: string;
    syncStatus: string;
    lastSync?: string;
  }> | null;
  collectedAt: string;
}

export interface AnalysisResult {
  stats: ConfigStats;
  findings: Finding[];
  inspectionPosture: InspectionPosture;
  ruleColumns?: string[];
  hostname?: string;
  atpStatus?: AtpStatus;
  threatStatus?: ThreatStatus;
}

export type WebFilterComplianceMode = "strict" | "informational";

export interface AnalyseOptions {
  centralLinked?: boolean;
  dpiExemptZones?: string[];
  dpiExemptNetworks?: string[];
  /** Default strict: WAN web-filter gaps are high/critical severity. Informational lowers severity for scoped assessments. */
  webFilterComplianceMode?: WebFilterComplianceMode;
  /** Rule names excluded from the "missing web filtering" WAN check (MSP-agreed scope). */
  webFilterExemptRuleNames?: string[];
}

const SEVERITY_ICON: Record<Severity, string> = {
  critical: "\u{1F534}",
  high: "\u{1F7E0}",
  medium: "\u{1F7E1}",
  low: "\u{1F7E2}",
  info: "\u{1F535}",
};

export function severityIcon(s: Severity): string {
  return SEVERITY_ICON[s];
}

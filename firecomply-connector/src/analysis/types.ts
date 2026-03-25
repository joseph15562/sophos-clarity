/**
 * Shared types for config analysis.
 * Synced from the web app (src/lib/analysis/types.ts + src/lib/extract-sections.ts).
 */

// --- Section data types (from extract-sections.ts) ---

export interface DetailBlock {
  title: string;
  fields: Record<string, string>;
}

export interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

export interface SectionData {
  tables: TableData[];
  text: string;
  details: DetailBlock[];
}

export interface ExtractedSections {
  [sectionName: string]: SectionData;
}

// --- Analysis types (from analysis/types.ts) ---

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
  wanWebServiceRuleNames: string[];
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
  managementIp?: string;
  atpStatus?: AtpStatus;
  threatStatus?: ThreatStatus;
}

export type WebFilterComplianceMode = "strict" | "informational";

export interface AnalyseOptions {
  centralLinked?: boolean;
  dpiExemptZones?: string[];
  dpiExemptNetworks?: string[];
  webFilterComplianceMode?: WebFilterComplianceMode;
  webFilterExemptRuleNames?: string[];
}

export function severityIcon(s: Severity): string {
  const icons: Record<Severity, string> = {
    critical: "\u{1F534}",
    high: "\u{1F7E0}",
    medium: "\u{1F7E1}",
    low: "\u{1F7E2}",
    info: "\u{1F535}",
  };
  return icons[s];
}

// --- Risk score types (kept here for connector convenience) ---

export interface CategoryScore {
  label: string;
  score: number;
  maxScore: number;
  pct: number;
  details: string;
}

export interface RiskScoreResult {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: CategoryScore[];
}

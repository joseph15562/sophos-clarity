/**
 * Shared types for the analysis module.
 * Mirrors the web app types from src/lib/analyse-config.ts and src/lib/risk-score.ts.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Confidence = "high" | "medium" | "low";

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
  wanRuleNames: string[];
  totalDisabledRules: number;
  dpiEngineEnabled: boolean;
}

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

export interface AnalysisResult {
  stats: ConfigStats;
  findings: Finding[];
  inspectionPosture: InspectionPosture;
  ruleColumns?: string[];
  hostname?: string;
  managementIp?: string;
  atpStatus?: AtpStatus;
}

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

export interface ExtractedSections {
  [sectionName: string]: {
    tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
    text: string;
    details: Array<{ title: string; fields: Record<string, string> }>;
  };
}

import { ApiClient } from "./client";
import type { AnalysisResult, RiskScoreResult } from "../analysis/types";
import type { ThreatStatus } from "../firewall/threat-status";

export interface SubmissionPayload {
  customer_name: string;
  firewall_label: string;
  firmware_version: string;
  agent_version: string;
  overall_score: number;
  overall_grade: string;
  firewalls: Array<{
    label: string;
    riskScore: RiskScoreResult;
    totalRules: number;
    totalFindings: number;
  }>;
  findings_summary: Array<{
    title: string;
    severity: string;
    confidence?: string;
  }>;
  finding_titles: string[];
  threat_status: ThreatStatus | null;
  full_analysis: AnalysisResult | null;
}

export interface SubmitResponse {
  ok: boolean;
  drift?: {
    new: string[];
    fixed: string[];
    regressed: string[];
  };
}

export async function submitAssessment(
  client: ApiClient,
  payload: SubmissionPayload
): Promise<SubmitResponse> {
  return client.post<SubmitResponse>("/api/agent/submit", payload);
}

export function buildPayload(
  customerName: string,
  firewallLabel: string,
  firmwareVersion: string,
  agentVersion: string,
  analysis: AnalysisResult,
  riskScore: RiskScoreResult,
  threatStatus: ThreatStatus | null
): SubmissionPayload {
  return {
    customer_name: customerName,
    firewall_label: firewallLabel,
    firmware_version: firmwareVersion,
    agent_version: agentVersion,
    overall_score: riskScore.overall,
    overall_grade: riskScore.grade,
    firewalls: [
      {
        label: firewallLabel,
        riskScore,
        totalRules: analysis.stats.totalRules,
        totalFindings: analysis.findings.length,
      },
    ],
    findings_summary: analysis.findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      confidence: f.confidence,
    })),
    finding_titles: analysis.findings.map((f) => f.title),
    threat_status: threatStatus,
    full_analysis: analysis,
  };
}

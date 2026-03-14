/**
 * Alert rules for email/webhook notifications.
 * Client-side scaffold — rules stored in localStorage until Supabase tables exist.
 */

import type { AnalysisResult } from "./analyse-config";
import { computeRiskScore } from "./risk-score";

export type AlertEventType =
  | "licence_expiry_warning"
  | "score_drop"
  | "new_critical_finding"
  | "central_disconnected";

export interface AlertRule {
  id: string;
  eventType: AlertEventType;
  channel: "email" | "webhook";
  config: { email?: string; webhookUrl?: string };
  enabled: boolean;
}

const STORAGE_KEY = "firecomply_alert_rules";

export function saveAlertRules(rules: AlertRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    console.warn("[alert-rules] saveAlertRules failed:", e);
  }
}

export function loadAlertRules(): AlertRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is AlertRule =>
        r &&
        typeof r === "object" &&
        typeof r.id === "string" &&
        typeof r.eventType === "string" &&
        (r.channel === "email" || r.channel === "webhook") &&
        typeof r.config === "object" &&
        typeof r.enabled === "boolean"
    );
  } catch {
    return [];
  }
}

export interface AlertCheckContext {
  /** Licence expiry: any licence expiring within 30 days */
  licenceExpiringSoon?: boolean;
  /** Central connection status */
  centralConnected?: boolean;
}

/**
 * Check which alert conditions are triggered (logic only, no actual sending).
 * @param analysisResults - Current analysis results
 * @param previousScore - Previous overall risk score (for score_drop)
 * @param context - Optional context for licence_expiry_warning and central_disconnected
 */
export function checkAlertConditions(
  analysisResults: Record<string, AnalysisResult>,
  previousScore?: number,
  context?: AlertCheckContext
): AlertEventType[] {
  const triggered: AlertEventType[] = [];

  if (Object.keys(analysisResults).length === 0) return triggered;

  const scores = Object.values(analysisResults).map((r) => computeRiskScore(r));
  const currentScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, s) => a + s.overall, 0) / scores.length)
      : undefined;

  if (currentScore != null && previousScore != null && currentScore < previousScore) {
    triggered.push("score_drop");
  }

  const hasCritical = Object.values(analysisResults).some((r) =>
    r.findings.some((f) => f.severity === "critical")
  );
  if (hasCritical) {
    triggered.push("new_critical_finding");
  }

  if (context?.licenceExpiringSoon === true) {
    triggered.push("licence_expiry_warning");
  }

  if (context?.centralConnected === false) {
    triggered.push("central_disconnected");
  }

  return triggered;
}

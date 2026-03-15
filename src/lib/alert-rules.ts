/**
 * Alert rules for email/webhook notifications.
 * Uses Supabase when authenticated, falls back to localStorage for guests.
 */

import type { AnalysisResult } from "./analyse-config";
import { computeRiskScore } from "./risk-score";
import { supabase } from "@/integrations/supabase/client";

export type AlertEventType =
  | "licence_expiry_warning"
  | "score_drop"
  | "new_critical_finding"
  | "central_disconnected"
  | "agent_drift_detected"
  | "agent_offline";

export interface AlertRule {
  id: string;
  eventType: AlertEventType;
  channel: "email" | "webhook";
  config: { email?: string; webhookUrl?: string };
  enabled: boolean;
}

const STORAGE_KEY = "firecomply_alert_rules";

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

function toAlertRule(row: { id: string; event_type: string; channel: string; config: unknown; enabled: boolean }): AlertRule {
  const cfg = (row.config && typeof row.config === "object" ? row.config : {}) as AlertRule["config"];
  return {
    id: row.id,
    eventType: row.event_type as AlertEventType,
    channel: row.channel as "email" | "webhook",
    config: cfg,
    enabled: row.enabled,
  };
}

export async function saveAlertRules(rules: AlertRule[]): Promise<void> {
  const orgId = await getOrgId();
  if (orgId) {
    const { data: existing } = await supabase
      .from("alert_rules")
      .select("id")
      .eq("org_id", orgId);
    const existingIds = new Set((existing ?? []).map((r) => r.id));
    const ruleIds = new Set(rules.map((r) => r.id));

    const toDelete = [...existingIds].filter((id) => !ruleIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("alert_rules").delete().eq("org_id", orgId).in("id", toDelete);
    }

    const toUpsert = rules.map((r) => ({
      id: r.id,
      org_id: orgId,
      event_type: r.eventType,
      channel: r.channel,
      config: r.config as Record<string, unknown>,
      enabled: r.enabled,
    }));
    if (toUpsert.length > 0) {
      const { error } = await supabase.from("alert_rules").upsert(toUpsert);
      if (error) console.warn("[alert-rules] Supabase upsert failed", error.message);
      else return;
    }
    return;
  }

  // localStorage fallback
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    console.warn("[alert-rules] saveAlertRules failed:", e);
  }
}

export async function loadAlertRules(): Promise<AlertRule[]> {
  const orgId = await getOrgId();
  if (orgId) {
    const { data } = await supabase
      .from("alert_rules")
      .select("id, event_type, channel, config, enabled")
      .eq("org_id", orgId);
    if (data && data.length > 0) {
      return data.map(toAlertRule);
    }
  }

  // localStorage fallback
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
  licenceExpiringSoon?: boolean;
  centralConnected?: boolean;
  agentDriftDetected?: boolean;
  agentOffline?: boolean;
}

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

  if (context?.agentDriftDetected === true) {
    triggered.push("agent_drift_detected");
  }

  if (context?.agentOffline === true) {
    triggered.push("agent_offline");
  }

  return triggered;
}

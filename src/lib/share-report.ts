/**
 * Shared reports — uses Supabase when authenticated, falls back to localStorage for guests.
 */

import { supabase } from "@/integrations/supabase/client";

export interface SharedReport {
  token: string;
  markdown: string;
  customerName: string;
  expiresAt: string;
  createdAt: string;
}

const STORAGE_PREFIX = "sophos-shared-report:";

export function generateShareToken(): string {
  return crypto.randomUUID();
}

async function getOrgAndUser(): Promise<{ orgId: string; userId: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { orgId: data.org_id, userId: user.id };
}

export async function saveSharedReport(
  token: string,
  reportMarkdown: string,
  customerName: string,
  expiresInDays = 7
): Promise<SharedReport> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const report: SharedReport = {
    token,
    markdown: reportMarkdown,
    customerName,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };

  const ctx = await getOrgAndUser();
  if (ctx) {
    const { error } = await supabase.from("shared_reports").insert({
      org_id: ctx.orgId,
      share_token: token,
      markdown: reportMarkdown,
      customer_name: customerName,
      created_by: ctx.userId,
      expires_at: expiresAt.toISOString(),
    });
    if (!error) return report;
    console.warn("[share-report] Supabase insert failed, falling back to localStorage", error.message);
  }

  // localStorage fallback
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify(report));
  } catch (e) {
    console.warn("[share-report] localStorage set failed", e);
  }

  return report;
}

export async function loadSharedReport(token: string): Promise<SharedReport | null> {
  // Try Edge Function first (public access, no auth required for recipients)
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/shared/${token}`;
    const res = await fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        token: data.share_token,
        markdown: data.markdown,
        customerName: data.customer_name,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
      };
    }
    // 404 or 410 — fall through to localStorage
  } catch {
    // Network error — fall through to localStorage
  }

  // localStorage fallback
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${token}`);
    if (!raw) return null;
    const report = JSON.parse(raw) as SharedReport;
    const expiresAt = new Date(report.expiresAt);
    if (expiresAt <= new Date()) return null;
    return report;
  } catch {
    return null;
  }
}

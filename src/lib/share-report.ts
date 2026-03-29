/**
 * Shared reports must be persisted server-side.
 * Public links should never silently degrade to browser-local storage.
 */

import { supabase } from "@/integrations/supabase/client";

export interface SharedReport {
  token: string;
  markdown: string;
  customerName: string;
  expiresAt: string;
  createdAt: string;
  /** When false, shared link is view-only (no export/download). */
  allowDownload?: boolean;
  /** Optional note from the advisor; shown on the shared report page. */
  advisorNotes?: string;
}

export function generateShareToken(): string {
  return crypto.randomUUID();
}

async function getOrgAndUser(): Promise<{ orgId: string; userId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  expiresInDays = 7,
  allowDownload = true,
  advisorNotes?: string,
): Promise<SharedReport> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  const notes = advisorNotes?.trim() || undefined;

  const report: SharedReport = {
    token,
    markdown: reportMarkdown,
    customerName,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    allowDownload,
    advisorNotes: notes,
  };

  const ctx = await getOrgAndUser();
  if (!ctx) {
    throw new Error("Sign in to create a share link.");
  }

  const { error } = await supabase.from("shared_reports").insert({
    org_id: ctx.orgId,
    share_token: token,
    markdown: reportMarkdown,
    customer_name: customerName,
    created_by: ctx.userId,
    expires_at: expiresAt.toISOString(),
    allow_download: allowDownload,
    advisor_notes: notes ?? null,
  } as Record<string, unknown>);

  if (error) {
    throw new Error(`Unable to publish share link: ${error.message}`);
  }

  return report;
}

export type SharedReportLoadFailure = "not_found" | "expired" | "server_error" | "network";

export type SharedReportLoadResult =
  | { ok: true; report: SharedReport }
  | { ok: false; reason: SharedReportLoadFailure };

export async function loadSharedReport(token: string): Promise<SharedReportLoadResult> {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-public/shared/${token}`;
    const res = await fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    });
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (res.status === 410) return { ok: false, reason: "expired" };
    if (!res.ok) return { ok: false, reason: "server_error" };
    const data = await res.json();
    return {
      ok: true,
      report: {
        token: data.share_token,
        markdown: data.markdown,
        customerName: data.customer_name,
        expiresAt: data.expires_at,
        createdAt: data.created_at,
        allowDownload: data.allow_download !== false,
        advisorNotes:
          typeof data.advisor_notes === "string" && data.advisor_notes.trim()
            ? data.advisor_notes
            : undefined,
      },
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}

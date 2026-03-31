import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";

export async function fetchOrganisationCompanyLogo(
  orgId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const { data, error } = await supabaseWithAbort(
    supabase.from("organisations").select("report_template").eq("id", orgId).single(),
    signal,
  );
  if (error) throw error;
  const rt = (data as { report_template?: Record<string, unknown> } | null)?.report_template;
  return (rt?.company_logo as string) ?? null;
}

export async function updateOrganisationCompanyLogo(
  orgId: string,
  dataUrl: string | null,
  signal?: AbortSignal,
): Promise<void> {
  const { data, error: selErr } = await supabaseWithAbort(
    supabase.from("organisations").select("report_template").eq("id", orgId).single(),
    signal,
  );
  if (selErr) throw selErr;
  const existing = ((data as { report_template?: Record<string, unknown> } | null)
    ?.report_template ?? {}) as Record<string, unknown>;
  const updated = { ...existing, company_logo: dataUrl };
  const { error: upErr } = await supabaseWithAbort(
    supabase.from("organisations").update({ report_template: updated }).eq("id", orgId),
    signal,
  );
  if (upErr) throw upErr;
}

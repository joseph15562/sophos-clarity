import { supabase } from "@/integrations/supabase/client";

/** PortalConfigurator save row shape (matches DB insert/update). */
export type PortalConfigSaveRow = {
  org_id: string;
  slug: string | null;
  tenant_name: string | null;
  logo_url: string | null;
  company_name: string | null;
  accent_color: string;
  welcome_message: string | null;
  sla_info: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  footer_text: string | null;
  visible_sections: string[];
  show_branding: boolean;
};

export async function savePortalConfigRow(opts: {
  id?: string;
  row: PortalConfigSaveRow;
}): Promise<{ newId?: string }> {
  const { id, row } = opts;
  if (id) {
    const { error } = await supabase.from("portal_config").update(row).eq("id", id);
    if (error) throw error;
    return {};
  }
  const { data, error } = await supabase.from("portal_config").insert(row).select("id").single();
  if (error) throw error;
  return { newId: data.id as string };
}

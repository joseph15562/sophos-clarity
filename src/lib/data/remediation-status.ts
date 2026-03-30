import { supabase } from "@/integrations/supabase/client";

export type RemediationDeltaPayload = {
  orgId: string;
  customerHash: string;
  added: string[];
  removed: string[];
};

export async function persistRemediationDelta(payload: RemediationDeltaPayload): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (payload.added.length > 0) {
    const { error } = await supabase.from("remediation_status").upsert(
      payload.added.map((playbook_id) => ({
        org_id: payload.orgId,
        playbook_id,
        customer_hash: payload.customerHash,
        completed_by: user?.id ?? null,
      })),
      { onConflict: "org_id,customer_hash,playbook_id" },
    );
    if (error) throw error;
  }
  if (payload.removed.length > 0) {
    const { error } = await supabase
      .from("remediation_status")
      .delete()
      .eq("org_id", payload.orgId)
      .eq("customer_hash", payload.customerHash)
      .in("playbook_id", payload.removed);
    if (error) throw error;
  }
}

export async function setPlaybookRemediationRow(opts: {
  orgId: string;
  playbookId: string;
  customerHash: string;
  adding: boolean;
}): Promise<void> {
  if (opts.adding) {
    const { error } = await supabase.from("remediation_status").upsert(
      {
        org_id: opts.orgId,
        playbook_id: opts.playbookId,
        customer_hash: opts.customerHash,
      },
      { onConflict: "org_id,customer_hash,playbook_id" },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("remediation_status")
      .delete()
      .eq("org_id", opts.orgId)
      .eq("customer_hash", opts.customerHash)
      .eq("playbook_id", opts.playbookId);
    if (error) throw error;
  }
}

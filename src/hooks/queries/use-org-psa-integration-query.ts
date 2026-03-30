import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "./keys";

export interface OrgPsaIntegrationFlags {
  cwCloud: boolean;
  cwManage: boolean;
  autotask: boolean;
  serviceKeys: boolean;
}

export async function fetchOrgPsaIntegrationFlags(orgId: string): Promise<OrgPsaIntegrationFlags> {
  const [cwC, cwM, at, keys] = await Promise.all([
    supabase
      .from("connectwise_cloud_credentials")
      .select("org_id")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("connectwise_manage_credentials")
      .select("org_id")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase.from("autotask_psa_credentials").select("org_id").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("org_service_api_keys")
      .select("id")
      .eq("org_id", orgId)
      .is("revoked_at", null)
      .limit(1),
  ]);

  return {
    cwCloud: !!cwC.data,
    cwManage: !!cwM.data,
    autotask: !!at.data,
    serviceKeys: (keys.data?.length ?? 0) > 0,
  };
}

export function useOrgPsaIntegrationFlagsQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: orgId
      ? queryKeys.org.psaIntegrationFlags(orgId)
      : ["org", "none", "psa_integration_flags"],
    queryFn: () => fetchOrgPsaIntegrationFlags(orgId!),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}

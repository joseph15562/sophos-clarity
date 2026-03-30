import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { queryKeys } from "./keys";

export interface OrgPsaIntegrationFlags {
  cwCloud: boolean;
  cwManage: boolean;
  autotask: boolean;
  serviceKeys: boolean;
}

export async function fetchOrgPsaIntegrationFlags(
  orgId: string,
  signal?: AbortSignal,
): Promise<OrgPsaIntegrationFlags> {
  const [cwC, cwM, at, keys] = await Promise.all([
    supabaseWithAbort(
      supabase
        .from("connectwise_cloud_credentials")
        .select("org_id")
        .eq("org_id", orgId)
        .maybeSingle(),
      signal,
    ),
    supabaseWithAbort(
      supabase
        .from("connectwise_manage_credentials")
        .select("org_id")
        .eq("org_id", orgId)
        .maybeSingle(),
      signal,
    ),
    supabaseWithAbort(
      supabase.from("autotask_psa_credentials").select("org_id").eq("org_id", orgId).maybeSingle(),
      signal,
    ),
    supabaseWithAbort(
      supabase
        .from("org_service_api_keys")
        .select("id")
        .eq("org_id", orgId)
        .is("revoked_at", null)
        .limit(1),
      signal,
    ),
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
    queryFn: ({ signal }) => fetchOrgPsaIntegrationFlags(orgId!, signal),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}

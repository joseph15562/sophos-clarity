import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "./keys";

export async function fetchOrgSubmissionRetentionDays(orgId: string): Promise<number | null> {
  const { data } = await supabase
    .from("organisations")
    .select("submission_retention_days")
    .eq("id", orgId)
    .single();
  if (!data) return null;
  return (data as { submission_retention_days?: number | null }).submission_retention_days ?? null;
}

export function useOrgSubmissionRetentionQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: orgId
      ? queryKeys.org.submissionRetention(orgId)
      : ["org", "none", "submission_retention"],
    queryFn: () => fetchOrgSubmissionRetentionDays(orgId!),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
}

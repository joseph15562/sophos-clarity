import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { queryKeys } from "./keys";

export async function fetchOrgSubmissionRetentionDays(
  orgId: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const { data } = await supabaseWithAbort(
    supabase.from("organisations").select("submission_retention_days").eq("id", orgId).single(),
    signal,
  );
  if (!data) return null;
  return (data as { submission_retention_days?: number | null }).submission_retention_days ?? null;
}

export function useOrgSubmissionRetentionQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: orgId
      ? queryKeys.org.submissionRetention(orgId)
      : ["org", "none", "submission_retention"],
    queryFn: ({ signal }) => fetchOrgSubmissionRetentionDays(orgId!, signal),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
}

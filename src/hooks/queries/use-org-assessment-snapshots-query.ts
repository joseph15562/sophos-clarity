import { useQuery } from "@tanstack/react-query";
import { loadHistoryCloud } from "@/lib/assessment-cloud";
import { queryKeys } from "./keys";

/** Latest cloud assessments for the signed-in org (RLS). Used by TenantDashboard fleet views. */
export function useOrgAssessmentSnapshotsQuery(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: orgId
      ? queryKeys.org.assessmentSnapshots(orgId)
      : ["org", "none", "assessment_snapshots"],
    queryFn: ({ signal }) => loadHistoryCloud(signal),
    enabled: Boolean(orgId && enabled),
    staleTime: 15_000,
  });
}

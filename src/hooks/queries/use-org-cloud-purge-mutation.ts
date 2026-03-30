import { useMutation, useQueryClient } from "@tanstack/react-query";
import { purgeOrgCloudData } from "@/lib/data/purge-org-cloud-data";
import { invalidateOrgScopedQueries } from "@/lib/invalidate-org-queries";

/** Data governance: delete org-scoped cloud rows and refresh TanStack caches. */
export function useOrgCloudPurgeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: purgeOrgCloudData,
    onSuccess: async (_void, orgId) => {
      await invalidateOrgScopedQueries(queryClient, orgId);
    },
  });
}

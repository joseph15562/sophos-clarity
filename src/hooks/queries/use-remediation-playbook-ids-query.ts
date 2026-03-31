import { useQuery } from "@tanstack/react-query";
import { fetchRemediationPlaybookIds } from "@/lib/data/remediation-status";
import { queryKeys } from "./keys";

export function useRemediationPlaybookIdsQuery(orgId: string | null, customerHash: string | null) {
  return useQuery({
    queryKey: queryKeys.org.remediationPlaybookIds(orgId ?? "", customerHash ?? ""),
    queryFn: ({ signal }) => fetchRemediationPlaybookIds(orgId!, customerHash!, signal),
    enabled: Boolean(orgId && customerHash !== null && customerHash !== ""),
    staleTime: 60_000,
  });
}

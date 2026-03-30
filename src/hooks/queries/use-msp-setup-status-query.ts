import { useQuery } from "@tanstack/react-query";
import { fetchMspSetupStatus } from "@/lib/data/msp-setup-status";
import { queryKeys } from "./keys";

export function useMspSetupStatusQuery(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.org.mspSetupStatus(orgId ?? ""),
    queryFn: ({ signal }) => fetchMspSetupStatus(orgId!, signal),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}

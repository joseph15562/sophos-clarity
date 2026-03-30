import { useQuery } from "@tanstack/react-query";
import { fetchRegulatoryDigestRecent } from "@/lib/regulatory-digest-data";
import { queryKeys } from "@/hooks/queries/keys";

export function useRegulatoryDigestQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.regulatoryDigest.recent(),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => fetchRegulatoryDigestRecent(signal),
  });
}

import { useQuery } from "@tanstack/react-query";
import { fetchFleetBundle } from "@/lib/fleet-command-data";
import { queryKeys } from "./keys";

export function useFleetCommandQuery(
  orgId: string | undefined,
  orgDisplayName: string | undefined,
) {
  return useQuery({
    queryKey: orgId ? queryKeys.org.fleetBundle(orgId) : ["org", "fleet_bundle", "disabled"],
    queryFn: ({ signal }) => fetchFleetBundle(orgId!, orgDisplayName, { signal }),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
}

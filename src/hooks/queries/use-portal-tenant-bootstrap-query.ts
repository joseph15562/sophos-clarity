import { useQuery } from "@tanstack/react-query";
import { fetchPortalTenantBootstrap } from "@/lib/data/portal-tenant-bootstrap";
import { queryKeys } from "./keys";

export function usePortalTenantBootstrapQuery(
  orgId: string,
  initialTenantName: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...queryKeys.portal.tenantBootstrap(orgId), initialTenantName ?? ""] as const,
    queryFn: ({ signal }) => fetchPortalTenantBootstrap(orgId, initialTenantName, signal),
    enabled: Boolean(orgId) && enabled,
    staleTime: 15_000,
  });
}

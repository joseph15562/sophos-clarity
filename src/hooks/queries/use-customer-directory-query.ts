import { useQuery } from "@tanstack/react-query";
import { fetchCustomerDirectory } from "@/lib/customer-directory";
import { queryKeys } from "./keys";

export function useCustomerDirectoryQuery(
  orgId: string | undefined,
  orgDisplayName: string | undefined,
) {
  return useQuery({
    queryKey: orgId
      ? queryKeys.org.customerDirectory(orgId)
      : ["org", "none", "customer_directory"],
    queryFn: () => fetchCustomerDirectory(orgId!, orgDisplayName ?? ""),
    enabled: Boolean(orgId),
    staleTime: 15_000,
  });
}

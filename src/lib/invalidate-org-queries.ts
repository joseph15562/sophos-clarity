import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries/keys";

/** After firewall_config_links changes — fleet aggregate + agents + Central status. */
export async function invalidateFleetRelatedQueries(
  queryClient: QueryClient,
  orgId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.org.fleetBundle(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.agents(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.agentSubmissionCounts7d(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.central.status(orgId) }),
  ]);
}

/** After org-wide mutations (purge, bulk deletes), refresh TanStack caches that read org-scoped data. */
export async function invalidateOrgScopedQueries(
  queryClient: QueryClient,
  orgId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.org.agents(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.submissions(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.customerDirectory(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.fleetBundle(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.scheduledReports(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.teamRoster(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.psaIntegrationFlags(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.submissionRetention(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.companyLogo(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.remediationStatus(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.mspSetupStatus(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.agentSubmissionCounts7d(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portal.viewers(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portal.tenantBootstrap(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portal.configs(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.central.status(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.savedReports.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.clientPortalPreviewAll(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.regulatoryDigest.recent() }),
  ]);
}

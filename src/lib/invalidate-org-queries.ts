import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries/keys";

/** After assessment save/delete/rename from Assess — refreshes TenantDashboard / fleet map. */
export async function invalidateOrgAssessmentSnapshots(
  queryClient: QueryClient,
  orgId: string,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.org.assessmentSnapshots(orgId) });
}

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
    queryClient.invalidateQueries({ queryKey: ["linkedFwCompliance", orgId], exact: false }),
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
    queryClient.invalidateQueries({ queryKey: queryKeys.org.assessmentSnapshots(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.fleetBundle(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.scheduledReports(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.teamRoster(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.psaIntegrationFlags(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.submissionRetention(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.companyLogo(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.remediationStatus(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.mspSetupStatus(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.agentSubmissionCounts7d(orgId) }),
    queryClient.invalidateQueries({
      queryKey: ["portal", "viewers", orgId],
      exact: false,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portal.tenantBootstrap(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portal.configs(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.central.status(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.savedReports.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.org.clientPortalPreviewAll(orgId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.regulatoryDigest.recent() }),
  ]);
}

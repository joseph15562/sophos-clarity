export const queryKeys = {
  org: {
    all: ["org"] as const,
    agents: (orgId: string) => ["org", orgId, "agents"] as const,
    submissions: (orgId: string) => ["org", orgId, "submissions"] as const,
    scheduledReports: (orgId: string) => ["org", orgId, "scheduled_reports"] as const,
    /** InviteStaff — org_invites + org_members */
    teamRoster: (orgId: string) => ["org", orgId, "team_roster"] as const,
    /** PSA / service-key row presence for Management drawer summary */
    psaIntegrationFlags: (orgId: string) => ["org", orgId, "psa_integration_flags"] as const,
    /** Data governance copy — organisations.submission_retention_days */
    submissionRetention: (orgId: string) => ["org", orgId, "submission_retention"] as const,
    /** Customer Management directory (tenants + assessments + agents + portal_config) */
    customerDirectory: (orgId: string) => ["org", orgId, "customer_directory"] as const,
  },
  seTeams: {
    all: ["se-teams"] as const,
    list: (seProfileId: string) => ["se-teams", "list", seProfileId] as const,
  },
  healthChecks: {
    all: ["health-checks"] as const,
    list: (teamId: string) => ["health-checks", "list", teamId] as const,
  },
  central: {
    all: ["central"] as const,
    status: (orgId: string) => ["central", orgId, "status"] as const,
  },
  portal: {
    all: ["portal"] as const,
    configs: (orgId: string) => ["portal", "configs", orgId] as const,
    viewers: (orgId: string) => ["portal", "viewers", orgId] as const,
    /** Agents' tenant_name values + portal_config rows for PortalConfigurator */
    tenantBootstrap: (orgId: string) => ["portal", "tenant-bootstrap", orgId] as const,
  },
  /** Saved report packages — cloud (org) or local-only pseudo-key */
  savedReports: {
    all: ["saved-reports"] as const,
    packages: (scope: string, refreshEpoch: number) =>
      ["saved-reports", "packages", scope, refreshEpoch] as const,
  },
  /** SE Health Check page — config upload request list (JWT + optional team_id) */
  seHealthCheck: {
    all: ["se-health-check"] as const,
    configUploadRequests: (seProfileId: string, teamId: string | null | undefined) =>
      ["se-health-check", "config-upload-requests", seProfileId, teamId ?? "none"] as const,
  },
} as const;

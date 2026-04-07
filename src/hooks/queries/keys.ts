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
    /** Cloud assessment rows for org — TenantDashboard / fleet map; invalidate after customer delete or assessment mutations */
    assessmentSnapshots: (orgId: string) => ["org", orgId, "assessment_snapshots"] as const,
    /** Fleet Command — central_firewalls + assessments + agents + links + tenants + reports */
    fleetBundle: (orgId: string) => ["org", orgId, "fleet_bundle"] as const,
    /** Playbook / remediation panel — remediation_status rows (invalidate after upsert/delete) */
    remediationStatus: (orgId: string) => ["org", orgId, "remediation_status"] as const,
    /** MSP first-time setup checklist — central + counts + portal slug */
    mspSetupStatus: (orgId: string) => ["org", orgId, "msp_setup_status"] as const,
    /** Agent submissions in last 7 days — per-agent counts (AgentFleetPanel) */
    agentSubmissionCounts7d: (orgId: string) =>
      ["org", orgId, "agent_submission_counts_7d"] as const,
    /** Latest agent_submissions row per agent — batched load (AgentFleetPanel); fingerprint = sorted agent ids */
    agentSubmissionsLatestBatch: (orgId: string, idsFingerprint: string) =>
      ["org", orgId, "agent_submissions_latest_batch", idsFingerprint] as const,
    /** Remediation playbook rows for org + customer_hash slice (prefix-invalidated with remediationStatus) */
    remediationPlaybookIds: (orgId: string, customerHash: string) =>
      ["org", orgId, "remediation_status", "playbook_ids", customerHash] as const,
    /** Management drawer Client View preview — assessments + score_history */
    clientPortalPreview: (orgKey: string, guest: boolean, fingerprint: string) =>
      ["org", orgKey, "client_portal_preview", guest ? "guest" : "member", fingerprint] as const,
    /** Invalidate every Client View preview variant for an org (e.g. after purge). */
    clientPortalPreviewAll: (orgId: string) => ["org", orgId, "client_portal_preview"] as const,
    /** Report template company logo data URL (Management drawer branding) */
    companyLogo: (orgId: string) => ["org", orgId, "company_logo"] as const,
  },
  /** Regulatory digest rows (RLS-scoped; global key — invalidate rarely) */
  regulatoryDigest: {
    recent: () => ["regulatory_updates", "recent"] as const,
  },
  /** Sophos Security Advisories RSS (Edge Function; changelog intel feed). */
  sophosAdvisories: {
    changelogFeed: (limit: number) => ["sophos_advisories_rss", "changelog", limit] as const,
  },
  /** Current user passkeys list (settings drawer) */
  passkeys: {
    list: () => ["passkeys", "list"] as const,
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
    /** Sophos Central open alerts — one Edge call; shared with Mission Control + Alerts page prefetch. */
    missionAlertsBundle: (orgId: string) => ["central", orgId, "mission_alerts_bundle"] as const,
    /** MDR threat feed — merged on Edge (Central MDR tab); warmed from OrgCentralPrefetch / CentralHub. */
    mdrThreatFeedMerged: (orgId: string) => ["central", orgId, "mdr_threat_feed_merged"] as const,
    /** Firewall groups — merged on Edge (Central Groups tab). */
    firewallGroupsMerged: (orgId: string) => ["central", orgId, "firewall_groups_merged"] as const,
    status: (orgId: string) => ["central", orgId, "status"] as const,
    cachedTenants: (orgId: string) => ["central", orgId, "cached_tenants"] as const,
    cachedFirewalls: (orgId: string, tenantId: string | "all") =>
      ["central", orgId, "cached_firewalls", tenantId] as const,
    alertsTenant: (orgId: string, tenantId: string) =>
      ["central", orgId, "alerts", tenantId] as const,
    firewallLicences: (orgId: string) => ["central", orgId, "firewall_licences"] as const,
    tenantLicencesMerged: (orgId: string, tenantKey: string) =>
      ["central", orgId, "tenant_licences_merged", tenantKey] as const,
    mdrMerged: (orgId: string, tenantKey: string) =>
      ["central", orgId, "mdr_merged", tenantKey] as const,
  },
  portal: {
    all: ["portal"] as const,
    configs: (orgId: string) => ["portal", "configs", orgId] as const,
    /** Portal viewer invites — scoped by vanity slug (matches portal_config.slug) */
    viewers: (orgId: string, portalSlug: string) =>
      ["portal", "viewers", orgId, portalSlug] as const,
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

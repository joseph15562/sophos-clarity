export const queryKeys = {
  org: {
    all: ["org"] as const,
    agents: (orgId: string) => ["org", orgId, "agents"] as const,
    submissions: (orgId: string) => ["org", orgId, "submissions"] as const,
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
} as const;

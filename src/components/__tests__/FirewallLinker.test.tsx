import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { FirewallLinker } from "@/components/FirewallLinker";
import type { AnalysisResult, InspectionPosture } from "@/lib/analyse-config";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: null,
    user: null,
    org: { id: "org-test", name: "Test Org" },
    role: "admin" as const,
    isGuest: false,
    isLoading: false,
    needsOrg: false,
    needsMfa: false,
    canManageTeam: true,
    canManageAgents: true,
    canRunAssessments: true,
    isViewerOnly: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    createOrg: vi.fn(),
    refreshOrg: vi.fn(),
    clearMfaRequired: vi.fn(),
  }),
}));

const refreshFirewalls = vi.fn(() => Promise.resolve());
const refreshGroups = vi.fn(() => Promise.resolve());
const refreshTenants = vi.fn(() => Promise.resolve());

vi.mock("@/hooks/use-central", () => ({
  useCentral: () => ({
    status: {
      connected: true,
      partner_type: "tenant" as const,
      partner_id: "tenant-1",
      last_synced_at: null,
    },
    tenants: [
      { id: "tenant-1", name: "Acme", dataRegion: "EU", apiHost: "https://api.example", billingType: "standard" },
    ],
    firewalls: [],
    groups: [],
    alerts: [],
    licences: [],
    mdrFeed: [],
    isConnected: true,
    isLoading: false,
    error: "",
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshStatus: vi.fn(),
    refreshTenants,
    refreshFirewalls,
    refreshGroups,
    refreshAlerts: vi.fn(),
    refreshLicences: vi.fn(),
    refreshMdrFeed: vi.fn(),
    loadCachedTenants: vi.fn(),
    loadCachedFirewalls: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({ firewall_config_links: [] }) };
});

function minimalPosture(): InspectionPosture {
  return {
    totalWanRules: 0,
    enabledWanRules: 0,
    disabledWanRules: 0,
    webFilterableRules: 0,
    withWebFilter: 0,
    withoutWebFilter: 0,
    withAppControl: 0,
    withIps: 0,
    withSslInspection: 0,
    sslDecryptRules: 0,
    sslExclusionRules: 0,
    sslRules: [],
    sslUncoveredZones: [],
    sslUncoveredNetworks: [],
    allWanSourceZones: [],
    allWanSourceNetworks: [],
    wanRuleNames: [],
    wanWebServiceRuleNames: [],
    wanMissingWebFilterRuleNames: [],
    totalDisabledRules: 0,
    dpiEngineEnabled: false,
  };
}

const analysisResults: Record<string, AnalysisResult> = {
  h1: {
    stats: {
      totalRules: 0,
      totalSections: 0,
      totalHosts: 0,
      totalNatRules: 0,
      interfaces: 0,
      populatedSections: 0,
      emptySections: 0,
      sectionNames: [],
    },
    findings: [],
    inspectionPosture: minimalPosture(),
  },
};

describe("FirewallLinker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    renderWithProviders(
      <FirewallLinker
        configs={[{ label: "FW-A", hostname: "fw-a", configHash: "h1" }]}
        customerName="Acme"
        analysisResults={analysisResults}
      />,
    );
    expect(screen.getByRole("heading", { name: /link to sophos central/i })).toBeVisible();
  });

  it("shows empty state when no firewalls", () => {
    renderWithProviders(
      <FirewallLinker
        configs={[{ label: "FW-A", hostname: "fw-a", configHash: "h1" }]}
        customerName="Acme"
        analysisResults={analysisResults}
      />,
    );
    expect(
      screen.getByText(/no firewalls found for this tenant/i),
    ).toBeVisible();
  });
});

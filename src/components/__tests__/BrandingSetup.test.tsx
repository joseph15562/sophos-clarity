import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { BrandingSetup, type BrandingData } from "@/components/BrandingSetup";
import { useState } from "react";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: null,
    user: null,
    org: null,
    role: null,
    isGuest: true,
    isLoading: false,
    needsOrg: false,
    needsMfa: false,
    canManageTeam: false,
    canManageAgents: false,
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

vi.mock("@/lib/assessment-history", () => ({
  loadHistory: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/assessment-cloud", () => ({
  loadHistoryCloud: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/saved-reports", () => ({
  loadSavedReportsCloud: vi.fn(() => Promise.resolve([])),
  loadSavedReportsLocal: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/lib/sophos-central", () => ({
  getCachedTenants: vi.fn(() => Promise.resolve([])),
  getEffectiveTenantDisplayName: vi.fn(
    (tenant: { name?: string } | null, fallback?: string | null) =>
      (fallback?.trim() ? fallback.trim() : null) || tenant?.name || "",
  ),
}));

vi.mock("@/hooks/use-company-logo", () => ({
  useCompanyLogo: () => ({
    logoUrl: null,
    setLogo: vi.fn(),
    loading: false,
    saving: false,
    canEdit: true,
  }),
}));

const initialBranding: BrandingData = {
  companyName: "Test Co",
  customerName: "",
  logoUrl: null,
  environment: "Private Sector",
  country: "United Kingdom",
  selectedFrameworks: [],
};

function BrandingHarness() {
  const [branding, setBranding] = useState<BrandingData>(initialBranding);
  return <BrandingSetup branding={branding} onChange={setBranding} />;
}

describe("BrandingSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders company name input", () => {
    renderWithProviders(<BrandingHarness />);
    expect(screen.getByLabelText(/company name/i)).toBeVisible();
  });

  it("renders customer name in the combined assessment context card", () => {
    renderWithProviders(<BrandingHarness />);
    expect(screen.getByText(/customer context/i)).toBeVisible();
    expect(screen.getByLabelText(/customer name/i)).toBeVisible();
    expect(screen.getByText(/Compliance \(this firewall\)/i)).toBeVisible();
  });

  it("renders without crashing", () => {
    renderWithProviders(<BrandingHarness />);
    expect(screen.getByText(/report identity/i)).toBeVisible();
  });

  it("shows mixed-jurisdiction guidance when uploads resolve to different geo", () => {
    renderWithProviders(
      <BrandingSetup
        branding={initialBranding}
        onChange={() => {}}
        multiConfig
        mixedJurisdiction
      />,
    );
    expect(screen.getByText(/Different regions or sectors across uploads/i)).toBeVisible();
  });
});

import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { UploadSection } from "@/components/UploadSection";
import type { BrandingData } from "@/components/BrandingSetup";

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabase } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabase({}) };
});

function minimalBranding(): BrandingData {
  return {
    companyName: "",
    logoUrl: null,
    customerName: "",
    environment: "",
    country: "",
    selectedFrameworks: [],
  };
}

function minimalUploadProps() {
  return {
    files: [],
    onFilesChange: vi.fn(),
    parsingProgress: null as const,
    branding: minimalBranding(),
    setBranding: vi.fn(),
    analysisResult: {},
    configMetas: [] as Array<{
      label: string;
      hostname?: string;
      serialNumber?: string;
      configHash: string;
      fromUpload?: boolean;
    }>,
    hasFiles: false,
    hasReports: false,
    reports: [] as Array<{ id: string; label: string; markdown: string }>,
    isGuest: true,
    org: null,
    localMode: false,
    onGenerateIndividual: vi.fn(),
    onGenerateExecutive: vi.fn(),
    onGenerateExecutiveOnePager: vi.fn(),
    onGenerateCompliance: vi.fn(),
    onGenerateAll: vi.fn(),
    setViewingReports: vi.fn(),
    onLoadAgentAssessment: vi.fn(),
    setCentralEnriched: vi.fn(),
    saveError: "",
    savingReports: false,
    reportsSaved: false,
    onSaveReports: vi.fn(),
    totalFindings: 0,
  };
}

describe("UploadSection", () => {
  it("renders upload heading and instructions", () => {
    renderWithProviders(<UploadSection {...minimalUploadProps()} />);

    expect(screen.getByRole("heading", { name: /upload firewall exports/i })).toBeVisible();
    expect(screen.getByText(/upload sophos html or xml exports/i)).toBeVisible();
  });

  it("renders file upload component", () => {
    renderWithProviders(<UploadSection {...minimalUploadProps()} />);

    expect(screen.getByText(/drop your sophos firewall export here/i)).toBeVisible();
  });
});

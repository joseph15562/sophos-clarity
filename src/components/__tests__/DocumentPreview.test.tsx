import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, renderWithProviders, userEvent } from "@/test/test-utils";
import type { BrandingData } from "@/components/BrandingSetup";
import { DocumentPreview } from "@/components/DocumentPreview";

vi.mock("@/lib/share-report", () => ({
  generateShareToken: vi.fn(() => "test-share-token"),
  saveSharedReport: vi.fn(async () => ({
    token: "test-share-token",
    markdown: "",
    customerName: "Customer",
    expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
    createdAt: new Date().toISOString(),
  })),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/lib/report-html", () => ({
  extractTocHeadings: vi.fn(() => []),
  buildReportHtml: vi.fn(() => "<div data-testid=\"report-html\">report</div>"),
}));

vi.mock("@/lib/report-export", () => ({
  buildPdfHtml: vi.fn(() => "<html><body>pdf</body></html>"),
  generateWordBlob: vi.fn(async () => new Blob()),
  generatePptxBlob: vi.fn(async () => new Blob()),
}));

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

vi.mock("jszip", () => ({
  default: class MockJSZip {
    folder() {
      return { file: vi.fn() };
    }
    generateAsync() {
      return Promise.resolve(new Blob());
    }
  },
}));

const brandingFixture: BrandingData = {
  companyName: "Test Co",
  customerName: "",
  logoUrl: null,
  environment: "Private Sector",
  country: "United Kingdom",
  selectedFrameworks: [],
};

describe("DocumentPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading spinner when isLoading", () => {
    renderWithProviders(
      <DocumentPreview
        reports={[]}
        activeReportId=""
        onActiveChange={() => {}}
        isLoading
        loadingReportIds={new Set()}
        failedReportIds={new Set()}
        onRetry={() => {}}
        branding={brandingFixture}
      />,
    );

    expect(screen.getByText("Analysing configuration")).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders report tabs", () => {
    renderWithProviders(
      <DocumentPreview
        reports={[
          { id: "r1", label: "Executive Summary", markdown: "# Hello" },
          { id: "r2", label: "Technical Detail", markdown: "# World" },
        ]}
        activeReportId="r1"
        onActiveChange={() => {}}
        isLoading={false}
        loadingReportIds={new Set()}
        failedReportIds={new Set()}
        onRetry={() => {}}
        branding={brandingFixture}
      />,
    );

    expect(screen.getByRole("button", { name: /Executive Summary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Technical Detail/i })).toBeInTheDocument();
  });

  it("calls onActiveChange when tab clicked", async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn();

    renderWithProviders(
      <DocumentPreview
        reports={[
          { id: "r1", label: "Executive Summary", markdown: "# Hello" },
          { id: "r2", label: "Technical Detail", markdown: "# World" },
        ]}
        activeReportId="r1"
        onActiveChange={onActiveChange}
        isLoading={false}
        loadingReportIds={new Set()}
        failedReportIds={new Set()}
        onRetry={() => {}}
        branding={brandingFixture}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Technical Detail/i }));

    expect(onActiveChange).toHaveBeenCalledWith("r2");
  });
});

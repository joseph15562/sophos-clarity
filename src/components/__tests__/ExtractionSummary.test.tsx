import { describe, it, expect } from "vitest";
import { render, screen, within } from "@/test/test-utils";
import type { ExtractionMeta, SectionMeta } from "@/lib/extract-sections";
import { ExtractionSummary } from "@/components/ExtractionSummary";

function buildMeta(overrides: Partial<ExtractionMeta> = {}): ExtractionMeta {
  const section: SectionMeta = {
    key: "firewall-rules",
    displayName: "Firewall rules",
    status: "extracted",
    htmlId: "firewall-rules",
    extractionMethod: "sidebar-mapped",
    plainTextFallback: false,
    rowCount: 4,
    tableCount: 1,
    detailCount: 1,
  };
  return {
    sections: [section],
    totalDetected: 12,
    totalExtracted: 9,
    totalEmpty: 3,
    coveragePct: 75,
    ...overrides,
  };
}

describe("ExtractionSummary", () => {
  it("renders file names", () => {
    render(
      <ExtractionSummary
        files={[
          { fileName: "alpha.html", meta: buildMeta() },
          { fileName: "beta.html", meta: buildMeta() },
        ]}
      />,
    );

    expect(screen.getByText("alpha.html")).toBeInTheDocument();
    expect(screen.getByText("beta.html")).toBeInTheDocument();
  });

  it("shows section counts", () => {
    render(
      <ExtractionSummary
        files={[
          {
            fileName: "one.html",
            meta: buildMeta({
              totalDetected: 20,
              totalExtracted: 15,
              totalEmpty: 5,
            }),
          },
        ]}
      />,
    );

    const detectedCard = screen.getByText("Sections detected").closest("div");
    expect(detectedCard).toBeTruthy();
    expect(within(detectedCard!).getByText("20")).toBeInTheDocument();

    const extractedCard = screen.getByText(/^Extracted$/).closest("div");
    expect(extractedCard).toBeTruthy();
    expect(within(extractedCard!).getByText("15")).toBeInTheDocument();

    const emptyCard = screen.getByText(/^Empty$/).closest("div");
    expect(emptyCard).toBeTruthy();
    expect(within(emptyCard!).getByText("5")).toBeInTheDocument();
  });

  it("renders without crashing with empty files array", () => {
    const { container } = render(<ExtractionSummary files={[]} />);
    expect(container).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /extraction summary/i })).not.toBeInTheDocument();
  });
});

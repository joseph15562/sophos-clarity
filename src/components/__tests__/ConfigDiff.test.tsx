import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { ConfigDiff } from "@/components/ConfigDiff";
import type { ExtractedSections } from "@/lib/extract-sections";

const _emptyTable = { headers: [] as string[], rows: [] as Record<string, string>[] };

describe("ConfigDiff", () => {
  it("renders diff view", () => {
    const beforeSections: ExtractedSections = {
      Demo: { tables: [{ headers: ["Name"], rows: [{ Name: "A" }] }], text: "", details: [] },
    };
    const afterSections: ExtractedSections = {
      Demo: { tables: [{ headers: ["Name"], rows: [{ Name: "B" }] }], text: "", details: [] },
    };

    renderWithProviders(
      <ConfigDiff
        beforeLabel="v1"
        afterLabel="v2"
        beforeSections={beforeSections}
        afterSections={afterSections}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: /configuration diff/i })).toBeVisible();
    expect(screen.getByText("v1")).toBeVisible();
    expect(screen.getByText("v2")).toBeVisible();
    expect(screen.getByRole("button", { name: /back/i })).toBeVisible();
  });

  it("handles empty inputs", () => {
    const beforeSections: ExtractedSections = {};
    const afterSections: ExtractedSections = {};

    renderWithProviders(
      <ConfigDiff
        beforeLabel="before"
        afterLabel="after"
        beforeSections={beforeSections}
        afterSections={afterSections}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/configurations are identical/i)).toBeVisible();
  });
});

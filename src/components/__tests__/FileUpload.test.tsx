import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { FileUpload, type UploadedFile } from "@/components/FileUpload";

vi.mock("@/components/FirewallLinkPicker", () => ({
  default: () => null,
  FirewallLinkPicker: () => null,
}));

function fileFixture(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: "id-1",
    fileName: "export.html",
    label: "export",
    content: "<html></html>",
    ...overrides,
  };
}

describe("FileUpload", () => {
  it("renders upload zone when no files", () => {
    renderWithProviders(
      <FileUpload files={[]} onFilesChange={vi.fn()} />,
    );

    expect(
      screen.getByText(/drop your sophos firewall export here/i),
    ).toBeInTheDocument();
  });

  it("renders file cards when files provided", () => {
    renderWithProviders(
      <FileUpload
        files={[
          fileFixture({ id: "a", fileName: "first.html", label: "First" }),
          fileFixture({ id: "b", fileName: "second.htm", label: "Second" }),
        ]}
        onFilesChange={vi.fn()}
      />,
    );

    expect(screen.getByText("first.html")).toBeInTheDocument();
    expect(screen.getByText("second.htm")).toBeInTheDocument();
  });

  it("calls onFilesChange when file removed", async () => {
    const user = userEvent.setup();
    const onFilesChange = vi.fn();
    renderWithProviders(
      <FileUpload files={[fileFixture({ id: "rm-1" })]} onFilesChange={onFilesChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove file" }));

    expect(onFilesChange).toHaveBeenCalledWith([]);
  });

  it("updates label on input change", async () => {
    const user = userEvent.setup();
    const onFilesChange = vi.fn();
    const initial = fileFixture({ id: "lbl-1", label: "Original" });

    function Harness() {
      const [files, setFiles] = useState<UploadedFile[]>([initial]);
      return (
        <FileUpload
          files={files}
          onFilesChange={(next) => {
            setFiles(next);
            onFilesChange(next);
          }}
        />
      );
    }

    renderWithProviders(<Harness />);

    const labelInput = screen.getByPlaceholderText(
      "Firewall name (e.g. Sophos Firewall)",
    );
    await user.clear(labelInput);
    await user.type(labelInput, "Renamed FW");

    expect(onFilesChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "lbl-1", label: "Renamed FW" }),
    ]);
  });
});

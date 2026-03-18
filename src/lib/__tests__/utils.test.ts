import { describe, it, expect } from "vitest";
import { getFileLabel, normalizeErrorMessage } from "../utils";

describe("getFileLabel", () => {
  it("returns label when present", () => {
    expect(getFileLabel({ label: "X", fileName: "a.html" })).toBe("X");
  });

  it("strips .html from fileName when no label", () => {
    expect(getFileLabel({ fileName: "a.html" })).toBe("a");
  });

  it("strips .htm from fileName (case insensitive)", () => {
    expect(getFileLabel({ fileName: "b.HTM" })).toBe("b");
  });

  it("returns fileName unchanged when no .html/.htm suffix", () => {
    expect(getFileLabel({ fileName: "config.xml" })).toBe("config.xml");
  });
});

describe("normalizeErrorMessage", () => {
  it("returns message for Error instances", () => {
    expect(normalizeErrorMessage(new Error("oops"))).toBe("oops");
  });

  it("converts string to string", () => {
    expect(normalizeErrorMessage("failed")).toBe("failed");
  });

  it("converts undefined to string", () => {
    expect(normalizeErrorMessage(undefined)).toBe("undefined");
  });
});

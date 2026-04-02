import { describe, it, expect } from "vitest";
import {
  brandingPatchFromComplianceGeo,
  getDefaultFrameworks,
  normalizeDirectoryCountry,
  normalizeDirectoryEnvironment,
  mergeDefaultAndDirectoryFrameworks,
} from "@/lib/compliance-context-options";

describe("normalizeDirectoryEnvironment", () => {
  it("returns known environment types", () => {
    expect(normalizeDirectoryEnvironment("Education")).toBe("Education");
    expect(normalizeDirectoryEnvironment(" Private Sector ")).toBe("Private Sector");
  });

  it("returns new environment types", () => {
    expect(normalizeDirectoryEnvironment("Logistics & Transport")).toBe("Logistics & Transport");
    expect(normalizeDirectoryEnvironment("Manufacturing")).toBe("Manufacturing");
    expect(normalizeDirectoryEnvironment("Technology & Telecoms")).toBe("Technology & Telecoms");
    expect(normalizeDirectoryEnvironment("Energy & Utilities")).toBe("Energy & Utilities");
  });

  it("returns undefined for unknown or empty", () => {
    expect(normalizeDirectoryEnvironment("")).toBeUndefined();
    expect(normalizeDirectoryEnvironment("Acme Corp")).toBeUndefined();
  });
});

describe("normalizeDirectoryCountry", () => {
  it("returns known countries", () => {
    expect(normalizeDirectoryCountry("United Kingdom")).toBe("United Kingdom");
  });

  it("returns new countries", () => {
    expect(normalizeDirectoryCountry("Sweden")).toBe("Sweden");
    expect(normalizeDirectoryCountry("Italy")).toBe("Italy");
    expect(normalizeDirectoryCountry("Spain")).toBe("Spain");
    expect(normalizeDirectoryCountry("Brazil")).toBe("Brazil");
    expect(normalizeDirectoryCountry("Saudi Arabia")).toBe("Saudi Arabia");
    expect(normalizeDirectoryCountry("Switzerland")).toBe("Switzerland");
  });

  it("returns undefined for placeholders and multi-country", () => {
    expect(normalizeDirectoryCountry("")).toBeUndefined();
    expect(normalizeDirectoryCountry("—")).toBeUndefined();
    expect(normalizeDirectoryCountry("Multiple (United Kingdom, United States)")).toBeUndefined();
  });
});

describe("getDefaultFrameworks", () => {
  it("returns UK education defaults", () => {
    const fw = getDefaultFrameworks("Education", "United Kingdom");
    expect(fw).toContain("GDPR");
    expect(fw).toContain("Cyber Essentials / CE+");
    expect(fw).toContain("NCSC Guidelines");
    expect(fw).toContain("DfE / KCSIE");
  });

  it("returns US healthcare defaults", () => {
    const fw = getDefaultFrameworks("Healthcare", "United States");
    expect(fw).toContain("NIST 800-53");
    expect(fw).toContain("HIPAA");
    expect(fw).toContain("HITECH");
  });

  it("returns EU country baseline (GDPR + NIS2)", () => {
    for (const c of ["Germany", "France", "Netherlands", "Ireland", "Sweden", "Italy", "Spain"]) {
      const fw = getDefaultFrameworks("Private Sector", c);
      expect(fw).toContain("GDPR");
      expect(fw).toContain("NIS2");
    }
  });

  it("returns Sweden Cybersecurity Act for Sweden", () => {
    const fw = getDefaultFrameworks("Private Sector", "Sweden");
    expect(fw).toContain("Sweden Cybersecurity Act");
  });

  it("returns Germany KRITIS / BSI", () => {
    const fw = getDefaultFrameworks("Private Sector", "Germany");
    expect(fw).toContain("KRITIS / BSI");
  });

  it("returns Australia baseline + ASD Essential Eight", () => {
    const fw = getDefaultFrameworks("Private Sector", "Australia");
    expect(fw).toContain("ISO 27001");
    expect(fw).toContain("ASD Essential Eight");
  });

  it("returns Australia financial services with APRA CPS 234", () => {
    const fw = getDefaultFrameworks("Financial Services", "Australia");
    expect(fw).toContain("APRA CPS 234");
    expect(fw).toContain("PCI DSS");
  });

  it("returns Singapore financial services with MAS TRM", () => {
    const fw = getDefaultFrameworks("Financial Services", "Singapore");
    expect(fw).toContain("CSA Cyber Trust");
    expect(fw).toContain("MAS TRM");
    expect(fw).toContain("PCI DSS");
  });

  it("returns Japan financial services with FISC", () => {
    const fw = getDefaultFrameworks("Financial Services", "Japan");
    expect(fw).toContain("PDPA (Japan)");
    expect(fw).toContain("FISC");
  });

  it("returns India baseline DPDPA", () => {
    const fw = getDefaultFrameworks("Private Sector", "India");
    expect(fw).toContain("DPDPA");
  });

  it("returns UAE baseline NESA IAS", () => {
    const fw = getDefaultFrameworks("Private Sector", "United Arab Emirates");
    expect(fw).toContain("NESA IAS");
  });

  it("returns Saudi Arabia NESA IAS", () => {
    const fw = getDefaultFrameworks("Private Sector", "Saudi Arabia");
    expect(fw).toContain("NESA IAS");
  });

  it("returns South Africa POPIA", () => {
    const fw = getDefaultFrameworks("Private Sector", "South Africa");
    expect(fw).toContain("POPIA");
  });

  it("returns Brazil LGPD", () => {
    const fw = getDefaultFrameworks("Private Sector", "Brazil");
    expect(fw).toContain("LGPD");
  });

  it("returns Switzerland Swiss FADP + ISO 27001", () => {
    const fw = getDefaultFrameworks("Private Sector", "Switzerland");
    expect(fw).toContain("Swiss FADP");
    expect(fw).toContain("ISO 27001");
  });

  it("returns Canada PIPEDA + ISO 27001", () => {
    const fw = getDefaultFrameworks("Private Sector", "Canada");
    expect(fw).toContain("PIPEDA");
    expect(fw).toContain("ISO 27001");
  });

  it("returns Logistics & Transport defaults", () => {
    const fw = getDefaultFrameworks("Logistics & Transport", "Germany");
    expect(fw).toContain("ISO 27001");
    expect(fw).toContain("NIS2");
  });

  it("returns Manufacturing defaults with IEC 62443", () => {
    const fw = getDefaultFrameworks("Manufacturing", "United States");
    expect(fw).toContain("IEC 62443");
    expect(fw).toContain("NIST 800-53");
  });

  it("returns Technology & Telecoms defaults", () => {
    const fw = getDefaultFrameworks("Technology & Telecoms", "United Kingdom");
    expect(fw).toContain("SOC 2");
    expect(fw).toContain("ISO 27001");
  });

  it("returns Energy & Utilities defaults", () => {
    const fwUK = getDefaultFrameworks("Energy & Utilities", "United Kingdom");
    expect(fwUK).toContain("IEC 62443");
    expect(fwUK).toContain("NIST 800-82");
    expect(fwUK).toContain("NCSC CAF");

    const fwUS = getDefaultFrameworks("Energy & Utilities", "United States");
    expect(fwUS).toContain("NERC CIP");
  });

  it("deduplicates frameworks", () => {
    const fw = getDefaultFrameworks("Financial Services", "United Kingdom");
    expect(fw.filter((f) => f === "GDPR").length).toBe(1);
  });
});

describe("mergeDefaultAndDirectoryFrameworks", () => {
  it("merges defaults with valid saved labels, deduped", () => {
    const merged = mergeDefaultAndDirectoryFrameworks("Education", "United Kingdom", undefined, [
      "ISO 27001",
      "GDPR",
      "Not A Real Framework",
    ]);
    expect(merged).toContain("GDPR");
    expect(merged).toContain("DfE / KCSIE");
    expect(merged).toContain("ISO 27001");
    expect(merged.filter((f) => f === "GDPR").length).toBe(1);
    expect(merged.some((f) => f === "Not A Real Framework")).toBe(false);
  });
});

describe("brandingPatchFromComplianceGeo", () => {
  it("returns UK education defaults", () => {
    const p = brandingPatchFromComplianceGeo("Education", "United Kingdom", "");
    expect(p.environment).toBe("Education");
    expect(p.country).toBe("United Kingdom");
    expect(p.selectedFrameworks).toContain("DfE / KCSIE");
    expect(p.selectedFrameworks).toContain("GDPR");
  });

  it("resolves US state from scope string", () => {
    const p = brandingPatchFromComplianceGeo("Education", "United States", "Ohio");
    expect(p.state).toBe("Ohio");
    expect(p.selectedFrameworks).toContain("Ohio DPA");
  });

  it("falls back to existingState when scope state invalid", () => {
    const p = brandingPatchFromComplianceGeo("Private Sector", "United States", "XX", {
      existingState: "California",
    });
    expect(p.state).toBe("California");
  });

  it("clears US state when country is not US", () => {
    const p = brandingPatchFromComplianceGeo("Education", "United Kingdom", "Ohio");
    expect(p.state).toBeUndefined();
  });
});

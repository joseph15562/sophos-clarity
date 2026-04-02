import { describe, it, expect } from "vitest";
import type { BrandingData } from "@/components/BrandingSetup";
import {
  createScopeFromBranding,
  deserializeScope,
  mergeScopeWithBrandingForEffective,
  resolveStreamFieldsForConfig,
  seedExplicitFrameworksForLinkedScope,
  serializeScope,
  scopeFromFirewallLink,
  shouldShowPerFileGeoEditors,
} from "@/lib/config-compliance-scope";
import type { FirewallLink } from "@/components/FirewallLinkPicker";

const baseBranding: BrandingData = {
  companyName: "MSP",
  logoUrl: null,
  customerName: "Acme",
  environment: "Education",
  country: "United Kingdom",
  selectedFrameworks: ["ISO 27001"],
};

describe("resolveStreamFieldsForConfig", () => {
  it("uses branding when no scope", () => {
    const r = resolveStreamFieldsForConfig(baseBranding, undefined);
    expect(r.customerName).toBe("Acme");
    expect(r.selectedFrameworks).toEqual(["ISO 27001"]);
    expect(r.country).toBe("United Kingdom");
  });

  it("uses implicit effectiveFrameworks when linked scope has no explicit list", () => {
    const scope = {
      country: "United Kingdom",
      state: "",
      environment: "Education",
      additionalFrameworks: [] as const,
    };
    const r = resolveStreamFieldsForConfig(baseBranding, scope);
    expect(r.selectedFrameworks).toContain("GDPR");
    expect(r.selectedFrameworks).toContain("DfE / KCSIE");
  });

  it("uses explicitSelectedFrameworks when set, ignoring additionalFrameworks", () => {
    const scope = {
      country: "United Kingdom",
      state: "",
      environment: "Education",
      additionalFrameworks: ["PCI DSS"] as "PCI DSS"[],
      explicitSelectedFrameworks: ["SOX"] as "SOX"[],
    };
    const r = resolveStreamFieldsForConfig(baseBranding, scope);
    expect(r.selectedFrameworks).toEqual(["SOX"]);
    expect(r.selectedFrameworks).not.toContain("PCI DSS");
  });

  it("allows empty explicit list", () => {
    const scope = {
      country: "United Kingdom",
      state: "",
      environment: "Education",
      additionalFrameworks: [],
      explicitSelectedFrameworks: [],
    };
    const r = resolveStreamFieldsForConfig(baseBranding, scope);
    expect(r.selectedFrameworks).toEqual([]);
  });
});

describe("shouldShowPerFileGeoEditors", () => {
  it("is true when not Central-linked (no tenant on scope)", () => {
    expect(
      shouldShowPerFileGeoEditors(baseBranding, {
        country: "",
        state: "",
        environment: "",
        additionalFrameworks: [],
      }),
    ).toBe(true);
  });

  it("is false when linked and scope has both country and environment from the link", () => {
    expect(
      shouldShowPerFileGeoEditors(baseBranding, {
        country: "United Kingdom",
        state: "",
        environment: "Education",
        additionalFrameworks: [],
        tenantCustomerDisplayName: "Acme Tenant",
      }),
    ).toBe(false);
  });

  it("is true when linked but scope is missing country or environment from the link", () => {
    expect(
      shouldShowPerFileGeoEditors(baseBranding, {
        country: "",
        state: "",
        environment: "Education",
        additionalFrameworks: [],
        tenantCustomerDisplayName: "T",
      }),
    ).toBe(true);
    expect(
      shouldShowPerFileGeoEditors(baseBranding, {
        country: "United Kingdom",
        state: "",
        environment: "",
        additionalFrameworks: [],
        tenantCustomerDisplayName: "T",
      }),
    ).toBe(true);
  });

  it("is true when linked but scope geo empty even if branding has defaults", () => {
    expect(
      shouldShowPerFileGeoEditors(baseBranding, {
        country: "",
        state: "",
        environment: "",
        additionalFrameworks: [],
        tenantCustomerDisplayName: "T",
      }),
    ).toBe(true);
  });
});

describe("createScopeFromBranding", () => {
  it("seeds explicit frameworks from branding and defers geo to merge", () => {
    const s = createScopeFromBranding(baseBranding);
    expect(s.country).toBe("");
    expect(s.environment).toBe("");
    const r = resolveStreamFieldsForConfig(baseBranding, s);
    expect(r.country).toBe("United Kingdom");
    expect(r.selectedFrameworks).toEqual(["ISO 27001"]);
  });
});

describe("serializeScope / deserializeScope", () => {
  it("round-trips explicitSelectedFrameworks", () => {
    const s = {
      country: "UK",
      state: "",
      environment: "Education",
      additionalFrameworks: [],
      explicitSelectedFrameworks: ["GDPR", "DfE / KCSIE"] as ("GDPR" | "DfE / KCSIE")[],
    };
    const ser = serializeScope(s);
    expect(ser.explicitSelectedFrameworks).toEqual(["GDPR", "DfE / KCSIE"]);
    const back = deserializeScope(ser);
    expect(back.explicitSelectedFrameworks).toEqual(["GDPR", "DfE / KCSIE"]);
  });

  it("round-trips webFilterComplianceMode", () => {
    const s = {
      country: "UK",
      state: "",
      environment: "",
      additionalFrameworks: [] as const,
      explicitSelectedFrameworks: ["GDPR"] as "GDPR"[],
      webFilterComplianceMode: "informational" as const,
    };
    const back = deserializeScope(serializeScope(s));
    expect(back.webFilterComplianceMode).toBe("informational");
  });

  it("omits explicit key in JSON shape when undefined", () => {
    const s = {
      country: "UK",
      state: "",
      environment: "",
      additionalFrameworks: [],
    };
    const ser = serializeScope(s);
    expect(ser.explicitSelectedFrameworks).toBeUndefined();
    const back = deserializeScope(ser);
    expect(back.explicitSelectedFrameworks).toBeUndefined();
  });
});

describe("seedExplicitFrameworksForLinkedScope", () => {
  it("merges branding fallback geo and returns defaults", () => {
    const link: FirewallLink = {
      configId: "c",
      firewallId: "f",
      tenantId: "t",
      hostname: "h",
      serialNumber: "s",
      model: "m",
      firmwareVersion: "v",
      tenantCustomerDisplayName: "Tenant",
    };
    const built = scopeFromFirewallLink(link, []);
    expect(built).not.toBeNull();
    const seed = seedExplicitFrameworksForLinkedScope(baseBranding, built!);
    expect(seed.length).toBeGreaterThan(0);
    expect(seed).toContain("DfE / KCSIE");
  });
});

describe("mergeScopeWithBrandingForEffective", () => {
  it("fills missing scope country from branding", () => {
    const scope = {
      country: "",
      state: "",
      environment: "",
      additionalFrameworks: [],
    };
    const m = mergeScopeWithBrandingForEffective(baseBranding, scope);
    expect(m.country).toBe("United Kingdom");
    expect(m.environment).toBe("Education");
  });
});

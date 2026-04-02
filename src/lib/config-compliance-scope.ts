import type { FirewallLink } from "@/components/FirewallLinkPicker";
import type { BrandingData } from "@/components/BrandingSetup";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import { getDefaultFrameworks, type ComplianceFramework } from "@/lib/compliance-context-options";

/** Persisted per uploaded config (`ParsedFile.id` / `config_hash`). */
export type ConfigComplianceScope = {
  country: string;
  state: string;
  environment: string;
  /** Sophos tenant / customer label for reports when linked. */
  tenantCustomerDisplayName?: string;
  /** Legacy: merged with getDefaultFrameworks when `explicitSelectedFrameworks` is unset. */
  additionalFrameworks: ComplianceFramework[];
  /**
   * When set (including `[]`), authoritative framework list for this linked config.
   * When `undefined`, use implicit `effectiveFrameworks` (geo + additionalFrameworks) — legacy sessions.
   */
  explicitSelectedFrameworks?: ComplianceFramework[];
  /** Per-firewall WAN web-filter finding tone (defaults to branding when unset). */
  webFilterComplianceMode?: WebFilterComplianceMode;
};

export type SerializableConfigComplianceScope = {
  country: string;
  state: string;
  environment: string;
  tenantCustomerDisplayName?: string;
  additionalFrameworks: string[];
  explicitSelectedFrameworks?: string[];
  webFilterComplianceMode?: WebFilterComplianceMode;
};

export function serializeScope(s: ConfigComplianceScope): SerializableConfigComplianceScope {
  const base: SerializableConfigComplianceScope = {
    country: s.country,
    state: s.state,
    environment: s.environment,
    tenantCustomerDisplayName: s.tenantCustomerDisplayName,
    additionalFrameworks: [...s.additionalFrameworks],
  };
  if (s.explicitSelectedFrameworks !== undefined) {
    base.explicitSelectedFrameworks = [...s.explicitSelectedFrameworks];
  }
  if (s.webFilterComplianceMode !== undefined) {
    base.webFilterComplianceMode = s.webFilterComplianceMode;
  }
  return base;
}

export function deserializeScope(s: SerializableConfigComplianceScope): ConfigComplianceScope {
  const out: ConfigComplianceScope = {
    country: s.country ?? "",
    state: s.state ?? "",
    environment: s.environment ?? "",
    tenantCustomerDisplayName: s.tenantCustomerDisplayName,
    additionalFrameworks: (s.additionalFrameworks ?? []) as ComplianceFramework[],
  };
  if (s.explicitSelectedFrameworks !== undefined) {
    out.explicitSelectedFrameworks = s.explicitSelectedFrameworks as ComplianceFramework[];
  }
  if (s.webFilterComplianceMode !== undefined) {
    out.webFilterComplianceMode = s.webFilterComplianceMode;
  }
  return out;
}

/** Seed a per-upload scope from session Customer Context (geo left empty so branding fills via merge). */
export function createScopeFromBranding(branding: BrandingData): ConfigComplianceScope {
  const country = branding.country?.trim() ?? "";
  const environment = branding.environment?.trim() ?? "";
  const state = country === "United States" ? (branding.state?.trim() ?? "") : "";
  const fromBranding =
    branding.selectedFrameworks.length > 0
      ? [...branding.selectedFrameworks]
      : getDefaultFrameworks(environment, country, state);
  return {
    country: "",
    state: "",
    environment: "",
    additionalFrameworks: [],
    explicitSelectedFrameworks: fromBranding,
    webFilterComplianceMode: branding.webFilterComplianceMode ?? "strict",
  };
}

export function effectiveFrameworks(scope: ConfigComplianceScope): ComplianceFramework[] {
  const defaults = getDefaultFrameworks(
    scope.environment,
    scope.country,
    scope.country === "United States" ? scope.state : "",
  );
  const seen = new Set<string>();
  const out: ComplianceFramework[] = [];
  for (const f of [...defaults, ...scope.additionalFrameworks]) {
    if (!seen.has(f)) {
      seen.add(f);
      out.push(f);
    }
  }
  return out;
}

/** Build scope from Central link (`explicitSelectedFrameworks` seeded in Index). */
export function scopeFromFirewallLink(
  link: FirewallLink,
  preserveAdditional?: ComplianceFramework[],
): ConfigComplianceScope | null {
  const ctx = link.complianceContext;
  const tenant = link.tenantCustomerDisplayName?.trim() ?? "";
  if (!ctx && !tenant) return null;
  const country = (ctx?.country ?? "").trim();
  const state = country === "United States" ? (ctx?.state ?? "").trim() : "";
  const environment = (ctx?.environment ?? "").trim();
  return {
    country,
    state,
    environment,
    ...(tenant ? { tenantCustomerDisplayName: tenant } : {}),
    additionalFrameworks: preserveAdditional?.length ? [...preserveAdditional] : [],
  };
}

/** Merge link scope with Customer Context branding for geo + legacy addons (no explicit list). */
export function mergeScopeWithBrandingForEffective(
  branding: BrandingData,
  scope: ConfigComplianceScope,
): ConfigComplianceScope {
  const country = scope.country?.trim() || branding.country?.trim() || "";
  const environment = scope.environment?.trim() || branding.environment?.trim() || "";
  const state =
    country === "United States" ? scope.state?.trim() || branding.state?.trim() || "" : "";
  return {
    country,
    state,
    environment,
    tenantCustomerDisplayName: scope.tenantCustomerDisplayName,
    additionalFrameworks: [...scope.additionalFrameworks],
  };
}

/**
 * When true, show environment / country (and US state) editors on the per-file compliance panel.
 * Unlinked uploads always show them. Central-linked rows hide only when **the link** populated both
 * `country` and `environment` on the scope (chips above are enough); if either is missing on the
 * scope, show editors even when Customer context would fill the gap.
 */
export function shouldShowPerFileGeoEditors(
  _branding: BrandingData,
  scope: ConfigComplianceScope,
): boolean {
  const linked = !!scope.tenantCustomerDisplayName?.trim();
  if (!linked) return true;
  const fromLink = !!scope.country?.trim() && !!scope.environment?.trim();
  return !fromLink;
}

/** Initial `explicitSelectedFrameworks` after Central link (merged geo + legacy addons). */
export function seedExplicitFrameworksForLinkedScope(
  branding: BrandingData,
  built: ConfigComplianceScope,
): ComplianceFramework[] {
  return effectiveFrameworks(mergeScopeWithBrandingForEffective(branding, built));
}

export type ResolvedStreamComplianceFields = {
  environment?: string;
  country?: string;
  customerName?: string;
  selectedFrameworks?: string[];
};

export function resolveStreamFieldsForConfig(
  branding: BrandingData,
  scope: ConfigComplianceScope | undefined,
): ResolvedStreamComplianceFields {
  const scopeHasGeoOrTenant =
    !!scope &&
    (!!scope.country?.trim() ||
      !!scope.environment?.trim() ||
      !!scope.tenantCustomerDisplayName?.trim());
  const scopeHasAddons = !!(scope?.additionalFrameworks && scope.additionalFrameworks.length > 0);
  const scopeHasExplicit = scope?.explicitSelectedFrameworks !== undefined;
  if (!scope || (!scopeHasGeoOrTenant && !scopeHasAddons && !scopeHasExplicit)) {
    return {
      environment: branding.environment?.trim() || undefined,
      country: branding.country?.trim() || undefined,
      customerName: branding.customerName?.trim() || undefined,
      selectedFrameworks:
        branding.selectedFrameworks.length > 0 ? [...branding.selectedFrameworks] : undefined,
    };
  }
  const mergedScope = mergeScopeWithBrandingForEffective(branding, scope);
  const country = mergedScope.country;
  const environment = mergedScope.environment;
  const customerName =
    scope.tenantCustomerDisplayName?.trim() || branding.customerName?.trim() || undefined;

  let selectedFrameworks: ComplianceFramework[] | undefined;
  if (scope.explicitSelectedFrameworks !== undefined) {
    selectedFrameworks = [...scope.explicitSelectedFrameworks];
  } else {
    const eff = effectiveFrameworks(mergedScope);
    selectedFrameworks =
      eff.length > 0
        ? eff
        : branding.selectedFrameworks.length > 0
          ? [...branding.selectedFrameworks]
          : undefined;
  }

  return {
    environment: environment.trim() || undefined,
    country: country.trim() || undefined,
    customerName,
    selectedFrameworks,
  };
}

/** Resolved env|country fingerprint for comparing across configs (uses branding fallback). */
export function resolvedGeoFingerprint(
  branding: BrandingData,
  scope: ConfigComplianceScope | undefined,
): string {
  const environment = scope?.environment?.trim() || branding.environment?.trim() || "";
  const country = scope?.country?.trim() || branding.country?.trim() || "";
  const state =
    country === "United States" ? scope?.state?.trim() || branding.state?.trim() || "" : "";
  return `${environment}\0${country}\0${state}`;
}

/** True if files resolve to more than one geo/sector fingerprint (executive jurisdictional note). */
export function filesHaveDifferingGeo(
  files: { id: string }[],
  scopeMap: Record<string, ConfigComplianceScope>,
  branding: BrandingData,
): boolean {
  if (files.length <= 1) return false;
  const keys = new Set(files.map((f) => resolvedGeoFingerprint(branding, scopeMap[f.id])));
  return keys.size > 1;
}

export function buildExecutiveJurisdictionSummary(
  files: { id: string }[],
  scopeMap: Record<string, ConfigComplianceScope>,
  branding: BrandingData,
): string | undefined {
  if (!filesHaveDifferingGeo(files, scopeMap, branding)) return undefined;
  return (
    "Jurisdictional note: This estate spans multiple compliance contexts (different countries and/or environment types). " +
    "Use this report for high-level posture across firewalls; for framework-specific mapping, use individual firewall reports or the Compliance Readiness report, which lists per-device scope when available."
  );
}

export type PerFirewallComplianceContextEntry = {
  environment?: string;
  country?: string;
  selectedFrameworks?: string[];
  webFilterComplianceMode?: "strict" | "informational";
};

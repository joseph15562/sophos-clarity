import type { FirewallLink } from "@/components/FirewallLinkPicker";
import type { BrandingData } from "@/components/BrandingSetup";
import { getDefaultFrameworks, type ComplianceFramework } from "@/lib/compliance-context-options";

/** Persisted per uploaded config (`ParsedFile.id` / `config_hash`). */
export type ConfigComplianceScope = {
  country: string;
  state: string;
  environment: string;
  /** Sophos tenant / customer label for reports when linked. */
  tenantCustomerDisplayName?: string;
  /** User-chosen extras; merged with getDefaultFrameworks for effective list. */
  additionalFrameworks: ComplianceFramework[];
};

export type SerializableConfigComplianceScope = {
  country: string;
  state: string;
  environment: string;
  tenantCustomerDisplayName?: string;
  additionalFrameworks: string[];
};

export function serializeScope(s: ConfigComplianceScope): SerializableConfigComplianceScope {
  return {
    country: s.country,
    state: s.state,
    environment: s.environment,
    tenantCustomerDisplayName: s.tenantCustomerDisplayName,
    additionalFrameworks: [...s.additionalFrameworks],
  };
}

export function deserializeScope(s: SerializableConfigComplianceScope): ConfigComplianceScope {
  return {
    country: s.country ?? "",
    state: s.state ?? "",
    environment: s.environment ?? "",
    tenantCustomerDisplayName: s.tenantCustomerDisplayName,
    additionalFrameworks: (s.additionalFrameworks ?? []) as ComplianceFramework[],
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

/** Build scope from Central link; keeps prior additionalFrameworks for same configId. */
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
  if (!scope || (!scopeHasGeoOrTenant && !scopeHasAddons)) {
    return {
      environment: branding.environment?.trim() || undefined,
      country: branding.country?.trim() || undefined,
      customerName: branding.customerName?.trim() || undefined,
      selectedFrameworks:
        branding.selectedFrameworks.length > 0 ? [...branding.selectedFrameworks] : undefined,
    };
  }
  const country = scope.country?.trim() || branding.country?.trim() || "";
  const environment = scope.environment?.trim() || branding.environment?.trim() || "";
  const state =
    country === "United States" ? scope.state?.trim() || branding.state?.trim() || "" : "";
  const mergedScope: ConfigComplianceScope = {
    country,
    state,
    environment,
    tenantCustomerDisplayName: scope.tenantCustomerDisplayName,
    additionalFrameworks: scope.additionalFrameworks,
  };
  const eff = effectiveFrameworks(mergedScope);
  const customerName =
    scope.tenantCustomerDisplayName?.trim() || branding.customerName?.trim() || undefined;
  const selectedFrameworks =
    eff.length > 0
      ? eff
      : branding.selectedFrameworks.length > 0
        ? [...branding.selectedFrameworks]
        : undefined;
  return {
    environment: environment || undefined,
    country: country || undefined,
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
};

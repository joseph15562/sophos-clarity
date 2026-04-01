import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  ImageIcon,
  Globe,
  Landmark,
  User,
  ShieldCheck,
  Plus,
  ChevronDown,
  Filter,
  FileText,
  Scale,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyLogo } from "@/hooks/use-company-logo";
import { loadHistory } from "@/lib/assessment-history";
import { loadHistoryCloud } from "@/lib/assessment-cloud";
import { loadSavedReportsCloud, loadSavedReportsLocal } from "@/lib/saved-reports";
import {
  getCachedTenants,
  getEffectiveTenantDisplayName,
  isThisTenantPlaceholder,
  displayCustomerNameForUi,
  type CentralTenant,
} from "@/lib/sophos-central";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";

export const ENVIRONMENT_TYPES = [
  "Education",
  "Government",
  "Healthcare",
  "Housing",
  "Operational Technology",
  "Private Sector",
  "Financial Services",
  "Retail & Hospitality",
  "Critical Infrastructure",
  "Non-Profit / Charity",
  "Legal",
  "Defence",
] as const;

export const COUNTRIES = [
  "United Kingdom",
  "United States",
  "Australia",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "Ireland",
  "New Zealand",
  "South Africa",
  "United Arab Emirates",
  "Singapore",
  "India",
  "Japan",
] as const;

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

export const ALL_FRAMEWORKS = [
  "GDPR",
  "Cyber Essentials / CE+",
  "NCSC Guidelines",
  "NCSC CAF",
  "PSN",
  "DfE / KCSIE",
  "ISO 27001",
  "PCI DSS",
  "FCA",
  "PRA",
  "HIPAA",
  "HITECH",
  "NIST 800-53",
  "FedRAMP",
  "CMMC",
  "CIS",
  "SOX",
  "SOC 2",
  "IEC 62443",
  "NIST 800-82",
  "NIS2",
  "NERC CIP",
  "MOD Cyber / ITAR",
  "CIPA",
  "Ohio DPA",
] as const;

export type ComplianceFramework = (typeof ALL_FRAMEWORKS)[number];

/** Returns default frameworks for a given environment + country + state combo */
function getDefaultFrameworks(
  environment: string,
  country: string,
  state?: string,
): ComplianceFramework[] {
  const fw: ComplianceFramework[] = [];
  const isUK = country === "United Kingdom";
  const isUS = country === "United States";
  const isEU = ["Germany", "France", "Netherlands", "Ireland"].includes(country);

  // Country-level defaults
  if (isUK) {
    fw.push("GDPR", "Cyber Essentials / CE+", "NCSC Guidelines");
  }
  if (isUS) {
    fw.push("NIST 800-53");
  }
  if (isEU) {
    fw.push("GDPR", "NIS2");
  }
  if (["Australia", "Canada", "New Zealand"].includes(country)) {
    fw.push("ISO 27001");
  }

  // State-level defaults (US only)
  if (isUS && state === "Ohio") {
    fw.push("Ohio DPA");
  }

  // Environment-level defaults
  switch (environment) {
    case "Education":
      if (isUK) fw.push("DfE / KCSIE");
      if (isUS) fw.push("CIPA");
      break;
    case "Healthcare":
      if (isUK) fw.push("NCSC CAF");
      if (isUS) fw.push("HIPAA", "HITECH");
      break;
    case "Government":
      if (isUK) fw.push("NCSC CAF", "PSN");
      if (isUS) fw.push("FedRAMP", "CMMC");
      break;
    case "Financial Services":
      fw.push("PCI DSS", "SOX", "SOC 2");
      if (isUK) fw.push("FCA", "PRA");
      break;
    case "Operational Technology":
      fw.push("IEC 62443", "NIST 800-82");
      if (isUK) fw.push("NCSC CAF");
      break;
    case "Critical Infrastructure":
      if (isUK) fw.push("NCSC CAF");
      if (isEU) fw.push("NIS2");
      if (isUS) fw.push("NERC CIP");
      break;
    case "Defence":
      fw.push("MOD Cyber / ITAR", "CMMC");
      if (isUK) fw.push("NCSC CAF");
      break;
    case "Retail & Hospitality":
      fw.push("PCI DSS");
      break;
  }

  // Deduplicate
  return [...new Set(fw)];
}

export type BrandingData = {
  companyName: string;
  logoUrl: string | null;
  customerName: string;
  environment: string;
  country: string;
  state?: string;
  selectedFrameworks: ComplianceFramework[];
  preparedBy?: string;
  footerText?: string;
  accentColor?: string;
  /** When true, adds "Confidential" watermark to PDF export */
  confidential?: boolean;
  /** WAN web-filter gap finding severity: strict (default) vs informational for scoped assessments */
  webFilterComplianceMode?: WebFilterComplianceMode;
  /** Firewall rule names excluded from missing-web-filter compliance check */
  webFilterExemptRuleNames?: string[];
};

type Props = {
  branding: BrandingData;
  onChange: React.Dispatch<React.SetStateAction<BrandingData>>;
};

export function BrandingSetup({ branding, onChange }: Props) {
  const { isGuest, org } = useAuth();
  const { logoUrl: orgWorkspaceLogoUrl } = useCompanyLogo();
  /** When non-null, report logo was last set from workspace logo (so we can follow workspace updates). */
  const lastSyncedWorkspaceLogoRef = useRef<string | null>(null);
  const userTouchedFrameworks = useRef(false);

  const [knownCustomers, setKnownCustomers] = useState<string[]>([]);
  const [customerReportCounts, setCustomerReportCounts] = useState<Record<string, number>>({});
  const [centralTenants, setCentralTenants] = useState<CentralTenant[]>([]);
  const [addingNew, setAddingNew] = useState(false);

  // Auto-fill company name from org when logged in
  useEffect(() => {
    if (!isGuest && org) {
      onChange((prev) =>
        prev.companyName === org.name ? prev : { ...prev, companyName: org.name },
      );
    }
  }, [isGuest, org, onChange]);

  // Auto-fill report identity logo from workspace (Settings → Company logo) when unset, and keep
  // it in sync until the user uploads a different file here.
  useEffect(() => {
    if (isGuest || !org) return;
    const w = orgWorkspaceLogoUrl?.trim() ? orgWorkspaceLogoUrl : null;
    onChange((prev) => {
      const cur = prev.logoUrl?.trim() || null;
      if (!w) {
        if (
          cur &&
          lastSyncedWorkspaceLogoRef.current !== null &&
          cur === lastSyncedWorkspaceLogoRef.current
        ) {
          lastSyncedWorkspaceLogoRef.current = null;
          return { ...prev, logoUrl: null };
        }
        return prev;
      }
      if (!cur) {
        lastSyncedWorkspaceLogoRef.current = w;
        return { ...prev, logoUrl: w };
      }
      if (
        lastSyncedWorkspaceLogoRef.current !== null &&
        cur === lastSyncedWorkspaceLogoRef.current &&
        cur !== w
      ) {
        lastSyncedWorkspaceLogoRef.current = w;
        return { ...prev, logoUrl: w };
      }
      return prev;
    });
  }, [isGuest, org, orgWorkspaceLogoUrl, onChange]);

  // Load known customers from history + saved reports + Central tenants
  useEffect(() => {
    const load = async () => {
      try {
        const useCloud = !isGuest && !!org;
        const [history, savedReports] = await Promise.all([
          useCloud ? loadHistoryCloud() : loadHistory(),
          useCloud ? loadSavedReportsCloud() : loadSavedReportsLocal(),
        ]);
        const allNames = new Set<string>();
        history.forEach((h) => {
          if (h.customerName && h.customerName !== "Unnamed") allNames.add(h.customerName);
        });
        savedReports.forEach((r) => {
          if (r.customerName && r.customerName !== "Unnamed") allNames.add(r.customerName);
        });
        const names = [...allNames].sort((a, b) => a.localeCompare(b));
        setKnownCustomers(names);

        const counts: Record<string, number> = {};
        for (const r of savedReports) {
          const n = r.customerName;
          if (n && n !== "Unnamed") counts[n] = (counts[n] || 0) + 1;
        }
        setCustomerReportCounts(counts);

        if (useCloud && org) {
          try {
            const tenants = await getCachedTenants(org.id);
            setCentralTenants(tenants);
          } catch (err) {
            console.warn("[BrandingSetup] getCachedTenants", err);
          }
        }
      } catch (err) {
        console.warn("[BrandingSetup] load", err);
      }
    };
    load();
  }, [isGuest, org]);

  const selectCustomer = useCallback(
    (name: string) => {
      onChange((prev) => ({ ...prev, customerName: name }));
      setAddingNew(false);
    },
    [onChange],
  );

  /** Pass org name when current customer is the Central placeholder so tenant rows resolve correctly. */
  const tenantResolutionFallback = useMemo(() => {
    if (org?.name?.trim() && isThisTenantPlaceholder(branding.customerName)) {
      return org.name.trim();
    }
    return branding.customerName ?? "";
  }, [org?.name, branding.customerName]);

  useEffect(() => {
    if (userTouchedFrameworks.current) return;
    if (branding.environment || branding.country) {
      const defaults = getDefaultFrameworks(branding.environment, branding.country, branding.state);
      onChange((prev) => ({ ...prev, selectedFrameworks: defaults }));
    }
  }, [branding.environment, branding.country, branding.state, onChange]);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      lastSyncedWorkspaceLogoRef.current = null;
      onChange({ ...branding, logoUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const toggleFramework = (fw: ComplianceFramework) => {
    userTouchedFrameworks.current = true;
    const current = branding.selectedFrameworks;
    const next = current.includes(fw) ? current.filter((f) => f !== fw) : [...current, fw];
    onChange({ ...branding, selectedFrameworks: next });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-brand-accent/15 bg-[linear-gradient(145deg,rgba(32,6,247,0.04),rgba(90,0,255,0.02),transparent_60%)] dark:bg-[linear-gradient(145deg,rgba(32,6,247,0.10),rgba(90,0,255,0.05),transparent_60%)] p-4 sm:p-5 space-y-4 shadow-card">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/20 bg-brand-accent/[0.06] dark:bg-brand-accent/[0.10] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
              <FileText className="h-3 w-3" />
              Report identity
            </span>
            <h4 className="text-base font-display font-bold tracking-tight text-foreground mt-2">
              Set how the assessment appears in reports
            </h4>
            <p className="text-xs text-muted-foreground">
              These fields control the report header, attribution, and exported delivery details.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="company"
              className="flex items-center gap-2 font-display font-semibold tracking-tight text-foreground"
            >
              <Building2 className="h-4 w-4" /> Company Name
              {!isGuest && org && (
                <span className="text-[9px] text-muted-foreground font-normal ml-1">
                  (from organization)
                </span>
              )}
            </Label>
            <Input
              id="company"
              placeholder="Your MSP Company Name"
              value={branding.companyName}
              onChange={(e) => onChange({ ...branding, companyName: e.target.value })}
              readOnly={!isGuest && !!org}
              className={!isGuest && org ? "bg-muted/50 cursor-default" : "bg-background/80"}
            />
            <p className="text-[11px] text-muted-foreground">
              Displayed on exported reports and customer-facing deliverables.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="logo"
              className="flex items-center gap-2 font-display font-semibold tracking-tight text-foreground"
            >
              <ImageIcon className="h-4 w-4" /> Company Logo
              {!isGuest && org && (
                <span className="text-[9px] text-muted-foreground font-normal ml-1">
                  (from workspace when unset)
                </span>
              )}
            </Label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 min-w-[160px] items-center justify-center rounded-xl border border-dashed border-border bg-background/70 px-4">
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt="Logo"
                    className="h-12 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-muted-foreground">No logo uploaded</span>
                )}
              </div>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogo}
                className="max-w-xs bg-background/80"
              />
            </div>
            {!isGuest && org && orgWorkspaceLogoUrl && (
              <p className="text-[11px] text-muted-foreground">
                The logo from Settings (Company logo) is copied here automatically. Choose a file
                above to use a different logo on this assessment only.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="preparedBy"
                className="flex items-center gap-2 text-xs font-display font-semibold tracking-tight text-foreground"
              >
                <User className="h-3.5 w-3.5" /> Prepared By
              </Label>
              <Input
                id="preparedBy"
                placeholder="e.g. Joseph McDonald, Security Consultant"
                value={branding.preparedBy ?? ""}
                onChange={(e) => onChange({ ...branding, preparedBy: e.target.value })}
                className="text-sm bg-background/80"
              />
              <p className="text-[11px] text-muted-foreground">
                Used for report attribution and delivery ownership.
              </p>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="footerText"
                className="flex items-center gap-2 text-xs font-display font-semibold tracking-tight text-foreground"
              >
                <Building2 className="h-3.5 w-3.5" /> Report Footer Text
              </Label>
              <Input
                id="footerText"
                placeholder="e.g. Confidential — For internal use only"
                value={branding.footerText ?? ""}
                onChange={(e) => onChange({ ...branding, footerText: e.target.value })}
                className="text-sm bg-background/80"
              />
              <p className="text-[11px] text-muted-foreground">
                Ideal for confidentiality wording, engagement notes, or internal-only disclaimers.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(32,6,247,0.05),rgba(0,242,179,0.04),transparent_70%)] dark:bg-[linear-gradient(135deg,rgba(32,6,247,0.12),rgba(0,242,179,0.06),transparent_70%)] p-4 sm:p-5 space-y-4 shadow-card">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.06] dark:bg-[#00F2B3]/[0.10] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#007A5A] dark:text-[#00F2B3]">
              <Globe className="h-3 w-3" />
              Customer context
            </span>
            <h4 className="text-base font-display font-bold tracking-tight text-foreground mt-2">
              Anchor the assessment to the right customer and scope
            </h4>
            <p className="text-xs text-muted-foreground">
              Customer, geography, and sector settings influence defaults and how findings are
              framed.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-border/50 bg-card/80 p-4">
            <Label
              htmlFor="customerName"
              className="flex items-center gap-2 font-display font-semibold tracking-tight text-foreground"
            >
              <User className="h-4 w-4" /> Customer Name
            </Label>

            {addingNew || (knownCustomers.length === 0 && centralTenants.length === 0) ? (
              <>
                <div className="flex gap-2 max-w-md">
                  <Input
                    id="customerName"
                    placeholder="Enter customer / client name"
                    value={branding.customerName}
                    onChange={(e) => onChange({ ...branding, customerName: e.target.value })}
                    autoFocus={addingNew}
                    className="bg-background/80"
                  />
                  {(knownCustomers.length > 0 || centralTenants.length > 0) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddingNew(false)}
                      className="gap-1 text-xs shrink-0"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">List</span>
                    </Button>
                  )}
                </div>
                {addingNew && (knownCustomers.length > 0 || centralTenants.length > 0) && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Plus className="h-2.5 w-2.5" /> Adding new customer.
                    <button
                      onClick={() => {
                        setAddingNew(false);
                        onChange({ ...branding, customerName: "" });
                      }}
                      className="text-brand-accent hover:underline ml-1"
                    >
                      Back to list
                    </button>
                  </p>
                )}
              </>
            ) : (
              <div className="flex gap-2 max-w-md">
                <Select
                  value={branding.customerName || undefined}
                  onValueChange={(val) => {
                    if (val === "__new__") {
                      setAddingNew(true);
                      onChange((prev) => ({ ...prev, customerName: "" }));
                    } else {
                      selectCustomer(val);
                    }
                  }}
                >
                  <SelectTrigger id="customerName" className="flex-1 bg-background/80">
                    <SelectValue placeholder="Select customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const orphanVal = branding.customerName;
                      if (
                        !orphanVal ||
                        centralTenants.some(
                          (t) =>
                            (getEffectiveTenantDisplayName(t, tenantResolutionFallback) ||
                              t.name) === orphanVal || t.name === orphanVal,
                        ) ||
                        knownCustomers.includes(orphanVal)
                      ) {
                        return null;
                      }
                      return (
                        <SelectItem
                          value={orphanVal}
                          onPointerUp={() => {
                            if (branding.customerName === orphanVal) selectCustomer(orphanVal);
                          }}
                        >
                          {displayCustomerNameForUi(orphanVal, org?.name)} (from connector)
                        </SelectItem>
                      );
                    })()}
                    {centralTenants
                      .filter((t) => {
                        const resolved =
                          getEffectiveTenantDisplayName(t, tenantResolutionFallback) || t.name;
                        return !knownCustomers.includes(resolved);
                      })
                      .map((t) => {
                        const displayName =
                          getEffectiveTenantDisplayName(t, tenantResolutionFallback) || t.name;
                        return (
                          <SelectItem
                            key={`central-${t.id}`}
                            value={displayName}
                            onPointerUp={() => {
                              if (branding.customerName === displayName) {
                                selectCustomer(displayName);
                              }
                            }}
                          >
                            {displayName} {t.dataRegion ? `(${t.dataRegion})` : ""}
                          </SelectItem>
                        );
                      })}
                    {knownCustomers.map((name) => {
                      const reportsSuffix =
                        customerReportCounts[name] > 0
                          ? ` (${customerReportCounts[name]} report${customerReportCounts[name] !== 1 ? "s" : ""})`
                          : "";
                      return (
                        <SelectItem
                          key={name}
                          value={name}
                          onPointerUp={() => {
                            /* Radix omits onValueChange when value unchanged — re-apply so parent still updates */
                            if (branding.customerName === name) selectCustomer(name);
                          }}
                        >
                          {displayCustomerNameForUi(name, org?.name)}
                          {reportsSuffix}
                        </SelectItem>
                      );
                    })}
                    <SelectItem value="__new__">＋ Add New Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              The client whose firewall configuration is being assessed and documented.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="environment"
                className="flex items-center gap-2 font-display font-semibold tracking-tight text-foreground"
              >
                <Landmark className="h-4 w-4" /> Environment Type
              </Label>
              <Select
                value={branding.environment}
                onValueChange={(v) => {
                  userTouchedFrameworks.current = false;
                  const defaults = getDefaultFrameworks(v, branding.country, branding.state);
                  onChange((prev) => ({ ...prev, environment: v, selectedFrameworks: defaults }));
                }}
              >
                <SelectTrigger id="environment" className="bg-background/80">
                  <SelectValue placeholder="Select environment…" />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENT_TYPES.map((env) => (
                    <SelectItem key={env} value={env}>
                      {env}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Best practice recommendations align with this sector.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="country"
                className="flex items-center gap-2 font-display font-semibold tracking-tight text-foreground"
              >
                <Globe className="h-4 w-4" /> Country
              </Label>
              <Select
                value={branding.country}
                onValueChange={(v) => {
                  userTouchedFrameworks.current = false;
                  const newState = v === "United States" ? branding.state : undefined;
                  const defaults = getDefaultFrameworks(branding.environment, v, newState);
                  onChange((prev) => ({
                    ...prev,
                    country: v,
                    state: newState,
                    selectedFrameworks: defaults,
                  }));
                }}
              >
                <SelectTrigger id="country" className="bg-background/80">
                  <SelectValue placeholder="Select country…" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Regional frameworks and compliance defaults are applied from here.
              </p>
            </div>
          </div>

          {branding.country === "United States" && (
            <div className="space-y-2 max-w-xs">
              <Label
                htmlFor="state"
                className="flex items-center gap-2 font-display font-semibold tracking-tight text-foreground"
              >
                <Globe className="h-4 w-4" /> State
              </Label>
              <Select
                value={branding.state ?? ""}
                onValueChange={(v) => {
                  userTouchedFrameworks.current = false;
                  const defaults = getDefaultFrameworks(branding.environment, branding.country, v);
                  onChange((prev) => ({ ...prev, state: v, selectedFrameworks: defaults }));
                }}
              >
                <SelectTrigger id="state" className="bg-background/80">
                  <SelectValue placeholder="Select state…" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                State-specific frameworks such as Ohio DPA are auto-selected when relevant.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-brand-accent/15 bg-[linear-gradient(160deg,rgba(90,0,255,0.04),rgba(32,6,247,0.03),transparent_50%)] dark:bg-[linear-gradient(160deg,rgba(90,0,255,0.08),rgba(32,6,247,0.06),transparent_50%)] p-4 sm:p-5 space-y-4 shadow-card">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-violet/20 bg-brand-violet/[0.06] dark:bg-brand-violet/[0.10] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-violet">
            <Scale className="h-3 w-3" />
            Compliance alignment
          </span>
          <h4 className="text-base font-display font-bold tracking-tight text-foreground mt-2">
            Tune scope and framework mapping
          </h4>
          <p className="text-xs text-muted-foreground">
            Select the frameworks that should shape findings, executive summaries, and compliance
            reporting.
          </p>
        </div>

        <div className="space-y-2 max-w-xl">
          <Label
            htmlFor="web-filter-compliance"
            className="flex items-center gap-2 font-display font-semibold tracking-tight text-foreground"
          >
            <Filter className="h-4 w-4" /> Web filter compliance
          </Label>
          <Select
            value={branding.webFilterComplianceMode ?? "strict"}
            onValueChange={(v) =>
              onChange({
                ...branding,
                webFilterComplianceMode: v as WebFilterComplianceMode,
              })
            }
          >
            <SelectTrigger id="web-filter-compliance" className="bg-background/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strict">Strict</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            <strong>Strict</strong> (default): WAN rules without web filtering are flagged as
            higher-severity findings. <strong>Informational</strong>: the same checks are applied at
            lower severity for scoped assessments; compliance wording avoids overstating regulatory
            risk unless a selected framework explicitly requires it.
          </p>
        </div>

        <div className="space-y-3" data-tour="framework-selector">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Label className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Compliance Frameworks
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Frameworks are automatically selected from customer context. Add or remove
                frameworks to tailor the assessment scope.
              </p>
            </div>
            <div className="text-[11px] font-medium text-muted-foreground rounded-full border border-border px-3 py-1 bg-background/70">
              {branding.selectedFrameworks.length} selected
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 pt-1">
            {ALL_FRAMEWORKS.map((fw) => {
              const checked = branding.selectedFrameworks.includes(fw);
              return (
                <label
                  key={fw}
                  className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm cursor-pointer transition-all duration-200 ${checked ? "border-brand-accent/30 bg-brand-accent/[0.07] dark:bg-brand-accent/[0.10] shadow-[0_0_16px_-4px] shadow-brand-accent/15 dark:shadow-brand-accent/20 ring-1 ring-brand-accent/10" : "border-border/50 bg-card/60 hover:bg-card hover:border-border/70 hover:shadow-card"}`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleFramework(fw)} />
                  <span
                    className={`select-none leading-snug ${checked ? "font-semibold text-foreground" : "text-foreground/80 group-hover:text-foreground"}`}
                  >
                    {fw}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

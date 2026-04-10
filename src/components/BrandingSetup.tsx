import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ImageIcon, Globe, User, Plus, ChevronDown, FileText } from "lucide-react";
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
import { resolveCustomerName } from "@/lib/customer-name";
import { fetchCustomerDirectory, type CustomerDirectoryEntry } from "@/lib/customer-directory";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import {
  ALL_FRAMEWORKS,
  COUNTRIES,
  ENVIRONMENT_TYPES,
  US_STATES,
  getDefaultFrameworks,
  mergeDefaultAndDirectoryFrameworks,
  normalizeDirectoryCountry,
  normalizeDirectoryEnvironment,
  type ComplianceFramework,
} from "@/lib/compliance-context-options";

export {
  ALL_FRAMEWORKS,
  COUNTRIES,
  ENVIRONMENT_TYPES,
  US_STATES,
  getDefaultFrameworks,
  mergeDefaultAndDirectoryFrameworks,
  normalizeDirectoryCountry,
  normalizeDirectoryEnvironment,
  type ComplianceFramework,
};

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
  /** When multiple configs are open, linked firewalls may override geography per file. */
  multiConfig?: boolean;
  /** Resolved country/sector/state differs across files (branding fallback for unlinked rows). */
  mixedJurisdiction?: boolean;
};

export function BrandingSetup({
  branding,
  onChange,
  multiConfig,
  mixedJurisdiction = false,
}: Props) {
  const { isGuest, org } = useAuth();
  const { logoUrl: orgWorkspaceLogoUrl } = useCompanyLogo();
  /** When non-null, report logo was last set from workspace logo (so we can follow workspace updates). */
  const lastSyncedWorkspaceLogoRef = useRef<string | null>(null);
  const userTouchedFrameworks = useRef(false);
  /** Skip one geo→frameworks sync after hydrating from customer directory (avoids wiping merged list). */
  const skipGeoFrameworkEffectRef = useRef(false);

  const [knownCustomers, setKnownCustomers] = useState<string[]>([]);
  const [customerDirectoryByName, setCustomerDirectoryByName] = useState<
    Map<string, CustomerDirectoryEntry>
  >(() => new Map());
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
        const orgDisplay = String(org?.name ?? "").trim();
        const allRaw = new Set<string>();
        history.forEach((h) => {
          if (h.customerName && h.customerName !== "Unnamed") allRaw.add(h.customerName);
        });
        savedReports.forEach((r) => {
          if (r.customerName && r.customerName !== "Unnamed") allRaw.add(r.customerName);
        });

        const counts: Record<string, number> = {};
        for (const r of savedReports) {
          const n = r.customerName;
          if (!n || n === "Unnamed") continue;
          const key = resolveCustomerName(n, orgDisplay);
          counts[key] = (counts[key] || 0) + 1;
        }
        setCustomerReportCounts(counts);

        let names: string[];
        if (useCloud && org) {
          try {
            const directory = await fetchCustomerDirectory(org.id, org.name);
            names = directory.map((d) => d.name).sort((a, b) => a.localeCompare(b));
            const m = new Map<string, CustomerDirectoryEntry>();
            for (const d of directory) m.set(d.name, d);
            setCustomerDirectoryByName(m);
          } catch (dirErr) {
            console.warn("[BrandingSetup] fetchCustomerDirectory", dirErr);
            setCustomerDirectoryByName(new Map());
            const resolvedUnique = new Set<string>();
            for (const raw of allRaw) {
              resolvedUnique.add(resolveCustomerName(raw, orgDisplay));
            }
            names = [...resolvedUnique].sort((a, b) => a.localeCompare(b));
          }
        } else {
          setCustomerDirectoryByName(new Map());
          const resolvedUnique = new Set<string>();
          for (const raw of allRaw) {
            resolvedUnique.add(resolveCustomerName(raw, orgDisplay));
          }
          names = [...resolvedUnique].sort((a, b) => a.localeCompare(b));
        }
        setKnownCustomers(names);

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
      setAddingNew(false);
      const entry = customerDirectoryByName.get(name);
      if (!entry) {
        onChange((prev) => ({ ...prev, customerName: name }));
        return;
      }
      userTouchedFrameworks.current = false;
      skipGeoFrameworkEffectRef.current = true;
      const env = normalizeDirectoryEnvironment(entry.sector) ?? "";
      const country = normalizeDirectoryCountry(entry.country) ?? "";
      onChange((prev) => {
        const nextState =
          country === "United States"
            ? prev.state && US_STATES.includes(prev.state as (typeof US_STATES)[number])
              ? prev.state
              : undefined
            : undefined;
        const selectedFrameworks = mergeDefaultAndDirectoryFrameworks(
          env,
          country,
          nextState,
          entry.frameworks,
        );
        return {
          ...prev,
          customerName: name,
          environment: env,
          country,
          state: nextState,
          selectedFrameworks,
        };
      });
    },
    [customerDirectoryByName, onChange],
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
    if (skipGeoFrameworkEffectRef.current) {
      skipGeoFrameworkEffectRef.current = false;
      return;
    }
    if (branding.environment || branding.country) {
      const defaults = getDefaultFrameworks(branding.environment, branding.country, branding.state);
      onChange((prev) => ({ ...prev, selectedFrameworks: defaults }));
    }
  }, [branding.environment, branding.country, branding.state, onChange]);

  /** When customer name matches org directory but geo is still empty, fill from Fleet (?customer=, etc.). */
  useEffect(() => {
    const name = branding.customerName?.trim();
    if (!name) return;
    const entry = customerDirectoryByName.get(name);
    if (!entry) return;
    if (branding.environment?.trim() || branding.country?.trim()) return;

    const env = normalizeDirectoryEnvironment(entry.sector) ?? "";
    const country = normalizeDirectoryCountry(entry.country) ?? "";
    if (!env && !country && (!entry.frameworks || entry.frameworks.length === 0)) return;

    userTouchedFrameworks.current = false;
    skipGeoFrameworkEffectRef.current = true;
    onChange((prev) => {
      const nextState =
        country === "United States"
          ? prev.state && US_STATES.includes(prev.state as (typeof US_STATES)[number])
            ? prev.state
            : undefined
          : undefined;
      const selectedFrameworks = mergeDefaultAndDirectoryFrameworks(
        env,
        country,
        nextState,
        entry.frameworks,
      );
      return {
        ...prev,
        environment: env || prev.environment,
        country: country || prev.country,
        state: nextState,
        selectedFrameworks,
      };
    });
  }, [
    branding.customerName,
    branding.environment,
    branding.country,
    customerDirectoryByName,
    onChange,
  ]);

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

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-brand-accent/15 bg-[linear-gradient(145deg,rgba(32,6,247,0.04),rgba(90,0,255,0.02),transparent_55%),linear-gradient(135deg,rgba(0,242,179,0.03),transparent_45%)] dark:bg-[linear-gradient(145deg,rgba(32,6,247,0.10),rgba(90,0,255,0.05),transparent_55%),linear-gradient(135deg,rgba(0,242,179,0.06),transparent_45%)] p-4 sm:p-5 sm:p-6 pt-6 shadow-card">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7]/80 via-brand-accent/60 to-[#008F69]/70 dark:to-[#00F2B3]/50 pointer-events-none"
          aria-hidden
        />
        <div className="relative space-y-8">
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

          <div className="border-t border-border/60 pt-6 space-y-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.06] dark:bg-[#00F2B3]/[0.10] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#007A5A] dark:text-[#00F2B3]">
                <Globe className="h-3 w-3" />
                Customer context
              </span>
              <h4 className="text-base font-display font-bold tracking-tight text-foreground mt-2">
                Who this assessment is for
              </h4>
              <p className="text-xs text-muted-foreground">
                Customer name drives report titles and narrative. Sector and country are set per
                upload under{" "}
                <strong className="text-foreground/90">Compliance (this firewall)</strong> (or come
                from a Central link).
              </p>
              {multiConfig ? (
                <p className="text-[11px] text-muted-foreground rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  Multiple configs: each row has its own compliance scope and Central link. This
                  customer label applies across the session for cover pages and executive wording.
                </p>
              ) : null}
              {multiConfig && mixedJurisdiction ? (
                <p className="text-[11px] text-foreground/90 rounded-lg border border-amber-500/35 bg-amber-500/[0.08] dark:bg-amber-500/[0.12] px-3 py-2">
                  <strong className="text-foreground">
                    Different regions or sectors across uploads:
                  </strong>{" "}
                  use each file&apos;s{" "}
                  <strong className="text-foreground">Scope for this export</strong> and framework
                  checklist — e.g. UK Education vs Canada Education — not only this customer name.
                </p>
              ) : null}
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card/80 p-4 max-w-2xl">
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
                {isGuest || !org ? null : (
                  <>
                    {" "}
                    Picking a customer from your directory can still apply Fleet-backed sector,
                    region, and framework defaults in the background when that data is available.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
        <strong className="text-foreground/90">Compliance frameworks</strong> and{" "}
        <strong className="text-foreground/90">web filter</strong> tone are set{" "}
        <strong className="text-foreground/90">per firewall</strong> under each upload row (new
        uploads copy session defaults from branding until you adjust each row).
      </p>
    </div>
  );
}

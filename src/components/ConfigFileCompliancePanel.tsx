import { useMemo, useCallback } from "react";
import { FileText, Filter, Globe, Landmark, MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BrandingData } from "@/components/BrandingSetup";
import { ComplianceFrameworkGrid } from "@/components/ComplianceFrameworkGrid";
import type { ConfigComplianceScope } from "@/lib/config-compliance-scope";
import {
  effectiveFrameworks,
  mergeScopeWithBrandingForEffective,
  shouldShowPerFileGeoEditors,
} from "@/lib/config-compliance-scope";
import {
  COUNTRIES,
  ENVIRONMENT_TYPES,
  US_STATES,
  getDefaultFrameworks,
  type ComplianceFramework,
} from "@/lib/compliance-context-options";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

type Props = {
  configId: string;
  branding: BrandingData;
  scope: ConfigComplianceScope;
  onPatch: (configId: string, patch: Partial<ConfigComplianceScope>) => void;
  /** First row hosts the guided-tour anchor for framework selection */
  tourFrameworkSelector?: boolean;
};

/** Per-upload compliance: optional geo, web-filter tone, frameworks (authoritative for this firewall). */
export function ConfigFileCompliancePanel({
  configId,
  branding,
  scope,
  onPatch,
  tourFrameworkSelector,
}: Props) {
  const merged = useMemo(
    () => mergeScopeWithBrandingForEffective(branding, scope),
    [branding, scope],
  );
  const showGeoEditors = shouldShowPerFileGeoEditors(branding, scope);

  const implicit = useMemo(
    () => effectiveFrameworks(mergeScopeWithBrandingForEffective(branding, scope)),
    [branding, scope],
  );

  const selected =
    scope.explicitSelectedFrameworks !== undefined ? scope.explicitSelectedFrameworks : implicit;

  const wfMode = scope.webFilterComplianceMode ?? branding.webFilterComplianceMode ?? "strict";

  const envSelectValue = scope.environment?.trim() || merged.environment?.trim() || undefined;
  const countrySelectValue = scope.country?.trim() || merged.country?.trim() || undefined;
  const effectiveCountry = merged.country?.trim() || "";
  const stateSelectValue =
    effectiveCountry === "United States"
      ? scope.state?.trim() || merged.state?.trim() || undefined
      : undefined;

  const applyGeoPatch = useCallback(
    (updates: Partial<Pick<ConfigComplianceScope, "environment" | "country" | "state">>) => {
      const nextEnv = updates.environment !== undefined ? updates.environment : scope.environment;
      const nextCountry = updates.country !== undefined ? updates.country : scope.country;
      let nextState = updates.state !== undefined ? updates.state : scope.state;
      if (updates.country !== undefined && updates.country !== "United States") {
        nextState = "";
      }
      const synthetic: ConfigComplianceScope = {
        ...scope,
        environment: nextEnv ?? "",
        country: nextCountry ?? "",
        state: nextState ?? "",
      };
      const m = mergeScopeWithBrandingForEffective(branding, synthetic);
      const c = m.country?.trim() || "";
      const e = m.environment?.trim() || "";
      const st = c === "United States" ? m.state?.trim() || "" : "";
      const defaults = getDefaultFrameworks(e, c, st);
      onPatch(configId, {
        environment: synthetic.environment,
        country: synthetic.country,
        state: c === "United States" ? synthetic.state : "",
        explicitSelectedFrameworks: defaults,
      });
    },
    [branding, configId, onPatch, scope],
  );

  return (
    <div
      className={cn(
        "relative mt-2 overflow-hidden rounded-2xl border-2 border-[#008F69]/25 dark:border-[#00F2B3]/25",
        "bg-gradient-to-br from-card via-card to-[#008F69]/[0.07] dark:to-[#00F2B3]/[0.08]",
        "shadow-[0_14px_44px_rgba(32,6,247,0.07),0_4px_20px_rgba(0,143,105,0.1)]",
        "dark:shadow-[0_14px_44px_rgba(0,0,0,0.25),0_4px_24px_rgba(0,242,179,0.08)]",
      )}
      {...(tourFrameworkSelector ? { "data-tour": "framework-selector" } : {})}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7]/70 via-[#008F69] to-[#00F2B3]/90" />
      <div className="relative p-4 sm:p-4 space-y-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#008F69]/15 dark:bg-[#00F2B3]/15 border border-[#008F69]/25 dark:border-[#00F2B3]/20">
            <FileText className="h-4 w-4 text-[#007A5A] dark:text-[#00F2B3]" />
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#007A5A] dark:text-[#00F2B3]">
              Compliance (this firewall)
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {showGeoEditors ? (
                <>
                  Set <strong className="text-foreground/90">sector</strong> and{" "}
                  <strong className="text-foreground/90">country</strong> here when this file is not
                  fully covered by a Central link — values start from{" "}
                  <strong className="text-foreground/90">Customer context</strong> until you change
                  them. Framework checkboxes refresh when geography changes.
                </>
              ) : (
                <>
                  Sector and country are on the{" "}
                  <strong className="text-foreground/90">chips</strong> above from your{" "}
                  <strong className="text-foreground/90">Central link</strong>. Adjust frameworks
                  and web-filter tone here — no need to duplicate geography.
                </>
              )}
            </p>
          </div>
        </div>

        {showGeoEditors ? (
          <div
            className={cn(
              "rounded-xl border border-[#008F69]/30 dark:border-[#00F2B3]/25",
              "bg-background/95 dark:bg-background/80 backdrop-blur-[2px]",
              "p-3.5 sm:p-4 space-y-3",
              "ring-2 ring-[#008F69]/10 dark:ring-[#00F2B3]/15",
              "shadow-inner shadow-[#008F69]/5",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#2006F7]/10 to-[#008F69]/12 dark:from-[#2006F7]/20 dark:to-[#00F2B3]/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/90 border border-[#008F69]/20">
                <MapPin className="h-3 w-3 text-[#007A5A] dark:text-[#00F2B3]" aria-hidden />
                Scope for this export
              </span>
              <span className="text-[10px] text-muted-foreground">
                Overrides apply to this upload only
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor={`ff-env-${configId}`}
                  className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/80"
                >
                  <Landmark className="h-3.5 w-3.5 text-[#007A5A] dark:text-[#00F2B3]" />
                  Environment type
                </Label>
                <Select
                  value={envSelectValue}
                  onValueChange={(v) => applyGeoPatch({ environment: v })}
                >
                  <SelectTrigger
                    id={`ff-env-${configId}`}
                    className="h-10 text-sm bg-background/90"
                  >
                    <SelectValue placeholder="Select sector…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENT_TYPES.map((env) => (
                      <SelectItem key={env} value={env}>
                        {env}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor={`ff-country-${configId}`}
                  className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/80"
                >
                  <Globe className="h-3.5 w-3.5 text-[#007A5A] dark:text-[#00F2B3]" />
                  Country
                </Label>
                <Select
                  value={countrySelectValue}
                  onValueChange={(v) => applyGeoPatch({ country: v })}
                >
                  <SelectTrigger
                    id={`ff-country-${configId}`}
                    className="h-10 text-sm bg-background/90"
                  >
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
              </div>
            </div>

            {effectiveCountry === "United States" && (
              <div className="space-y-1.5 max-w-md">
                <Label
                  htmlFor={`ff-state-${configId}`}
                  className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/80"
                >
                  <Globe className="h-3.5 w-3.5 text-[#007A5A] dark:text-[#00F2B3]" />
                  State
                </Label>
                <Select
                  value={stateSelectValue || undefined}
                  onValueChange={(v) => applyGeoPatch({ state: v })}
                >
                  <SelectTrigger
                    id={`ff-state-${configId}`}
                    className="h-10 text-sm bg-background/90"
                  >
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
              </div>
            )}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label
            htmlFor={`wf-mode-${configId}`}
            className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <Filter className="h-3.5 w-3.5 text-[#007A5A] dark:text-[#00F2B3]" /> Web filter
            compliance
          </Label>
          <Select
            value={wfMode}
            onValueChange={(v) =>
              onPatch(configId, { webFilterComplianceMode: v as WebFilterComplianceMode })
            }
          >
            <SelectTrigger id={`wf-mode-${configId}`} className="h-10 text-sm bg-background/90">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strict">Strict</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            <strong className="text-foreground/85">Strict</strong>: WAN rules without web filtering
            are higher-severity findings.{" "}
            <strong className="text-foreground/85">Informational</strong>: same checks, lower
            severity and softer compliance wording unless a selected framework requires it.
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 dark:bg-background/30 p-3">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Compliance frameworks
          </Label>
          <ComplianceFrameworkGrid
            variant="compact"
            selectedFrameworks={selected}
            onChange={(next: ComplianceFramework[]) => {
              onPatch(configId, { explicitSelectedFrameworks: [...next] });
            }}
          />
          <p className="text-[10px] text-muted-foreground">{selected.length} selected</p>
        </div>
      </div>
    </div>
  );
}

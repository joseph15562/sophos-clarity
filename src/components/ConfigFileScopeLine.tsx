import type { BrandingData } from "@/components/BrandingSetup";
import type { ConfigComplianceScope } from "@/lib/config-compliance-scope";
import { countryFlagEmoji } from "@/lib/compliance-context-options";

type Props = {
  branding: BrandingData;
  scope?: ConfigComplianceScope;
  /** True when this config has a stored scope row (link, add-on frameworks, etc.). */
  hasScopeEntry?: boolean;
};

/** Effective sector / country for one uploaded config (link scope merged over Customer Context). */
export function ConfigFileScopeLine({ branding, scope, hasScopeEntry }: Props) {
  const env = (scope?.environment ?? "").trim() || (branding.environment ?? "").trim();
  const country = (scope?.country ?? "").trim() || (branding.country ?? "").trim();
  const usState =
    country === "United States" ? (scope?.state ?? "").trim() || (branding.state ?? "").trim() : "";
  const geoFromLink = !!(scope?.country?.trim() || scope?.environment?.trim());

  if (!env && !country) {
    return (
      <p className="text-[10px] text-muted-foreground mt-1">
        {geoFromLink
          ? "Partial link context — set Customer Context or complete Fleet defaults."
          : hasScopeEntry
            ? "Extra frameworks only — geography from Customer Context."
            : "Compliance scope: Customer Context below (or link Central for per-device defaults)."}
      </p>
    );
  }

  const flag = country ? countryFlagEmoji(country) : "";
  return (
    <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
      <span className="rounded border border-[#008F69]/20 dark:border-[#00F2B3]/15 bg-[#008F69]/[0.06] dark:bg-[#00F2B3]/5 px-1.5 py-px font-medium text-foreground/80">
        {env || "—"}
      </span>
      <span className="text-muted-foreground/50">·</span>
      {country ? (
        <span className="inline-flex items-center gap-0.5 text-foreground/75">
          <span aria-hidden>{flag}</span>
          <span>
            {country}
            {usState ? ` · ${usState}` : ""}
          </span>
        </span>
      ) : (
        <span>—</span>
      )}
    </p>
  );
}

/** Shared MSP compliance context (Fleet, Branding, Customer directory). */

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
  "Logistics & Transport",
  "Manufacturing",
  "Technology & Telecoms",
  "Energy & Utilities",
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
  "Sweden",
  "Italy",
  "Spain",
  "Brazil",
  "Saudi Arabia",
  "Switzerland",
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
  "ASD Essential Eight",
  "APRA CPS 234",
  "MAS TRM",
  "CSA Cyber Trust",
  "NESA IAS",
  "POPIA",
  "DPDPA",
  "PIPEDA",
  "LGPD",
  "PDPA (Japan)",
  "FISC",
  "Sweden Cybersecurity Act",
  "Swiss FADP",
  "KRITIS / BSI",
] as const;

export type ComplianceFramework = (typeof ALL_FRAMEWORKS)[number];

const ENVIRONMENT_TYPE_SET = new Set<string>(ENVIRONMENT_TYPES);
const COUNTRY_SET = new Set<string>(COUNTRIES);

/** Map Fleet / directory `sector` to a valid environment type when it matches. */
export function normalizeDirectoryEnvironment(sector: string): string | undefined {
  const t = sector.trim();
  if (!t) return undefined;
  return ENVIRONMENT_TYPE_SET.has(t) ? t : undefined;
}

/**
 * Map Fleet customer directory `country` to branding country.
 * Returns undefined for empty, placeholder, or multi-country rows.
 */
export function normalizeDirectoryCountry(country: string): string | undefined {
  const t = country.trim();
  if (!t || t === "—") return undefined;
  if (t.startsWith("Multiple")) return undefined;
  return COUNTRY_SET.has(t) ? t : undefined;
}

/** Flag emoji for known countries (Customer Management + Fleet). */
export const COUNTRY_TO_FLAG: Record<string, string> = {
  "United Kingdom": "🇬🇧",
  "United States": "🇺🇸",
  Australia: "🇦🇺",
  Canada: "🇨🇦",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Netherlands: "🇳🇱",
  Ireland: "🇮🇪",
  "New Zealand": "🇳🇿",
  "South Africa": "🇿🇦",
  "United Arab Emirates": "🇦🇪",
  Singapore: "🇸🇬",
  India: "🇮🇳",
  Japan: "🇯🇵",
  Sweden: "🇸🇪",
  Italy: "🇮🇹",
  Spain: "🇪🇸",
  Brazil: "🇧🇷",
  "Saudi Arabia": "🇸🇦",
  Switzerland: "🇨🇭",
};

export function countryFlagEmoji(country: string): string {
  const t = country.trim();
  if (!t) return "";
  return COUNTRY_TO_FLAG[t] ?? "🌐";
}

/** Returns default frameworks for a given environment + country + state combo */
export function getDefaultFrameworks(
  environment: string,
  country: string,
  state?: string,
): ComplianceFramework[] {
  const fw: ComplianceFramework[] = [];
  const isUK = country === "United Kingdom";
  const isUS = country === "United States";
  const isEU = ["Germany", "France", "Netherlands", "Ireland", "Sweden", "Italy", "Spain"].includes(
    country,
  );

  // ── Country / region baseline ──

  if (isUK) fw.push("GDPR", "Cyber Essentials / CE+", "NCSC Guidelines");
  if (isUS) fw.push("NIST 800-53", "CIS");
  if (isEU) fw.push("GDPR", "NIS2");

  switch (country) {
    case "Australia":
      fw.push("ISO 27001", "ASD Essential Eight");
      break;
    case "Canada":
      fw.push("ISO 27001", "PIPEDA");
      break;
    case "New Zealand":
      fw.push("ISO 27001");
      break;
    case "Singapore":
      fw.push("CSA Cyber Trust");
      break;
    case "Japan":
      fw.push("PDPA (Japan)");
      break;
    case "India":
      fw.push("DPDPA");
      break;
    case "United Arab Emirates":
      fw.push("NESA IAS");
      break;
    case "Saudi Arabia":
      fw.push("NESA IAS");
      break;
    case "South Africa":
      fw.push("POPIA");
      break;
    case "Brazil":
      fw.push("LGPD");
      break;
    case "Switzerland":
      fw.push("Swiss FADP", "ISO 27001");
      break;
    case "Sweden":
      fw.push("Sweden Cybersecurity Act");
      break;
    case "Germany":
      fw.push("KRITIS / BSI");
      break;
  }

  // ── US state-specific ──

  if (isUS && state === "Ohio") fw.push("Ohio DPA");

  // ── Sector defaults (cross-country) ──

  switch (environment) {
    case "Education":
      if (isUK) fw.push("DfE / KCSIE");
      if (isUS) fw.push("CIPA");
      break;
    case "Healthcare":
      if (isUK) fw.push("NCSC CAF");
      if (isUS) fw.push("HIPAA", "HITECH");
      if (isEU) fw.push("ISO 27001");
      break;
    case "Government":
      if (isUK) fw.push("NCSC CAF", "PSN");
      if (isUS) fw.push("FedRAMP", "CMMC");
      if (isEU) fw.push("ISO 27001");
      break;
    case "Financial Services":
      fw.push("PCI DSS", "SOX", "SOC 2");
      if (isUK) fw.push("FCA", "PRA");
      if (country === "Australia") fw.push("APRA CPS 234");
      if (country === "Singapore") fw.push("MAS TRM");
      if (country === "Japan") fw.push("FISC");
      break;
    case "Operational Technology":
      fw.push("IEC 62443", "NIST 800-82");
      if (isUK) fw.push("NCSC CAF");
      break;
    case "Critical Infrastructure":
      fw.push("ISO 27001");
      if (isUK) fw.push("NCSC CAF");
      if (isUS) fw.push("NERC CIP");
      break;
    case "Defence":
      fw.push("MOD Cyber / ITAR", "CMMC");
      if (isUK) fw.push("NCSC CAF");
      break;
    case "Retail & Hospitality":
      fw.push("PCI DSS");
      break;
    case "Logistics & Transport":
      fw.push("ISO 27001");
      break;
    case "Manufacturing":
      fw.push("IEC 62443");
      break;
    case "Technology & Telecoms":
      fw.push("SOC 2", "ISO 27001");
      break;
    case "Energy & Utilities":
      fw.push("IEC 62443", "NIST 800-82");
      if (isUK) fw.push("NCSC CAF");
      if (isUS) fw.push("NERC CIP");
      break;
    case "Housing":
      if (isUK) fw.push("Cyber Essentials / CE+");
      break;
    case "Legal":
      fw.push("ISO 27001");
      break;
    case "Non-Profit / Charity":
      if (isUK) fw.push("Cyber Essentials / CE+");
      break;
  }

  return [...new Set(fw)];
}

/** Branding fields + default frameworks from compliance geography (Central link, Fleet, etc.). */
export function brandingPatchFromComplianceGeo(
  environment: string,
  country: string,
  stateFromScope: string,
  options?: { existingState?: string },
): {
  environment: string;
  country: string;
  state?: string;
  selectedFrameworks: ComplianceFramework[];
} {
  const env = environment.trim();
  const cty = country.trim();
  const resolvedState =
    cty === "United States"
      ? (() => {
          const s = stateFromScope.trim();
          if (s && US_STATES.includes(s as (typeof US_STATES)[number])) return s;
          const ex = options?.existingState?.trim();
          if (ex && US_STATES.includes(ex as (typeof US_STATES)[number])) return ex;
          return undefined;
        })()
      : undefined;

  return {
    environment: env,
    country: cty,
    state: resolvedState,
    selectedFrameworks: getDefaultFrameworks(env, cty, resolvedState),
  };
}

const ALL_FRAMEWORKS_SET = new Set<string>(ALL_FRAMEWORKS);

/** Defaults from geo + optional saved framework labels from directory / CRM. */
export function mergeDefaultAndDirectoryFrameworks(
  environment: string,
  country: string,
  state: string | undefined,
  savedLabels: string[],
): ComplianceFramework[] {
  const defaults = getDefaultFrameworks(environment, country, state ?? "");
  const saved = savedLabels.filter((f): f is ComplianceFramework => ALL_FRAMEWORKS_SET.has(f));
  const seen = new Set<string>();
  const out: ComplianceFramework[] = [];
  for (const f of [...defaults, ...saved]) {
    if (!seen.has(f)) {
      seen.add(f);
      out.push(f);
    }
  }
  return out;
}

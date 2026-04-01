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
  const isEU = ["Germany", "France", "Netherlands", "Ireland"].includes(country);

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

  if (isUS && state === "Ohio") {
    fw.push("Ohio DPA");
  }

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

  return [...new Set(fw)];
}

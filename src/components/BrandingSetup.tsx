import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, ImageIcon, Globe, Landmark, User, ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";

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

export const ALL_FRAMEWORKS = [
  "GDPR",
  "Cyber Essentials / CE+",
  "NCSC Guidelines",
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
  "SOX",
  "IEC 62443",
  "NIST 800-82",
  "NIS2",
  "NERC CIP",
  "MOD Cyber / ITAR",
] as const;

export type ComplianceFramework = (typeof ALL_FRAMEWORKS)[number];

/** Returns default frameworks for a given environment + country combo */
function getDefaultFrameworks(environment: string, country: string): ComplianceFramework[] {
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
  // Australia, Canada, NZ etc get ISO by default
  if (["Australia", "Canada", "New Zealand"].includes(country)) {
    fw.push("ISO 27001");
  }

  // Environment-level defaults
  switch (environment) {
    case "Education":
      if (isUK) fw.push("DfE / KCSIE");
      break;
    case "Healthcare":
      if (isUS) fw.push("HIPAA", "HITECH");
      break;
    case "Government":
      if (isUS) fw.push("FedRAMP", "CMMC");
      break;
    case "Financial Services":
      fw.push("PCI DSS", "SOX");
      if (isUK) fw.push("FCA", "PRA");
      break;
    case "Operational Technology":
      fw.push("IEC 62443", "NIST 800-82");
      break;
    case "Critical Infrastructure":
      if (isEU) fw.push("NIS2");
      if (isUS) fw.push("NERC CIP");
      break;
    case "Defence":
      fw.push("MOD Cyber / ITAR", "CMMC");
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
  selectedFrameworks: ComplianceFramework[];
};

type Props = {
  branding: BrandingData;
  onChange: (b: BrandingData) => void;
};

export function BrandingSetup({ branding, onChange }: Props) {
  // Auto-populate frameworks when environment or country changes
  useEffect(() => {
    if (branding.environment || branding.country) {
      const defaults = getDefaultFrameworks(branding.environment, branding.country);
      onChange({ ...branding, selectedFrameworks: defaults });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding.environment, branding.country]);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ ...branding, logoUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const toggleFramework = (fw: ComplianceFramework) => {
    const current = branding.selectedFrameworks;
    const next = current.includes(fw)
      ? current.filter((f) => f !== fw)
      : [...current, fw];
    onChange({ ...branding, selectedFrameworks: next });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Company Name
        </Label>
        <Input
          id="company"
          placeholder="Your MSP Company Name"
          value={branding.companyName}
          onChange={(e) => onChange({ ...branding, companyName: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="logo" className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Company Logo
        </Label>
        <div className="flex items-center gap-4">
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="h-12 w-auto max-w-[160px] object-contain rounded border border-border p-1 bg-card"
            />
          )}
          <Input
            id="logo"
            type="file"
            accept="image/*"
            onChange={handleLogo}
            className="max-w-xs"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerName" className="flex items-center gap-2">
          <User className="h-4 w-4" /> Customer Name
        </Label>
        <Input
          id="customerName"
          placeholder="Customer / Client Name"
          value={branding.customerName}
          onChange={(e) => onChange({ ...branding, customerName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          The end-client whose firewall configuration is being documented.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="environment" className="flex items-center gap-2">
          <Landmark className="h-4 w-4" /> Environment Type
        </Label>
        <Select
          value={branding.environment}
          onValueChange={(v) => onChange({ ...branding, environment: v })}
        >
          <SelectTrigger id="environment" className="max-w-xs">
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
        <p className="text-xs text-muted-foreground">
          Best practice recommendations will focus on compliance requirements for this sector.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country" className="flex items-center gap-2">
          <Globe className="h-4 w-4" /> Country
        </Label>
        <Select
          value={branding.country}
          onValueChange={(v) => onChange({ ...branding, country: v })}
        >
          <SelectTrigger id="country" className="max-w-xs">
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
        <p className="text-xs text-muted-foreground">
          Local regulatory compliance will be applied based on country.
        </p>
      </div>

      {/* Compliance Frameworks */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Compliance Frameworks
        </Label>
        <p className="text-xs text-muted-foreground">
          Auto-selected based on environment & country. Tick or untick to customise.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {ALL_FRAMEWORKS.map((fw) => (
            <label
              key={fw}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
            >
              <Checkbox
                checked={branding.selectedFrameworks.includes(fw)}
                onCheckedChange={() => toggleFramework(fw)}
              />
              <span className="select-none">{fw}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

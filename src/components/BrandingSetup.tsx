import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ImageIcon, Globe, Landmark } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export type BrandingData = {
  companyName: string;
  logoUrl: string | null;
  environment: string;
  country: string;
};

type Props = {
  branding: BrandingData;
  onChange: (b: BrandingData) => void;
};

export function BrandingSetup({ branding, onChange }: Props) {
  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({ ...branding, logoUrl: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
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
          Local regulatory compliance (e.g. GDPR, KCSIE, HIPAA) will be applied based on country.
        </p>
      </div>
    </div>
  );
}

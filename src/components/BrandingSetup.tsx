import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, ImageIcon, Globe, Landmark, User, ShieldCheck, Plus, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { loadHistory } from "@/lib/assessment-history";
import { loadHistoryCloud } from "@/lib/assessment-cloud";
import { loadSavedReportsCloud, loadSavedReportsLocal } from "@/lib/saved-reports";

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
  const { isGuest, org } = useAuth();
  const userTouchedFrameworks = useRef(false);
  const companyAutoFilled = useRef(false);

  const [knownCustomers, setKnownCustomers] = useState<string[]>([]);
  const [customerReportCounts, setCustomerReportCounts] = useState<Record<string, number>>({});
  const [customerSearch, setCustomerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-fill company name from org when logged in
  useEffect(() => {
    if (!isGuest && org && !companyAutoFilled.current && !branding.companyName) {
      companyAutoFilled.current = true;
      onChange({ ...branding, companyName: org.name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, org]);

  // Load known customers from history + saved reports
  useEffect(() => {
    const load = async () => {
      try {
        const useCloud = !isGuest && !!org;
        const [history, savedReports] = await Promise.all([
          useCloud ? loadHistoryCloud() : loadHistory(),
          useCloud ? loadSavedReportsCloud() : loadSavedReportsLocal(),
        ]);
        const allNames = new Set<string>();
        history.forEach((h) => { if (h.customerName && h.customerName !== "Unnamed") allNames.add(h.customerName); });
        savedReports.forEach((r) => { if (r.customerName && r.customerName !== "Unnamed") allNames.add(r.customerName); });
        const names = [...allNames].sort((a, b) => a.localeCompare(b));
        setKnownCustomers(names);

        const counts: Record<string, number> = {};
        for (const r of savedReports) {
          const n = r.customerName;
          if (n && n !== "Unnamed") counts[n] = (counts[n] || 0) + 1;
        }
        setCustomerReportCounts(counts);
      } catch { /* ignore */ }
    };
    load();
  }, [isGuest, org]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return knownCustomers;
    const q = customerSearch.toLowerCase();
    return knownCustomers.filter((c) => c.toLowerCase().includes(q));
  }, [knownCustomers, customerSearch]);

  const selectCustomer = useCallback((name: string) => {
    onChange({ ...branding, customerName: name });
    setCustomerSearch("");
    setShowDropdown(false);
    setAddingNew(false);
  }, [branding, onChange]);

  useEffect(() => {
    if (userTouchedFrameworks.current) return;
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
    userTouchedFrameworks.current = true;
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
          {!isGuest && org && (
            <span className="text-[9px] text-muted-foreground font-normal ml-1">(from organisation)</span>
          )}
        </Label>
        <Input
          id="company"
          placeholder="Your MSP Company Name"
          value={branding.companyName}
          onChange={(e) => onChange({ ...branding, companyName: e.target.value })}
          readOnly={!isGuest && !!org}
          className={!isGuest && org ? "bg-muted/50 cursor-default" : ""}
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

        {/* Searchable customer dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={showDropdown ? customerSearch : branding.customerName}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  if (!showDropdown) setShowDropdown(true);
                  if (addingNew) {
                    onChange({ ...branding, customerName: e.target.value });
                  }
                }}
                onFocus={() => {
                  if (!addingNew && knownCustomers.length > 0) {
                    setShowDropdown(true);
                    setCustomerSearch("");
                  }
                }}
                placeholder={knownCustomers.length > 0 ? "Search or select customer…" : "Customer / Client Name"}
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setAddingNew(true);
                setShowDropdown(false);
                setCustomerSearch("");
                onChange({ ...branding, customerName: "" });
              }}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
              title="Add new customer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>

          {/* Dropdown list */}
          {showDropdown && !addingNew && knownCustomers.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-w-xs rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No matching customers.
                  <button
                    onClick={() => {
                      setAddingNew(true);
                      setShowDropdown(false);
                      onChange({ ...branding, customerName: customerSearch });
                    }}
                    className="ml-1 text-[#2006F7] dark:text-[#00EDFF] hover:underline"
                  >
                    Add "{customerSearch}"
                  </button>
                </div>
              ) : (
                filteredCustomers.map((name) => (
                  <button
                    key={name}
                    onClick={() => selectCustomer(name)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between ${
                      branding.customerName === name ? "bg-[#2006F7]/5 font-medium text-foreground" : "text-foreground"
                    }`}
                  >
                    <span>{name}</span>
                    {customerReportCounts[name] > 0 && (
                      <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-2 shrink-0">
                        {customerReportCounts[name]} report{customerReportCounts[name] !== 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {addingNew && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Plus className="h-2.5 w-2.5" /> Adding new customer.
            {knownCustomers.length > 0 && (
              <button
                onClick={() => setAddingNew(false)}
                className="text-[#2006F7] dark:text-[#00EDFF] hover:underline ml-1"
              >
                Back to list
              </button>
            )}
          </p>
        )}

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

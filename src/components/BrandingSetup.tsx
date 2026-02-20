import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ImageIcon } from "lucide-react";

export type BrandingData = {
  companyName: string;
  logoUrl: string | null;
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
    </div>
  );
}

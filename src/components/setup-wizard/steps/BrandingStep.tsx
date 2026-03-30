import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrandingData } from "@/components/BrandingSetup";
import { SetupPreviewFrame, MockReportViewer } from "../wizard-ui";

export interface BrandingStepProps {
  branding: BrandingData;
  onBrandingChange: (b: BrandingData) => void;
}

export function BrandingStep({ branding, onBrandingChange }: BrandingStepProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] items-start">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
            Report identity
          </div>
          <h3 className="text-base font-display tracking-tight font-semibold text-foreground mt-2">
            Company Branding
          </h3>
          <p className="text-[11px] text-muted-foreground">
            This information appears on all your reports and assessments. You can change it anytime.
          </p>
          <SetupPreviewFrame
            title="Branded customer deliverables"
            subtitle="Your company details shape the exported reports and executive packs customers receive."
          >
            <MockReportViewer type="executive" />
          </SetupPreviewFrame>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-company" className="text-xs">
              Company / MSP Name
            </Label>
            <Input
              id="setup-company"
              placeholder="e.g. Acme IT Solutions"
              value={branding.companyName}
              onChange={(e) => onBrandingChange({ ...branding, companyName: e.target.value })}
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="setup-prepared" className="text-xs">
                Prepared By
              </Label>
              <Input
                id="setup-prepared"
                placeholder="e.g. Joseph McDonald"
                value={branding.preparedBy ?? ""}
                onChange={(e) => onBrandingChange({ ...branding, preparedBy: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-footer" className="text-xs">
                Report Footer
              </Label>
              <Input
                id="setup-footer"
                placeholder="e.g. Confidential"
                value={branding.footerText ?? ""}
                onChange={(e) => onBrandingChange({ ...branding, footerText: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">Tip:</strong> You can add a logo and set
              customer-specific details later in the Assessment Context section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

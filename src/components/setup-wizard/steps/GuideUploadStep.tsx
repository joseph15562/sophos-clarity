import { Download, Upload, Shield, Wifi } from "lucide-react";
import { GuideStep } from "../wizard-ui";

/** Setup wizard — "Uploading Configs" tour step (extracted from SetupWizardBody). */
export function GuideUploadStep() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          How to Upload & Assess
        </h3>
        <p className="text-[11px] text-muted-foreground">
          FireComply analyses Sophos XGS HTML configuration exports. Here&apos;s the workflow:
        </p>
      </div>

      <div className="space-y-3">
        <GuideStep
          number={1}
          title="Export your firewall config"
          description="In Sophos Firewall, go to Backup & firmware > Import/Export and export as HTML."
          icon={<Download className="h-4 w-4" />}
          color="text-[#2006F7]"
        />
        <GuideStep
          number={2}
          title="Drag & drop the file"
          description="Drop one or more HTML files into the upload area on the main page. Multi-firewall assessments are supported."
          icon={<Upload className="h-4 w-4" />}
          color="text-[#005BC8]"
        />
        <GuideStep
          number={3}
          title="Instant analysis"
          description="FireComply automatically parses the config and shows findings, risk scores, compliance mapping, and best practice checks."
          icon={<Shield className="h-4 w-4" />}
          color="text-[#00F2B3]"
        />
        <GuideStep
          number={4}
          title="Link to Sophos Central"
          description='If connected, click "Link Firewall" to match each config to its Central firewall for live data enrichment.'
          icon={<Wifi className="h-4 w-4" />}
          color="text-[#00EDFF]"
        />
      </div>

      <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> Set the customer name and compliance
          frameworks in the <strong className="text-foreground">Assessment Context</strong> section
          before generating reports — this tailors the AI analysis.
        </p>
      </div>
    </div>
  );
}

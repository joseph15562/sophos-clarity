import { useState, useEffect, useCallback } from "react";
import { Mail, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const CARD_CLASS =
  "rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-5 shadow-card transition-[box-shadow,border-color] duration-200 hover:shadow-elevated hover:border-border/70";
const STORAGE_KEY = "firecomply-email-digest";

type Frequency = "weekly" | "monthly";

interface EmailDigestConfig {
  frequency: Frequency;
  recipients: string;
  sections: {
    executiveSummary: boolean;
    scoreOverview: boolean;
    findingsSummary: boolean;
    complianceStatus: boolean;
    remediationPlan: boolean;
  };
}

const DEFAULT_CONFIG: EmailDigestConfig = {
  frequency: "weekly",
  recipients: "",
  sections: {
    executiveSummary: true,
    scoreOverview: true,
    findingsSummary: true,
    complianceStatus: true,
    remediationPlan: true,
  },
};

const SECTION_OPTIONS = [
  { id: "executiveSummary" as const, label: "Executive Summary" },
  { id: "scoreOverview" as const, label: "Score Overview" },
  { id: "findingsSummary" as const, label: "Findings Summary" },
  { id: "complianceStatus" as const, label: "Compliance Status" },
  { id: "remediationPlan" as const, label: "Remediation Plan" },
];

function loadConfig(): EmailDigestConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config: EmailDigestConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function buildPreviewHtml(config: EmailDigestConfig): string {
  const sections = SECTION_OPTIONS.filter((s) => config.sections[s.id]);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Zalando Sans', system-ui, sans-serif; font-size: 14px; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #2006F7; font-size: 20px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .section { margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 8px; }
  .footer { margin-top: 24px; font-size: 11px; color: #999; }
</style></head>
<body>
  <h1>Sophos FireComply — ${config.frequency === "weekly" ? "Weekly" : "Monthly"} Digest</h1>
  <p class="meta">Recipients: ${config.recipients || "(none configured)"}</p>
  ${sections.map((s) => `<div class="section"><strong>${s.label}</strong><br/>Content placeholder for this section.</div>`).join("\n  ")}
  <p class="footer">This is an automated digest from Sophos FireComply. Configure in Settings → Email Digest.</p>
</body>
</html>
  `.trim();
}

export function EmailDigestSettings() {
  const [config, setConfig] = useState<EmailDigestConfig>(loadConfig());
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const toggleSection = useCallback((id: keyof EmailDigestConfig["sections"]) => {
    setConfig((c) => ({
      ...c,
      sections: { ...c.sections, [id]: !c.sections[id] },
    }));
  }, []);

  const previewHtml = buildPreviewHtml(config);

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
        <Mail className="h-4 w-4" />
        Email Digest Settings
      </h3>
      <p className="text-[10px] text-muted-foreground mt-1">
        Configure scheduled email digests with score overview, findings, and compliance status.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <Label className="text-xs">Frequency</Label>
          <Select
            value={config.frequency}
            onValueChange={(v) => setConfig((c) => ({ ...c, frequency: v as Frequency }))}
          >
            <SelectTrigger className="mt-1 h-9 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly" className="text-xs">
                Weekly
              </SelectItem>
              <SelectItem value="monthly" className="text-xs">
                Monthly
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Recipients (comma-separated emails)</Label>
          <Input
            value={config.recipients}
            onChange={(e) => setConfig((c) => ({ ...c, recipients: e.target.value }))}
            placeholder="admin@example.com, ops@example.com"
            className="mt-1 h-9 text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">Content sections to include</Label>
          <div className="mt-2 space-y-2">
            {SECTION_OPTIONS.map((s) => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer text-xs">
                <Checkbox
                  checked={config.sections[s.id]}
                  onCheckedChange={() => toggleSection(s.id)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm">Email template preview</DialogTitle>
            </DialogHeader>
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              className="w-full flex-1 min-h-[400px] rounded border border-border bg-white"
              sandbox="allow-same-origin"
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

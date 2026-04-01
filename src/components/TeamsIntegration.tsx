import { useState, useEffect, useCallback } from "react";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";
import { Users, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const CARD_CLASS =
  "rounded-xl border border-border/50 bg-card p-5 shadow-card transition-[box-shadow,border-color] duration-200 hover:shadow-elevated hover:border-border/70";
const STORAGE_KEY = "firecomply-teams-config";

interface TeamsConfig {
  webhookUrl: string;
  triggers: {
    assessmentComplete: boolean;
    scoreDrop: boolean;
    slaBreach: boolean;
  };
}

const DEFAULT_CONFIG: TeamsConfig = {
  webhookUrl: "",
  triggers: {
    assessmentComplete: true,
    scoreDrop: true,
    slaBreach: true,
  },
};

function loadConfig(): TeamsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config: TeamsConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function TeamsIntegration() {
  const nextMutationSignal = useAbortableInFlight();
  const [config, setConfig] = useState<TeamsConfig>(loadConfig());

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const handleTest = useCallback(async () => {
    if (!config.webhookUrl?.trim()) {
      toast.error("Enter a webhook URL first");
      return;
    }
    try {
      const res = await fetch(config.webhookUrl, {
        method: "POST",
        signal: nextMutationSignal(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "@type": "MessageCard",
          "@context": "https://schema.org/extensions",
          summary: "Test from Sophos FireComply",
          themeColor: "2006F7",
          title: "FireComply Test",
          text: "Test notification from Sophos FireComply — integration working.",
        }),
      });
      if (res.ok) {
        toast.success("Teams test successful — message sent");
      } else {
        toast.error(`Teams returned ${res.status} — check your webhook`);
      }
    } catch {
      toast.error("Teams test failed — check URL and network");
    }
  }, [config.webhookUrl, nextMutationSignal]);

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
        <Users className="h-4 w-4" />
        Microsoft Teams Notifications
      </h3>
      <p className="text-[10px] text-muted-foreground mt-1">
        Send alerts to Microsoft Teams when assessments complete, scores drop, or SLA is breached.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <Label className="text-xs">Webhook URL</Label>
          <Input
            value={config.webhookUrl}
            onChange={(e) => setConfig((c) => ({ ...c, webhookUrl: e.target.value }))}
            placeholder="https://outlook.office.com/webhook/..."
            className="mt-1 h-9 text-xs"
          />
        </div>

        <div>
          <Label className="text-xs">Notification triggers</Label>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                checked={config.triggers.assessmentComplete}
                onCheckedChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    triggers: { ...c.triggers, assessmentComplete: !!v },
                  }))
                }
              />
              Assessment Complete
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                checked={config.triggers.scoreDrop}
                onCheckedChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    triggers: { ...c.triggers, scoreDrop: !!v },
                  }))
                }
              />
              Score Drop
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox
                checked={config.triggers.slaBreach}
                onCheckedChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    triggers: { ...c.triggers, slaBreach: !!v },
                  }))
                }
              />
              SLA Breach
            </label>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleTest} className="text-xs">
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Test
        </Button>
      </div>
    </div>
  );
}

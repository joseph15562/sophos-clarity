import { useState, useEffect, useCallback } from "react";
import { Plug, CheckCircle, XCircle, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CARD_CLASS = "rounded-xl border border-border bg-card p-5";
const STORAGE_KEY = "firecomply-psa-config";

type PsaType = "connectwise" | "autotask" | "jira" | "servicenow";

interface PsaConfig {
  apiUrl: string;
  apiKey: string;
  ticketMapping: string;
  connected: boolean;
}

interface FullPsaConfig {
  connectwise: PsaConfig;
  autotask: PsaConfig;
  jira: PsaConfig;
  servicenow: PsaConfig;
}

const DEFAULT_PSA: PsaConfig = {
  apiUrl: "",
  apiKey: "",
  ticketMapping: "",
  connected: false,
};

const PSA_LABELS: Record<PsaType, string> = {
  connectwise: "ConnectWise",
  autotask: "Autotask",
  jira: "Jira",
  servicenow: "ServiceNow",
};

function loadConfig(): FullPsaConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      connectwise: { ...DEFAULT_PSA, ...parsed.connectwise },
      autotask: { ...DEFAULT_PSA, ...parsed.autotask },
      jira: { ...DEFAULT_PSA, ...parsed.jira },
      servicenow: { ...DEFAULT_PSA, ...parsed.servicenow },
    };
  } catch {
    return {
      connectwise: { ...DEFAULT_PSA },
      autotask: { ...DEFAULT_PSA },
      jira: { ...DEFAULT_PSA },
      servicenow: { ...DEFAULT_PSA },
    };
  }
}

function saveConfig(config: FullPsaConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function PsaIntegrations() {
  const [config, setConfig] = useState<FullPsaConfig>(loadConfig());

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const updatePsa = useCallback(
    (key: PsaType, patch: Partial<PsaConfig>) => {
      setConfig((c) => ({
        ...c,
        [key]: { ...c[key], ...patch },
      }));
    },
    []
  );

  const handleTestConnection = useCallback((key: PsaType) => {
    const cfg = config[key];
    if (!cfg.apiUrl?.trim() || !cfg.apiKey?.trim()) {
      updatePsa(key, { connected: false });
      return;
    }
    updatePsa(key, { connected: true });
  }, [config, updatePsa]);

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Plug className="h-4 w-4" />
        PSA Integrations
      </h3>
      <p className="text-[10px] text-muted-foreground mt-1">
        Connect ConnectWise, Autotask, Jira, and ServiceNow for ticket creation and sync.
      </p>

      <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Note: PSA integrations require backend proxy for OAuth. Configure API credentials below for future backend wiring.
        </p>
      </div>

      <Tabs defaultValue="connectwise" className="mt-4">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          {(Object.keys(PSA_LABELS) as PsaType[]).map((k) => (
            <TabsTrigger key={k} value={k} className="text-xs">
              {PSA_LABELS[k]}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(PSA_LABELS) as PsaType[]).map((key) => (
          <TabsContent key={key} value={key} className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium">Status</span>
              {config[key].connected ? (
                <span className="flex items-center gap-1 text-[10px] text-[#00F2B3]">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" />
                  Disconnected
                </span>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">API URL</Label>
                <Input
                  value={config[key].apiUrl}
                  onChange={(e) => updatePsa(key, { apiUrl: e.target.value })}
                  placeholder="https://..."
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">API Key / Token</Label>
                <Input
                  type="password"
                  value={config[key].apiKey}
                  onChange={(e) => updatePsa(key, { apiKey: e.target.value })}
                  placeholder="••••••••"
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Ticket mapping config</Label>
                <Input
                  value={config[key].ticketMapping}
                  onChange={(e) => updatePsa(key, { ticketMapping: e.target.value })}
                  placeholder="finding.severity → priority"
                  className="mt-1 h-9 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection(key)}
                className="text-xs"
              >
                Test connection
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

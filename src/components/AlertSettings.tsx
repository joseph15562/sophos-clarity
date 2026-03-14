import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, Mail, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  loadAlertRules,
  saveAlertRules,
  type AlertRule,
  type AlertEventType,
} from "@/lib/alert-rules";

const EVENT_LABELS: Record<AlertEventType, string> = {
  licence_expiry_warning: "Licence expiring soon",
  score_drop: "Risk score drop",
  new_critical_finding: "New critical finding",
  central_disconnected: "Central disconnected",
  agent_drift_detected: "Agent drift detected",
  agent_offline: "Agent offline",
};

function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function AlertSettings() {
  const [rules, setRules] = useState<AlertRule[]>([]);

  useEffect(() => {
    setRules(loadAlertRules());
  }, []);

  const persist = useCallback((next: AlertRule[]) => {
    setRules(next);
    saveAlertRules(next);
  }, []);

  const addRule = useCallback(() => {
    const rule: AlertRule = {
      id: generateId(),
      eventType: "new_critical_finding",
      channel: "email",
      config: {},
      enabled: true,
    };
    persist([...rules, rule]);
  }, [rules, persist]);

  const removeRule = useCallback(
    (id: string) => {
      persist(rules.filter((r) => r.id !== id));
    },
    [rules, persist]
  );

  const updateRule = useCallback(
    (id: string, patch: Partial<AlertRule>) => {
      persist(
        rules.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    [rules, persist]
  );

  const updateConfig = useCallback(
    (id: string, key: "email" | "webhookUrl", value: string) => {
      persist(
        rules.map((r) =>
          r.id === id ? { ...r, config: { ...r.config, [key]: value || undefined } } : r
        )
      );
    },
    [rules, persist]
  );

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">Email & webhook alerts</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Configure notifications for licence expiry, score drops, critical findings, and Central disconnection.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={addRule}
          className="gap-1.5 text-[10px] h-7"
        >
          <Plus className="h-3 w-3" />
          Add rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 py-6 text-center text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-[11px]">No alert rules configured</p>
          <p className="text-[9px] mt-1">Add a rule to receive email or webhook notifications</p>
          <Button
            variant="outline"
            size="sm"
            onClick={addRule}
            className="mt-3 gap-1.5 text-[10px] h-7"
          >
            <Plus className="h-3 w-3" />
            Add rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-lg border border-border bg-card p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) =>
                      updateRule(rule.id, { enabled: checked })
                    }
                  />
                  <select
                    value={rule.eventType}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        eventType: e.target.value as AlertEventType,
                      })
                    }
                    className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                  >
                    {(Object.entries(EVENT_LABELS) as [AlertEventType, string][]).map(
                      ([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-[#EA0022]"
                  onClick={() => removeRule(rule.id)}
                  aria-label="Remove rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateRule(rule.id, {
                      channel: "email",
                      config: { ...rule.config, webhookUrl: undefined },
                    })
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] transition-colors ${
                    rule.channel === "email"
                      ? "bg-[#2006F7]/10 text-[#2006F7] dark:text-[#6B5BFF]"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateRule(rule.id, {
                      channel: "webhook",
                      config: { ...rule.config, email: undefined },
                    })
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] transition-colors ${
                    rule.channel === "webhook"
                      ? "bg-[#2006F7]/10 text-[#2006F7] dark:text-[#6B5BFF]"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Webhook className="h-3.5 w-3.5" />
                  Webhook
                </button>
              </div>

              {rule.channel === "email" ? (
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={rule.config.email ?? ""}
                  onChange={(e) => updateConfig(rule.id, "email", e.target.value)}
                  className="h-8 text-[11px]"
                />
              ) : (
                <Input
                  type="url"
                  placeholder="https://..."
                  value={rule.config.webhookUrl ?? ""}
                  onChange={(e) =>
                    updateConfig(rule.id, "webhookUrl", e.target.value)
                  }
                  className="h-8 text-[11px]"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground">
        Alerts are stored locally. Supabase-backed alert delivery will be added in a future release.
      </p>
    </div>
  );
}

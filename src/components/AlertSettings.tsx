import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, Mail, Webhook, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  loadAlertRules,
  saveAlertRules,
  type AlertRule,
  type AlertEventType,
} from "@/lib/alert-rules";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";

const TEST_WEBHOOK_PAYLOAD = {
  event: "test",
  source: "Sophos FireComply",
  timestamp: "2024-01-01T00:00:00Z",
  data: {
    message: "This is a test webhook from Sophos FireComply",
  },
};

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

type TabId = "all" | "webhook";

export function AlertSettings() {
  const nextFetchSignal = useAbortableInFlight();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("all");

  useEffect(() => {
    loadAlertRules().then(setRules);
  }, []);

  const webhookRules = rules.filter((r) => r.channel === "webhook");

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
    [rules, persist],
  );

  const updateRule = useCallback(
    (id: string, patch: Partial<AlertRule>) => {
      persist(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [rules, persist],
  );

  const updateConfig = useCallback(
    (id: string, key: "email" | "webhookUrl", value: string) => {
      persist(
        rules.map((r) =>
          r.id === id ? { ...r, config: { ...r.config, [key]: value || undefined } } : r,
        ),
      );
    },
    [rules, persist],
  );

  const testWebhook = useCallback(
    async (url: string) => {
      if (!url?.trim()) {
        toast.error("Enter a webhook URL first");
        return;
      }
      const signal = nextFetchSignal();
      try {
        const res = await fetch(url, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(TEST_WEBHOOK_PAYLOAD),
        });
        if (res.ok) {
          toast.success("Webhook test successful — endpoint responded");
        } else {
          toast.error(`Webhook returned ${res.status} — check your endpoint`);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast.error("Webhook test failed — check URL and network");
      }
    },
    [nextFetchSignal],
  );

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-semibold text-foreground">Email &amp; webhook alerts</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            Configure notifications for licence expiry, score drops, critical findings, and Central
            disconnection.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={addRule}
          className="gap-1.5 text-[10px] h-7 rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white border-0 hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          Add rule
        </Button>
      </div>

      <div className="flex gap-1 border-b border-brand-accent/10">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-2.5 py-1.5 text-[10px] font-medium border-b-2 transition-colors ${
            activeTab === "all"
              ? "border-brand-accent text-brand-accent"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("webhook")}
          className={`px-2.5 py-1.5 text-[10px] font-medium border-b-2 transition-colors flex items-center gap-1 ${
            activeTab === "webhook"
              ? "border-brand-accent text-brand-accent"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Webhook className="h-3 w-3" />
          Webhook / SIEM
        </button>
      </div>

      {activeTab === "webhook" && (
        <div className="rounded-xl border border-brand-accent/15 bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] p-3">
          <p className="text-[10px] font-medium text-foreground mb-1">Webhook / SIEM integration</p>
          <p className="text-[9px] text-muted-foreground">
            Configure webhook URLs to receive finding events in your SIEM. Webhook delivery runs
            when findings change (via the connector agent). Use the Test Webhook button to validate
            connectivity.
          </p>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-brand-accent/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] py-6 text-center text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 text-brand-accent/30" />
          <p className="text-[11px]">No alert rules configured</p>
          <p className="text-[9px] mt-1">Add a rule to receive email or webhook notifications</p>
          <Button
            variant="outline"
            size="sm"
            onClick={addRule}
            className="mt-3 gap-1.5 text-[10px] h-7 rounded-xl border-brand-accent/15 hover:bg-brand-accent/[0.06]"
          >
            <Plus className="h-3 w-3" />
            Add rule
          </Button>
        </div>
      ) : activeTab === "webhook" && webhookRules.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-brand-accent/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] py-6 text-center text-muted-foreground">
          <Webhook className="h-8 w-8 mx-auto mb-2 text-brand-accent/30" />
          <p className="text-[11px]">No webhook rules</p>
          <p className="text-[9px] mt-1">
            Add a rule and select Webhook to configure SIEM integration
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={addRule}
            className="mt-3 gap-1.5 text-[10px] h-7 rounded-xl border-brand-accent/15 hover:bg-brand-accent/[0.06]"
          >
            <Plus className="h-3 w-3" />
            Add rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(activeTab === "webhook" ? webhookRules : rules).map((rule) => (
            <div
              key={rule.id}
              className="rounded-xl border border-brand-accent/10 bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
                  />
                  <select
                    value={rule.eventType}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        eventType: e.target.value as AlertEventType,
                      })
                    }
                    className="flex-1 min-w-0 rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
                  >
                    {(Object.entries(EVENT_LABELS) as [AlertEventType, string][]).map(
                      ([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ),
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
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors ${
                    rule.channel === "email"
                      ? "bg-brand-accent/10 text-brand-accent"
                      : "bg-brand-accent/[0.04] text-muted-foreground hover:bg-brand-accent/[0.08]"
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
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors ${
                    rule.channel === "webhook"
                      ? "bg-brand-accent/10 text-brand-accent"
                      : "bg-brand-accent/[0.04] text-muted-foreground hover:bg-brand-accent/[0.08]"
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
                  className="h-8 text-[11px] rounded-xl border-brand-accent/15"
                />
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={rule.config.webhookUrl ?? ""}
                    onChange={(e) => updateConfig(rule.id, "webhookUrl", e.target.value)}
                    className="h-8 text-[11px] flex-1 rounded-xl border-brand-accent/15"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-[10px] shrink-0 rounded-xl border-brand-accent/15 hover:bg-brand-accent/[0.06]"
                    onClick={() => testWebhook(rule.config.webhookUrl ?? "")}
                  >
                    <Send className="h-3 w-3" />
                    Test Webhook
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/70">
        Alert rules are synced to your organisation. Webhook delivery runs when findings change (via
        the connector agent). The Test Webhook button validates connectivity only.
      </p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function WebhookSettings() {
  const { org, canManageTeam } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("organisations")
          .select("webhook_url, webhook_secret")
          .eq("id", org.id)
          .single();
        if (cancelled) return;
        const row = data as { webhook_url?: string | null; webhook_secret?: string | null } | null;
        setWebhookUrl(row?.webhook_url ?? "");
        setWebhookSecret(row?.webhook_secret ?? "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  const handleSave = async () => {
    if (!org?.id || !canManageTeam) return;
    setSaving(true);
    setSaved(false);
    await supabase
      .from("organisations")
      .update({
        webhook_url: webhookUrl.trim() || null,
        webhook_secret: webhookSecret.trim() || null,
      })
      .eq("id", org.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="text-xs text-muted-foreground">Loading…</div>;
  if (!canManageTeam)
    return <p className="text-xs text-muted-foreground">Only admins can configure webhooks.</p>;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">
        When a report or assessment is saved, FireComply can POST a JSON payload to your URL (e.g.
        for PSA/RMM or ticketing). Optional secret is used to sign the request (X-Webhook-Signature:
        HMAC-SHA256).
      </p>
      <div>
        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-server.com/webhooks/firecomply"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-muted-foreground mb-1">
          Secret (optional)
        </label>
        <input
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="Leave blank to skip signing"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
          autoComplete="off"
        />
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
        {saved ? "Saved" : saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

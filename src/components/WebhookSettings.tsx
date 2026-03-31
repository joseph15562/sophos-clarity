import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";

const webhookFormSchema = z.object({
  webhookUrl: z
    .string()
    .trim()
    .refine((s) => s === "" || z.string().url().safeParse(s).success, {
      message: "Enter a valid https URL or leave blank",
    }),
  webhookSecret: z.string(),
});

export function WebhookSettings() {
  const { org, canManageTeam } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [urlFieldError, setUrlFieldError] = useState<string | null>(null);

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
    setUrlFieldError(null);
    const parsed = webhookFormSchema.safeParse({ webhookUrl, webhookSecret });
    if (!parsed.success) {
      const urlIssue = parsed.error.flatten().fieldErrors.webhookUrl?.[0];
      setUrlFieldError(urlIssue ?? "Check the webhook URL");
      return;
    }
    setSaving(true);
    setSaved(false);
    await supabase
      .from("organisations")
      .update({
        webhook_url: parsed.data.webhookUrl.trim() || null,
        webhook_secret: parsed.data.webhookSecret.trim() || null,
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
      <div className="space-y-1.5">
        <Label htmlFor="org-webhook-url" className="text-[10px] font-medium text-muted-foreground">
          Webhook URL
        </Label>
        <Input
          id="org-webhook-url"
          type="url"
          value={webhookUrl}
          onChange={(e) => {
            setWebhookUrl(e.target.value);
            setUrlFieldError(null);
          }}
          placeholder="https://your-server.com/webhooks/firecomply"
          className="text-xs"
          aria-invalid={!!urlFieldError}
          aria-describedby={urlFieldError ? "org-webhook-url-error" : undefined}
        />
        {urlFieldError ? (
          <p id="org-webhook-url-error" className="text-xs text-destructive" role="alert">
            {urlFieldError}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="org-webhook-secret"
          className="text-[10px] font-medium text-muted-foreground"
        >
          Secret (optional)
        </Label>
        <Input
          id="org-webhook-secret"
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="Leave blank to skip signing"
          className="text-xs"
          autoComplete="off"
        />
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
        {saved ? "Saved" : saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

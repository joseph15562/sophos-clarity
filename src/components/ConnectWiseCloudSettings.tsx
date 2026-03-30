import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Plug, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logAudit } from "@/lib/audit";

const AUTH_GUIDE = "https://developers.cloudservices.connectwise.com/Guides/Authentication";
const GET_STARTED = "https://developers.cloudservices.connectwise.com/getstarted";
const MANAGE_REST = "https://developer.connectwise.com/products/manage/rest";

type StatusRow = {
  public_id_suffix: string;
  scope: string;
  connected_at: string;
  last_token_ok_at: string | null;
  last_error: string | null;
};

/** ConnectWise Cloud Services API credentials (client credentials + subscription key). */
export function ConnectWiseCloudSettings() {
  const { org } = useAuth();
  const [status, setStatus] = useState<StatusRow | null>(null);
  const [publicMemberId, setPublicMemberId] = useState("");
  const [subscriptionKey, setSubscriptionKey] = useState("");
  const [scope, setScope] = useState<"Partner" | "Distributor">("Partner");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [whoamiJson, setWhoamiJson] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!org?.id) {
      setStatus(null);
      return;
    }
    const { data, error } = await supabase
      .from("connectwise_cloud_credentials")
      .select("public_id_suffix, scope, connected_at, last_token_ok_at, last_error")
      .eq("org_id", org.id)
      .maybeSingle();
    if (error) {
      console.warn("[ConnectWiseCloudSettings]", error);
      setStatus(null);
      return;
    }
    setStatus(data as StatusRow | null);
  }, [org?.id]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function apiFetch(path: string, init?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
    const method = init?.method ?? "GET";
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(method !== "GET" && method !== "HEAD" ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...init?.headers,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(
        typeof body.error === "string" ? body.error : `Request failed (${res.status})`,
      );
    return body;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;
    const pid = publicMemberId.trim();
    const key = subscriptionKey.trim();
    if (!pid || !key) {
      setMessage("API user ID and subscription key are required.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await apiFetch("/connectwise/credentials", {
        method: "POST",
        body: JSON.stringify({ publicMemberId: pid, subscriptionKey: key, scope }),
      });
      setPublicMemberId("");
      setSubscriptionKey("");
      await loadStatus();
      setMessage("Saved and token verified.");
      void logAudit(org.id, "connectwise.linked", "connectwise", "", { scope });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!org?.id) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await apiFetch("/connectwise/test", { method: "POST" });
      const exp = typeof data.expires_in === "number" ? data.expires_in : null;
      await loadStatus();
      setMessage(exp != null ? `Token OK (expires in ${exp}s).` : "Token OK.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Test failed");
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  /** GET /whoami on the Partner Cloud gateway (fresh token per request; cache later if rate limits require). */
  const handleWhoami = async () => {
    if (!org?.id) return;
    setBusy(true);
    setMessage("");
    setWhoamiJson(null);
    try {
      const data = await apiFetch("/connectwise/whoami");
      if (data && typeof data === "object" && "whoami" in data) {
        setWhoamiJson(JSON.stringify((data as { whoami: unknown }).whoami, null, 2));
        setMessage("Partner Cloud profile loaded.");
      } else {
        setMessage("Unexpected response.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "whoami failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!org?.id) return;
    if (!confirm("Remove ConnectWise Cloud credentials for this workspace?")) return;
    setBusy(true);
    setMessage("");
    try {
      await apiFetch("/connectwise/credentials", { method: "DELETE" });
      await loadStatus();
      setMessage("Disconnected.");
      void logAudit(org.id, "connectwise.disconnected", "connectwise", "");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  if (status === undefined) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const connected = status !== null;

  return (
    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
      <p>
        <span className="font-semibold text-foreground">Partner Cloud</span> — OAuth 2.0 client
        credentials (API user ID + subscription key +{" "}
        <code className="text-[10px]">Ocp-Apim-Subscription-Key</code>).{" "}
        <a
          href={AUTH_GUIDE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent inline-flex items-center gap-0.5 font-medium"
        >
          Authentication <ExternalLink className="h-3 w-3" />
        </a>
        {" · "}
        <a
          href={GET_STARTED}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent font-medium"
        >
          Get started
        </a>
        . Encrypted like Sophos Central; token verified on save.{" "}
        <strong className="text-foreground">Service tickets</strong> use{" "}
        <strong className="text-foreground">ConnectWise Manage</strong> in PSA settings (
        <a
          href={MANAGE_REST}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent font-medium"
        >
          Manage REST <ExternalLink className="inline h-3 w-3" />
        </a>
        ) — not this Partner API.
      </p>

      {connected && (
        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 flex flex-wrap items-center gap-2">
          <Plug className="h-3.5 w-3.5 text-[#5A00FF] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground text-[11px]">Connected</p>
            <p className="text-[10px] font-mono text-muted-foreground">
              …{status.public_id_suffix} · {status.scope}
            </p>
            {status.last_error && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                {status.last_error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1"
              disabled={busy}
              onClick={() => void handleWhoami()}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
              Partner profile
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px] gap-1"
              disabled={busy}
              onClick={() => void handleTest()}
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Test token
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] text-destructive"
              disabled={busy}
              onClick={() => void handleDisconnect()}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {whoamiJson && (
        <pre className="max-h-40 overflow-auto rounded-lg border border-border/50 bg-muted/30 p-2 text-[10px] font-mono text-foreground whitespace-pre-wrap break-all">
          {whoamiJson}
        </pre>
      )}

      <form
        onSubmit={(e) => void handleSave(e)}
        className="space-y-2 rounded-xl border border-border/50 bg-background/30 p-3"
      >
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">
          {connected ? "Update credentials" : "Connect"}
        </p>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">API user ID</label>
          <Input
            className="h-8 text-xs font-mono"
            value={publicMemberId}
            onChange={(e) => setPublicMemberId(e.target.value)}
            placeholder="e.g. 4f3d7c7b…"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">Subscription key</label>
          <Input
            className="h-8 text-xs font-mono"
            type="password"
            value={subscriptionKey}
            onChange={(e) => setSubscriptionKey(e.target.value)}
            placeholder="Primary or secondary key"
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">Scope (product)</label>
          <select
            className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            value={scope}
            onChange={(e) => setScope(e.target.value as "Partner" | "Distributor")}
          >
            <option value="Partner">Partner</option>
            <option value="Distributor">Distributor</option>
          </select>
        </div>
        <Button type="submit" size="sm" className="text-xs" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save & verify"}
        </Button>
      </form>

      {message && (
        <p
          className={`text-[11px] ${message.includes("failed") || message.includes("required") ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

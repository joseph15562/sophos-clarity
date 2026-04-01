import { useCallback, useEffect, useState } from "react";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";
import { KeyRound, Loader2, Copy, Trash2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logAudit } from "@/lib/audit";

type KeyRow = Tables<"org_service_api_keys">;

function formatServiceKeyClientError(err: unknown): string {
  if (err instanceof TypeError && /fetch/i.test(String(err.message))) {
    return "Could not reach the FireComply API (network or CORS). Check your connection, VPN, ad blockers, and that Supabase Edge Functions are deployed for this project.";
  }
  if (err instanceof Error && /failed to fetch/i.test(err.message)) {
    return "Could not reach the FireComply API (network or CORS). Check connection and that the api function is deployed.";
  }
  return err instanceof Error ? err.message : "Request failed";
}

/** List and manage org service API keys; Edge validates via `_shared/service-key.ts`. */
export function OrgServiceKeysSettings() {
  const { org } = useAuth();
  const nextMutationSignal = useAbortableInFlight();
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [scopeFirewalls, setScopeFirewalls] = useState(true);
  const [scopeAssessments, setScopeAssessments] = useState(false);

  const loadRows = useCallback(async () => {
    if (!org?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase
      .from("org_service_api_keys")
      .select("*")
      .eq("org_id", org.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[OrgServiceKeysSettings]", error);
      setRows([]);
      setLoadError(
        error.message?.includes("fetch") || error.message === "Failed to fetch"
          ? formatServiceKeyClientError(new TypeError("Failed to fetch"))
          : error.message || "Could not load keys",
      );
    } else {
      setRows((data ?? []) as KeyRow[]);
    }
    setLoading(false);
  }, [org?.id]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function apiPost(path: string, body: unknown, signal?: AbortSignal) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    });
    const resBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof resBody.error === "string" ? resBody.error : `Request failed (${res.status})`,
      );
    }
    return resBody;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;
    const trimmed = label.trim();
    if (!trimmed) {
      setMessage("Enter a label for this key.");
      return;
    }
    if (!scopeFirewalls && !scopeAssessments) {
      setMessage("Select at least one permission.");
      return;
    }
    const scopes: string[] = [];
    if (scopeFirewalls) scopes.push("api:read");
    if (scopeAssessments) scopes.push("api:read:assessments");
    setBusy(true);
    setMessage("");
    try {
      const data = await apiPost(
        "/service-key/issue",
        {
          label: trimmed,
          scopes,
        },
        nextMutationSignal(),
      );
      const secret = typeof data.secret === "string" ? data.secret : "";
      if (!secret) throw new Error("No secret returned");
      setNewSecret(secret);
      setLabel("");
      await loadRows();
      void logAudit(org.id, "service_key.issued", "service_key", data.key?.id ?? "", {
        label: trimmed,
      });
    } catch (err) {
      setMessage(formatServiceKeyClientError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!org?.id) return;
    if (!confirm("Revoke this key? Integrations using it will stop working immediately.")) return;
    setRevokingId(id);
    setMessage("");
    try {
      await apiPost("/service-key/revoke", { id }, nextMutationSignal());
      await loadRows();
      void logAudit(org.id, "service_key.revoked", "service_key", id, {});
    } catch (err) {
      setMessage(formatServiceKeyClientError(err));
    } finally {
      setRevokingId(null);
    }
  };

  const pingUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/service-key/ping`;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading keys…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <details className="group rounded-xl border border-border/50 bg-muted/15 open:bg-muted/25">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[10px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          Using service keys &amp; ping URL
        </summary>
        <p className="border-t border-border/40 px-3 pb-3 pt-2 text-[10px] text-muted-foreground leading-relaxed">
          Use <code className="text-[10px]">X-FireComply-Service-Key</code> or Bearer (non-JWT) on
          API calls. Ping <code className="text-[10px] break-all">{pingUrl}</code> to verify.{" "}
          <code className="text-[10px]">api:read</code> allows{" "}
          <code className="text-[10px]">GET /api/firewalls</code>;{" "}
          <code className="text-[10px]">api:read:assessments</code> allows listing and reading
          assessments.
        </p>
      </details>

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="space-y-2 rounded-xl border border-border/50 bg-background/30 p-3"
      >
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">
          Create key
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-foreground">Label</label>
            <Input
              className="h-8 text-xs"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. RMM production"
              disabled={busy}
            />
          </div>
          <Button type="submit" size="sm" className="text-xs shrink-0" disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create key"}
          </Button>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[10px] font-medium text-foreground">Permissions</span>
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
            <Checkbox
              checked={scopeFirewalls}
              onCheckedChange={(c) => setScopeFirewalls(c === true)}
              disabled={busy}
            />
            <span>
              Read firewalls (<code className="text-[10px]">api:read</code>)
            </span>
          </label>
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
            <Checkbox
              checked={scopeAssessments}
              onCheckedChange={(c) => setScopeAssessments(c === true)}
              disabled={busy}
            />
            <span>
              Read assessments (<code className="text-[10px]">api:read:assessments</code>)
            </span>
          </label>
        </div>
      </form>

      {message && <p className="text-[11px] text-amber-700 dark:text-amber-400">{message}</p>}

      {loadError && !message && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">{loadError}</p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {loadError
            ? "Keys could not be loaded. Fix the issue above, then refresh or reopen settings."
            : "No active keys yet. Create one above."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((k) => (
            <li
              key={k.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs"
            >
              <KeyRound className="h-3.5 w-3.5 text-brand-accent shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{k.label}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{k.key_prefix}…</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {k.scopes?.join(", ") || "—"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-destructive shrink-0 px-2"
                disabled={revokingId === k.id}
                onClick={() => void handleRevoke(k.id)}
                aria-label={`Revoke key ${k.label}`}
              >
                {revokingId === k.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!newSecret} onOpenChange={(open) => !open && setNewSecret(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Copy your service key</DialogTitle>
            <DialogDescription className="text-xs text-left">
              This secret is shown only once. Store it in a password manager or secret store. You
              cannot retrieve it later.
            </DialogDescription>
          </DialogHeader>
          {newSecret && (
            <div className="rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px] break-all text-foreground">
              {newSecret}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (newSecret) void navigator.clipboard.writeText(newSecret);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button type="button" size="sm" onClick={() => setNewSecret(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

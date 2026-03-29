import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Ticket, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MANAGE_REST = "https://developer.connectwise.com/products/manage/rest";

/** ConnectWise Manage REST credentials and defaults for service ticket creation (separate from Partner Cloud). */
export function ConnectWiseManageSettings() {
  const { org } = useAuth();
  const [linked, setLinked] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [integratorCompanyId, setIntegratorCompanyId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [defaultBoardId, setDefaultBoardId] = useState("");
  const [defaultStatusId, setDefaultStatusId] = useState("1");
  const [mappings, setMappings] = useState<{ customer_key: string; company_id: number }[]>([]);
  const [mapCustomerKey, setMapCustomerKey] = useState("");
  const [mapCompanyId, setMapCompanyId] = useState("");
  const [mapBusy, setMapBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!org?.id) {
      setLinked(false);
      return;
    }
    const { data, error } = await supabase
      .from("connectwise_manage_credentials")
      .select("api_base_url, integrator_company_id, default_board_id, default_status_id")
      .eq("org_id", org.id)
      .maybeSingle();
    if (error) {
      console.warn("[ConnectWiseManageSettings]", error);
      setLinked(false);
      return;
    }
    if (data) {
      setLinked(true);
      setApiBaseUrl(data.api_base_url ?? "");
      setIntegratorCompanyId(data.integrator_company_id ?? "");
      setDefaultBoardId(String(data.default_board_id ?? ""));
      setDefaultStatusId(String(data.default_status_id ?? 1));
    } else {
      setLinked(false);
    }
  }, [org?.id]);

  const loadMappings = useCallback(async () => {
    if (!org?.id) {
      setMappings([]);
      return;
    }
    const { data, error } = await supabase
      .from("psa_customer_company_map")
      .select("customer_key, company_id")
      .eq("org_id", org.id)
      .eq("provider", "connectwise_manage")
      .order("customer_key", { ascending: true });
    if (error) {
      console.warn("[ConnectWiseManageSettings] mappings", error);
      setMappings([]);
      return;
    }
    setMappings((data ?? []) as { customer_key: string; company_id: number }[]);
  }, [org?.id]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  async function apiPost(path: string, body: unknown) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
    const res = await fetch(`${base}${path}`, {
      method: "POST",
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

  async function apiDelete(path: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
    const res = await fetch(`${base}${path}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    const resBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof resBody.error === "string" ? resBody.error : `Request failed (${res.status})`,
      );
    }
    return resBody;
  }

  async function apiPut(path: string, body: unknown) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
    const res = await fetch(`${base}${path}`, {
      method: "PUT",
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;
    const board = parseInt(defaultBoardId, 10);
    const status = parseInt(defaultStatusId, 10) || 1;
    if (!apiBaseUrl.trim() || !integratorCompanyId.trim()) {
      setMessage("API base URL and integrator company ID are required.");
      return;
    }
    if (!linked && (!publicKey.trim() || !privateKey.trim())) {
      setMessage("Public and private keys are required for a new connection.");
      return;
    }
    if (!Number.isFinite(board)) {
      setMessage("Default board ID must be a number.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        apiBaseUrl: apiBaseUrl.trim(),
        integratorCompanyId: integratorCompanyId.trim(),
        defaultBoardId: board,
        defaultStatusId: status,
      };
      if (publicKey.trim() && privateKey.trim()) {
        payload.publicKey = publicKey.trim();
        payload.privateKey = privateKey.trim();
      }
      await apiPost("/connectwise-manage/credentials", payload);
      setPrivateKey("");
      setMessage("Saved.");
      await loadStatus();
      await loadMappings();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.id) return;
    const ck = mapCustomerKey.trim();
    const cid = parseInt(mapCompanyId, 10);
    if (!ck) {
      setMessage("Enter the FireComply customer name (same as Customers page).");
      return;
    }
    if (!Number.isFinite(cid)) {
      setMessage("Manage company ID must be a number.");
      return;
    }
    setMapBusy(true);
    setMessage("");
    try {
      await apiPut("/connectwise-manage/company-mappings", {
        customerKey: ck,
        companyId: cid,
      });
      setMapCustomerKey("");
      setMapCompanyId("");
      setMessage("Mapping saved.");
      await loadMappings();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Mapping save failed");
    } finally {
      setMapBusy(false);
    }
  };

  const handleDeleteMapping = async (customerKey: string) => {
    if (!confirm(`Remove mapping for "${customerKey}"?`)) return;
    setMapBusy(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
      const res = await fetch(`${base}/connectwise-manage/company-mappings`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ customerKey }),
      });
      const resBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof resBody.error === "string" ? resBody.error : `Request failed (${res.status})`,
        );
      }
      setMessage("Mapping removed.");
      await loadMappings();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setMapBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Remove ConnectWise Manage credentials?")) return;
    setBusy(true);
    setMessage("");
    try {
      await apiDelete("/connectwise-manage/credentials");
      setLinked(false);
      setApiBaseUrl("");
      setIntegratorCompanyId("");
      setPublicKey("");
      setPrivateKey("");
      setDefaultBoardId("");
      setDefaultStatusId("1");
      setMessage("Disconnected.");
      setMappings([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  if (linked === undefined) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
      <p>
        <span className="font-semibold text-foreground">ConnectWise Manage</span> uses the REST API
        at your site (API base + integration keys), not the Partner Cloud developer portal. See{" "}
        <a
          href={MANAGE_REST}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent font-medium"
        >
          Manage REST docs <ExternalLink className="inline h-3 w-3" />
        </a>
        . Keys are encrypted like Sophos Central. Set a default service board and status for tickets
        created from findings.
      </p>
      {linked && (
        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Ticket className="h-3.5 w-3.5 text-[#5A00FF] shrink-0" />
            <span className="text-[11px] font-medium text-foreground truncate">
              Manage API linked
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-destructive shrink-0"
            disabled={busy}
            onClick={() => void handleDisconnect()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <form
        onSubmit={(e) => void handleSave(e)}
        className="space-y-2 rounded-xl border border-border/50 bg-background/30 p-3"
      >
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">
          {linked ? "Update credentials" : "Connect"}
        </p>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">API base URL</label>
          <Input
            className="h-8 text-[11px] font-mono"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://na.myconnectwise.net/v4_6_release/apis/3.0"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">Integrator company ID</label>
          <Input
            className="h-8 text-xs font-mono"
            value={integratorCompanyId}
            onChange={(e) => setIntegratorCompanyId(e.target.value)}
            placeholder="Numeric company ID from Manage"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">Public key</label>
          <Input
            className="h-8 text-xs font-mono"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">Private key</label>
          <Input
            className="h-8 text-xs font-mono"
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Paste from Manage API member"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-foreground">Default board ID</label>
            <Input
              className="h-8 text-xs"
              value={defaultBoardId}
              onChange={(e) => setDefaultBoardId(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-foreground">Default status ID</label>
            <Input
              className="h-8 text-xs"
              value={defaultStatusId}
              onChange={(e) => setDefaultStatusId(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>
        <p className="text-[10px] text-amber-700 dark:text-amber-400">
          You can change board, status, or URL without re-entering keys. Paste both keys only when
          adding or rotating the integration. Keys are never shown after save.
        </p>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </form>

      <div className="rounded-xl border border-border/50 bg-background/20 p-3 space-y-2">
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">
          Customer ↔ Manage company ID
        </p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Use the exact customer label shown on the Customers page (resolved name). When creating a
          ticket from findings, this maps the assessment customer to a ConnectWise Manage company
          ID.
        </p>
        {mappings.length > 0 && (
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {mappings.map((m) => (
              <li
                key={m.customer_key}
                className="flex items-center justify-between gap-2 rounded border border-border/40 px-2 py-1 text-[11px]"
              >
                <span className="truncate text-foreground" title={m.customer_key}>
                  {m.customer_key}
                </span>
                <span className="font-mono text-muted-foreground shrink-0">{m.company_id}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive shrink-0"
                  disabled={mapBusy}
                  onClick={() => void handleDeleteMapping(m.customer_key)}
                  aria-label={`Remove mapping ${m.customer_key}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e) => void handleSaveMapping(e)} className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-1">
            <label className="text-[10px] text-foreground">FireComply customer name</label>
            <Input
              className="h-8 text-xs"
              value={mapCustomerKey}
              onChange={(e) => setMapCustomerKey(e.target.value)}
              placeholder="e.g. Acme Corp"
              disabled={mapBusy}
            />
          </div>
          <div className="space-y-1 sm:col-span-1">
            <label className="text-[10px] text-foreground">Manage company ID</label>
            <Input
              className="h-8 text-xs font-mono"
              value={mapCompanyId}
              onChange={(e) => setMapCompanyId(e.target.value)}
              placeholder="Numeric ID"
              inputMode="numeric"
              disabled={mapBusy}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="sm:col-span-2 w-fit"
            disabled={mapBusy}
          >
            Save mapping
          </Button>
        </form>
      </div>

      {message && <p className="text-[11px] text-foreground">{message}</p>}
    </div>
  );
}

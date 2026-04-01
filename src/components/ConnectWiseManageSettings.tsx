import { useCallback, useEffect, useState } from "react";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";
import { Check, ChevronsUpDown, ExternalLink, Loader2, Ticket, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FirecomplyCustomerMappingInput } from "@/components/psa/FirecomplyCustomerMappingInput";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MANAGE_REST = "https://developer.connectwise.com/products/manage/rest";

type ManageCompanyRow = { id: number; name: string; identifier: string };

/** ConnectWise Manage REST credentials and defaults for service ticket creation (separate from Partner Cloud). */
export function ConnectWiseManageSettings() {
  const { org } = useAuth();
  const nextMutationSignal = useAbortableInFlight();
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

  const [manageCompanies, setManageCompanies] = useState<ManageCompanyRow[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyManualMode, setCompanyManualMode] = useState(false);

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

  async function apiGet(path: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
    const res = await fetch(`${base}${path}`, {
      method: "GET",
      signal,
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
    return resBody as Record<string, unknown>;
  }

  async function ensureManageCompanies() {
    if (!linked) return;
    setCompaniesLoading(true);
    setCompaniesError("");
    try {
      const data = await apiGet("/connectwise-manage/companies", nextMutationSignal());
      const list = data.companies;
      setManageCompanies(Array.isArray(list) ? (list as ManageCompanyRow[]) : []);
    } catch (err) {
      setCompaniesError(err instanceof Error ? err.message : "Failed to load companies");
      setManageCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }

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

  async function apiDelete(path: string, signal?: AbortSignal) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
    const res = await fetch(`${base}${path}`, {
      method: "DELETE",
      signal,
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

  async function apiPut(path: string, body: unknown, signal?: AbortSignal) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
    const res = await fetch(`${base}${path}`, {
      method: "PUT",
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
      await apiPost("/connectwise-manage/credentials", payload, nextMutationSignal());
      setPrivateKey("");
      setMessage("Saved.");
      await loadStatus();
      await loadMappings();
      setManageCompanies([]);
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
      setMessage("Choose or enter the FireComply customer name (same as Customers page).");
      return;
    }
    if (!Number.isFinite(cid)) {
      setMessage("Manage company ID must be a number.");
      return;
    }
    setMapBusy(true);
    setMessage("");
    try {
      await apiPut(
        "/connectwise-manage/company-mappings",
        {
          customerKey: ck,
          companyId: cid,
        },
        nextMutationSignal(),
      );
      setMapCustomerKey("");
      setMapCompanyId("");
      setCompanyManualMode(false);
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
        signal: nextMutationSignal(),
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
      await apiDelete("/connectwise-manage/credentials", nextMutationSignal());
      setLinked(false);
      setApiBaseUrl("");
      setIntegratorCompanyId("");
      setPublicKey("");
      setPrivateKey("");
      setDefaultBoardId("");
      setDefaultStatusId("1");
      setMessage("Disconnected.");
      setMappings([]);
      setManageCompanies([]);
      setCompaniesError("");
      setMapCustomerKey("");
      setMapCompanyId("");
      setCompanyManualMode(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  const selectedCompanyLabel = (() => {
    const id = parseInt(mapCompanyId, 10);
    if (!Number.isFinite(id)) return "";
    const row = manageCompanies.find((c) => c.id === id);
    if (!row) return String(id);
    return row.identifier ? `${row.name} (${row.identifier})` : row.name;
  })();

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
        <span className="font-semibold text-foreground">ConnectWise Manage</span> — site REST API
        (base URL + integrator keys), not Partner Cloud.{" "}
        <a
          href={MANAGE_REST}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent font-medium"
        >
          Manage REST docs <ExternalLink className="inline h-3 w-3" />
        </a>
        . Encrypted like Sophos Central. Default board/status apply to tickets from findings.
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
          Pick the customer label from your org data (same resolved names as the Customers page).
          With Manage linked, choose a company from Manage or enter an ID manually.
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
          <div className="sm:col-span-1 min-w-0">
            <FirecomplyCustomerMappingInput
              value={mapCustomerKey}
              onChange={setMapCustomerKey}
              disabled={mapBusy}
            />
          </div>
          <div className="space-y-1 sm:col-span-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] text-foreground">Manage company</label>
              {linked && !companyManualMode && (
                <button
                  type="button"
                  className="text-[10px] text-brand-accent font-medium hover:underline shrink-0"
                  disabled={mapBusy || companiesLoading}
                  onClick={() => void ensureManageCompanies()}
                >
                  {companiesLoading ? "Loading…" : manageCompanies.length ? "Refresh" : "Load list"}
                </button>
              )}
            </div>
            {linked && !companyManualMode ? (
              <>
                <Popover
                  open={companyOpen}
                  onOpenChange={(open) => {
                    setCompanyOpen(open);
                    if (open && manageCompanies.length === 0 && !companiesLoading) {
                      void ensureManageCompanies();
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={companyOpen}
                      disabled={mapBusy || companiesLoading}
                      className="h-8 w-full justify-between px-2 text-xs font-normal text-foreground"
                    >
                      <span className="truncate">
                        {companiesLoading
                          ? "Loading companies…"
                          : mapCompanyId && selectedCompanyLabel
                            ? `${selectedCompanyLabel} · ${mapCompanyId}`
                            : "Select company…"}
                      </span>
                      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search name or ID…" className="h-9 text-xs" />
                      <CommandList>
                        <CommandEmpty className="text-xs py-3">
                          {companiesError || "No companies loaded."}
                        </CommandEmpty>
                        <CommandGroup>
                          {manageCompanies.map((c) => {
                            const label = c.identifier ? `${c.name} (${c.identifier})` : c.name;
                            const searchValue = `${c.name} ${c.identifier} ${c.id}`;
                            return (
                              <CommandItem
                                key={c.id}
                                value={searchValue}
                                className="text-xs"
                                onSelect={() => {
                                  setMapCompanyId(String(c.id));
                                  setCompanyOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-3.5 w-3.5 shrink-0",
                                    mapCompanyId === String(c.id) ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="truncate flex-1 min-w-0">{label}</span>
                                <span className="font-mono text-muted-foreground shrink-0 ml-1">
                                  {c.id}
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                          <CommandItem
                            value="__manual_company"
                            className="text-xs"
                            onSelect={() => {
                              setCompanyManualMode(true);
                              setCompanyOpen(false);
                            }}
                          >
                            Enter company ID manually…
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {companiesError && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">{companiesError}</p>
                )}
              </>
            ) : (
              <div className="space-y-1">
                <Input
                  className="h-8 text-xs font-mono"
                  value={mapCompanyId}
                  onChange={(e) => setMapCompanyId(e.target.value)}
                  placeholder="Numeric company ID"
                  inputMode="numeric"
                  disabled={mapBusy}
                />
                {linked && (
                  <button
                    type="button"
                    className="text-[10px] text-brand-accent font-medium hover:underline"
                    onClick={() => {
                      setCompanyManualMode(false);
                      setMapCompanyId("");
                    }}
                  >
                    Pick from Manage list
                  </button>
                )}
              </div>
            )}
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

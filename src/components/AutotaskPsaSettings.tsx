import { useCallback, useEffect, useState } from "react";
import { useAbortableInFlight } from "@/hooks/use-abortable-in-flight";
import { Check, ChevronsUpDown, ExternalLink, Loader2, Trash2 } from "lucide-react";
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

const AUTOTASK_AUTH_DOC =
  "https://www.autotask.net/help/DeveloperHelp/Content/APIs/REST/General_Topics/REST_Security_Auth.htm";

type AtCompanyRow = { id: number; name: string };

/** Datto Autotask PSA REST — credentials, ticket defaults, customer ↔ company mapping. */
export function AutotaskPsaSettings() {
  const { org } = useAuth();
  const nextMutationSignal = useAbortableInFlight();
  const [linked, setLinked] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [apiZoneBaseUrl, setApiZoneBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [integrationCode, setIntegrationCode] = useState("");
  const [defaultQueueId, setDefaultQueueId] = useState("");
  const [defaultPriority, setDefaultPriority] = useState("");
  const [defaultStatus, setDefaultStatus] = useState("");
  const [defaultSource, setDefaultSource] = useState("");
  const [defaultTicketType, setDefaultTicketType] = useState("");
  const [mappings, setMappings] = useState<{ customer_key: string; company_id: number }[]>([]);
  const [mapCustomerKey, setMapCustomerKey] = useState("");
  const [mapCompanyId, setMapCompanyId] = useState("");
  const [mapBusy, setMapBusy] = useState(false);

  const [atCompanies, setAtCompanies] = useState<AtCompanyRow[]>([]);
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
      .from("autotask_psa_credentials")
      .select(
        "api_zone_base_url, username, default_queue_id, default_priority, default_status, default_source, default_ticket_type",
      )
      .eq("org_id", org.id)
      .maybeSingle();
    if (error) {
      console.warn("[AutotaskPsaSettings]", error);
      setLinked(false);
      return;
    }
    if (data) {
      setLinked(true);
      setApiZoneBaseUrl(data.api_zone_base_url ?? "");
      setUsername(data.username ?? "");
      setDefaultQueueId(String(data.default_queue_id ?? ""));
      setDefaultPriority(String(data.default_priority ?? ""));
      setDefaultStatus(String(data.default_status ?? ""));
      setDefaultSource(String(data.default_source ?? ""));
      setDefaultTicketType(String(data.default_ticket_type ?? ""));
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
      .eq("provider", "autotask")
      .order("customer_key", { ascending: true });
    if (error) {
      console.warn("[AutotaskPsaSettings] mappings", error);
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

  async function ensureAtCompanies() {
    if (!linked) return;
    setCompaniesLoading(true);
    setCompaniesError("");
    try {
      const data = await apiGet("/autotask-psa/companies", nextMutationSignal());
      const list = data.companies;
      setAtCompanies(Array.isArray(list) ? (list as AtCompanyRow[]) : []);
    } catch (err) {
      setCompaniesError(err instanceof Error ? err.message : "Failed to load companies");
      setAtCompanies([]);
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
    const q = parseInt(defaultQueueId, 10);
    const pr = parseInt(defaultPriority, 10);
    const st = parseInt(defaultStatus, 10);
    const so = parseInt(defaultSource, 10);
    const tt = parseInt(defaultTicketType, 10);
    if (!apiZoneBaseUrl.trim() || !username.trim()) {
      setMessage("Zone URL and username are required.");
      return;
    }
    if (!linked && (!secret.trim() || !integrationCode.trim())) {
      setMessage("Secret and API integration code are required for a new connection.");
      return;
    }
    if (![q, pr, st, so, tt].every((n) => Number.isFinite(n))) {
      setMessage(
        "All default picklist IDs (queue, priority, status, source, ticket type) must be numbers.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const payload: Record<string, unknown> = {
        apiZoneBaseUrl: apiZoneBaseUrl.trim(),
        username: username.trim(),
        defaultQueueId: q,
        defaultPriority: pr,
        defaultStatus: st,
        defaultSource: so,
        defaultTicketType: tt,
      };
      if (secret.trim() && integrationCode.trim()) {
        payload.secret = secret.trim();
        payload.integrationCode = integrationCode.trim();
      }
      await apiPost("/autotask-psa/credentials", payload, nextMutationSignal());
      setSecret("");
      setIntegrationCode("");
      setMessage("Saved.");
      await loadStatus();
      await loadMappings();
      setAtCompanies([]);
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
      setMessage("Choose or enter the FireComply customer name.");
      return;
    }
    if (!Number.isFinite(cid)) {
      setMessage("Autotask company ID must be a number.");
      return;
    }
    setMapBusy(true);
    setMessage("");
    try {
      await apiPut(
        "/autotask-psa/company-mappings",
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
      const res = await fetch(`${base}/autotask-psa/company-mappings`, {
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
    if (!confirm("Remove Autotask PSA credentials?")) return;
    setBusy(true);
    setMessage("");
    try {
      await apiDelete("/autotask-psa/credentials", nextMutationSignal());
      setLinked(false);
      setApiZoneBaseUrl("");
      setUsername("");
      setSecret("");
      setIntegrationCode("");
      setDefaultQueueId("");
      setDefaultPriority("");
      setDefaultStatus("");
      setDefaultSource("");
      setDefaultTicketType("");
      setMessage("Disconnected.");
      setMappings([]);
      setAtCompanies([]);
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
    const row = atCompanies.find((c) => c.id === id);
    return row ? row.name : String(id);
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
        <span className="font-semibold text-foreground">Autotask (Datto) PSA</span> — REST API for
        your zone; API-only user per{" "}
        <a
          href={AUTOTASK_AUTH_DOC}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-accent font-medium"
        >
          REST security &amp; authentication <ExternalLink className="inline h-3 w-3" />
        </a>
        . Credentials encrypted like Sophos Central. Defaults are picklist IDs for tickets from
        findings.
      </p>
      {linked && (
        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-foreground truncate">
            Autotask PSA linked
          </span>
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
          <label className="text-[10px] text-foreground">API zone URL</label>
          <Input
            className="h-8 text-[11px] font-mono"
            value={apiZoneBaseUrl}
            onChange={(e) => setApiZoneBaseUrl(e.target.value)}
            placeholder="https://webservices3.autotask.net"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">Username (API user email)</label>
          <Input
            className="h-8 text-xs"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">Secret</label>
          <Input
            className="h-8 text-xs font-mono"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={linked ? "Leave blank to keep existing" : "API user secret"}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-foreground">API integration code</label>
          <Input
            className="h-8 text-xs font-mono"
            type="password"
            value={integrationCode}
            onChange={(e) => setIntegrationCode(e.target.value)}
            placeholder={linked ? "Leave blank to keep existing" : "Tracking identifier"}
            autoComplete="new-password"
          />
        </div>
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide pt-1">
          Ticket defaults (picklist IDs)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-foreground">Queue</label>
            <Input
              className="h-8 text-xs"
              value={defaultQueueId}
              onChange={(e) => setDefaultQueueId(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-foreground">Priority</label>
            <Input
              className="h-8 text-xs"
              value={defaultPriority}
              onChange={(e) => setDefaultPriority(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-foreground">Status</label>
            <Input
              className="h-8 text-xs"
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-foreground">Source</label>
            <Input
              className="h-8 text-xs"
              value={defaultSource}
              onChange={(e) => setDefaultSource(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-foreground">Ticket type</label>
            <Input
              className="h-8 text-xs"
              value={defaultTicketType}
              onChange={(e) => setDefaultTicketType(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>
        <p className="text-[10px] text-amber-700 dark:text-amber-400">
          You can change URL, username, or defaults without re-entering secret and integration code.
          Paste both only when connecting or rotating credentials.
        </p>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </form>

      <div className="rounded-xl border border-border/50 bg-background/20 p-3 space-y-2">
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">
          Customer ↔ Autotask company ID
        </p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Map FireComply customers to Autotask company (account) IDs. With Autotask linked, load
          companies from your zone or enter an ID manually.
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
              <label className="text-[10px] text-foreground">Autotask company</label>
              {linked && !companyManualMode && (
                <button
                  type="button"
                  className="text-[10px] text-brand-accent font-medium hover:underline shrink-0"
                  disabled={mapBusy || companiesLoading}
                  onClick={() => void ensureAtCompanies()}
                >
                  {companiesLoading ? "Loading…" : atCompanies.length ? "Refresh" : "Load list"}
                </button>
              )}
            </div>
            {linked && !companyManualMode ? (
              <>
                <Popover
                  open={companyOpen}
                  onOpenChange={(open) => {
                    setCompanyOpen(open);
                    if (open && atCompanies.length === 0 && !companiesLoading) {
                      void ensureAtCompanies();
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
                          {atCompanies.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.name} ${c.id}`}
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
                              <span className="truncate flex-1 min-w-0">{c.name}</span>
                              <span className="font-mono text-muted-foreground shrink-0 ml-1">
                                {c.id}
                              </span>
                            </CommandItem>
                          ))}
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
                    Pick from Autotask list
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

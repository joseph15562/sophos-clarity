import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/queries";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import {
  Save,
  Copy,
  Loader2,
  ImageIcon,
  ExternalLink,
  X,
  ChevronDown,
  ChevronRight,
  Globe,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { resolveCustomerName } from "@/lib/customer-name";

const SECTION_OPTIONS = [
  { id: "score", label: "Score Summary" },
  { id: "history", label: "Assessment History" },
  { id: "findings", label: "Findings Summary" },
  { id: "compliance", label: "Compliance Status" },
  { id: "reports", label: "Report Downloads" },
  { id: "feedback", label: "Customer Feedback" },
] as const;

type SectionId = (typeof SECTION_OPTIONS)[number]["id"];

export interface PortalConfig {
  id?: string;
  org_id: string;
  slug: string;
  tenant_name: string | null;
  logo_url: string | null;
  company_name: string;
  accent_color: string;
  welcome_message: string;
  sla_info: string;
  contact_email: string;
  contact_phone: string;
  footer_text: string;
  visible_sections: SectionId[];
  show_branding: boolean;
}

function emptyConfig(orgId: string, tenantName: string | null): PortalConfig {
  return {
    org_id: orgId,
    slug: tenantName ? slugify(tenantName) : "",
    tenant_name: tenantName,
    logo_url: null,
    company_name: "",
    accent_color: "#2006F7",
    welcome_message: "",
    sla_info: "",
    contact_email: "",
    contact_phone: "",
    footer_text: "",
    visible_sections: ["score", "history", "findings", "compliance", "reports", "feedback"],
    show_branding: true,
  };
}

function randomHex(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  const suffix = randomHex(4);
  return `${base}-${suffix}`.slice(0, 48);
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{10,46}[a-z0-9]$/;

function rowToConfig(row: Record<string, unknown>): PortalConfig {
  return {
    id: row.id as string,
    org_id: row.org_id as string,
    slug: (row.slug as string) ?? "",
    tenant_name: (row.tenant_name as string) ?? null,
    logo_url: (row.logo_url as string) ?? null,
    company_name: (row.company_name as string) ?? "",
    accent_color: (row.accent_color as string) ?? "#2006F7",
    welcome_message: (row.welcome_message as string) ?? "",
    sla_info: (row.sla_info as string) ?? "",
    contact_email: (row.contact_email as string) ?? "",
    contact_phone: (row.contact_phone as string) ?? "",
    footer_text: (row.footer_text as string) ?? "",
    visible_sections: Array.isArray(row.visible_sections)
      ? (row.visible_sections as SectionId[])
      : ["score", "history", "findings", "compliance", "reports", "feedback"],
    show_branding: (row.show_branding as boolean) ?? true,
  };
}

export interface PortalConfiguratorProps {
  /** Raw `tenant_name` to select when opening from Customer Management (must match DB). */
  initialTenantName?: string | null;
  /** `focused` hides the full tenant list and edits one tenant only. */
  tenantListMode?: "all" | "focused";
  onSaved?: () => void;
}

export function PortalConfigurator({
  initialTenantName = null,
  tenantListMode = "all",
  onSaved,
}: PortalConfiguratorProps) {
  const { org } = useAuth();
  const queryClient = useQueryClient();
  const orgDisplayName = org?.name ?? "";

  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [portalSurface, setPortalSurface] = useState<"consultant" | "customer">("consultant");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedTenantRef = useRef<string | null>(null);

  const orgId = org?.id ?? "";

  useLayoutEffect(() => {
    selectedTenantRef.current = selectedTenant;
  }, [selectedTenant]);

  const {
    data: bootstrap,
    isPending: bootstrapPending,
    isError: bootstrapError,
    error: bootstrapErrorDetail,
  } = useQuery({
    queryKey: queryKeys.portal.tenantBootstrap(orgId),
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [{ data: agents }, { data: configs }] = await Promise.all([
        supabase.from("agents").select("tenant_name").not("tenant_name", "is", null),
        supabase.from("portal_config").select("*").eq("org_id", orgId),
      ]);

      const tenantSet = new Set<string>();
      for (const a of (agents ?? []) as Array<{ tenant_name: string | null }>) {
        if (a.tenant_name) tenantSet.add(a.tenant_name);
      }

      const configList: PortalConfig[] = [];
      for (const row of (configs ?? []) as Array<Record<string, unknown>>) {
        const pc = rowToConfig(row);
        configList.push(pc);
        if (pc.tenant_name) tenantSet.add(pc.tenant_name);
      }

      if (initialTenantName) tenantSet.add(initialTenantName);

      const sortedTenants = [...tenantSet].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
      return { tenants: sortedTenants, portalConfigs: configList };
    },
  });

  const tenants = bootstrap?.tenants ?? [];
  const portalConfigs = bootstrap?.portalConfigs ?? [];

  useEffect(() => {
    if (!bootstrap || !orgId) return;
    const sortedTenants = bootstrap.tenants;
    const prev = selectedTenantRef.current;
    const nextSelected =
      tenantListMode === "focused" && initialTenantName
        ? initialTenantName
        : prev && sortedTenants.includes(prev)
          ? prev
          : (sortedTenants[0] ?? null);
    setSelectedTenant(nextSelected);
  }, [bootstrap, orgId, initialTenantName, tenantListMode]);

  useEffect(() => {
    setPortalSurface("consultant");
  }, [selectedTenant]);

  // When selected tenant changes, load or create the config for that tenant
  useEffect(() => {
    if (!orgId || selectedTenant === null) {
      setConfig(null);
      return;
    }
    const existing = portalConfigs.find((pc) => pc.tenant_name === selectedTenant);
    setConfig(existing ?? emptyConfig(orgId, selectedTenant));
    setSlugError(null);
    setConfigExpanded(true);
  }, [selectedTenant, portalConfigs, orgId]);

  const update = useCallback((patch: Partial<PortalConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleSlugChange = useCallback(
    (raw: string) => {
      const slug = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
      update({ slug });
      if (slug && !SLUG_RE.test(slug)) {
        setSlugError("12-48 chars, lowercase letters, numbers, and hyphens only");
      } else {
        setSlugError(null);
      }
    },
    [update],
  );

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 512_000) {
        toast.error("Logo too large", { description: "Maximum file size is 500 KB." });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        update({ logo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [update],
  );

  const toggleSection = useCallback((sectionId: SectionId) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const sections = prev.visible_sections.includes(sectionId)
        ? prev.visible_sections.filter((s) => s !== sectionId)
        : [...prev.visible_sections, sectionId];
      return { ...prev, visible_sections: sections };
    });
  }, []);

  const { mutate: savePortalMutate, isPending: savePortalPending } = useMutation({
    mutationFn: async (args: { config: PortalConfig; orgId: string }) => {
      const { config, orgId: oid } = args;
      const row = {
        org_id: oid,
        slug: config.slug || null,
        tenant_name: config.tenant_name,
        logo_url: config.logo_url,
        company_name: config.company_name || null,
        accent_color: config.accent_color || "#2006F7",
        welcome_message: config.welcome_message || null,
        sla_info: config.sla_info || null,
        contact_email: config.contact_email || null,
        contact_phone: config.contact_phone || null,
        footer_text: config.footer_text || null,
        visible_sections: config.visible_sections,
        show_branding: config.show_branding,
      };
      if (config.id) {
        const { error } = await supabase.from("portal_config").update(row).eq("id", config.id);
        if (error) throw error;
        return {} as { newId?: string };
      }
      const { data, error } = await supabase
        .from("portal_config")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      return { newId: data.id as string };
    },
    onSuccess: async (result, variables) => {
      if (result.newId) update({ id: result.newId });
      toast.success("Portal configuration saved");
      onSaved?.();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.portal.tenantBootstrap(variables.orgId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.portal.configs(variables.orgId) });
    },
    onError: (error: unknown) => {
      const e = error as { message?: string; code?: string };
      const msg = e.message ?? "Save failed";
      const isDupe = msg.includes("duplicate") || e.code === "23505";
      toast.error(isDupe ? "Slug already taken" : "Save failed", {
        description: isDupe ? "Another portal is already using this slug." : msg,
      });
    },
  });

  const handleSave = useCallback(() => {
    if (!config || !orgId) return;
    if (config.slug && !SLUG_RE.test(config.slug)) {
      setSlugError("Invalid slug format");
      return;
    }
    savePortalMutate({ config, orgId });
  }, [config, orgId, savePortalMutate]);

  const portalUrl = config?.slug ? `${window.location.origin}/portal/${config.slug}` : "";

  const copyLink = useCallback((url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success("Portal link copied to clipboard");
  }, []);

  if (!orgId) {
    return null;
  }

  if (bootstrapPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="rounded-[20px] border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
        <p className="text-sm text-foreground font-medium">Could not load portal data</p>
        <p className="text-xs text-muted-foreground">
          {bootstrapErrorDetail instanceof Error ? bootstrapErrorDetail.message : "Try again."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void queryClient.invalidateQueries({
              queryKey: queryKeys.portal.tenantBootstrap(orgId),
            })
          }
        >
          Retry
        </Button>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] p-6">
        <EmptyState
          icon={<Building2 className="h-6 w-6 text-muted-foreground/50" />}
          title="No tenants yet"
          description="Connect a FireComply Connector agent with a tenant name to create tenant portals."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tenant Portal Summary */}
      {tenantListMode === "all" && (
        <div className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-accent/10">
            <div className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-brand-accent/50" />
              <span className="text-[13px] font-display font-semibold text-foreground">
                Tenant Portals
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Each tenant gets their own portal link showing only their firewalls' data.
            </p>
          </div>
          <div className="divide-y divide-brand-accent/[0.06]">
            {tenants.map((tenant) => {
              const pc = portalConfigs.find((c) => c.tenant_name === tenant);
              const url = pc?.slug ? `${window.location.origin}/portal/${pc.slug}` : null;
              const isSelected = selectedTenant === tenant;
              const displayName = resolveCustomerName(tenant, orgDisplayName);

              return (
                <div
                  key={tenant}
                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-brand-accent/[0.02] dark:hover:bg-brand-accent/[0.04] transition-colors ${
                    isSelected ? "bg-brand-accent/[0.04] dark:bg-brand-accent/[0.08]" : ""
                  }`}
                  onClick={() => setSelectedTenant(tenant)}
                >
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                    {url ? (
                      <p className="text-xs text-muted-foreground truncate">{url}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Not configured</p>
                    )}
                  </div>
                  {pc?.slug ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-md text-[#00F2B3] bg-[#00F2B3]/[0.08] border-[#008F69]/30 dark:border-[#00F2B3]/20"
                    >
                      Live
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-md text-muted-foreground bg-brand-accent/[0.04] border-brand-accent/10"
                    >
                      Draft
                    </Badge>
                  )}
                  {url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(url);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Tenant Configuration */}
      {config && (
        <div className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] overflow-hidden">
          <div className="flex flex-wrap gap-2 px-5 pt-4 border-b border-brand-accent/10 pb-3">
            <Button
              type="button"
              size="sm"
              variant={portalSurface === "consultant" ? "secondary" : "outline"}
              className="h-8 text-xs"
              onClick={() => setPortalSurface("consultant")}
            >
              Consultant setup
            </Button>
            <Button
              type="button"
              size="sm"
              variant={portalSurface === "customer" ? "secondary" : "outline"}
              className="h-8 text-xs"
              onClick={() => setPortalSurface("customer")}
            >
              Customer view
            </Button>
          </div>
          {portalSurface === "customer" ? (
            <div className="p-5 space-y-4 text-sm">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Customers only see the live portal (branding, enabled sections, reports you expose).
                Use this tab to sanity-check scope before sharing the link.
              </p>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Visible sections
                </p>
                <ul className="list-disc pl-5 text-xs text-foreground space-y-1">
                  {config.visible_sections.map((sid) => {
                    const opt = SECTION_OPTIONS.find((o) => o.id === sid);
                    return <li key={sid}>{opt?.label ?? sid}</li>;
                  })}
                </ul>
              </div>
              {portalUrl ? (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" asChild>
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open live customer portal
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Save a valid slug under Consultant setup to open the customer URL.
                </p>
              )}
            </div>
          ) : (
            <>
              {portalUrl ? (
                <div className="px-5 py-3 border-b border-brand-accent/10 flex flex-wrap items-center justify-between gap-2 bg-brand-accent/[0.03]">
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Customer view</span> — what end
                    clients see at the live portal. Your edits below are the consultant
                    configuration.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs shrink-0"
                    asChild
                  >
                    <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open live portal
                    </a>
                  </Button>
                </div>
              ) : null}
              <button
                type="button"
                className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-brand-accent/[0.02] dark:hover:bg-brand-accent/[0.04] transition-colors"
                onClick={() => setConfigExpanded((v) => !v)}
              >
                {configExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">
                  Configure: {resolveCustomerName(selectedTenant ?? "", orgDisplayName)}
                </span>
                {config.id && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Saved
                  </Badge>
                )}
              </button>

              {configExpanded && (
                <div className="px-4 pb-4 space-y-6 border-t border-border pt-4">
                  {/* Portal Link */}
                  {portalUrl && (
                    <div className="rounded-xl border border-brand-accent/10 bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Portal Link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background/60 dark:bg-background/30 rounded-lg px-3 py-2 border border-brand-accent/15 truncate font-mono">
                          {portalUrl}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLink(portalUrl)}
                          className="rounded-xl border-brand-accent/15 hover:bg-brand-accent/[0.06] gap-1.5"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Vanity Slug */}
                  <div className="space-y-1.5">
                    <Label htmlFor="portal-slug">Portal Slug</Label>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <span>{window.location.origin}/portal/</span>
                    </div>
                    <Input
                      id="portal-slug"
                      placeholder={slugify(selectedTenant ?? "acme-security")}
                      value={config.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className={slugError ? "border-red-500" : ""}
                    />
                    {slugError && <p className="text-xs text-red-500">{slugError}</p>}
                  </div>

                  {/* Branding Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Branding</Label>
                      <p className="text-xs text-muted-foreground">
                        Display your logo and company name on the portal
                      </p>
                    </div>
                    <Switch
                      checked={config.show_branding}
                      onCheckedChange={(v) => update({ show_branding: v })}
                    />
                  </div>

                  {/* Logo */}
                  <div className="space-y-1.5">
                    <Label>Company Logo</Label>
                    <div className="flex items-center gap-3">
                      {config.logo_url ? (
                        <div className="relative">
                          <img
                            src={config.logo_url}
                            alt="Logo preview"
                            className="h-12 w-auto max-w-[160px] object-contain rounded-lg border border-brand-accent/15 bg-white p-1"
                          />
                          <button
                            type="button"
                            onClick={() => update({ logo_url: null })}
                            className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-12 w-24 rounded-lg border border-dashed border-brand-accent/20 flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {config.logo_url ? "Change" : "Upload"}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPEG, SVG, or WebP. Max 500 KB.
                    </p>
                  </div>

                  {/* Company Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="portal-company">Company Name</Label>
                    <Input
                      id="portal-company"
                      placeholder={org?.name ?? "Your Company"}
                      value={config.company_name}
                      onChange={(e) => update({ company_name: e.target.value })}
                    />
                  </div>

                  {/* Accent Colour */}
                  <div className="space-y-1.5">
                    <Label htmlFor="portal-accent">Accent Colour</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="portal-accent"
                        value={config.accent_color}
                        onChange={(e) => update({ accent_color: e.target.value })}
                        className="h-9 w-12 rounded-lg border border-brand-accent/15 cursor-pointer bg-transparent p-0.5"
                      />
                      <Input
                        value={config.accent_color}
                        onChange={(e) => update({ accent_color: e.target.value })}
                        className="w-28 font-mono text-xs"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  {/* Welcome Message */}
                  <div className="space-y-1.5">
                    <Label htmlFor="portal-welcome">Welcome Message</Label>
                    <Textarea
                      id="portal-welcome"
                      placeholder="Welcome to your security dashboard. Here you can view your latest assessment results and compliance status."
                      value={config.welcome_message}
                      onChange={(e) => update({ welcome_message: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* SLA Info */}
                  <div className="space-y-1.5">
                    <Label htmlFor="portal-sla">SLA Information</Label>
                    <Textarea
                      id="portal-sla"
                      placeholder="Assessments are performed quarterly. Critical findings are addressed within 24 hours."
                      value={config.sla_info}
                      onChange={(e) => update({ sla_info: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {/* Contact Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="portal-email">Contact Email</Label>
                      <Input
                        id="portal-email"
                        type="email"
                        placeholder="security@yourcompany.com"
                        value={config.contact_email}
                        onChange={(e) => update({ contact_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="portal-phone">Contact Phone</Label>
                      <Input
                        id="portal-phone"
                        type="tel"
                        placeholder="+44 20 1234 5678"
                        value={config.contact_phone}
                        onChange={(e) => update({ contact_phone: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Footer Text */}
                  <div className="space-y-1.5">
                    <Label htmlFor="portal-footer">Footer Text</Label>
                    <Input
                      id="portal-footer"
                      placeholder="&copy; 2026 Your Company. All rights reserved."
                      value={config.footer_text}
                      onChange={(e) => update({ footer_text: e.target.value })}
                    />
                  </div>

                  {/* Visible Sections */}
                  <div className="space-y-3">
                    <Label>Visible Sections</Label>
                    <p className="text-xs text-muted-foreground">
                      Choose which sections this tenant's customers can see on their portal.
                    </p>
                    <div className="space-y-2">
                      {SECTION_OPTIONS.map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-1">
                          <span className="text-sm text-foreground">{s.label}</span>
                          <Switch
                            checked={config.visible_sections.includes(s.id)}
                            onCheckedChange={() => toggleSection(s.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save */}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={savePortalPending || !!slugError}
                      className="rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white hover:opacity-90 gap-1.5"
                    >
                      {savePortalPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {savePortalPending ? "Saving..." : "Save Configuration"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

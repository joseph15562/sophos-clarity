import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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

export function PortalConfigurator() {
  const { org } = useAuth();
  const { toast } = useToast();

  const [tenants, setTenants] = useState<string[]>([]);
  const [portalConfigs, setPortalConfigs] = useState<PortalConfig[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [configExpanded, setConfigExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orgId = org?.id ?? "";

  // Load distinct tenant names from agents + all existing portal configs
  const loadTenants = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

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

    const sortedTenants = [...tenantSet].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    setTenants(sortedTenants);
    setPortalConfigs(configList);

    // Auto-select first tenant if none selected
    if (!selectedTenant && sortedTenants.length > 0) {
      setSelectedTenant(sortedTenants[0]);
    }

    setLoading(false);
  }, [orgId, selectedTenant]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

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
        toast({
          title: "Logo too large",
          description: "Maximum file size is 500 KB.",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        update({ logo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [update, toast],
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

  const handleSave = useCallback(async () => {
    if (!config || !orgId) return;

    if (config.slug && !SLUG_RE.test(config.slug)) {
      setSlugError("Invalid slug format");
      return;
    }

    setSaving(true);
    const row = {
      org_id: orgId,
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

    let error;
    if (config.id) {
      ({ error } = await supabase.from("portal_config").update(row).eq("id", config.id));
    } else {
      const { data, error: insertErr } = await supabase
        .from("portal_config")
        .insert(row)
        .select("id")
        .single();
      error = insertErr;
      if (data) update({ id: data.id });
    }

    setSaving(false);

    if (error) {
      const isDupe = error.message?.includes("duplicate") || error.code === "23505";
      toast({
        title: isDupe ? "Slug already taken" : "Save failed",
        description: isDupe ? "Another portal is already using this slug." : error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Portal configuration saved" });
      await loadTenants();
    }
  }, [config, orgId, toast, update, loadTenants]);

  const portalUrl = config?.slug ? `${window.location.origin}/portal/${config.slug}` : "";

  const copyLink = useCallback(
    (url: string) => {
      if (!url) return;
      navigator.clipboard.writeText(url);
      toast({ title: "Portal link copied to clipboard" });
    },
    [toast],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          No tenants found. Connect a FireComply Connector agent with a tenant name to create tenant
          portals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tenant Portal Summary */}
      <div className="rounded-xl border border-border/70 bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Tenant Portals</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Each tenant gets their own portal link showing only their firewalls' data.
          </p>
        </div>
        <div className="divide-y divide-border">
          {tenants.map((tenant) => {
            const pc = portalConfigs.find((c) => c.tenant_name === tenant);
            const url = pc?.slug ? `${window.location.origin}/portal/${pc.slug}` : null;
            const isSelected = selectedTenant === tenant;

            return (
              <div
                key={tenant}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                  isSelected ? "bg-muted/60" : ""
                }`}
                onClick={() => setSelectedTenant(tenant)}
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tenant}</p>
                  {url ? (
                    <p className="text-xs text-muted-foreground truncate">{url}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Not configured</p>
                  )}
                </div>
                {pc?.slug ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                  >
                    Live
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
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

      {/* Selected Tenant Configuration */}
      {config && (
        <div className="rounded-xl border border-border/70 bg-card">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            onClick={() => setConfigExpanded((v) => !v)}
          >
            {configExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium text-foreground">Configure: {selectedTenant}</span>
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
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Portal Link</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 border border-input truncate">
                      {portalUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => copyLink(portalUrl)}>
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
                        className="h-12 w-auto max-w-[160px] object-contain rounded border border-border bg-white p-1"
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
                    <div className="h-12 w-24 rounded border border-dashed border-border flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
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
                    className="h-9 w-12 rounded border border-input cursor-pointer bg-transparent p-0.5"
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
                <Button onClick={handleSave} disabled={saving || !!slugError}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

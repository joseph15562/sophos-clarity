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
} from "lucide-react";

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

function emptyConfig(orgId: string): PortalConfig {
  return {
    org_id: orgId,
    slug: "",
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

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;

export function PortalConfigurator() {
  const { org } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orgId = org?.id ?? "";

  const loadConfig = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("portal_config")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();

    if (error) {
      console.warn("[PortalConfigurator] load failed", error);
    }

    if (data) {
      setConfig({
        id: data.id,
        org_id: data.org_id,
        slug: data.slug ?? "",
        logo_url: data.logo_url,
        company_name: data.company_name ?? "",
        accent_color: data.accent_color ?? "#2006F7",
        welcome_message: data.welcome_message ?? "",
        sla_info: data.sla_info ?? "",
        contact_email: data.contact_email ?? "",
        contact_phone: data.contact_phone ?? "",
        footer_text: data.footer_text ?? "",
        visible_sections: Array.isArray(data.visible_sections)
          ? (data.visible_sections as SectionId[])
          : ["score", "history", "findings", "compliance", "reports", "feedback"],
        show_branding: data.show_branding ?? true,
      });
    } else {
      setConfig(emptyConfig(orgId));
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const update = useCallback(
    (patch: Partial<PortalConfig>) => {
      setConfig((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [],
  );

  const handleSlugChange = useCallback((raw: string) => {
    const slug = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
    update({ slug });
    if (slug && !SLUG_RE.test(slug)) {
      setSlugError("3-48 chars, lowercase letters, numbers, and hyphens only");
    } else {
      setSlugError(null);
    }
  }, [update]);

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 512_000) {
        toast({ title: "Logo too large", description: "Maximum file size is 500 KB.", variant: "destructive" });
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

  const toggleSection = useCallback(
    (sectionId: SectionId) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const sections = prev.visible_sections.includes(sectionId)
          ? prev.visible_sections.filter((s) => s !== sectionId)
          : [...prev.visible_sections, sectionId];
        return { ...prev, visible_sections: sections };
      });
    },
    [],
  );

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
      ({ error } = await supabase
        .from("portal_config")
        .update(row)
        .eq("id", config.id));
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
        description: isDupe
          ? "Another organisation is already using this portal slug."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Portal configuration saved" });
    }
  }, [config, orgId, toast, update]);

  const portalUrl = config?.slug
    ? `${window.location.origin}/portal/${config.slug}`
    : orgId
      ? `${window.location.origin}/portal/${orgId}`
      : "";

  const copyLink = useCallback(() => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    toast({ title: "Portal link copied to clipboard" });
  }, [portalUrl, toast]);

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portal Link */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Portal Link</span>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 border border-input truncate">
            {portalUrl || "Configure a slug below to generate a link"}
          </code>
          <Button variant="outline" size="sm" onClick={copyLink} disabled={!portalUrl}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
      </div>

      {/* Vanity Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="portal-slug">Portal Slug</Label>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <span>{window.location.origin}/portal/</span>
        </div>
        <Input
          id="portal-slug"
          placeholder="acme-security"
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
          <p className="text-xs text-muted-foreground">Display your logo and company name on the portal</p>
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
        <p className="text-xs text-muted-foreground">PNG, JPEG, SVG, or WebP. Max 500 KB.</p>
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
          placeholder="© 2026 Your Company. All rights reserved."
          value={config.footer_text}
          onChange={(e) => update({ footer_text: e.target.value })}
        />
      </div>

      {/* Visible Sections */}
      <div className="space-y-3">
        <Label>Visible Sections</Label>
        <p className="text-xs text-muted-foreground">
          Choose which sections your customers can see on the portal.
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
  );
}

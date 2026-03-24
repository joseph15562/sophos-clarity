import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const LS_KEY_PREFIX = "fc-company-logo-";

function lsKey(orgId: string) {
  return `${LS_KEY_PREFIX}${orgId}`;
}

/**
 * Manages the org-level company logo.
 *
 * Authenticated users: persisted to `organisations.report_template.company_logo`
 * and cached in localStorage. Guest users: localStorage only.
 */
export function useCompanyLogo() {
  const { org, isGuest, canManageTeam } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isGuest || !org?.id) {
        const cached = localStorage.getItem(lsKey("guest"));
        if (!cancelled) {
          setLogoUrl(cached);
          setLoading(false);
        }
        return;
      }

      const cached = localStorage.getItem(lsKey(org.id));
      if (cached && !cancelled) setLogoUrl(cached);

      try {
        const { data } = await supabase
          .from("organisations")
          .select("report_template")
          .eq("id", org.id)
          .single();

        if (cancelled) return;
        const rt = (data as { report_template?: Record<string, unknown> } | null)?.report_template;
        const dbLogo = (rt?.company_logo as string) ?? null;

        setLogoUrl(dbLogo);
        if (dbLogo) {
          localStorage.setItem(lsKey(org.id), dbLogo);
        } else {
          localStorage.removeItem(lsKey(org.id));
        }
      } catch {
        // keep cached value
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [org?.id, isGuest]);

  const setLogo = useCallback(
    async (dataUrl: string | null) => {
      setLogoUrl(dataUrl);

      const key = org?.id ? lsKey(org.id) : lsKey("guest");
      if (dataUrl) {
        localStorage.setItem(key, dataUrl);
      } else {
        localStorage.removeItem(key);
      }

      if (isGuest || !org?.id) return;

      setSaving(true);
      try {
        const { data } = await supabase
          .from("organisations")
          .select("report_template")
          .eq("id", org.id)
          .single();

        const existing = ((data as { report_template?: Record<string, unknown> } | null)?.report_template ?? {}) as Record<string, unknown>;
        const updated = { ...existing, company_logo: dataUrl };

        await supabase
          .from("organisations")
          .update({ report_template: updated })
          .eq("id", org.id);
      } catch (err) {
        console.warn("[useCompanyLogo] save failed", err);
      } finally {
        setSaving(false);
      }
    },
    [org?.id, isGuest],
  );

  return { logoUrl, setLogo, loading, saving, canEdit: canManageTeam || isGuest };
}

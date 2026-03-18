import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const DEFAULT_TEMPLATE = {
  sections: [
    { id: "executive-summary", heading: "Executive Summary", required: true },
    { id: "findings", heading: "Security Findings", required: true },
    { id: "recommendations", heading: "Recommendations", required: false },
  ],
};

export function ReportTemplateSettings() {
  const { org, canManageTeam } = useAuth();
  const [templateJson, setTemplateJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org?.id) return;
    supabase
      .from("organisations")
      .select("report_template")
      .eq("id", org.id)
      .single()
      .then(({ data }) => {
        const rt = (data as { report_template?: unknown } | null)?.report_template;
        setTemplateJson(rt ? JSON.stringify(rt, null, 2) : JSON.stringify(DEFAULT_TEMPLATE, null, 2));
      })
      .finally(() => setLoading(false));
  }, [org?.id]);

  const handleSave = async () => {
    if (!org?.id || !canManageTeam) return;
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(templateJson);
    } catch (e) {
      setError("Invalid JSON");
      return;
    }
    setSaving(true);
    setSaved(false);
    await supabase
      .from("organisations")
      .update({ report_template: parsed as Record<string, unknown> })
      .eq("id", org.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="text-xs text-muted-foreground">Loading…</div>;
  if (!canManageTeam) return <p className="text-xs text-muted-foreground">Only admins can configure report templates.</p>;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">
        Optional custom report structure (JSON). Define section IDs and headings; future report generation will merge this with AI output. Example: sections with id, heading, and required flag.
      </p>
      <textarea
        value={templateJson}
        onChange={(e) => setTemplateJson(e.target.value)}
        rows={12}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-mono"
        spellCheck={false}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
        {saved ? "Saved" : saving ? "Saving…" : "Save template"}
      </Button>
    </div>
  );
}

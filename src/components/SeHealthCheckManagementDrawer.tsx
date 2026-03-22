import { useEffect, useState } from "react";
import { Loader2, PanelRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSEAuth, type SEProfile } from "@/hooks/use-se-auth";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
};

function defaultDraftFromProfile(p: SEProfile): string {
  return p.healthCheckPreparedBy?.trim() || p.displayName?.trim() || p.email?.trim() || "";
}

export function SeHealthCheckManagementDrawer({ open, onClose }: Props) {
  const { seProfile, reloadSeProfile } = useSEAuth();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !seProfile) return;
    setDraft(defaultDraftFromProfile(seProfile));
  }, [open, seProfile?.id, seProfile?.healthCheckPreparedBy, seProfile?.displayName, seProfile?.email]);

  if (!open) return null;

  const handleSave = async () => {
    if (!seProfile) return;
    const trimmed = draft.trim();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("se_profiles")
        .update({ health_check_prepared_by: trimmed || null } as Record<string, unknown>)
        .eq("id", seProfile.id);
      if (error) throw error;
      await reloadSeProfile();
      toast.success("Report settings saved.");
      onClose();
    } catch (e) {
      console.warn("[SeHealthCheckManagementDrawer] save failed", e);
      toast.error(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card shrink-0">
          <div className="h-9 w-9 rounded-lg bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center shrink-0">
            <PanelRight className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-display font-bold text-foreground truncate">Management</h2>
            <p className="text-[10px] text-muted-foreground">Report defaults for SE health checks</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!seProfile ? (
            <p className="text-sm text-muted-foreground">Sign in to manage report settings.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="se-mgmt-prepared-by" className="text-xs font-semibold">
                  Prepared by
                </Label>
                <Input
                  id="se-mgmt-prepared-by"
                  className="rounded-lg text-sm h-10"
                  placeholder="Name as it should appear on exports"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={saving}
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Stored in your FireComply profile and used for PDF, HTML, and history exports. Leave blank to fall back to
                  your account display name or email.
                </p>
              </div>
              <Button
                type="button"
                className="rounded-lg bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

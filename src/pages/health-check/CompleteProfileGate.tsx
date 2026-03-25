import { useCallback, useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { useSEAuthProvider } from "@/hooks/use-se-auth";

interface CompleteProfileGateProps {
  seAuth: ReturnType<typeof useSEAuthProvider>;
}

export function CompleteProfileGate({ seAuth }: CompleteProfileGateProps) {
  const suggestedName = seAuth.seProfile?.healthCheckPreparedBy || seAuth.user?.user_metadata?.full_name as string || seAuth.user?.user_metadata?.name as string || "";
  const [name, setName] = useState(suggestedName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter your name"); return; }
    setSaving(true);
    setError(null);
    try {
      const { error: metaErr } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
      if (metaErr) throw metaErr;
      const { error: dbErr } = await supabase
        .from("se_profiles")
        .update({ display_name: trimmed, profile_completed: true } as Record<string, unknown>)
        .eq("id", seAuth.seProfile!.id);
      if (dbErr) throw dbErr;
      await seAuth.reloadSeProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [name, seAuth]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5 text-[#2006F7]" />
            Complete your profile
          </CardTitle>
          <CardDescription>
            Please enter your name so it can be used in emails and reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Full Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Joseph McDonald"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            />
          </div>
          {error && (
            <p className="text-xs text-[#EA0022]">{error}</p>
          )}
          <Button
            className="w-full bg-[#2006F7] hover:bg-[#10037C] text-white"
            disabled={saving || !name.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
          </Button>
          <button
            onClick={() => void seAuth.signOut()}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

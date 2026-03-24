import { useState, useCallback } from "react";
import { Building2, ArrowRight, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  userEmail: string;
  onCreateOrg: (name: string) => Promise<{ error: string | null }>;
  onSignOut: () => void;
}

export function OrgSetup({ userEmail, onCreateOrg, onSignOut }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Organisation name is required");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await onCreateOrg(name.trim());
    setLoading(false);
    if (result.error) setError(result.error);
  }, [name, onCreateOrg]);

  return (
    <div className="max-w-md mx-auto mt-16 rounded-xl border border-border/70 bg-card overflow-hidden">
      <div className="p-6 space-y-5">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center mx-auto">
            <Building2 className="h-6 w-6 text-brand-accent" />
          </div>
          <h2 className="text-lg font-display font-bold text-foreground">Create Your Organisation</h2>
          <p className="text-xs text-muted-foreground">
            Set up your MSP workspace. You'll be the admin and can invite team members later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Organisation Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme IT Solutions"
              className="bg-background/80"
              autoFocus
            />
          </div>

          <div className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{userEmail}</span>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-[#EA0022] bg-[#EA0022]/5 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2"
          >
            {loading ? (
              <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                Create Organisation
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>

        <button
          onClick={onSignOut}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";

type KeyRow = Tables<"org_service_api_keys">;

/** G3.2 — List org service API keys; Edge validates via `_shared/service-key.ts` (ping + scoped routes). */
export function OrgServiceKeysSettings() {
  const { org } = useAuth();
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("org_service_api_keys")
        .select("*")
        .eq("org_id", org.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setRows(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading keys…
      </div>
    );
  }

  const pingUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/service-key/ping`;

  if (rows.length === 0) {
    return (
      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p>
          No active service keys in this workspace. Support can issue keys stored as a SHA-256 hash
          in <code className="text-[10px]">org_service_api_keys</code>.
        </p>
        <p>
          <span className="font-medium text-foreground">Edge validation:</span> send{" "}
          <code className="text-[10px]">X-FireComply-Service-Key</code> or{" "}
          <code className="text-[10px]">Authorization: Bearer &lt;secret&gt;</code>
          (not a user JWT). Verify with <code className="text-[10px] break-all">
            {pingUrl}
          </code>{" "}
          (returns <code className="text-[10px]">org_id</code> and{" "}
          <code className="text-[10px]">scopes</code>
          ). <code className="text-[10px]">GET /api/firewalls</code> accepts the same key when{" "}
          <code className="text-[10px]">api:read</code> is in scopes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Use <code className="text-[10px]">X-FireComply-Service-Key</code> or Bearer (non-JWT) on API
        calls. Ping <code className="text-[10px] break-all">{pingUrl}</code> to confirm the secret
        is active.
      </p>
      <ul className="space-y-2">
        {rows.map((k) => (
          <li
            key={k.id}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs"
          >
            <KeyRound className="h-3.5 w-3.5 text-brand-accent shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{k.label}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{k.key_prefix}…</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {k.scopes?.join(", ") || "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Plus, Trash2, Smartphone, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePasskeysQuery } from "@/hooks/queries/use-passkeys-query";
import { queryKeys } from "@/hooks/queries/keys";
import { usePasskeyDeleteMutation } from "@/hooks/queries/use-passkey-delete-mutation";

export function PasskeyManager() {
  const queryClient = useQueryClient();
  const { data: passkeys = [], isPending: passkeysLoading } = usePasskeysQuery();
  const deletePasskeyMutation = usePasskeyDeleteMutation();
  const [registering, setRegistering] = useState(false);
  const [newName, setNewName] = useState("");

  const registerPasskey = async () => {
    setRegistering(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Not authenticated");

      const fnHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      const optionsRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/passkey/register-options`,
        { method: "POST", headers: fnHeaders },
      );

      if (!optionsRes.ok) {
        const errBody = await optionsRes.text().catch(() => "");
        throw new Error(
          `Registration options failed (${optionsRes.status}): ${errBody || optionsRes.statusText}`,
        );
      }
      const options = await optionsRes.json();

      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge), (c) => c.charCodeAt(0)),
          user: {
            ...options.user,
            id: Uint8Array.from(atob(options.user.id), (c) => c.charCodeAt(0)),
          },
          excludeCredentials: (options.excludeCredentials ?? []).map(
            (c: Record<string, string>) => ({
              ...c,
              id: Uint8Array.from(atob(c.id), (ch) => ch.charCodeAt(0)),
            }),
          ),
        },
      });

      if (!credential) throw new Error("Registration cancelled");

      const attestationResponse = credential as PublicKeyCredential;
      const response = attestationResponse.response as AuthenticatorAttestationResponse;

      const verifyRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/passkey/register-verify`,
        {
          method: "POST",
          headers: fnHeaders,
          body: JSON.stringify({
            credential: {
              id: attestationResponse.id,
              rawId: btoa(String.fromCharCode(...new Uint8Array(attestationResponse.rawId))),
              type: attestationResponse.type,
              response: {
                attestationObject: btoa(
                  String.fromCharCode(...new Uint8Array(response.attestationObject)),
                ),
                clientDataJSON: btoa(
                  String.fromCharCode(...new Uint8Array(response.clientDataJSON)),
                ),
              },
            },
            name: newName.trim() || "Passkey",
          }),
        },
      );

      if (!verifyRes.ok) {
        const verifyErr = await verifyRes.text().catch(() => "");
        throw new Error(
          `Verification failed (${verifyRes.status}): ${verifyErr || verifyRes.statusText}`,
        );
      }

      toast.success("Passkey registered");
      setNewName("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.passkeys.list() });
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") {
        toast.error(err.message);
      }
    }
    setRegistering(false);
  };

  const deletePasskey = (id: string) => {
    if (!confirm("Remove this passkey?")) return;
    deletePasskeyMutation.mutate(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-5 rounded-md bg-gradient-to-br from-[#6B5BFF] to-[#00EDFF] flex items-center justify-center">
          <Fingerprint className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-display font-semibold text-foreground">Passkeys</span>
      </div>

      {passkeysLoading ? (
        <p className="text-[10px] text-muted-foreground">Loading passkeys…</p>
      ) : passkeys.length > 0 ? (
        <div className="space-y-2">
          {passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between rounded-xl border border-brand-accent/10 bg-brand-accent/[0.02] dark:bg-brand-accent/[0.04] px-3 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                {pk.device_type === "platform" ? (
                  <Smartphone className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                ) : (
                  <Key className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{pk.name}</p>
                  <p className="text-[9px] text-muted-foreground">
                    Added{" "}
                    {new Date(pk.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-[#EA0022]"
                onClick={() => deletePasskey(pk.id)}
                disabled={deletePasskeyMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          No passkeys registered. Add one for passwordless sign-in.
        </p>
      )}

      <div className="space-y-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Passkey name (e.g. MacBook Pro Touch ID)"
          className="h-8 text-[11px] rounded-xl border-brand-accent/15"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={registerPasskey}
          disabled={registering}
          className="gap-1.5 text-[10px] h-8 w-full rounded-xl bg-gradient-to-r from-[#5A00FF] to-[#2006F7] text-white border-0 hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          {registering ? "Registering…" : "Register New Passkey"}
        </Button>
      </div>
    </div>
  );
}

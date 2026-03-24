import { useState, useEffect, useCallback } from "react";
import { Fingerprint, Plus, Trash2, Smartphone, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PasskeyCredential {
  id: string;
  credential_id: string;
  device_type: string;
  name: string;
  created_at: string;
}

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [registering, setRegistering] = useState(false);
  const [newName, setNewName] = useState("");

  const loadPasskeys = useCallback(async () => {
    const { data } = await supabase
      .from("passkey_credentials")
      .select("id, credential_id, device_type, name, created_at")
      .order("created_at", { ascending: false });
    setPasskeys(data ?? []);
  }, []);

  useEffect(() => { loadPasskeys(); }, [loadPasskeys]);

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

      // Get registration options from server
      const optionsRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/passkey/register-options`,
        { method: "POST", headers: fnHeaders }
      );

      if (!optionsRes.ok) {
        const errBody = await optionsRes.text().catch(() => "");
        throw new Error(`Registration options failed (${optionsRes.status}): ${errBody || optionsRes.statusText}`);
      }
      const options = await optionsRes.json();

      // Use WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge), (c) => c.charCodeAt(0)),
          user: {
            ...options.user,
            id: Uint8Array.from(atob(options.user.id), (c) => c.charCodeAt(0)),
          },
          excludeCredentials: (options.excludeCredentials ?? []).map((c: Record<string, string>) => ({
            ...c,
            id: Uint8Array.from(atob(c.id), (ch) => ch.charCodeAt(0)),
          })),
        },
      });

      if (!credential) throw new Error("Registration cancelled");

      const attestationResponse = credential as PublicKeyCredential;
      const response = attestationResponse.response as AuthenticatorAttestationResponse;

      // Verify with server
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
                attestationObject: btoa(String.fromCharCode(...new Uint8Array(response.attestationObject))),
                clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
              },
            },
            name: newName.trim() || "Passkey",
          }),
        }
      );

      if (!verifyRes.ok) {
        const verifyErr = await verifyRes.text().catch(() => "");
        throw new Error(`Verification failed (${verifyRes.status}): ${verifyErr || verifyRes.statusText}`);
      }

      toast.success("Passkey registered");
      setNewName("");
      loadPasskeys();
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") {
        toast.error(err.message);
      }
    }
    setRegistering(false);
  };

  const deletePasskey = async (id: string) => {
    if (!confirm("Remove this passkey?")) return;
    const { error } = await supabase.from("passkey_credentials").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Passkey removed"); loadPasskeys(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-[#6B5BFF]" />
        <span className="text-xs font-semibold text-foreground">Passkeys</span>
      </div>

      {passkeys.length > 0 ? (
        <div className="space-y-2">
          {passkeys.map((pk) => (
            <div key={pk.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {pk.device_type === "platform" ? (
                  <Smartphone className="h-3.5 w-3.5 text-[#6B5BFF] shrink-0" />
                ) : (
                  <Key className="h-3.5 w-3.5 text-[#6B5BFF] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">{pk.name}</p>
                  <p className="text-[9px] text-muted-foreground">
                    Added {new Date(pk.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-[#EA0022]" onClick={() => deletePasskey(pk.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">No passkeys registered. Add one for passwordless sign-in.</p>
      )}

      <div className="space-y-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Passkey name (e.g. MacBook Pro Touch ID)"
          className="h-8 text-[11px]"
        />
        <Button variant="outline" size="sm" onClick={registerPasskey} disabled={registering} className="gap-1.5 text-[10px] h-7 w-full">
          <Plus className="h-3 w-3" />
          {registering ? "Registering…" : "Register New Passkey"}
        </Button>
      </div>
    </div>
  );
}

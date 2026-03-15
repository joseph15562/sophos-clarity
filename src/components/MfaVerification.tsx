import { useState, useRef, useEffect } from "react";
import { Shield, Key, Fingerprint, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onVerified: () => void;
  onCancel?: () => void;
  showPasskeyOption?: boolean;
}

export function MfaVerification({ onVerified, onCancel, showPasskeyOption = true }: Props) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryDone, setRecoveryDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startChallenge();
    inputRef.current?.focus();
  }, []);

  const startChallenge = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) {
        toast.error("No MFA factor enrolled");
        return;
      }

      setFactorId(totpFactor.id);

      const { data: challenge, error } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (error) {
        toast.error("Failed to create MFA challenge");
        return;
      }

      setChallengeId(challenge.id);
    } catch (err) {
      toast.error("MFA setup error");
    }
  };

  const verify = async () => {
    if (!factorId || !challengeId || code.length !== 6) return;
    setVerifying(true);

    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (error) {
        toast.error("Invalid code — please try again");
        setCode("");
        inputRef.current?.focus();
      } else {
        toast.success("Verified");
        onVerified();
      }
    } catch {
      toast.error("Verification failed");
    }

    setVerifying(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) verify();
  };

  const handleRecovery = async () => {
    setRecovering(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Could not determine your email");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/auth/mfa-recovery`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email: user.email }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Recovery failed");
      }

      const data = await res.json();
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success("MFA has been reset — you can re-enroll from Settings");
        onVerified();
      } else {
        setRecoveryDone(true);
        toast.success("MFA factors removed — sign in again with your password");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recovery failed");
    }
    setRecovering(false);
  };

  if (recoveryDone) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 space-y-6 max-w-sm mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-[#00995a]/10 flex items-center justify-center">
          <Mail className="h-8 w-8 text-[#00995a]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">MFA Reset Complete</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your authenticator has been removed. Sign in again with your password to continue. You can re-enroll MFA from Settings.
          </p>
        </div>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="gap-2">
            Back to Sign In
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 space-y-6 max-w-sm mx-auto">
      <div className="h-16 w-16 rounded-2xl bg-[#2006F7]/10 flex items-center justify-center">
        <Shield className="h-8 w-8 text-[#2006F7]" />
      </div>

      <div className="text-center">
        <h2 className="text-lg font-bold text-foreground">Verify Your Identity</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <div className="w-full space-y-4">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={handleKeyDown}
          placeholder="000000"
          className="w-full text-center text-2xl font-mono tracking-[0.5em] rounded-xl border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
        />

        <Button
          onClick={verify}
          disabled={verifying || code.length !== 6}
          className="w-full h-10 gap-2"
        >
          <Key className="h-4 w-4" />
          {verifying ? "Verifying…" : "Verify"}
        </Button>

        {showPasskeyOption && (
          <Button variant="outline" className="w-full h-10 gap-2" disabled>
            <Fingerprint className="h-4 w-4" />
            Use Passkey Instead
          </Button>
        )}

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}

        <div className="pt-2 border-t border-border">
          <button
            onClick={handleRecovery}
            disabled={recovering}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 disabled:opacity-50"
          >
            {recovering ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Resetting MFA…
              </>
            ) : (
              <>
                <Mail className="h-3 w-3" /> Lost access to authenticator?
              </>
            )}
          </button>
          <p className="text-[9px] text-muted-foreground text-center mt-1">
            This will remove your MFA enrollment and sign you in. You can re-enroll afterwards.
          </p>
        </div>
      </div>
    </div>
  );
}

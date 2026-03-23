import { useState, useRef, useEffect } from "react";
import { Shield, Key, Fingerprint, Mail } from "lucide-react";
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
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);
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

  if (showRecoveryInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 space-y-6 max-w-sm mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-[#00F2B3]/10 flex items-center justify-center">
          <Mail className="h-8 w-8 text-[#00F2B3]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">Lost access to authenticator?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your organisation admin to reset your MFA, or use a backup code.
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowRecoveryInfo(false)} className="gap-2">
          Back
        </Button>
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
            onClick={() => setShowRecoveryInfo(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
          >
            <Mail className="h-3 w-3" /> Lost access to authenticator?
          </button>
          <p className="text-[9px] text-muted-foreground text-center mt-1">
            Contact your organisation admin to reset MFA, or use a backup code.
          </p>
        </div>
      </div>
    </div>
  );
}

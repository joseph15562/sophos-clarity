import { useState } from "react";
import { Shield, Check, Trash2, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function MfaEnrollment() {
  const [enrolling, setEnrolling] = useState(false);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const [existingFactors, setExistingFactors] = useState<Array<{ id: string; friendly_name?: string }>>([]);
  const [loading, setLoading] = useState(false);

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setExistingFactors(data?.totp ?? []);
    setEnrolled((data?.totp?.length ?? 0) > 0);
  };

  useState(() => { loadFactors(); });

  const startEnrollment = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "FireComply Authenticator",
      });

      if (error) {
        toast.error(error.message);
        setEnrolling(false);
        return;
      }

      setQrUri(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch {
      toast.error("Failed to start enrollment");
      setEnrolling(false);
    }
  };

  const confirmEnrollment = async () => {
    if (!factorId || verifyCode.length !== 6) return;
    setLoading(true);

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        toast.error("Challenge failed");
        setLoading(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });

      if (verifyError) {
        toast.error("Invalid code — try again");
        setVerifyCode("");
      } else {
        toast.success("MFA enabled successfully");
        setEnrolling(false);
        setQrUri(null);
        setSecret(null);
        setFactorId(null);
        setVerifyCode("");
        loadFactors();
      }
    } catch {
      toast.error("Verification failed");
    }

    setLoading(false);
  };

  const unenroll = async (id: string) => {
    if (!confirm("Remove MFA? You'll no longer need a code to sign in.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) toast.error(error.message);
    else { toast.success("MFA removed"); loadFactors(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-[#2006F7]" />
        <span className="text-xs font-semibold text-foreground">Two-Factor Authentication</span>
      </div>

      {enrolled && !enrolling && (
        <div className="space-y-2">
          {existingFactors.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#00995a]" />
                <span className="text-[11px] text-foreground font-medium">
                  {f.friendly_name ?? "Authenticator App"}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-[#EA0022]" onClick={() => unenroll(f.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!enrolling && !enrolled && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center space-y-3">
          <Key className="h-6 w-6 mx-auto text-muted-foreground/40" />
          <p className="text-[11px] text-muted-foreground">Secure your account with an authenticator app</p>
          <Button variant="outline" size="sm" onClick={startEnrollment} className="gap-1.5 text-[10px] h-7">
            <Shield className="h-3 w-3" /> Set Up Authenticator
          </Button>
        </div>
      )}

      {enrolling && qrUri && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
          <div className="flex justify-center">
            <img src={qrUri} alt="MFA QR Code" className="w-48 h-48 rounded-lg border border-border" />
          </div>
          {secret && (
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">Or enter manually:</p>
              <code className="text-[10px] font-mono bg-muted px-2 py-1 rounded select-all">{secret}</code>
            </div>
          )}
          <div>
            <label className="text-[10px] font-medium text-foreground block mb-1">Enter verification code</label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="h-8 text-center font-mono tracking-wider"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={confirmEnrollment} disabled={loading || verifyCode.length !== 6} className="flex-1 text-[11px] h-8">
              {loading ? "Verifying…" : "Confirm"}
            </Button>
            <Button variant="outline" onClick={() => { setEnrolling(false); setQrUri(null); }} className="text-[11px] h-8">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

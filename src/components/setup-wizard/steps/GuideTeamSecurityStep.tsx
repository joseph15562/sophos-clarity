import { Fingerprint, Lock, UserPlus } from "lucide-react";
import { FeatureButton, FeatureOverlay, MockSecurityPanel, MockTeamPanel } from "../wizard-ui";

type Props = {
  activeOverlay: string | null;
  setActiveOverlay: (id: string | null) => void;
};

export function GuideTeamSecurityStep({ activeOverlay, setActiveOverlay }: Props) {
  return (
    <div className="space-y-5 relative">
      {activeOverlay === "team-mgmt" && (
        <FeatureOverlay
          title="Team Management"
          subtitle="Invite colleagues and assign roles"
          onClose={() => setActiveOverlay(null)}
        >
          <MockTeamPanel />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Invite team members by
              email, assign them roles (Owner, Engineer, or Viewer), and collaborate on assessments.
              Each role has different permissions — Engineers can run assessments and generate
              reports, while Viewers have read-only access.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "mfa" && (
        <FeatureOverlay
          title="Multi-Factor Authentication"
          subtitle="TOTP-based authenticator app"
          onClose={() => setActiveOverlay(null)}
        >
          <div className="space-y-4">
            <MockSecurityPanel />
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-foreground">Setup Process</p>
              <div className="space-y-1.5">
                {[
                  {
                    step: "1",
                    text: "Open Settings › Security and click 'Enable MFA'",
                  },
                  {
                    step: "2",
                    text: "Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)",
                  },
                  { step: "3", text: "Enter the 6-digit code to verify and activate" },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-2 text-[9px]">
                    <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#00F2B3] text-white text-[8px] font-bold shrink-0 mt-0.5">
                      {s.step}
                    </span>
                    <span className="text-muted-foreground">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">Why MFA?</strong> Multi-factor authentication adds
              a critical second layer of protection to your account. Even if your password is
              compromised, your account stays secure.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "passkeys" && (
        <FeatureOverlay
          title="Passkeys"
          subtitle="Passwordless sign-in with biometrics"
          onClose={() => setActiveOverlay(null)}
        >
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-14 w-14 rounded-2xl bg-[#6B5BFF]/10 flex items-center justify-center">
                <Fingerprint className="h-7 w-7 text-[#6B5BFF]" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground">Passwordless Authentication</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Sign in with Face ID, Touch ID, Windows Hello, or a hardware security key
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card p-3">
              <p className="text-[10px] font-semibold text-foreground mb-2">Registered Passkeys</p>
              <div className="flex items-center gap-3 rounded bg-muted/20 p-2.5">
                <Fingerprint className="h-4 w-4 text-[#6B5BFF]" />
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-foreground">MacBook Pro Touch ID</p>
                  <p className="text-[9px] text-muted-foreground">Added 12 Mar 2026</p>
                </div>
                <span className="text-[9px] text-[#00F2B3] font-medium">Active</span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Passkeys use your
              device&apos;s built-in biometric or hardware security to authenticate. They&apos;re
              phishing-resistant and more secure than traditional passwords. Register one in
              Settings &gt; Security.
            </p>
          </div>
        </FeatureOverlay>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Team & Security
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Invite your team and secure your workspace with{" "}
          <strong className="text-foreground">multi-factor authentication</strong> and{" "}
          <strong className="text-foreground">passkeys</strong>. Click each to learn more.
        </p>
      </div>

      <div className="space-y-2.5">
        <FeatureButton
          icon={<UserPlus className="h-4 w-4" />}
          title="Team Management"
          desc="Invite colleagues by email and assign Owner, Engineer, or Viewer roles"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("team-mgmt")}
        />
        <FeatureButton
          icon={<Lock className="h-4 w-4" />}
          title="Multi-Factor Authentication"
          desc="Add TOTP-based verification via authenticator app for all logins"
          color="text-[#00F2B3]"
          onClick={() => setActiveOverlay("mfa")}
        />
        <FeatureButton
          icon={<Fingerprint className="h-4 w-4" />}
          title="Passkeys"
          desc="Passwordless sign-in with Face ID, Touch ID, or hardware security keys"
          color="text-[#6B5BFF]"
          onClick={() => setActiveOverlay("passkeys")}
        />
      </div>

      <div className="rounded-lg bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 border border-[#00F2B3]/15 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Recommendation:</strong> Enable MFA or register a
          passkey for your account as soon as possible. You can set these up in Settings &gt;
          Security.
        </p>
      </div>
    </div>
  );
}

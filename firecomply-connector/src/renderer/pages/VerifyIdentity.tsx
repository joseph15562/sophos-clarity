import { useState, useRef, useEffect } from "react";

interface Props {
  onVerified: () => void;
}

export function VerifyIdentity({ onVerified }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { codeRef.current?.focus(); }, []);

  const verify = async () => {
    if (!email || code.length !== 6) return;
    setVerifying(true);
    setError(null);

    try {
      const config = await window.electronAPI.getConfig();
      if (!config?.firecomplyApiUrl || !config?.agentApiKey) {
        throw new Error("Agent not configured");
      }

      const res = await fetch(`${config.firecomplyApiUrl}/api/agent/verify-identity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.agentApiKey,
        },
        body: JSON.stringify({ email, totpCode: code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Verification failed");
      }

      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode("");
      codeRef.current?.focus();
    }

    setVerifying(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-[#6B5BFF]/10 flex items-center justify-center">
          <svg className="h-8 w-8 text-[#6B5BFF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-foreground">Verify Identity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email and authenticator code
          </p>
        </div>

        <div className="space-y-3 text-left">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">TOTP Code</label>
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="000000"
              className="w-full text-center text-xl font-mono tracking-[0.5em] rounded-lg border border-border bg-background px-3 py-2"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={verify}
            disabled={verifying || !email || code.length !== 6}
            className="w-full px-4 py-2.5 rounded-lg bg-[#6B5BFF] text-white text-sm font-medium disabled:opacity-50"
          >
            {verifying ? "Verifying…" : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}

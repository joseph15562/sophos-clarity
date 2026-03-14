import { useState } from "react";

interface Props {
  host: string;
  port: number;
  username: string;
  password: string;
}

export function ConnectionTest({ host, port, username, password }: Props) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; firmwareVersion?: string; error?: string } | null>(null);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await window.electronAPI?.testFirewall({
        host, port, username, password, skipSslVerify: true,
      });
      setResult(res);
    } catch (err) {
      setResult({ ok: false, error: "Connection failed" });
    }
    setTesting(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={test}
        disabled={testing || !host || !username}
        className="px-3 py-1 rounded bg-muted text-xs font-medium hover:bg-muted/80 disabled:opacity-50"
      >
        {testing ? "Testing…" : "Test Connection"}
      </button>
      {result?.ok && (
        <span className="text-xs text-green-500">✓ {result.firmwareVersion}</span>
      )}
      {result && !result.ok && (
        <span className="text-xs text-red-500">✗ {result.error}</span>
      )}
    </div>
  );
}

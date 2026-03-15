import { useState, useEffect } from "react";
import { CheckCircle2, History } from "lucide-react";

const STORAGE_KEY = "firecomply-attestations";

export interface Attestation {
  framework: string;
  attested: boolean;
  attestedBy: string;
  attestedAt: string;
}

function loadAttestations(): Attestation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAttestations(items: Attestation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

const DEFAULT_FRAMEWORKS = [
  "NCSC Guidelines",
  "Cyber Essentials / CE+",
  "GDPR",
  "ISO 27001",
  "PCI DSS",
];

interface Props {
  frameworks?: string[];
}

export function AttestationWorkflow({ frameworks = DEFAULT_FRAMEWORKS }: Props) {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setAttestations(loadAttestations());
  }, []);

  const attestationsByFramework = new Map(attestations.map((a) => [a.framework, a]));

  const attest = (framework: string) => {
    const by = nameInput.trim() || "Unknown";
    const item: Attestation = {
      framework,
      attested: true,
      attestedBy: by,
      attestedAt: new Date().toISOString(),
    };
    const existing = attestations.filter((a) => a.framework !== framework);
    const next = [...existing, item];
    setAttestations(next);
    saveAttestations(next);
  };

  const history = [...attestations].sort(
    (a, b) => new Date(b.attestedAt).getTime() - new Date(a.attestedAt).getTime()
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Attestation Workflow</h3>

      <div className="space-y-2 mb-4">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
          Attestor name
        </label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>

      <div className="space-y-3">
        {frameworks.map((fw) => {
          const att = attestationsByFramework.get(fw);
          const isAttested = att?.attested ?? false;

          return (
            <div
              key={fw}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/10 p-3"
            >
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAttested}
                    onChange={(e) => {
                      if (e.target.checked) {
                        attest(fw);
                      } else {
                        const next = attestations.filter((a) => a.framework !== fw);
                        setAttestations(next);
                        saveAttestations(next);
                      }
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-xs font-medium text-foreground">
                    I attest controls have been reviewed
                  </span>
                </label>
                <span className="text-[10px] text-muted-foreground">— {fw}</span>
              </div>
              {isAttested && att && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {att.attestedBy} · {new Date(att.attestedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {attestations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" />
            Attestation history
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {history.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 text-[#00995a] dark:text-[#00F2B3] shrink-0" />
                  <span className="text-foreground">{a.framework}</span>
                  <span className="text-muted-foreground">
                    by {a.attestedBy} on {new Date(a.attestedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

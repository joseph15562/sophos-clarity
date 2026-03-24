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
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card space-y-5">
      <h3 className="text-base font-display font-bold tracking-tight text-foreground">Attestation Workflow</h3>

      <div className="space-y-2">
        <label className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em] block">
          Attestor name
        </label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border border-border/60 bg-card px-4 py-2.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30 focus:border-brand-accent/30 transition-colors placeholder:text-muted-foreground/40"
        />
      </div>

      <div className="space-y-2">
        {frameworks.map((fw) => {
          const att = attestationsByFramework.get(fw);
          const isAttested = att?.attested ?? false;

          return (
            <div
              key={fw}
              className={`flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${
                isAttested
                  ? "border-[#00F2B3]/20 bg-[#00F2B3]/[0.03]"
                  : "border-border/40 bg-muted/5 dark:bg-muted/5 hover:bg-muted/15"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
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
                    className="rounded border-border h-4 w-4 shrink-0"
                  />
                  <span className="text-[12px] font-medium text-foreground">
                    I attest controls have been reviewed
                  </span>
                </label>
                <span className="text-[11px] text-muted-foreground/50 font-medium shrink-0">— {fw}</span>
              </div>
              {isAttested && att && (
                <span className="text-[10px] text-muted-foreground/50 font-medium shrink-0">
                  {att.attestedBy} · {new Date(att.attestedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {attestations.length > 0 && (
        <div className="pt-4 border-t border-border/40 space-y-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground/50 hover:text-[#2006F7] dark:hover:text-[#00EDFF] transition-colors"
          >
            <History className="h-4 w-4" />
            Attestation history
          </button>
          {showHistory && (
            <ul className="space-y-2">
              {history.map((a, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[11px] rounded-lg bg-muted/10 dark:bg-muted/5 border border-border/30 px-3.5 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#00F2B3] shrink-0" />
                  <span className="font-display font-medium text-foreground">{a.framework}</span>
                  <span className="text-muted-foreground/60">
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

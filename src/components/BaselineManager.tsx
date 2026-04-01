import { useMemo, useState, useEffect, useCallback } from "react";
import { Check, Trash2 } from "lucide-react";
import { computeRiskScore } from "@/lib/risk-score";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { Button } from "@/components/ui/button";
import { warnOptionalError } from "@/lib/client-error-feedback";

const BASELINE_KEY = "firecomply-baseline-config";

const SEV_BADGE: Record<string, string> = {
  critical: "bg-[#EA0022]/10 text-[#EA0022]",
  high: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]",
  medium: "bg-[#ca8a04]/12 text-[#78350f] dark:bg-[#F8E300]/10 dark:text-[#F8E300]",
  low: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]",
  info: "bg-[#009CFB]/10 text-[#009CFB]",
};

export interface BaselineManagerProps {
  analysisResults: Record<string, AnalysisResult>;
}

export function BaselineManager({ analysisResults }: BaselineManagerProps) {
  const labels = useMemo(() => Object.keys(analysisResults), [analysisResults]);
  const [baselineLabel, setBaselineLabel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BASELINE_KEY);
      if (stored && labels.includes(stored)) {
        setBaselineLabel(stored);
      } else if (stored && !labels.includes(stored)) {
        localStorage.removeItem(BASELINE_KEY);
        setBaselineLabel(null);
      }
    } catch (e) {
      warnOptionalError("BaselineManager.load", e);
      setBaselineLabel(null);
    }
  }, [labels]);

  const handleSetBaseline = useCallback((label: string) => {
    setBaselineLabel(label);
    try {
      localStorage.setItem(BASELINE_KEY, label);
    } catch (e) {
      warnOptionalError("BaselineManager.set", e);
    }
  }, []);

  const handleClearBaseline = useCallback(() => {
    setBaselineLabel(null);
    try {
      localStorage.removeItem(BASELINE_KEY);
    } catch (e) {
      warnOptionalError("BaselineManager.clear", e);
    }
  }, []);

  const baselineResult = baselineLabel ? analysisResults[baselineLabel] : null;
  const otherLabels = useMemo(
    () => labels.filter((l) => l !== baselineLabel),
    [labels, baselineLabel],
  );

  if (labels.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-5 shadow-card"
      data-tour="baseline-manager"
    >
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">
        Configuration Baseline
      </h3>

      {!baselineLabel ? (
        <p className="text-sm text-muted-foreground mb-4">
          Select a well-configured firewall as your baseline
        </p>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Baseline: {baselineLabel}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearBaseline}
            className="gap-1 text-xs h-7"
          >
            <Trash2 className="h-3 w-3" />
            Clear Baseline
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {labels.map((label) => {
          const isBaseline = label === baselineLabel;
          return (
            <div key={label} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{label}</span>
                {!isBaseline && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetBaseline(label)}
                    className="gap-1 text-xs h-7"
                  >
                    <Check className="h-3 w-3" />
                    Set as Baseline
                  </Button>
                )}
              </div>

              {baselineLabel && baselineResult && label !== baselineLabel && (
                <BaselineComparison
                  baselineResult={baselineResult}
                  firewallResult={analysisResults[label]}
                  firewallLabel={label}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BaselineComparison({
  baselineResult,
  firewallResult,
  firewallLabel,
}: {
  baselineResult: AnalysisResult;
  firewallResult: AnalysisResult | undefined;
  firewallLabel: string;
}) {
  const comparison = useMemo(() => {
    if (!firewallResult) return null;
    const baselineIds = new Set(baselineResult.findings.map((f) => f.id));
    const firewallIds = new Set(firewallResult.findings.map((f) => f.id));
    const matching = baselineResult.findings.filter((f) => firewallIds.has(f.id)).length;
    const totalBaseline = baselineResult.findings.length;
    const alignmentPct = totalBaseline > 0 ? Math.round((matching / totalBaseline) * 100) : 100;
    const missing = baselineResult.findings.filter((f) => !firewallIds.has(f.id));
    const extra = firewallResult.findings.filter((f) => !baselineIds.has(f.id));
    return { alignmentPct, missing, extra };
  }, [baselineResult, firewallResult]);

  if (!comparison || !firewallResult) return null;

  return (
    <div className="space-y-2 text-xs">
      <p className="text-foreground">
        <span className="font-semibold">{firewallLabel}</span> is{" "}
        <span className="font-bold text-[#007A5A] dark:text-[#00F2B3]">
          {comparison.alignmentPct}%
        </span>{" "}
        aligned with baseline
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="font-semibold text-muted-foreground mb-1">Missing items</div>
          <FindingList findings={comparison.missing} />
        </div>
        <div>
          <div className="font-semibold text-muted-foreground mb-1">Extra items</div>
          <FindingList findings={comparison.extra} />
        </div>
      </div>
    </div>
  );
}

function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <ul className="space-y-1 max-h-24 overflow-y-auto">
      {findings.length === 0 ? (
        <li className="text-muted-foreground">None</li>
      ) : (
        findings.map((f) => (
          <li key={f.id} className="flex items-start gap-1.5">
            <span
              className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase ${SEV_BADGE[f.severity] ?? "bg-muted text-muted-foreground"}`}
            >
              {f.severity}
            </span>
            <span className="text-foreground truncate">{f.title}</span>
          </li>
        ))
      )}
    </ul>
  );
}

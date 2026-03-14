import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  BASELINE_TEMPLATES,
  evaluateBaseline,
  type BaselineResult,
} from "@/lib/policy-baselines";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

function mergeAnalysisResults(results: Record<string, AnalysisResult>): AnalysisResult | null {
  const entries = Object.values(results);
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0];
  return {
    stats: entries[0].stats,
    findings: entries.flatMap((e) => e.findings),
    inspectionPosture: entries[0].inspectionPosture,
  };
}

export function PolicyBaseline({ analysisResults }: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(BASELINE_TEMPLATES[0].id);

  const mergedResult = useMemo(
    () => mergeAnalysisResults(analysisResults),
    [analysisResults],
  );

  const baselineResult = useMemo<BaselineResult | null>(() => {
    if (!mergedResult) return null;
    const template = BASELINE_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? BASELINE_TEMPLATES[0];
    return evaluateBaseline(template, mergedResult);
  }, [mergedResult, selectedTemplateId]);

  if (Object.keys(analysisResults).length === 0) return null;

  const template = BASELINE_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? BASELINE_TEMPLATES[0];

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-[#2006F7]/10 flex items-center justify-center">
          <ClipboardCheck className="h-4 w-4 text-[#2006F7]" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Policy Baseline</h3>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Baseline template
        </label>
        <select
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
        >
          {BASELINE_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {template.description}
        </p>
      </div>

      {baselineResult && (
        <>
          {/* Overall score */}
          <div
            className={`rounded-lg border p-4 ${
              baselineResult.score >= 80
                ? "border-[#00995a]/20 bg-[#00995a]/[0.04] dark:bg-[#00F2B3]/[0.06]"
                : baselineResult.score >= 50
                  ? "border-[#F29400]/20 bg-[#F29400]/[0.04]"
                  : "border-[#EA0022]/20 bg-[#EA0022]/[0.04]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Baseline compliance score
              </span>
              <span
                className={`text-2xl font-extrabold tabular-nums ${
                  baselineResult.score >= 80
                    ? "text-[#00995a] dark:text-[#00F2B3]"
                    : baselineResult.score >= 50
                      ? "text-[#F29400]"
                      : "text-[#EA0022]"
                }`}
              >
                {baselineResult.score}%
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {baselineResult.requirements.filter((r) => r.met).length} of {baselineResult.requirements.length} requirements met
            </p>
          </div>

          {/* Requirements list */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Requirements
            </span>
            <div className="space-y-1.5">
              {baselineResult.requirements.map((req, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                    req.met
                      ? "border-[#00995a]/20 bg-[#00995a]/[0.04] dark:bg-[#00F2B3]/[0.06]"
                      : "border-[#EA0022]/20 bg-[#EA0022]/[0.04]"
                  }`}
                >
                  <div
                    className={`mt-0.5 h-5 w-5 shrink-0 rounded-md flex items-center justify-center ${
                      req.met ? "bg-[#00995a]/10" : "bg-[#EA0022]/10"
                    }`}
                  >
                    {req.met ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#00995a] dark:text-[#00F2B3]" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-[#EA0022]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{req.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      {req.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

import { useMemo } from "react";
import { FileDown } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { assessInsuranceReadiness, type InsuranceAnswer } from "@/lib/insurance-readiness";
import { toast } from "sonner";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

const ANSWER_STYLES: Record<InsuranceAnswer, { color: string; bg: string; symbol: string }> = {
  yes: {
    color: "text-[#00F2B3] dark:text-[#00F2B3]",
    bg: "bg-[#00F2B3]/10 dark:bg-[#00F2B3]/10",
    symbol: "\u2713",
  },
  no: {
    color: "text-[#EA0022]",
    bg: "bg-[#EA0022]/10",
    symbol: "\u2717",
  },
  partial: {
    color: "text-[#F29400]",
    bg: "bg-[#F29400]/10",
    symbol: "~",
  },
};

export function InsuranceReadiness({ analysisResults }: Props) {
  const result = useMemo(
    () => assessInsuranceReadiness(analysisResults),
    [analysisResults]
  );

  const handleExportPdf = () => {
    toast.info("Export as PDF", {
      description: "Coming soon — PDF export for insurance readiness will be available in a future release.",
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center">
            <svg
              className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Cyber Insurance Readiness
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Common questionnaire items mapped from firewall analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold tabular-nums ${
              result.readinessScore >= 75
                ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3]"
                : result.readinessScore >= 50
                  ? "bg-[#F29400]/10 text-[#F29400]"
                  : "bg-[#EA0022]/10 text-[#EA0022]"
            }`}
          >
            <span className="text-lg">{result.readinessScore}%</span>
            <span className="text-[10px] font-medium">Readiness</span>
          </div>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export as PDF
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {result.questions.map((q) => {
          const style = ANSWER_STYLES[q.answer];
          return (
            <div
              key={q.question}
              className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
            >
              <span
                className={`inline-flex items-center justify-center h-6 w-6 rounded shrink-0 text-sm font-bold ${style.bg} ${style.color}`}
                title={q.answer}
              >
                {style.symbol}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{q.question}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {q.evidence}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

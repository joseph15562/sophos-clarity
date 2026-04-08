import { useMemo } from "react";
import { FileDown } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  assessInsuranceReadiness,
  buildInsuranceReadinessPrintHtml,
  type InsuranceAnswer,
} from "@/lib/insurance-readiness";
import { buildPdfHtml, printHtmlInHiddenIframe } from "@/lib/report-export";
import type { BrandingData } from "@/components/BrandingSetup";
import { toast } from "sonner";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  /** Shown on PDF cover line */
  customerName?: string;
  mspName?: string;
}

const ANSWER_STYLES: Record<InsuranceAnswer, { color: string; bg: string; symbol: string }> = {
  yes: {
    color: "text-[#007A5A] dark:text-[#00F2B3]",
    bg: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 dark:bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10",
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

export function InsuranceReadiness({ analysisResults, customerName, mspName }: Props) {
  const result = useMemo(() => assessInsuranceReadiness(analysisResults), [analysisResults]);

  const handleExportPdf = () => {
    const inner = buildInsuranceReadinessPrintHtml(result, customerName);
    const branding: BrandingData = {
      companyName: mspName ?? "",
      customerName: customerName ?? "",
      logoUrl: null,
      environment: "",
      country: "",
      selectedFrameworks: [],
    };
    const html = buildPdfHtml(inner, "Cyber Insurance Readiness", branding, {
      theme: "light",
      omitPdfToc: true,
    });
    if (!printHtmlInHiddenIframe(html)) {
      toast.error("Could not prepare print view. Try again or use a different browser.");
      return;
    }
    toast.success("Print dialog opened — choose Save as PDF if you prefer a file.");
  };

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 space-y-5 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(0,242,179,0.04), rgba(242,148,0,0.03), rgba(234,0,34,0.02), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,242,179,0.15), rgba(242,148,0,0.1), rgba(234,0,34,0.08), transparent)",
        }}
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center h-9 w-9 rounded-xl"
            style={{
              background: "linear-gradient(145deg, rgba(0,242,179,0.15), rgba(0,242,179,0.06))",
              border: "1px solid rgba(0,242,179,0.2)",
              boxShadow: "0 0 12px rgba(0,242,179,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <svg
              className="h-5 w-5 text-brand-accent"
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
            <h3 className="text-base font-display font-bold tracking-tight text-foreground">
              Cyber Insurance Readiness
            </h3>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              Common questionnaire items mapped from firewall analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border font-bold tabular-nums ${
              result.readinessScore >= 75
                ? "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#00F2B3] border-[#008F69]/30 dark:border-[#00F2B3]/20"
                : result.readinessScore >= 50
                  ? "bg-[#F29400]/10 text-[#F29400] border-[#F29400]/20"
                  : "bg-[#EA0022]/10 text-[#EA0022] border-[#EA0022]/20"
            }`}
          >
            <span className="text-xl font-display font-black">{result.readinessScore}%</span>
            <span className="text-[11px] font-semibold opacity-70">Readiness</span>
          </div>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold rounded-xl transition-all duration-200 backdrop-blur-sm hover:brightness-110"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              color: "rgba(255,255,255,0.65)",
            }}
          >
            <FileDown className="h-3.5 w-3.5" />
            Export as PDF
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {result.questions.map((q) => {
          const style = ANSWER_STYLES[q.answer];
          const borderAccent =
            q.answer === "yes"
              ? "border-l-[#00F2B3]"
              : q.answer === "no"
                ? "border-l-[#EA0022]"
                : "border-l-[#F29400]";
          return (
            <div
              key={q.question}
              className={`flex items-start gap-3.5 rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] border-l-[3px] ${borderAccent} px-4 py-4 transition-all duration-200 hover:shadow-elevated backdrop-blur-sm`}
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <span
                className={`inline-flex items-center justify-center h-7 w-7 rounded-lg shrink-0 text-sm font-bold ${style.bg} ${style.color}`}
                title={q.answer}
              >
                {style.symbol}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-display font-semibold tracking-tight text-foreground">
                  {q.question}
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1 leading-relaxed">
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

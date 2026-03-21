import { BookOpen, ClipboardCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportCardsProps {
  fileCount: number;
  localMode?: boolean;
  isViewerOnly?: boolean;
  onGenerateIndividual: () => void;
  onGenerateExecutive: () => void;
  onGenerateExecutiveOnePager: () => void;
  onGenerateCompliance: () => void;
  onGenerateAll: () => void;
}

export function ReportCards({
  fileCount,
  localMode = false,
  isViewerOnly = false,
  onGenerateIndividual,
  onGenerateExecutive,
  onGenerateExecutiveOnePager,
  onGenerateCompliance,
  onGenerateAll,
}: ReportCardsProps) {
  const canGenerate = !localMode && !isViewerOnly;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">3</span>
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Generate Reports</h2>
          <p className="text-[10px] text-muted-foreground">Technical Report, Executive Brief, Compliance Pack — export deliverables for customer handoff or audit.</p>
        </div>
      </div>

      {localMode && (
        <div className="rounded-xl border border-[#F29400]/30 bg-[#F29400]/5 dark:bg-[#F29400]/10 px-5 py-4 flex items-start gap-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">AI reports unavailable in local mode.</strong> Technical reports, executive briefs, and compliance reports require an external AI service. Generate the Executive One-Pager below for a local-only summary.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Technical Report — AI, disabled in local mode */}
        <div
          className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 ${
            !canGenerate ? "opacity-50 pointer-events-none" : "hover:shadow-md hover:border-[#2006F7]/30 dark:hover:border-[#2006F7]/40 cursor-pointer group"
          }`}
          onClick={canGenerate ? onGenerateIndividual : undefined}
        >
          <div className="h-1 bg-gradient-to-r from-[#2006F7] to-[#5A00FF]" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center shrink-0 group-hover:bg-[#2006F7]/15 dark:group-hover:bg-[#2006F7]/25 transition-colors">
                <img src="/icons/sophos-document.svg" alt="" className="h-6 w-6 sophos-icon" />
              </div>
              <span className="font-display font-bold text-foreground text-[15px]">Generate Technical Report</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Comprehensive per-firewall assessment covering rules, NAT, interfaces, hosts, policies, and security posture. Includes prioritised findings, NCSC-aligned recommendations, and remediation guidance.
            </p>
            <Button size="sm" className="w-full gap-2 bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white shadow-sm" disabled={!canGenerate}>
              <img src="/icons/sophos-ai-white.svg" alt="" className="h-4 w-4" />
              {!canGenerate ? (isViewerOnly ? "View only" : "AI unavailable") : (fileCount === 1 ? "Generate Report" : `Generate ${fileCount} Reports`)}
            </Button>
          </div>
        </div>

        {/* Executive Brief — AI, disabled in local mode */}
        <div
          className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 ${
            !canGenerate || fileCount < 1 ? "opacity-50 pointer-events-none" : "hover:shadow-md hover:border-[#5A00FF]/30 dark:hover:border-[#5A00FF]/40 cursor-pointer group"
          }`}
          onClick={canGenerate && fileCount >= 1 ? onGenerateExecutive : undefined}
        >
          <div className="h-1 bg-gradient-to-r from-[#5A00FF] to-[#B529F7]" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#5A00FF]/10 dark:bg-[#5A00FF]/15 flex items-center justify-center shrink-0">
                <img src="/icons/sophos-chart.svg" alt="" className="h-6 w-6 sophos-icon" />
              </div>
              <span className="font-display font-bold text-foreground text-[15px]">Generate Executive Brief</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {fileCount >= 1
                ? "Estate summary with risk matrix, key findings, and strategic recommendations — designed for management and stakeholder reporting."
                : "Upload a firewall export to unlock the executive brief."}
            </p>
            <Button size="sm" variant="secondary" className="w-full gap-2" disabled={fileCount < 1 || !canGenerate}>
              <BookOpen className="h-3.5 w-3.5" /> {!canGenerate ? (isViewerOnly ? "View only" : "AI unavailable") : "Generate Executive Brief"}
            </Button>
          </div>
        </div>

        {/* Executive One-Pager */}
        <div
          className={`rounded-xl border border-border bg-card shadow-sm transition-all duration-200 overflow-hidden ${
            canGenerate ? "hover:shadow-md hover:border-[#B529F7]/30 dark:hover:border-[#B529F7]/40 cursor-pointer group" : "opacity-50 pointer-events-none"
          }`}
          onClick={canGenerate ? onGenerateExecutiveOnePager : undefined}
        >
          <div className="h-1 bg-gradient-to-r from-[#B529F7] to-[#E040FB]" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#B529F7]/10 dark:bg-[#B529F7]/15 flex items-center justify-center shrink-0 group-hover:bg-[#B529F7]/15 dark:group-hover:bg-[#B529F7]/25 transition-colors">
                <FileText className="h-6 w-6 text-[#B529F7]" />
              </div>
              <span className="font-display font-bold text-foreground text-[15px]">Generate Executive One-Pager</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Instant one-page summary with overall score, grade, top 5 risks, and 3 recommended next steps. No AI required — generated locally from your analysis.
            </p>
            <Button size="sm" variant="outline" className="w-full gap-2" disabled={!canGenerate}>
              <FileText className="h-3.5 w-3.5" /> {canGenerate ? "Generate One-Pager" : "View only"}
            </Button>
          </div>
        </div>

        {/* Compliance Readiness Report — AI, disabled in local mode */}
        <div
          className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 ${
            !canGenerate ? "opacity-50 pointer-events-none" : "hover:shadow-md hover:border-[#009CFB]/30 dark:hover:border-[#009CFB]/40 cursor-pointer group"
          }`}
          onClick={canGenerate ? onGenerateCompliance : undefined}
        >
          <div className="h-1 bg-gradient-to-r from-[#009CFB] to-[#00EDFF]" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#009CFB]/10 dark:bg-[#009CFB]/15 flex items-center justify-center shrink-0 group-hover:bg-[#009CFB]/15 dark:group-hover:bg-[#009CFB]/25 transition-colors">
                <img src="/icons/sophos-governance.svg" alt="" className="h-6 w-6 sophos-icon" />
              </div>
              <span className="font-display font-bold text-foreground text-[15px]">Generate Compliance Pack</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Compliance readiness assessment mapping firewall controls to your selected frameworks. Includes control status, gap analysis, and remediation priorities. Results are indicative and should be validated by a qualified auditor.
            </p>
            <Button size="sm" variant="outline" className="w-full gap-2" disabled={!canGenerate}>
              <ClipboardCheck className="h-3.5 w-3.5" /> {!canGenerate ? (isViewerOnly ? "View only" : "AI unavailable") : "Generate Compliance Report"}
            </Button>
          </div>
        </div>
      </div>

      {canGenerate && (
      <Button size="lg" onClick={onGenerateAll} className="w-full gap-2 text-base bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white">
        <img src="/icons/sophos-orchestration-white.svg" alt="" className="h-5 w-5" />
        {fileCount >= 2
          ? "Generate All Reports + Executive Brief"
          : "Generate All Reports + Compliance Report"}
      </Button>
      )}
    </section>
  );
}

import { BookOpen, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportCardsProps {
  fileCount: number;
  onGenerateIndividual: () => void;
  onGenerateExecutive: () => void;
  onGenerateCompliance: () => void;
  onGenerateAll: () => void;
}

export function ReportCards({
  fileCount,
  onGenerateIndividual,
  onGenerateExecutive,
  onGenerateCompliance,
  onGenerateAll,
}: ReportCardsProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">3</span>
        <h2 className="text-lg font-display font-bold text-foreground">Generate Reports</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Technical Report */}
        <div
          className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-[#2006F7]/30 dark:hover:border-[#2006F7]/40 transition-all duration-200 cursor-pointer group overflow-hidden"
          onClick={onGenerateIndividual}
        >
          <div className="h-1 bg-gradient-to-r from-[#2006F7] to-[#5A00FF]" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center shrink-0 group-hover:bg-[#2006F7]/15 dark:group-hover:bg-[#2006F7]/25 transition-colors">
                <img src="/icons/sophos-document.svg" alt="" className="h-6 w-6 sophos-icon" />
              </div>
              <span className="font-display font-bold text-foreground text-[15px]">Technical Report</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Comprehensive per-firewall assessment covering rules, NAT, interfaces, hosts, policies, and security posture. Includes prioritised findings, NCSC-aligned recommendations, and remediation guidance.
            </p>
            <Button size="sm" className="w-full gap-2 bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white shadow-sm">
              <img src="/icons/sophos-ai-white.svg" alt="" className="h-4 w-4" />
              {fileCount === 1 ? "Generate Report" : `Generate ${fileCount} Reports`}
            </Button>
          </div>
        </div>

        {/* Executive Brief */}
        <div
          className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-200 ${fileCount >= 2 ? "hover:shadow-md hover:border-[#5A00FF]/30 dark:hover:border-[#5A00FF]/40 cursor-pointer group" : "opacity-45 pointer-events-none"}`}
          onClick={fileCount >= 2 ? onGenerateExecutive : undefined}
        >
          <div className="h-1 bg-gradient-to-r from-[#5A00FF] to-[#B529F7]" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#5A00FF]/10 dark:bg-[#5A00FF]/15 flex items-center justify-center shrink-0">
                <img src="/icons/sophos-chart.svg" alt="" className="h-6 w-6 sophos-icon" />
              </div>
              <span className="font-display font-bold text-foreground text-[15px]">Executive Brief</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {fileCount >= 2
                ? "Consolidated estate summary comparing all firewalls. Risk matrix, cross-estate findings, strategic recommendations — designed for management and stakeholder reporting."
                : "Upload 2+ firewall exports to unlock the consolidated executive brief across your estate."}
            </p>
            <Button size="sm" variant="secondary" className="w-full gap-2" disabled={fileCount < 2}>
              <BookOpen className="h-3.5 w-3.5" /> Generate Executive Brief
            </Button>
          </div>
        </div>

        {/* Compliance Evidence Pack */}
        <div
          className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-[#009CFB]/30 dark:hover:border-[#009CFB]/40 transition-all duration-200 cursor-pointer group overflow-hidden"
          onClick={onGenerateCompliance}
        >
          <div className="h-1 bg-gradient-to-r from-[#009CFB] to-[#00EDFF]" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-[#009CFB]/10 dark:bg-[#009CFB]/15 flex items-center justify-center shrink-0 group-hover:bg-[#009CFB]/15 dark:group-hover:bg-[#009CFB]/25 transition-colors">
                <img src="/icons/sophos-governance.svg" alt="" className="h-6 w-6 sophos-icon" />
              </div>
              <span className="font-display font-bold text-foreground text-[15px]">Compliance Evidence Pack</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Audit-ready evidence appendix mapping firewall controls to your selected compliance frameworks. Includes control status assessment, gap analysis, residual risk register, and remediation priorities.
            </p>
            <Button size="sm" variant="outline" className="w-full gap-2">
              <ClipboardCheck className="h-3.5 w-3.5" /> Generate Compliance Pack
            </Button>
          </div>
        </div>
      </div>

      <Button size="lg" onClick={onGenerateAll} className="w-full gap-2 text-base bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white">
        <img src="/icons/sophos-orchestration-white.svg" alt="" className="h-5 w-5" />
        {fileCount >= 2
          ? "Generate All Reports + Executive Brief"
          : "Generate All Reports + Compliance Pack"}
      </Button>
    </section>
  );
}

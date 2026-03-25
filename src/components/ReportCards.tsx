import { BookOpen, ClipboardCheck, FileText, BarChart3, Scale, Sparkles } from "lucide-react";
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
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-[#2006F7] to-[#5A00FF] text-white text-xs font-bold ring-4 ring-[#2006F7]/20 dark:ring-[#00EDFF]/20 shadow-[0_0_18px_rgba(32,6,247,0.35)]">
          3
        </span>
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-[#2006F7] dark:to-[#00EDFF] bg-clip-text text-transparent">
            Generate Reports
          </h2>
          <p className="text-sm font-medium text-foreground/80 dark:text-white/75 leading-relaxed">
            Create{" "}
            <span className="text-brand-accent font-semibold">
              technical reports, executive briefs, and compliance packs
            </span>{" "}
            as packaged deliverables for{" "}
            <span className="text-foreground dark:text-white font-semibold">
              customer handoff, board review, and audit preparation
            </span>
            .
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[32px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.08),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.99),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(0,242,179,0.08),transparent_28%),linear-gradient(135deg,rgba(8,13,26,0.98),rgba(12,18,34,0.98))] shadow-[0_20px_60px_rgba(32,6,247,0.08)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00F2B3]" />

        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-accent">
                Delivery ready
              </div>
              <h3 className="text-2xl sm:text-[1.9rem] font-display font-black text-foreground tracking-tight leading-tight">
                Turn analysis into{" "}
                <span className="text-brand-accent">executive-ready deliverables</span>
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Generate polished outputs for technical teams, leadership stakeholders, and
                compliance conversations without rebuilding the story by hand.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 min-w-full lg:min-w-[360px] lg:max-w-[430px]">
              <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Best for
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  Customer handoff, board packs, audit preparation
                </p>
              </div>
              <div className="rounded-2xl border border-[#00F2B3]/20 bg-[#00F2B3]/[0.05] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Outcome
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  Clearer reporting with less manual rewriting
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Technical
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                Detailed evidence and remediation for engineers
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Executive
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                Stakeholder-ready narrative for business decisions
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Compliance
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                Framework mapping and readiness context for audits
              </p>
            </div>
          </div>

          {localMode && (
            <div className="rounded-[24px] border border-[#F29400]/30 bg-[#F29400]/5 dark:bg-[#F29400]/10 px-5 py-4 flex items-start gap-3 shadow-sm">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">AI reports unavailable in local mode.</strong>{" "}
                Technical reports, executive briefs, and compliance reports require an external AI
                service. Generate the Executive One-Pager below for a local-only summary.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Technical Report — AI, disabled in local mode */}
            <div
              className={`rounded-[24px] border border-border/50 bg-card/90 shadow-sm overflow-hidden transition-all duration-200 ${
                !canGenerate
                  ? "opacity-50 pointer-events-none"
                  : "hover:shadow-md hover:border-brand-accent/30 dark:hover:border-[#2006F7]/40 cursor-pointer group"
              }`}
              onClick={canGenerate ? onGenerateIndividual : undefined}
            >
              <div className="h-1 bg-gradient-to-r from-[#2006F7] to-[#5A00FF]" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center shrink-0 group-hover:bg-brand-accent/15 dark:group-hover:bg-[#2006F7]/25 transition-colors">
                    <FileText className="h-6 w-6 text-brand-accent" />
                  </div>
                  <span className="font-display font-bold text-foreground text-[15px]">
                    Generate Technical Report
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Comprehensive per-firewall assessment covering rules, NAT, interfaces, hosts,
                  policies, and security posture. Includes prioritised findings, NCSC-aligned
                  recommendations, and remediation guidance.
                </p>
                <Button
                  size="sm"
                  className="w-full gap-2 bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white shadow-sm"
                  disabled={!canGenerate}
                >
                  <Sparkles className="h-4 w-4" />
                  {!canGenerate
                    ? isViewerOnly
                      ? "View only"
                      : "AI unavailable"
                    : fileCount === 1
                      ? "Generate Report"
                      : `Generate ${fileCount} Reports`}
                </Button>
              </div>
            </div>

            {/* Executive Brief — AI, disabled in local mode */}
            <div
              className={`rounded-[24px] border border-border/50 bg-card/90 shadow-sm overflow-hidden transition-all duration-200 ${
                !canGenerate || fileCount < 1
                  ? "opacity-50 pointer-events-none"
                  : "hover:shadow-md hover:border-[#5A00FF]/30 dark:hover:border-[#5A00FF]/40 cursor-pointer group"
              }`}
              onClick={canGenerate && fileCount >= 1 ? onGenerateExecutive : undefined}
            >
              <div className="h-1 bg-gradient-to-r from-[#5A00FF] to-[#B529F7]" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-[#5A00FF]/10 dark:bg-[#5A00FF]/15 flex items-center justify-center shrink-0">
                    <BarChart3 className="h-6 w-6 text-brand-accent" />
                  </div>
                  <span className="font-display font-bold text-foreground text-[15px]">
                    Generate Executive Brief
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {fileCount >= 1
                    ? "Estate summary with risk matrix, key findings, and strategic recommendations — designed for management and stakeholder reporting."
                    : "Upload a firewall export to unlock the executive brief."}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full gap-2"
                  disabled={fileCount < 1 || !canGenerate}
                >
                  <BookOpen className="h-3.5 w-3.5" />{" "}
                  {!canGenerate
                    ? isViewerOnly
                      ? "View only"
                      : "AI unavailable"
                    : "Generate Executive Brief"}
                </Button>
              </div>
            </div>

            {/* Executive One-Pager */}
            <div
              className={`rounded-[24px] border border-border/50 bg-card/90 shadow-sm transition-all duration-200 overflow-hidden ${
                canGenerate
                  ? "hover:shadow-md hover:border-[#B529F7]/30 dark:hover:border-[#B529F7]/40 cursor-pointer group"
                  : "opacity-50 pointer-events-none"
              }`}
              onClick={canGenerate ? onGenerateExecutiveOnePager : undefined}
            >
              <div className="h-1 bg-gradient-to-r from-[#B529F7] to-[#E040FB]" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-[#B529F7]/10 dark:bg-[#B529F7]/15 flex items-center justify-center shrink-0 group-hover:bg-[#B529F7]/15 dark:group-hover:bg-[#B529F7]/25 transition-colors">
                    <FileText className="h-6 w-6 text-[#B529F7]" />
                  </div>
                  <span className="font-display font-bold text-foreground text-[15px]">
                    Generate Executive One-Pager
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Instant one-page summary with overall score, grade, top 5 risks, and 3 recommended
                  next steps. No AI required — generated locally from your analysis.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={!canGenerate}
                >
                  <FileText className="h-3.5 w-3.5" />{" "}
                  {canGenerate ? "Generate One-Pager" : "View only"}
                </Button>
              </div>
            </div>

            {/* Compliance Readiness Report — AI, disabled in local mode */}
            <div
              className={`rounded-[24px] border border-border/50 bg-card/90 shadow-sm overflow-hidden transition-all duration-200 ${
                !canGenerate
                  ? "opacity-50 pointer-events-none"
                  : "hover:shadow-md hover:border-[#009CFB]/30 dark:hover:border-[#009CFB]/40 cursor-pointer group"
              }`}
              onClick={canGenerate ? onGenerateCompliance : undefined}
            >
              <div className="h-1 bg-gradient-to-r from-[#009CFB] to-[#00EDFF]" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-[#009CFB]/10 dark:bg-[#009CFB]/15 flex items-center justify-center shrink-0 group-hover:bg-[#009CFB]/15 dark:group-hover:bg-[#009CFB]/25 transition-colors">
                    <Scale className="h-6 w-6 text-brand-accent" />
                  </div>
                  <span className="font-display font-bold text-foreground text-[15px]">
                    Generate Compliance Pack
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Compliance readiness assessment mapping firewall controls to your selected
                  frameworks. Includes control status, gap analysis, and remediation priorities.
                  Results are indicative and should be validated by a qualified auditor.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={!canGenerate}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />{" "}
                  {!canGenerate
                    ? isViewerOnly
                      ? "View only"
                      : "AI unavailable"
                    : "Generate Compliance Report"}
                </Button>
              </div>
            </div>
          </div>

          {canGenerate && (
            <div className="rounded-2xl border border-brand-accent/15 bg-card/70 p-3 sm:p-4">
              <Button
                size="lg"
                onClick={onGenerateAll}
                className="w-full gap-2 text-base bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white shadow-sm"
              >
                <Sparkles className="h-5 w-5" />
                {fileCount >= 2
                  ? "Generate All Reports + Executive Brief"
                  : "Generate All Reports + Compliance Report"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

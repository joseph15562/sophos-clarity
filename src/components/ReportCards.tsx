import {
  BookOpen,
  ClipboardCheck,
  FileText,
  BarChart3,
  Scale,
  Sparkles,
  Shield,
} from "lucide-react";
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
  /** Insurance readiness lives under Analysis → Compliance (not a separate AI PDF yet). */
  onOpenInsuranceReadiness?: () => void;
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
  onOpenInsuranceReadiness,
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
              <div className="info-pill">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                  Best for
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  Customer handoff, board packs, audit preparation
                </p>
              </div>
              <div className="info-pill">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                  Outcome
                </p>
                <p className="text-sm font-semibold text-foreground mt-1">
                  Clearer reporting with less manual rewriting
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="info-pill">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                Technical
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                Detailed evidence and remediation for engineers
              </p>
            </div>
            <div className="info-pill">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                Executive
              </p>
              <p className="text-sm font-semibold text-foreground mt-1">
                Stakeholder-ready narrative for business decisions
              </p>
            </div>
            <div className="info-pill">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
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
            {[
              {
                title: "Generate Technical Report",
                testId: "generate-technical-report",
                desc: "Comprehensive per-firewall assessment covering rules, NAT, interfaces, hosts, policies, and security posture. Includes prioritised findings, NCSC-aligned recommendations, and remediation guidance.",
                icon: FileText,
                hex: "#2006F7",
                hexEnd: "#5A00FF",
                onClick: canGenerate ? onGenerateIndividual : undefined,
                disabled: !canGenerate,
                btnLabel: !canGenerate
                  ? isViewerOnly
                    ? "View only"
                    : "AI unavailable"
                  : fileCount === 1
                    ? "Generate Report"
                    : `Generate ${fileCount} Reports`,
                btnIcon: Sparkles,
                primary: true,
              },
              {
                title: "Generate Executive Brief",
                desc:
                  fileCount >= 1
                    ? "Estate summary with risk matrix, key findings, and strategic recommendations — designed for management and stakeholder reporting."
                    : "Upload a firewall export to unlock the executive brief.",
                icon: BarChart3,
                hex: "#5A00FF",
                hexEnd: "#B529F7",
                onClick: canGenerate && fileCount >= 1 ? onGenerateExecutive : undefined,
                disabled: fileCount < 1 || !canGenerate,
                btnLabel: !canGenerate
                  ? isViewerOnly
                    ? "View only"
                    : "AI unavailable"
                  : "Generate Executive Brief",
                btnIcon: BookOpen,
                primary: false,
              },
              {
                title: "Generate Executive One-Pager",
                testId: "generate-one-pager",
                desc: "Instant one-page summary with overall score, grade, top 5 risks, and 3 recommended next steps. No AI required — generated locally from your analysis.",
                icon: FileText,
                hex: "#B529F7",
                hexEnd: "#E040FB",
                onClick: canGenerate ? onGenerateExecutiveOnePager : undefined,
                disabled: !canGenerate,
                btnLabel: canGenerate ? "Generate One-Pager" : "View only",
                btnIcon: FileText,
                primary: false,
              },
              {
                title: "Generate Compliance Pack",
                desc: "Compliance readiness assessment mapping firewall controls to your selected frameworks. Includes control status, gap analysis, and remediation priorities. Results are indicative and should be validated by a qualified auditor.",
                icon: Scale,
                hex: "#009CFB",
                hexEnd: "#00EDFF",
                onClick: canGenerate ? onGenerateCompliance : undefined,
                disabled: !canGenerate,
                btnLabel: !canGenerate
                  ? isViewerOnly
                    ? "View only"
                    : "AI unavailable"
                  : "Generate Compliance Report",
                btnIcon: ClipboardCheck,
                primary: false,
              },
              {
                title: "Insurance readiness",
                desc: "Structured posture signals for cyber-insurance conversations — opens the Insurance Readiness tab. Use Export as PDF and your carrier questionnaire; full AI submission pack is not available yet.",
                icon: Shield,
                hex: "#EA0022",
                hexEnd: "#B91C1C",
                onClick:
                  canGenerate && onOpenInsuranceReadiness
                    ? () => onOpenInsuranceReadiness()
                    : undefined,
                disabled: !canGenerate || !onOpenInsuranceReadiness,
                btnLabel: !canGenerate
                  ? isViewerOnly
                    ? "View only"
                    : "Upload a config first"
                  : "Open Insurance Readiness",
                btnIcon: Shield,
                primary: false,
              },
            ].map((card) => {
              const Icon = card.icon;
              const BtnIcon = card.btnIcon;
              return (
                <div
                  key={card.title}
                  className={`relative overflow-hidden rounded-[24px] border border-slate-900/[0.10] dark:border-white/[0.06] shadow-card transition-all duration-200 flex flex-col ${
                    card.disabled
                      ? "opacity-50 pointer-events-none"
                      : "hover:scale-[1.02] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated cursor-pointer group"
                  }`}
                  style={{
                    background: `linear-gradient(90deg, ${card.hex}, ${card.hexEnd}) 0 0 / 100% 2px no-repeat, linear-gradient(145deg, ${card.hex}12, ${card.hex}04) 0 0 / 100% 100% no-repeat`,
                  }}
                  onClick={card.onClick}
                >
                  <div className="absolute inset-0 pointer-events-none">
                    <div
                      className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-[28px] opacity-20 transition-opacity duration-200 group-hover:opacity-35"
                      style={{ backgroundColor: card.hex }}
                    />
                  </div>
                  <div className="relative p-5 flex flex-col h-full">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border border-slate-900/[0.12] dark:border-white/[0.08] transition-transform duration-200 group-hover:scale-110"
                        style={{ backgroundColor: `${card.hex}18` }}
                      >
                        <Icon className="h-6 w-6" style={{ color: card.hex }} />
                      </div>
                      <span className="font-display font-black text-foreground text-[15px] tracking-tight">
                        {card.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed mt-3 flex-1">
                      {card.desc}
                    </p>
                    <Button
                      size="sm"
                      data-testid={(card as { testId?: string }).testId}
                      className="w-full gap-2 font-bold border-0 text-white transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] hover:brightness-110 mt-3"
                      style={{
                        background: `linear-gradient(135deg, ${card.hex}, ${card.hexEnd})`,
                      }}
                      disabled={card.disabled}
                    >
                      <BtnIcon className="h-3.5 w-3.5" />
                      {card.btnLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {canGenerate && (
            <div
              className="relative overflow-hidden rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-3 sm:p-4"
              style={{
                background: "linear-gradient(135deg, rgba(32,6,247,0.10), rgba(90,0,255,0.06))",
              }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-20 w-40 rounded-full blur-[40px] opacity-15 bg-[#2006F7]" />
              </div>
              <div
                className="absolute inset-x-0 top-0 h-px pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(32,6,247,0.25), transparent)",
                }}
              />
              <Button
                size="lg"
                data-testid="generate-all-reports"
                onClick={onGenerateAll}
                className="relative w-full gap-2 text-base font-bold bg-gradient-to-r from-[#2006F7] to-[#5A00FF] hover:from-[#10037C] hover:to-[#2006F7] text-white border-0 shadow-[0_6px_24px_rgba(32,6,247,0.3)] hover:shadow-[0_8px_32px_rgba(32,6,247,0.4)] transition-all duration-200"
              >
                <Sparkles
                  className="h-5 w-5"
                  style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.4))" }}
                />
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

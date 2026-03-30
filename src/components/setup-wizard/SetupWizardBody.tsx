import { useState, useMemo } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  Wifi,
  Upload,
  Sparkles,
  Check,
  X,
  RotateCcw,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Settings,
  Eye,
  Download,
  MousePointerClick,
  ChevronDown,
  Shield,
  BarChart3,
  History,
  Users,
  Activity,
  ExternalLink,
  Plug,
  Bell,
  Globe,
  Lock,
  Fingerprint,
  Mail,
  Webhook,
  BookOpen,
  UserPlus,
  ShieldCheck,
  Wrench,
  ListChecks,
  Compass,
  GitCompare,
  Calendar,
  Layers,
  Trash2,
  Scale,
  Zap,
  Map,
  Package,
  ClipboardList,
  Play,
  ArrowLeftRight,
  Target,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markSetupComplete } from "./setup-storage";
import { AGENT_STEP, BASE_STEPS, type Props } from "./wizard-types";
import { WelcomeStep } from "./steps/WelcomeStep";
import { BrandingStep } from "./steps/BrandingStep";
import { CentralSetupStep } from "./steps/CentralSetupStep";
import { ConnectorAgentStep } from "./steps/ConnectorAgentStep";
import { GuidePreAiStep } from "./steps/GuidePreAiStep";
import { GuideUploadStep } from "./steps/GuideUploadStep";
import { GuideAiReportsStep } from "./steps/GuideAiReportsStep";
import {
  SetupPreviewFrame,
  FeatureOverlay,
  FeatureButton,
  MockReportViewer,
  MockTenantDashboard,
  MockSavedReports,
  MockHistoryChart,
  MockSettingsPanel,
  MockTeamPanel,
  MockSecurityPanel,
  MockAlertPanel,
  MockClientPortalPanel,
  MockRuleOptimiser,
  MockPolicyComplexity,
  MockUnusedObjects,
  MockRemediationProgress,
  MockRemediationRoadmap,
  MockPlaybooks,
  MockScoreSimulator,
  MockAttackSurface,
  MockConfigCompare,
  MockScheduledReports,
  MockWebhookPanel,
} from "./wizard-ui";

export function SetupWizard({
  open,
  onClose,
  branding,
  onBrandingChange,
  orgName,
  isGuest,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const steps = useMemo(() => {
    if (isGuest) return BASE_STEPS;
    const s = [...BASE_STEPS];
    const centralIdx = s.findIndex((st) => st.id === "central");
    s.splice(centralIdx + 1, 0, AGENT_STEP);
    return s;
  }, [isGuest]);

  if (!open) return null;

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      markSetupComplete();
      onClose();
      return;
    }
    setActiveOverlay(null);
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveOverlay(null);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleSkip = () => {
    markSetupComplete();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-background rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header with progress */}
          <div className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img
                  src="/sophos-icon-white.svg"
                  alt="Sophos"
                  className="h-5 w-5 hidden dark:block"
                />
                <img
                  src="/sophos-icon-white.svg"
                  alt="Sophos"
                  className="h-5 w-5 dark:hidden brightness-0"
                />
                <span className="text-sm font-display font-bold text-foreground">
                  FireComply Setup
                </span>
              </div>
              <button
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
                title="Skip setup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
                <div key={s.id} className="flex-1 flex items-center gap-1">
                  <div
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      i < currentStep
                        ? "bg-[#00A878] dark:bg-[#00F2B3]"
                        : i === currentStep
                          ? "bg-[#2006F7]"
                          : "bg-muted"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-7 w-7 rounded-lg bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center">
                <step.icon className="h-3.5 w-3.5 text-brand-accent" />
              </div>
              <span className="text-xs font-semibold text-foreground">{step.title}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            {step.id === "welcome" && <WelcomeStep orgName={orgName} />}

            {step.id === "branding" && (
              <BrandingStep branding={branding} onBrandingChange={onBrandingChange} />
            )}

            {step.id === "central" && <CentralSetupStep />}

            {step.id === "connector-agent" && <ConnectorAgentStep />}

            {step.id === "guide-upload" && <GuideUploadStep />}

            {step.id === "guide-pre-ai" && (
              <GuidePreAiStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
            )}

            {step.id === "guide-ai-reports" && (
              <GuideAiReportsStep
                activeOverlay={activeOverlay}
                setActiveOverlay={setActiveOverlay}
              />
            )}

            {step.id === "guide-optimisation" && (
              <div className="space-y-5 relative">
                {activeOverlay === "rule-optimiser" && (
                  <FeatureOverlay
                    title="Rule Optimiser"
                    subtitle="Identify redundant, shadowed, and overlapping rules"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockRuleOptimiser />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> FireComply
                        analyses every rule against every other rule to find shadows (a broader rule
                        makes a narrower one unreachable), redundancies (identical match criteria),
                        and consolidation opportunities (adjacent rules that can merge).
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "policy-complexity" && (
                  <FeatureOverlay
                    title="Policy Complexity"
                    subtitle="Measure and reduce policy complexity"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockPolicyComplexity />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Analyses rule
                        count, average conditions per rule, object group nesting depth, and
                        zone-pair distribution to produce a complexity score. Lower complexity means
                        easier auditing and fewer misconfigurations.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "unused-objects" && (
                  <FeatureOverlay
                    title="Unused Objects"
                    subtitle="Find orphaned hosts, services, and groups"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockUnusedObjects />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Scans all network
                        objects, service definitions, and groups in the config and cross-references
                        them against every rule. Objects not referenced by any active rule are
                        flagged for cleanup.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "consistency-checker" && (
                  <FeatureOverlay
                    title="Consistency Checker"
                    subtitle="Cross-firewall rule consistency analysis"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded border border-border/50 bg-card p-2">
                          <p className="text-lg font-bold text-[#00F2B3]">87%</p>
                          <p className="text-[8px] text-muted-foreground">Consistency Score</p>
                        </div>
                        <div className="rounded border border-border/50 bg-card p-2">
                          <p className="text-lg font-bold text-[#F29400]">4</p>
                          <p className="text-[8px] text-muted-foreground">Inconsistencies</p>
                        </div>
                      </div>
                      {[
                        {
                          rule: "IPS Policy",
                          fw1: "GeneralPolicy",
                          fw2: "None",
                          status: "mismatch",
                        },
                        { rule: "Web Filtering", fw1: "Enabled", fw2: "Enabled", status: "match" },
                        {
                          rule: "Admin HTTPS",
                          fw1: "Disabled",
                          fw2: "Enabled",
                          status: "mismatch",
                        },
                        { rule: "SSL Inspection", fw1: "38%", fw2: "42%", status: "match" },
                      ].map((r) => (
                        <div
                          key={r.rule}
                          className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-2.5 text-[9px]"
                        >
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${r.status === "match" ? "bg-[#00F2B3]" : "bg-[#EA0022]"}`}
                          />
                          <span className="font-medium text-foreground flex-1">{r.rule}</span>
                          <span className="text-muted-foreground">FW1: {r.fw1}</span>
                          <span className="text-muted-foreground">FW2: {r.fw2}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> When multiple
                        firewall configs are loaded, FireComply compares security feature settings,
                        rule structures, and policy configurations across devices to identify
                        inconsistencies that could indicate gaps in your security posture.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Optimisation
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    FireComply analyses your firewall rules for{" "}
                    <strong className="text-foreground">redundancy, complexity, and hygiene</strong>{" "}
                    — helping you clean up and streamline your policy. Click each to preview.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton
                    icon={<Wrench className="h-4 w-4" />}
                    title="Rule Optimiser"
                    desc="Identifies redundant, shadowed, and overlapping rules that can be consolidated"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("rule-optimiser")}
                  />
                  <FeatureButton
                    icon={<Layers className="h-4 w-4" />}
                    title="Policy Complexity"
                    desc="Measures rule complexity and suggests simplification opportunities"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("policy-complexity")}
                  />
                  <FeatureButton
                    icon={<Trash2 className="h-4 w-4" />}
                    title="Unused Objects"
                    desc="Finds hosts, services, and groups no longer referenced by any rule"
                    color="text-[#F29400]"
                    onClick={() => setActiveOverlay("unused-objects")}
                  />
                  <FeatureButton
                    icon={<Scale className="h-4 w-4" />}
                    title="Consistency Checker"
                    desc="Cross-firewall rule consistency analysis when multiple configs are loaded"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("consistency-checker")}
                  />
                </div>

                <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> The Optimisation tab appears
                    automatically after uploading a config. Upload multiple configs to enable
                    cross-firewall consistency checking.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-remediation" && (
              <div className="space-y-5 relative">
                {activeOverlay === "remediation-progress" && (
                  <FeatureOverlay
                    title="Remediation Progress"
                    subtitle="Track fix progress across all findings"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockRemediationProgress />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Track remediation
                        status for every finding — mark items as fixed, in progress, or accepted
                        risk. Progress bars show completion by severity so you can focus on what
                        matters most.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "remediation-roadmap" && (
                  <FeatureOverlay
                    title="Remediation Roadmap"
                    subtitle="Prioritised timeline with effort estimates"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockRemediationRoadmap />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Generates a
                        prioritised remediation timeline based on finding severity and estimated
                        effort. Critical issues first, then high, then medium — with suggested
                        timelines for each phase.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "playbooks" && (
                  <FeatureOverlay
                    title="Remediation Playbooks"
                    subtitle="Step-by-step guides for each finding"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockPlaybooks />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Each finding has
                        a step-by-step playbook with exact navigation paths, CLI commands, and
                        verification steps for the Sophos Firewall admin console. Follow along to
                        fix issues quickly and correctly.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Remediation
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Plan, prioritise, and track the work needed to{" "}
                    <strong className="text-foreground">fix security findings</strong> — from
                    individual playbooks to full remediation roadmaps. Click each to preview.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton
                    icon={<TrendingUp className="h-4 w-4" />}
                    title="Progress Tracking"
                    desc="Track fix progress across all findings with completion metrics by severity"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("remediation-progress")}
                  />
                  <FeatureButton
                    icon={<Map className="h-4 w-4" />}
                    title="Remediation Roadmap"
                    desc="Prioritised timeline of recommended fixes with effort estimates"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("remediation-roadmap")}
                  />
                  <FeatureButton
                    icon={<ClipboardList className="h-4 w-4" />}
                    title="Playbooks"
                    desc="Step-by-step remediation guides with exact navigation paths and commands"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("playbooks")}
                  />
                </div>

                <div className="rounded-lg bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 border border-[#00F2B3]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> The Remediation tab appears
                    when findings are detected. Use it to demonstrate ongoing security improvements
                    to your customers.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-tools" && (
              <div className="space-y-5 relative">
                {activeOverlay === "score-simulator" && (
                  <FeatureOverlay
                    title="Remediation Impact Simulator"
                    subtitle="See the projected impact of recommended security actions"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockScoreSimulator />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Select
                        recommended remediation actions and instantly see how your risk score,
                        grade, and security coverage would improve. Great for prioritising
                        remediation work and demonstrating ROI to customers.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "attack-surface" && (
                  <FeatureOverlay
                    title="Attack Surface Map"
                    subtitle="Visualise internet-facing services and exposed ports"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockAttackSurface />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Analyses firewall
                        rules to identify every service accessible from external zones. Maps exposed
                        ports, protocols, and admin interfaces to highlight your internet-facing
                        attack surface.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "export-centre" && (
                  <FeatureOverlay
                    title="Export Centre"
                    subtitle="Export reports, risk registers, and evidence"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="space-y-2">
                      {[
                        {
                          format: "PDF",
                          desc: "Branded report ready for client delivery",
                          icon: <FileText className="h-3.5 w-3.5 text-[#EA0022]" />,
                          types: "Individual, Executive, Compliance",
                        },
                        {
                          format: "Word (DOCX)",
                          desc: "Editable document for custom modifications",
                          icon: <FileText className="h-3.5 w-3.5 text-[#2006F7]" />,
                          types: "Individual, Executive, Compliance",
                        },
                        {
                          format: "PowerPoint (PPTX)",
                          desc: "Presentation-ready slides with charts",
                          icon: <FileText className="h-3.5 w-3.5 text-[#F29400]" />,
                          types: "Executive Summary",
                        },
                        {
                          format: "CSV / Excel",
                          desc: "Raw data for analysis and risk registers",
                          icon: <FileText className="h-3.5 w-3.5 text-[#00F2B3]" />,
                          types: "Findings, Risk Register, Evidence",
                        },
                        {
                          format: "ZIP Bundle",
                          desc: "All reports and evidence in a single download",
                          icon: <Package className="h-3.5 w-3.5 text-[#6B5BFF]" />,
                          types: "Full assessment package",
                        },
                      ].map((f) => (
                        <div
                          key={f.format}
                          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
                        >
                          <div className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                            {f.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-foreground">{f.format}</p>
                            <p className="text-[9px] text-muted-foreground">{f.desc}</p>
                            <p className="text-[8px] text-muted-foreground/60 mt-0.5">{f.types}</p>
                          </div>
                          <Download className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> The Export Centre
                        provides one-click downloads in multiple formats. Generate branded PDFs for
                        clients, editable Word docs for customisation, PowerPoint decks for
                        presentations, and CSV exports for data analysis — or download everything as
                        a ZIP bundle.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "config-compare" && (
                  <FeatureOverlay
                    title="Config Compare"
                    subtitle="Side-by-side diff between firewall configurations"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockConfigCompare />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Upload two
                        configs (e.g. before and after remediation) and FireComply shows a detailed
                        diff — changed rules, score impact, and whether findings were resolved. Also
                        available in the Compare tab.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Tools & Compare
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Power tools for deeper analysis —{" "}
                    <strong className="text-foreground">simulate scores</strong>,{" "}
                    <strong className="text-foreground">map your attack surface</strong>,{" "}
                    <strong className="text-foreground">compare configs</strong>, and{" "}
                    <strong className="text-foreground">export everything</strong>. Click each to
                    preview.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton
                    icon={<Zap className="h-4 w-4" />}
                    title="Remediation Simulator"
                    desc="See projected risk reduction from recommended actions"
                    color="text-[#F29400]"
                    onClick={() => setActiveOverlay("score-simulator")}
                  />
                  <FeatureButton
                    icon={<Target className="h-4 w-4" />}
                    title="Attack Surface"
                    desc="Map internet-facing services, ports, and access paths"
                    color="text-[#EA0022]"
                    onClick={() => setActiveOverlay("attack-surface")}
                  />
                  <FeatureButton
                    icon={<GitCompare className="h-4 w-4" />}
                    title="Config Compare"
                    desc="Side-by-side diff between before and after configs"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("config-compare")}
                  />
                  <FeatureButton
                    icon={<Package className="h-4 w-4" />}
                    title="Export Centre"
                    desc="Export reports, risk registers, and evidence in PDF, Word, PPTX"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("export-centre")}
                  />
                </div>

                <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> Upload two configs to enable
                    the Compare tab. The Remediation Impact Simulator and Attack Surface Map are in
                    the Tools tab after uploading any config.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-management" && (
              <div className="space-y-5 relative">
                {activeOverlay === "mgmt-dashboard" && (
                  <FeatureOverlay
                    title="Multi-Tenant Dashboard"
                    subtitle="Overview of all customer assessments"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockTenantDashboard />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you see:</strong> Every customer's
                        latest risk score, grade, firewall count, and score trend at a glance.
                        Includes licence expiry warnings for your managed estate.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-reports" && (
                  <FeatureOverlay
                    title="Saved Reports"
                    subtitle="Browse and reload previously saved reports"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockSavedReports />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you see:</strong> A searchable
                        library of every report your team has saved. Filter by customer, report
                        type, or date. Click any row to reload the full report in the viewer.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-history" && (
                  <FeatureOverlay
                    title="Assessment History"
                    subtitle="Track scores over time per customer"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockHistoryChart />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you see:</strong> A trend line of
                        risk scores for each customer over time. Demonstrate security improvements
                        and track the impact of your remediation work.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mgmt-settings" && (
                  <FeatureOverlay
                    title="Settings"
                    subtitle="Central API, security, team, alerts, and more"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockSettingsPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">What you see:</strong> Manage your
                        Sophos Central API, connector agents, team members and roles, client portal
                        branding, MFA and passkeys, alert rules, custom compliance frameworks, and
                        audit log — all in one place.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    The Management Panel
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Click your <strong className="text-foreground">organisation name</strong> in the
                    top navbar to open it. Click each tab below to preview.
                  </p>
                </div>

                {/* Visual representation of the navbar button */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-[#001A47] px-4 py-2.5 flex items-center gap-3">
                    <img
                      src="/sophos-icon-white.svg"
                      alt=""
                      className="h-5 w-5"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="text-[11px] font-bold text-white flex-1">
                      Sophos FireComply
                    </span>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 border border-white/20">
                      <Building2 className="h-3 w-3 text-white/70" />
                      <span className="text-[10px] font-medium text-white">
                        {orgName || "Your Org"}
                      </span>
                      <ChevronDown className="h-2.5 w-2.5 text-white/70" />
                    </div>
                    <MousePointerClick className="h-4 w-4 text-[#00EDFF] animate-pulse" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton
                    icon={<LayoutDashboard className="h-4 w-4" />}
                    title="Dashboard"
                    desc="Multi-tenant overview of all customer scores and licence expiry"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("mgmt-dashboard")}
                  />
                  <FeatureButton
                    icon={<FileText className="h-4 w-4" />}
                    title="Reports"
                    desc="Browse and reload all previously saved reports"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("mgmt-reports")}
                  />
                  <FeatureButton
                    icon={<History className="h-4 w-4" />}
                    title="History"
                    desc="Track assessment scores over time per customer"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("mgmt-history")}
                  />
                  <FeatureButton
                    icon={<Settings className="h-4 w-4" />}
                    title="Settings"
                    desc="Central API, team management, activity log, and re-run setup"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("mgmt-settings")}
                  />
                </div>
              </div>
            )}

            {step.id === "guide-team-security" && (
              <div className="space-y-5 relative">
                {activeOverlay === "team-mgmt" && (
                  <FeatureOverlay
                    title="Team Management"
                    subtitle="Invite colleagues and assign roles"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockTeamPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Invite team
                        members by email, assign them roles (Owner, Engineer, or Viewer), and
                        collaborate on assessments. Each role has different permissions — Engineers
                        can run assessments and generate reports, while Viewers have read-only
                        access.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "mfa" && (
                  <FeatureOverlay
                    title="Multi-Factor Authentication"
                    subtitle="TOTP-based authenticator app"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="space-y-4">
                      <MockSecurityPanel />
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-foreground">Setup Process</p>
                        <div className="space-y-1.5">
                          {[
                            {
                              step: "1",
                              text: "Open Settings \u203a Security and click 'Enable MFA'",
                            },
                            {
                              step: "2",
                              text: "Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)",
                            },
                            { step: "3", text: "Enter the 6-digit code to verify and activate" },
                          ].map((s) => (
                            <div key={s.step} className="flex items-start gap-2 text-[9px]">
                              <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#00F2B3] text-white text-[8px] font-bold shrink-0 mt-0.5">
                                {s.step}
                              </span>
                              <span className="text-muted-foreground">{s.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">Why MFA?</strong> Multi-factor
                        authentication adds a critical second layer of protection to your account.
                        Even if your password is compromised, your account stays secure.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "passkeys" && (
                  <FeatureOverlay
                    title="Passkeys"
                    subtitle="Passwordless sign-in with biometrics"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-3 py-4">
                        <div className="h-14 w-14 rounded-2xl bg-[#6B5BFF]/10 flex items-center justify-center">
                          <Fingerprint className="h-7 w-7 text-[#6B5BFF]" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-semibold text-foreground">
                            Passwordless Authentication
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Sign in with Face ID, Touch ID, Windows Hello, or a hardware security
                            key
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card p-3">
                        <p className="text-[10px] font-semibold text-foreground mb-2">
                          Registered Passkeys
                        </p>
                        <div className="flex items-center gap-3 rounded bg-muted/20 p-2.5">
                          <Fingerprint className="h-4 w-4 text-[#6B5BFF]" />
                          <div className="flex-1">
                            <p className="text-[10px] font-medium text-foreground">
                              MacBook Pro Touch ID
                            </p>
                            <p className="text-[9px] text-muted-foreground">Added 12 Mar 2026</p>
                          </div>
                          <span className="text-[9px] text-[#00F2B3] font-medium">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Passkeys use your
                        device's built-in biometric or hardware security to authenticate. They're
                        phishing-resistant and more secure than traditional passwords. Register one
                        in Settings &gt; Security.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Team & Security
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Invite your team and secure your workspace with{" "}
                    <strong className="text-foreground">multi-factor authentication</strong> and{" "}
                    <strong className="text-foreground">passkeys</strong>. Click each to learn more.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <FeatureButton
                    icon={<UserPlus className="h-4 w-4" />}
                    title="Team Management"
                    desc="Invite colleagues by email and assign Owner, Engineer, or Viewer roles"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("team-mgmt")}
                  />
                  <FeatureButton
                    icon={<Lock className="h-4 w-4" />}
                    title="Multi-Factor Authentication"
                    desc="Add TOTP-based verification via authenticator app for all logins"
                    color="text-[#00F2B3]"
                    onClick={() => setActiveOverlay("mfa")}
                  />
                  <FeatureButton
                    icon={<Fingerprint className="h-4 w-4" />}
                    title="Passkeys"
                    desc="Passwordless sign-in with Face ID, Touch ID, or hardware security keys"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("passkeys")}
                  />
                </div>

                <div className="rounded-lg bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 border border-[#00F2B3]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Recommendation:</strong> Enable MFA or
                    register a passkey for your account as soon as possible. You can set these up in
                    Settings &gt; Security.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-portal-alerts" && (
              <div className="space-y-5 relative">
                {activeOverlay === "client-portal" && (
                  <FeatureOverlay
                    title="Client Portal"
                    subtitle="Branded assessment portal for your customers"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockClientPortalPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Create branded,
                        read-only portals for your customers. Each client gets their own secure view
                        showing risk scores, reports, compliance status, and assessment history —
                        with your MSP branding and logo.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "alerts" && (
                  <FeatureOverlay
                    title="Alerts & Notifications"
                    subtitle="Email and webhook notifications"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockAlertPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Configure alert
                        rules to get notified when critical events happen — new critical findings,
                        agents going offline, configuration drift, or licence expiry. Send alerts
                        via email, webhook (Slack, Teams, etc.), or both.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "scheduled-reports" && (
                  <FeatureOverlay
                    title="Scheduled Reports"
                    subtitle="Automated report delivery to customers"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockScheduledReports />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Schedule
                        automatic report delivery — compliance, executive, or full suite — on a
                        weekly, monthly, or quarterly basis. Reports are generated and emailed
                        directly to your customers with your MSP branding.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}
                {activeOverlay === "webhooks" && (
                  <FeatureOverlay
                    title="Webhook Integrations"
                    subtitle="POST data to your PSA, RMM, or ticketing system"
                    onClose={() => setActiveOverlay(null)}
                  >
                    <MockWebhookPanel />
                    <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
                      <p className="text-[10px] text-muted-foreground">
                        <strong className="text-foreground">How it works:</strong> Configure webhook
                        endpoints to receive JSON payloads when key events happen — assessments
                        complete, critical findings detected, reports saved, or agents go offline.
                        Integrate with Slack, Teams, ConnectWise, Datto, or any system that accepts
                        webhooks.
                      </p>
                    </div>
                  </FeatureOverlay>
                )}

                <div className="space-y-1">
                  <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                    Portal, Alerts & Integrations
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Share results with customers through{" "}
                    <strong className="text-foreground">branded portals</strong>, automate{" "}
                    <strong className="text-foreground">scheduled reports</strong>, stay informed
                    with <strong className="text-foreground">real-time alerts</strong>, and connect
                    to your <strong className="text-foreground">existing tools via webhooks</strong>
                    . Click each to learn more.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <FeatureButton
                    icon={<Globe className="h-4 w-4" />}
                    title="Client Portal"
                    desc="Branded read-only portal for customers with scores and reports"
                    color="text-[#005BC8]"
                    onClick={() => setActiveOverlay("client-portal")}
                  />
                  <FeatureButton
                    icon={<Bell className="h-4 w-4" />}
                    title="Alerts"
                    desc="Email and webhook alerts for critical findings and drift"
                    color="text-[#F29400]"
                    onClick={() => setActiveOverlay("alerts")}
                  />
                  <FeatureButton
                    icon={<Calendar className="h-4 w-4" />}
                    title="Scheduled Reports"
                    desc="Auto-email compliance reports on a weekly, monthly, or quarterly basis"
                    color="text-[#2006F7]"
                    onClick={() => setActiveOverlay("scheduled-reports")}
                  />
                  <FeatureButton
                    icon={<Webhook className="h-4 w-4" />}
                    title="Webhooks"
                    desc="POST assessment data to your PSA, RMM, or ticketing system"
                    color="text-[#6B5BFF]"
                    onClick={() => setActiveOverlay("webhooks")}
                  />
                </div>

                <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> Configure all of these from
                    Settings. Client portals and scheduled reports are especially useful for MSPs
                    who want to give customers ongoing visibility into their security posture.
                  </p>
                </div>
              </div>
            )}

            {step.id === "done" && (
              <div className="text-center space-y-5 py-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#00F2B3] to-[#00F2B3] flex items-center justify-center mx-auto shadow-lg shadow-[#00F2B3]/20">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-foreground">
                    You're All Set!
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Your workspace is ready. Upload a Sophos XGS firewall config export to start
                    your first security assessment.
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-card p-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-foreground">What's next?</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        <strong className="text-foreground">Upload</strong> a firewall HTML config
                        export
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        <strong className="text-foreground">Review</strong> the automated security
                        assessment
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        <strong className="text-foreground">Generate</strong> AI-powered reports for
                        your customer
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-card flex items-center gap-3 shrink-0">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3 w-3" />
                Back
              </Button>
            )}
            {isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-xs text-muted-foreground"
              >
                Skip setup
              </Button>
            )}
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1.5 text-xs bg-[#2006F7] hover:bg-[#10037C] text-white"
            >
              {isLast ? "Start Using FireComply" : "Continue"}
              {!isLast && <ArrowRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function RerunSetupButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl border border-border/50 bg-card shadow-card hover:bg-muted/20 transition-colors text-left group"
    >
      <div className="h-9 w-9 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0 group-hover:bg-brand-accent/15 dark:group-hover:bg-[#00EDFF]/15 transition-colors">
        <RotateCcw className="h-4.5 w-4.5 text-brand-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-display font-semibold tracking-tight text-foreground">
          Re-run First-Time Setup
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          Walk through the setup wizard again to update branding and connections
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}

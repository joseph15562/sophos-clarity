import { useState, lazy, Suspense } from "react";
import {
  ArrowRight, ArrowLeft, Building2, Wifi, Upload, Sparkles, Check, X, RotateCcw,
  FileText, LayoutDashboard, Settings, Eye, Save, Download, MousePointerClick,
  ChevronDown, Shield, BarChart3, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrandingData } from "@/components/BrandingSetup";

const CentralIntegration = lazy(() => import("@/components/CentralIntegration").then((m) => ({ default: m.CentralIntegration })));

const SETUP_KEY = "sophos-firecomply-setup-complete";

export function isSetupComplete(): boolean {
  try {
    return localStorage.getItem(SETUP_KEY) === "true";
  } catch {
    return false;
  }
}

export function markSetupComplete(): void {
  try {
    localStorage.setItem(SETUP_KEY, "true");
  } catch { /* ignore */ }
}

export function resetSetupFlag(): void {
  try {
    localStorage.removeItem(SETUP_KEY);
  } catch { /* ignore */ }
}

interface Props {
  open: boolean;
  onClose: () => void;
  branding: BrandingData;
  onBrandingChange: (b: BrandingData) => void;
  orgName?: string;
}

type StepId = "welcome" | "branding" | "central" | "guide-upload" | "guide-pre-ai" | "guide-ai-reports" | "guide-management" | "done";

interface Step {
  id: StepId;
  title: string;
  icon: typeof Building2;
}

const STEPS: Step[] = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "branding", title: "Branding", icon: Building2 },
  { id: "central", title: "Sophos Central", icon: Wifi },
  { id: "guide-upload", title: "Uploading Configs", icon: Upload },
  { id: "guide-pre-ai", title: "Pre-AI Assessment", icon: Shield },
  { id: "guide-ai-reports", title: "AI Reports", icon: Sparkles },
  { id: "guide-management", title: "Management", icon: LayoutDashboard },
  { id: "done", title: "Ready", icon: Check },
];

function GuideStep({ number, title, description, icon, color }: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#2006F7] text-white text-[9px] font-bold">{number}</span>
        <div className={`h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/20 p-2.5">
      <div className={`shrink-0 mt-0.5 ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-semibold text-foreground">{title}</p>
        <p className="text-[9px] text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-muted/40 rounded w-3/4" />
      <div className="h-4 bg-muted/40 rounded w-1/2" />
      <div className="h-32 bg-muted/40 rounded" />
    </div>
  );
}

export function SetupWizard({ open, onClose, branding, onBrandingChange, orgName }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!open) return null;

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      markSetupComplete();
      onClose();
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const handleSkip = () => {
    markSetupComplete();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-background rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header with progress */}
          <div className="px-6 pt-5 pb-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src="/sophos-icon-white.svg" alt="Sophos" className="h-5 w-5 hidden dark:block" />
                <img src="/sophos-icon-white.svg" alt="Sophos" className="h-5 w-5 dark:hidden brightness-0" />
                <span className="text-sm font-display font-bold text-foreground">FireComply Setup</span>
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
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex-1 flex items-center gap-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < currentStep ? "bg-[#00995a] dark:bg-[#00F2B3]" :
                    i === currentStep ? "bg-[#2006F7]" :
                    "bg-muted"
                  }`} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="h-7 w-7 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center">
                <step.icon className="h-3.5 w-3.5 text-[#2006F7] dark:text-[#00EDFF]" />
              </div>
              <span className="text-xs font-semibold text-foreground">{step.title}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Step {currentStep + 1} of {STEPS.length}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step.id === "welcome" && (
              <div className="text-center space-y-5 py-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2006F7] to-[#00EDFF] flex items-center justify-center mx-auto shadow-lg shadow-[#2006F7]/20">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-foreground">
                    Welcome to Sophos FireComply{orgName ? `, ${orgName}` : ""}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Let's get your workspace set up. This takes about 2 minutes and you can always change these settings later.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded-lg border border-border bg-card p-3 text-center">
                    <Building2 className="h-5 w-5 mx-auto text-[#2006F7] dark:text-[#6B5BFF] mb-1.5" />
                    <p className="text-[10px] font-medium text-foreground">Company Branding</p>
                    <p className="text-[9px] text-muted-foreground">Logo & report details</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 text-center">
                    <Wifi className="h-5 w-5 mx-auto text-[#005BC8] dark:text-[#00EDFF] mb-1.5" />
                    <p className="text-[10px] font-medium text-foreground">Sophos Central</p>
                    <p className="text-[9px] text-muted-foreground">Live firewall data</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 text-center">
                    <Upload className="h-5 w-5 mx-auto text-[#00995a] dark:text-[#00F2B3] mb-1.5" />
                    <p className="text-[10px] font-medium text-foreground">Upload & Assess</p>
                    <p className="text-[9px] text-muted-foreground">Start auditing</p>
                  </div>
                </div>
              </div>
            )}

            {step.id === "branding" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Company Branding</h3>
                  <p className="text-[11px] text-muted-foreground">
                    This information appears on all your reports and assessments. You can change it anytime.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="setup-company" className="text-xs">Company / MSP Name</Label>
                    <Input
                      id="setup-company"
                      placeholder="e.g. Acme IT Solutions"
                      value={branding.companyName}
                      onChange={(e) => onBrandingChange({ ...branding, companyName: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="setup-prepared" className="text-xs">Prepared By</Label>
                      <Input
                        id="setup-prepared"
                        placeholder="e.g. Joseph McDonald"
                        value={branding.preparedBy ?? ""}
                        onChange={(e) => onBrandingChange({ ...branding, preparedBy: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setup-footer" className="text-xs">Report Footer</Label>
                      <Input
                        id="setup-footer"
                        placeholder="e.g. Confidential"
                        value={branding.footerText ?? ""}
                        onChange={(e) => onBrandingChange({ ...branding, footerText: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border p-3">
                    <p className="text-[10px] text-muted-foreground">
                      <strong className="text-foreground">Tip:</strong> You can add a logo and set customer-specific details later in the Assessment Context section.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step.id === "central" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Connect Sophos Central</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Link your Sophos Central Partner or Tenant account to enrich reports with live firewall data, licence info, and alerts. You can skip this and connect later.
                  </p>
                </div>
                <Suspense fallback={<Skeleton />}>
                  <CentralIntegration />
                </Suspense>
              </div>
            )}

            {step.id === "guide-upload" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">How to Upload & Assess</h3>
                  <p className="text-[11px] text-muted-foreground">
                    FireComply analyses Sophos XGS HTML configuration exports. Here's the workflow:
                  </p>
                </div>

                <div className="space-y-3">
                  <GuideStep
                    number={1}
                    title="Export your firewall config"
                    description="In Sophos Firewall, go to Backup & firmware > Import/Export and export as HTML."
                    icon={<Download className="h-4 w-4" />}
                    color="text-[#2006F7]"
                  />
                  <GuideStep
                    number={2}
                    title="Drag & drop the file"
                    description="Drop one or more HTML files into the upload area on the main page. Multi-firewall assessments are supported."
                    icon={<Upload className="h-4 w-4" />}
                    color="text-[#005BC8]"
                  />
                  <GuideStep
                    number={3}
                    title="Instant analysis"
                    description="FireComply automatically parses the config and shows findings, risk scores, compliance mapping, and best practice checks."
                    icon={<Shield className="h-4 w-4" />}
                    color="text-[#00995a]"
                  />
                  <GuideStep
                    number={4}
                    title="Link to Sophos Central"
                    description='If connected, click "Link Firewall" to match each config to its Central firewall for live data enrichment.'
                    icon={<Wifi className="h-4 w-4" />}
                    color="text-[#00EDFF]"
                  />
                </div>

                <div className="rounded-lg bg-[#2006F7]/5 border border-[#2006F7]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Tip:</strong> Set the customer name and compliance frameworks in the <strong className="text-foreground">Assessment Context</strong> section before generating reports — this tailors the AI analysis.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-pre-ai" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Pre-AI Assessment (Instant)</h3>
                  <p className="text-[11px] text-muted-foreground">
                    As soon as you upload a config, FireComply runs a <strong className="text-foreground">deterministic analysis</strong> — no AI needed. This is instant and always consistent.
                  </p>
                </div>

                {/* Visual flow diagram */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="bg-muted/30 px-3 py-2 border-b border-border">
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">What you get instantly</span>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2">
                    <FeatureCard icon={<Shield className="h-4 w-4" />} title="Risk Score & Grade" desc="A-F rating based on weighted security checks" color="text-[#00995a]" />
                    <FeatureCard icon={<BarChart3 className="h-4 w-4" />} title="Findings & Severity" desc="Critical, high, medium, low categorised issues" color="text-[#EA0022]" />
                    <FeatureCard icon={<Eye className="h-4 w-4" />} title="Inspection Posture" desc="IPS, web filter, app control, SSL/TLS coverage" color="text-[#2006F7]" />
                    <FeatureCard icon={<FileText className="h-4 w-4" />} title="Compliance Mapping" desc="ISO 27001, NIST, PCI DSS, Cyber Essentials" color="text-[#6B5BFF]" />
                  </div>
                </div>

                <div className="space-y-3">
                  <GuideStep
                    number={1}
                    title="Automatic on upload"
                    description="The Pre-AI assessment runs as soon as you drop a config file — no buttons to click. Findings, risk score, and dashboards populate immediately."
                    icon={<Upload className="h-4 w-4" />}
                    color="text-[#2006F7]"
                  />
                  <GuideStep
                    number={2}
                    title="Best Practice scoring"
                    description="The Sophos Best Practice Score checks 25+ items based on official Sophos documentation. Your licence tier is auto-detected from Central."
                    icon={<Shield className="h-4 w-4" />}
                    color="text-[#00995a]"
                  />
                  <GuideStep
                    number={3}
                    title='Save Pre-AI assessment'
                    description={'Click "Save Assessment (Pre-AI)" to save the deterministic scores before generating AI reports. This populates the multi-tenant dashboard and assessment history.'}
                    icon={<Save className="h-4 w-4" />}
                    color="text-[#005BC8]"
                  />
                </div>

                <div className="rounded-lg bg-[#00995a]/5 border border-[#00995a]/15 p-3">
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Why Pre-AI?</strong> The deterministic analysis is repeatable and consistent — same config always gives the same score. It's the baseline before AI adds narrative reporting.
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-ai-reports" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">AI-Powered Reports</h3>
                  <p className="text-[11px] text-muted-foreground">
                    After the Pre-AI assessment, generate <strong className="text-foreground">AI narrative reports</strong> for your customers — professional documents enriched with Central data.
                  </p>
                </div>

                {/* Report type cards */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="bg-muted/30 px-3 py-2 border-b border-border">
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Report types</span>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="px-3 py-2.5 flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-[#2006F7]/10 flex items-center justify-center shrink-0">
                        <FileText className="h-3.5 w-3.5 text-[#2006F7]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground">Individual Firewall</p>
                        <p className="text-[9px] text-muted-foreground">Deep-dive analysis per firewall with finding-level detail</p>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-[#6B5BFF]/10 flex items-center justify-center shrink-0">
                        <BarChart3 className="h-3.5 w-3.5 text-[#6B5BFF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground">Executive Summary</p>
                        <p className="text-[9px] text-muted-foreground">High-level overview for management with key metrics and recommendations</p>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-[#005BC8]/10 flex items-center justify-center shrink-0">
                        <Shield className="h-3.5 w-3.5 text-[#005BC8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground">Compliance Report</p>
                        <p className="text-[9px] text-muted-foreground">Maps findings against your selected compliance frameworks</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <GuideStep
                    number={1}
                    title="Click a report card or Generate All"
                    description='Select which report to generate from the report cards section, or hit "Generate All Reports" to create everything in one go.'
                    icon={<Sparkles className="h-4 w-4" />}
                    color="text-[#2006F7]"
                  />
                  <GuideStep
                    number={2}
                    title="AI enriches with Central data"
                    description="If your firewall is linked to Central, the AI receives live firmware, licence, alert, and HA data to make reports more accurate."
                    icon={<Wifi className="h-4 w-4" />}
                    color="text-[#005BC8]"
                  />
                  <GuideStep
                    number={3}
                    title="Review in the built-in viewer"
                    description="Reports open in a tabbed viewer with live markdown rendering. Switch between reports using tabs or number keys 1-9."
                    icon={<Eye className="h-4 w-4" />}
                    color="text-[#6B5BFF]"
                  />
                  <GuideStep
                    number={4}
                    title="Export & save"
                    description="Export to branded PDF, Word (.docx), PowerPoint (.pptx), or download all as a ZIP. Save to the cloud for your team."
                    icon={<Download className="h-4 w-4" />}
                    color="text-[#00995a]"
                  />
                </div>

                <div className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-[#2006F7] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Keyboard shortcuts:</strong>{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">Ctrl+G</kbd> generate all,{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">Ctrl+S</kbd> save,{" "}
                    <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">1-9</kbd> switch tabs
                  </p>
                </div>
              </div>
            )}

            {step.id === "guide-management" && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">The Management Panel</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Click your <strong className="text-foreground">organisation name</strong> in the top navbar to open the Management panel — your central hub for everything.
                  </p>
                </div>

                {/* Visual representation of the navbar button */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-[#001A47] px-4 py-2.5 flex items-center gap-3">
                    <img src="/sophos-icon-white.svg" alt="" className="h-5 w-5" />
                    <span className="text-[11px] font-bold text-white flex-1">Sophos FireComply</span>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 border border-white/20">
                      <Building2 className="h-3 w-3 text-white/70" />
                      <span className="text-[10px] font-medium text-white">{orgName || "Your Org"}</span>
                      <ChevronDown className="h-2.5 w-2.5 text-white/70" />
                    </div>
                    <MousePointerClick className="h-4 w-4 text-[#00EDFF] animate-pulse" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <LayoutDashboard className="h-3.5 w-3.5 text-[#2006F7]" />
                      <span className="text-[10px] font-semibold text-foreground">Dashboard</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      Multi-tenant overview of all customer assessments and licence expiry across your estate.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-[#2006F7]" />
                      <span className="text-[10px] font-semibold text-foreground">Reports</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      Browse and reload all previously saved reports. Filter by customer, type, or date.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-[#2006F7]" />
                      <span className="text-[10px] font-semibold text-foreground">History</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      Track assessment scores over time per customer to demonstrate security improvements.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5 text-[#2006F7]" />
                      <span className="text-[10px] font-semibold text-foreground">Settings</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      Sophos Central API config, team management, activity audit log, and re-run this setup.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step.id === "done" && (
              <div className="text-center space-y-5 py-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#00995a] to-[#00F2B3] flex items-center justify-center mx-auto shadow-lg shadow-[#00995a]/20">
                  <Check className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-foreground">You're All Set!</h2>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Your workspace is ready. Upload a Sophos XGS firewall config export to start your first security assessment.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-foreground">What's next?</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">1</span>
                      <span><strong className="text-foreground">Upload</strong> a firewall HTML config export</span>
                    </li>
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">2</span>
                      <span><strong className="text-foreground">Review</strong> the automated security assessment</span>
                    </li>
                    <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">3</span>
                      <span><strong className="text-foreground">Generate</strong> AI-powered reports for your customer</span>
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
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-xs text-muted-foreground">
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
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-left"
    >
      <div className="h-8 w-8 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
        <RotateCcw className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">Re-run First-Time Setup</p>
        <p className="text-[10px] text-muted-foreground">Walk through the setup wizard again to update branding and connections</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </button>
  );
}

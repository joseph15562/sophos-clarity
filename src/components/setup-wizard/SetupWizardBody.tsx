import { useState, useMemo } from "react";
import { ArrowRight, ArrowLeft, RotateCcw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markSetupComplete } from "./setup-storage";
import { AGENT_STEP, BASE_STEPS, type Props } from "./wizard-types";
import { WelcomeStep } from "./steps/WelcomeStep";
import { BrandingStep } from "./steps/BrandingStep";
import { CentralSetupStep } from "./steps/CentralSetupStep";
import { ConnectorAgentStep } from "./steps/ConnectorAgentStep";
import { GuidePreAiStep } from "./steps/GuidePreAiStep";
import { GuideUploadStep } from "./steps/GuideUploadStep";
import { GuideAiReportsStep } from "./steps/GuideAiReportsStep";
import { GuideOptimisationStep } from "./steps/GuideOptimisationStep";
import { GuideRemediationStep } from "./steps/GuideRemediationStep";
import { GuideToolsStep } from "./steps/GuideToolsStep";
import { GuideManagementStep } from "./steps/GuideManagementStep";
import { GuideTeamSecurityStep } from "./steps/GuideTeamSecurityStep";
import { GuidePortalAlertsStep } from "./steps/GuidePortalAlertsStep";
import { DoneWizardStep } from "./steps/DoneWizardStep";
import { WalkthroughShell } from "./walkthrough-shell";

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
    <WalkthroughShell
      variant="modal"
      title="FireComply Setup"
      steps={steps}
      currentStepIndex={currentStep}
      onDismiss={handleSkip}
      dismissButtonTitle="Skip setup"
      footer={
        <>
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
        </>
      }
    >
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
        <GuideAiReportsStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      )}

      {step.id === "guide-optimisation" && (
        <GuideOptimisationStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      )}

      {step.id === "guide-remediation" && (
        <GuideRemediationStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      )}

      {step.id === "guide-tools" && (
        <GuideToolsStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      )}

      {step.id === "guide-management" && (
        <GuideManagementStep
          activeOverlay={activeOverlay}
          setActiveOverlay={setActiveOverlay}
          orgName={orgName}
        />
      )}

      {step.id === "guide-team-security" && (
        <GuideTeamSecurityStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      )}

      {step.id === "guide-portal-alerts" && (
        <GuidePortalAlertsStep activeOverlay={activeOverlay} setActiveOverlay={setActiveOverlay} />
      )}

      {step.id === "done" && <DoneWizardStep />}
    </WalkthroughShell>
  );
}

export function RerunSetupButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
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

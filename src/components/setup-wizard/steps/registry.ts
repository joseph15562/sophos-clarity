/**
 * Setup wizard step registry — extracted step components live under `./`.
 * Inline steps in `SetupWizardBody.tsx` should move here over time; `GuideAiReportsStep` is the first migration.
 */
import type { StepId } from "../wizard-types";

export const WIZARD_EXTRACTED_STEP_IDS: readonly StepId[] = [
  "welcome",
  "branding",
  "central",
  "connector-agent",
  "guide-upload",
  "guide-pre-ai",
  "guide-ai-reports",
] as const;

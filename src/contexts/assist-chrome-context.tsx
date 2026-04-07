import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import type { TourCallbacks } from "@/lib/guided-tours";

export type AssessAiPanelBinding = {
  analysisResults: Record<string, AnalysisResult>;
  reports: { id: string; label: string; markdown: string }[];
  customerName?: string;
  environment?: string;
  analysisTab?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessage?: string;
  onInitialMessageSent?: () => void;
};

export type AssessAssistRegistration = {
  tourCallbacks: TourCallbacks;
  hasFiles: boolean;
  hasReports: boolean;
  isGuest: boolean;
  /** null = hide AI on assess (e.g. local mode) */
  ai: AssessAiPanelBinding | null;
};

type AssistChromeContextValue = {
  assess: AssessAssistRegistration | null;
  setAssess: (reg: AssessAssistRegistration | null) => void;
};

const AssistChromeContext = createContext<AssistChromeContextValue | null>(null);

export function AssistChromeProvider({ children }: { children: ReactNode }) {
  const [assess, setAssessState] = useState<AssessAssistRegistration | null>(null);
  const setAssess = useCallback((reg: AssessAssistRegistration | null) => {
    setAssessState(reg);
  }, []);

  const value = useMemo(() => ({ assess, setAssess }), [assess, setAssess]);

  return <AssistChromeContext.Provider value={value}>{children}</AssistChromeContext.Provider>;
}

export function useAssistChrome() {
  const ctx = useContext(AssistChromeContext);
  if (!ctx) {
    throw new Error("useAssistChrome must be used within AssistChromeProvider");
  }
  return ctx;
}

export function useAssistChromeOptional() {
  return useContext(AssistChromeContext);
}

export function useRegisterAssessAssistChrome(reg: AssessAssistRegistration | null) {
  const ctx = useAssistChromeOptional();
  const setAssess = ctx?.setAssess;

  useEffect(() => {
    if (!setAssess) return;
    if (reg) setAssess(reg);
    else setAssess(null);
    return () => setAssess(null);
  }, [reg, setAssess]);
}

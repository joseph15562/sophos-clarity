import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Wifi,
  Upload,
  Sparkles,
  Check,
  Plug,
  Shield,
  Wrench,
  ListChecks,
  Compass,
  LayoutDashboard,
  Users,
  Globe,
} from "lucide-react";
import type { BrandingData } from "@/components/BrandingSetup";

export interface Props {
  open: boolean;
  onClose: () => void;
  branding: BrandingData;
  onBrandingChange: (b: BrandingData) => void;
  orgName?: string;
  isGuest?: boolean;
}

export type StepId =
  | "welcome"
  | "branding"
  | "central"
  | "connector-agent"
  | "guide-upload"
  | "guide-pre-ai"
  | "guide-ai-reports"
  | "guide-optimisation"
  | "guide-remediation"
  | "guide-tools"
  | "guide-management"
  | "guide-team-security"
  | "guide-portal-alerts"
  | "done";

export interface Step {
  id: StepId;
  title: string;
  icon: LucideIcon;
}

export const BASE_STEPS: Step[] = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "branding", title: "Branding", icon: Building2 },
  { id: "central", title: "Sophos Central", icon: Wifi },
  { id: "guide-upload", title: "Uploading Configs", icon: Upload },
  { id: "guide-pre-ai", title: "Pre-AI Assessment", icon: Shield },
  { id: "guide-ai-reports", title: "AI Reports", icon: Sparkles },
  { id: "guide-optimisation", title: "Optimisation", icon: Wrench },
  { id: "guide-remediation", title: "Remediation", icon: ListChecks },
  { id: "guide-tools", title: "Tools & Compare", icon: Compass },
  { id: "guide-management", title: "Management", icon: LayoutDashboard },
  { id: "guide-team-security", title: "Team & Security", icon: Users },
  { id: "guide-portal-alerts", title: "Portal & Alerts", icon: Globe },
  { id: "done", title: "Ready", icon: Check },
];

export const AGENT_STEP: Step = { id: "connector-agent", title: "Connector Agent", icon: Plug };

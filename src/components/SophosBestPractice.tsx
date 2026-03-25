import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ExternalLink,
  ChevronDown,
  UserCheck,
  Undo2,
  Lock,
  HelpCircle,
} from "lucide-react";
import { ScoringMethodology } from "./ScoringMethodology";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  type LicenceTier,
  type LicenceSelection,
  type ModuleId,
  type CheckStatus,
  MODULES,
  getActiveModules,
  computeSophosBPScore,
  detectBpLicenceTierFromCentral,
} from "@/lib/sophos-licence";
import { useAuthOptional } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getCentralStatus } from "@/lib/sophos-central";
import {
  SE_HEALTH_CHECK_BP_NO_MANUAL_COMPLY_IDS,
  SE_HEALTH_CHECK_BP_OVERRIDES_KEY,
  seCentralAutoForLabel,
  seCentralAutoForOverall,
} from "@/lib/se-health-check-bp";
import { GRADE_COLORS } from "@/lib/design-tokens";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  centralLicences?: Array<{ product: string; endDate: string; type: string }>;
  /** Defaults to MSP localStorage key; SE Health Check uses its own key so overrides do not clash. */
  overridesStorageKey?: string;
  /** When true (e.g. SE session connected to Central), treat Central management check as satisfied without org DB link. */
  centralEnrichmentActive?: boolean;
  /** Notified when manual overrides change (e.g. SE page refreshes linked dashboard scores). */
  onManualOverridesChange?: () => void;
  /**
   * When both are set (e.g. SE Health Check), licence tier/modules are owned by the parent so the page header
   * toggle and this card stay in sync.
   */
  licence?: LicenceSelection;
  onLicenceChange?: (next: LicenceSelection) => void;
  /**
   * SE Health Check: `analysisResults` keys (firewall labels) whose upload serial matches a Central HA group.
   * Auto-passes `bp-ha-configured` when the XML has no HA section (same as picking the HA dropdown row).
   */
  centralHaConfirmedLabels?: Set<string>;
  /** SE Health Check: MDR/NDR export-gap acknowledgement from the results header panel. */
  seThreatResponseAck?: Set<string>;
  /** SE Health Check: BP checks omitted from scoring (e.g. Heartbeat without endpoints). */
  seExcludedBpChecks?: Set<string>;
}

const TIER_INFO: Record<LicenceTier, { label: string; description: string }> = {
  standard: {
    label: "Standard Protection",
    description: "Network Protection + Web Protection + Enhanced Support",
  },
  xstream: {
    label: "Xstream Protection",
    description: "Everything in Standard + Zero-Day + Central Orchestration + DNS Protection",
  },
  individual: {
    label: "Individual Modules",
    description: "Select specific modules licensed for this firewall",
  },
};

const STATUS_CONFIG: Record<
  CheckStatus,
  {
    icon: typeof CheckCircle2;
    color: string;
    bg: string;
    label: string;
    iconGlow: string;
    rowHover: string;
  }
> = {
  pass: {
    icon: CheckCircle2,
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    label: "Pass",
    iconGlow: "shadow-[0_0_18px_rgba(52,211,153,0.45)]",
    rowHover: "hover:bg-emerald-500/[0.06]",
  },
  fail: {
    icon: XCircle,
    color: "text-red-300",
    bg: "bg-red-500/15",
    label: "Fail",
    iconGlow: "shadow-[0_0_18px_rgba(248,113,113,0.45)]",
    rowHover: "hover:bg-red-500/[0.06]",
  },
  warn: {
    icon: AlertTriangle,
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    label: "Verify",
    iconGlow: "shadow-[0_0_16px_rgba(251,191,36,0.4)]",
    rowHover: "hover:bg-amber-500/[0.06]",
  },
  na: {
    icon: MinusCircle,
    color: "text-muted-foreground/70",
    bg: "bg-muted/30",
    label: "N/A",
    iconGlow: "",
    rowHover: "hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02]",
  },
  unknown: {
    icon: AlertTriangle,
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    label: "Unknown",
    iconGlow: "",
    rowHover: "hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02]",
  },
};

const CATEGORY_THEME: Record<
  string,
  {
    iconWrap: string;
    title: string;
    summary: string;
    pill: string;
    accentBar: string;
    cardTint: string;
  }
> = {
  "Device Hardening": {
    iconWrap: "border-cyan-400/35 bg-cyan-500/15",
    title: "text-cyan-600 dark:text-cyan-200",
    summary: "text-cyan-700/80 dark:text-cyan-100/75",
    pill: "border-cyan-400/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-100",
    accentBar: "linear-gradient(180deg, rgba(34,211,238,0.85), rgba(6,182,212,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(34,211,238,0.14), transparent 55%)",
  },
  Authentication: {
    iconWrap: "border-violet-400/35 bg-violet-500/15",
    title: "text-violet-600 dark:text-violet-200",
    summary: "text-violet-700/80 dark:text-violet-100/75",
    pill: "border-violet-400/30 bg-violet-500/15 text-violet-700 dark:text-violet-100",
    accentBar: "linear-gradient(180deg, rgba(167,139,250,0.85), rgba(139,92,246,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(167,139,250,0.14), transparent 55%)",
  },
  Networking: {
    iconWrap: "border-blue-400/35 bg-blue-500/15",
    title: "text-blue-600 dark:text-blue-200",
    summary: "text-blue-700/80 dark:text-blue-100/75",
    pill: "border-blue-400/30 bg-blue-500/15 text-blue-700 dark:text-blue-100",
    accentBar: "linear-gradient(180deg, rgba(96,165,250,0.85), rgba(59,130,246,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(96,165,250,0.14), transparent 55%)",
  },
  VPN: {
    iconWrap: "border-indigo-400/35 bg-indigo-500/15",
    title: "text-indigo-600 dark:text-indigo-200",
    summary: "text-indigo-700/80 dark:text-indigo-100/75",
    pill: "border-indigo-400/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-100",
    accentBar: "linear-gradient(180deg, rgba(129,140,248,0.85), rgba(99,102,241,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(129,140,248,0.14), transparent 55%)",
  },
  "VPN Security": {
    iconWrap: "border-indigo-400/35 bg-indigo-500/15",
    title: "text-indigo-600 dark:text-indigo-200",
    summary: "text-indigo-700/80 dark:text-indigo-100/75",
    pill: "border-indigo-400/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-100",
    accentBar: "linear-gradient(180deg, rgba(129,140,248,0.85), rgba(99,102,241,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(129,140,248,0.14), transparent 55%)",
  },
  HA: {
    iconWrap: "border-sky-400/35 bg-sky-500/15",
    title: "text-sky-600 dark:text-sky-200",
    summary: "text-sky-700/80 dark:text-sky-100/75",
    pill: "border-sky-400/30 bg-sky-500/15 text-sky-700 dark:text-sky-100",
    accentBar: "linear-gradient(180deg, rgba(56,189,248,0.85), rgba(14,165,233,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(56,189,248,0.14), transparent 55%)",
  },
  Logging: {
    iconWrap: "border-amber-400/35 bg-amber-500/15",
    title: "text-amber-600 dark:text-amber-200",
    summary: "text-amber-700/80 dark:text-amber-100/75",
    pill: "border-amber-400/30 bg-amber-500/15 text-amber-700 dark:text-amber-100",
    accentBar: "linear-gradient(180deg, rgba(251,191,36,0.85), rgba(245,158,11,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(251,191,36,0.12), transparent 55%)",
  },
  Email: {
    iconWrap: "border-rose-400/35 bg-rose-500/15",
    title: "text-rose-600 dark:text-rose-200",
    summary: "text-rose-700/80 dark:text-rose-100/75",
    pill: "border-rose-400/30 bg-rose-500/15 text-rose-700 dark:text-rose-100",
    accentBar: "linear-gradient(180deg, rgba(251,113,133,0.85), rgba(244,63,94,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(251,113,133,0.12), transparent 55%)",
  },
  "Visibility & Monitoring": {
    iconWrap: "border-teal-400/35 bg-teal-500/15",
    title: "text-teal-600 dark:text-teal-200",
    summary: "text-teal-700/80 dark:text-teal-100/75",
    pill: "border-teal-400/30 bg-teal-500/15 text-teal-700 dark:text-teal-100",
    accentBar: "linear-gradient(180deg, rgba(45,212,191,0.85), rgba(20,184,166,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(45,212,191,0.14), transparent 55%)",
  },
  "Encryption & Inspection": {
    iconWrap: "border-fuchsia-400/35 bg-fuchsia-500/15",
    title: "text-fuchsia-600 dark:text-fuchsia-200",
    summary: "text-fuchsia-700/80 dark:text-fuchsia-100/75",
    pill: "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-100",
    accentBar: "linear-gradient(180deg, rgba(232,121,249,0.85), rgba(217,70,239,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(232,121,249,0.12), transparent 55%)",
  },
  "Rule Hygiene": {
    iconWrap: "border-orange-400/35 bg-orange-500/15",
    title: "text-orange-600 dark:text-orange-200",
    summary: "text-orange-700/80 dark:text-orange-100/75",
    pill: "border-orange-400/30 bg-orange-500/15 text-orange-700 dark:text-orange-100",
    accentBar: "linear-gradient(180deg, rgba(251,146,60,0.85), rgba(249,115,22,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(251,146,60,0.12), transparent 55%)",
  },
  "Network Protection": {
    iconWrap: "border-blue-400/35 bg-blue-500/15",
    title: "text-blue-600 dark:text-blue-200",
    summary: "text-blue-700/80 dark:text-blue-100/75",
    pill: "border-blue-400/30 bg-blue-500/15 text-blue-700 dark:text-blue-100",
    accentBar: "linear-gradient(180deg, rgba(59,130,246,0.85), rgba(37,99,235,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(59,130,246,0.14), transparent 55%)",
  },
  "DoS & Spoof Protection": {
    iconWrap: "border-red-400/30 bg-red-500/12",
    title: "text-red-600 dark:text-red-200",
    summary: "text-red-700/80 dark:text-red-100/75",
    pill: "border-red-400/30 bg-red-500/12 text-red-700 dark:text-red-100",
    accentBar: "linear-gradient(180deg, rgba(248,113,113,0.75), rgba(239,68,68,0.1))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(248,113,113,0.1), transparent 55%)",
  },
  "Active Threat Response": {
    iconWrap: "border-emerald-400/35 bg-emerald-500/15",
    title: "text-emerald-600 dark:text-emerald-200",
    summary: "text-emerald-700/80 dark:text-emerald-100/75",
    pill: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-100",
    accentBar: "linear-gradient(180deg, rgba(52,211,153,0.85), rgba(16,185,129,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(52,211,153,0.12), transparent 55%)",
  },
  "Synchronized Security": {
    iconWrap: "border-lime-400/35 bg-lime-500/12",
    title: "text-lime-700 dark:text-lime-200",
    summary: "text-lime-800/80 dark:text-lime-100/75",
    pill: "border-lime-400/30 bg-lime-500/12 text-lime-800 dark:text-lime-100",
    accentBar: "linear-gradient(180deg, rgba(163,230,53,0.75), rgba(132,204,22,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(163,230,53,0.1), transparent 55%)",
  },
  "Web Protection": {
    iconWrap: "border-cyan-400/35 bg-cyan-500/12",
    title: "text-cyan-600 dark:text-cyan-200",
    summary: "text-cyan-700/80 dark:text-cyan-100/75",
    pill: "border-cyan-400/30 bg-cyan-500/12 text-cyan-700 dark:text-cyan-100",
    accentBar: "linear-gradient(180deg, rgba(34,211,238,0.7), rgba(6,182,212,0.1))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(34,211,238,0.1), transparent 55%)",
  },
  "Zero-Day Protection": {
    iconWrap: "border-purple-400/35 bg-purple-500/15",
    title: "text-purple-600 dark:text-purple-200",
    summary: "text-purple-700/80 dark:text-purple-100/75",
    pill: "border-purple-400/30 bg-purple-500/15 text-purple-700 dark:text-purple-100",
    accentBar: "linear-gradient(180deg, rgba(192,132,252,0.85), rgba(168,85,247,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(192,132,252,0.12), transparent 55%)",
  },
  "Central Orchestration": {
    iconWrap: "border-[#2006F7]/40 bg-[#2006F7]/12 dark:border-[#00EDFF]/35 dark:bg-[#00EDFF]/10",
    title: "text-[#2006F7] dark:text-[#00EDFF]",
    summary: "text-[#2006F7]/80 dark:text-[#00EDFF]/80",
    pill: "border-[#2006F7]/25 bg-[#2006F7]/10 text-[#2006F7] dark:border-[#00EDFF]/30 dark:bg-[#00EDFF]/10 dark:text-[#00EDFF]",
    accentBar: "linear-gradient(180deg, rgba(0,237,255,0.75), rgba(32,6,247,0.15))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(0,237,255,0.1), transparent 55%)",
  },
  "DNS Protection": {
    iconWrap: "border-sky-400/35 bg-sky-500/12",
    title: "text-sky-600 dark:text-sky-200",
    summary: "text-sky-700/80 dark:text-sky-100/75",
    pill: "border-sky-400/30 bg-sky-500/12 text-sky-700 dark:text-sky-100",
    accentBar: "linear-gradient(180deg, rgba(14,165,233,0.8), rgba(2,132,199,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(14,165,233,0.1), transparent 55%)",
  },
  Resilience: {
    iconWrap: "border-stone-400/35 bg-stone-500/12",
    title: "text-stone-700 dark:text-stone-200",
    summary: "text-stone-600/90 dark:text-stone-300/80",
    pill: "border-stone-400/30 bg-stone-500/12 text-stone-700 dark:text-stone-200",
    accentBar: "linear-gradient(180deg, rgba(168,162,158,0.7), rgba(120,113,108,0.12))",
    cardTint: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(168,162,158,0.08), transparent 55%)",
  },
  Default: {
    iconWrap: "border-[#2006F7]/30 bg-[#2006F7]/10 dark:border-[#00EDFF]/35 dark:bg-[#00EDFF]/8",
    title: "text-foreground",
    summary: "text-muted-foreground",
    pill: "border-white/15 bg-white/80 dark:bg-white/[0.06] text-foreground/80",
    accentBar: "linear-gradient(180deg, rgba(99,102,241,0.75), rgba(32,6,247,0.12))",
    cardTint: "radial-gradient(ellipse 90% 60% at 0% 0%, rgba(99,102,241,0.1), transparent 50%)",
  },
};

function GaugeRing({ score, grade }: { score: number; grade: string }) {
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = GRADE_COLORS[grade] ?? GRADE_COLORS.C;

  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Best practice score: ${score}, grade ${grade}`}
    >
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-muted/20"
      />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        className="transition-all duration-700"
      />
      <text
        x="60"
        y="54"
        textAnchor="middle"
        fill={color}
        fontSize="28"
        fontWeight="700"
        style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
      >
        {score}
      </text>
      <text
        x="60"
        y="72"
        textAnchor="middle"
        fill={color}
        fontSize="12"
        fontWeight="600"
        style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
      >
        Grade {grade}
      </text>
    </svg>
  );
}

const OVERRIDES_KEY_DEFAULT = "sophos-bp-manual-overrides";
const NO_CENTRAL_HA_LABELS = new Set<string>();

function loadOverrides(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch (err) {
    console.warn("[loadOverrides]", err);
  }
  return new Set();
}

function saveOverrides(storageKey: string, overrides: Set<string>) {
  localStorage.setItem(storageKey, JSON.stringify([...overrides]));
}

export function SophosBestPractice({
  analysisResults,
  centralLicences,
  overridesStorageKey,
  centralEnrichmentActive = false,
  onManualOverridesChange,
  licence: licenceFromParent,
  onLicenceChange,
  centralHaConfirmedLabels,
  seThreatResponseAck,
  seExcludedBpChecks,
}: Props) {
  const isSeHealthCheckBp = overridesStorageKey === SE_HEALTH_CHECK_BP_OVERRIDES_KEY;
  // SE Health Check route has no AuthProvider — optional auth skips org DB Central link; use centralEnrichmentActive instead.
  const auth = useAuthOptional();
  const orgId = auth?.org?.id ?? "";
  const isGuest = auth?.isGuest ?? true;

  const storageKey = overridesStorageKey ?? OVERRIDES_KEY_DEFAULT;

  const detectedTier = useMemo(
    () => detectBpLicenceTierFromCentral(centralLicences),
    [centralLicences],
  );
  const isLocked = detectedTier !== null;

  const isControlled = licenceFromParent !== undefined;

  const [internalTier, setInternalTier] = useState<LicenceTier>("xstream");
  const [internalIndividualModules, setInternalIndividualModules] = useState<ModuleId[]>([
    "networkProtection",
    "webProtection",
  ]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [manualOverrides, setManualOverrides] = useState<Set<string>>(() =>
    loadOverrides(storageKey),
  );
  const manualOverridesHydrated = useRef(false);
  const [centralLinked, setCentralLinked] = useState(false);
  const [activeTab, setActiveTab] = useState("overall");
  const [showHelp, setShowHelp] = useState(false);

  const tier = isControlled ? licenceFromParent!.tier : internalTier;
  const individualModules = isControlled ? licenceFromParent!.modules : internalIndividualModules;

  const setLicenceSelection = useCallback(
    (next: LicenceSelection) => {
      if (isControlled) onLicenceChange?.(next);
      else {
        setInternalTier(next.tier);
        setInternalIndividualModules(next.modules);
      }
    },
    [isControlled, onLicenceChange],
  );

  useEffect(() => {
    if (isControlled || !detectedTier) return;
    setInternalTier(detectedTier);
    if (detectedTier !== "individual") setInternalIndividualModules([]);
  }, [detectedTier, isControlled]);

  useEffect(() => {
    saveOverrides(storageKey, manualOverrides);
    if (!manualOverridesHydrated.current) {
      manualOverridesHydrated.current = true;
      return;
    }
    onManualOverridesChange?.();
  }, [storageKey, manualOverrides, onManualOverridesChange]);

  useEffect(() => {
    if (!orgId || isGuest) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await getCentralStatus(orgId);
        if (!status?.connected || cancelled) return;
        const { data } = await supabase
          .from("firewall_config_links")
          .select("config_hash")
          .eq("org_id", orgId)
          .limit(1);
        if (!cancelled && data && data.length > 0) setCentralLinked(true);
      } catch (err) {
        console.warn("[SophosBestPractice] getCentralStatus", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, isGuest]);

  const licence: LicenceSelection = useMemo(
    () => ({ tier, modules: individualModules }),
    [tier, individualModules],
  );

  const activeModules = useMemo(() => getActiveModules(licence), [licence]);

  const toggleModule = useCallback(
    (mod: ModuleId) => {
      const prev = individualModules;
      const nextMods = prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod];
      setLicenceSelection({ tier: "individual", modules: nextMods });
    },
    [individualModules, setLicenceSelection],
  );

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleOverride = useCallback((checkId: string) => {
    setManualOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) next.delete(checkId);
      else next.add(checkId);
      return next;
    });
  }, []);

  const firewallLabels = useMemo(() => Object.keys(analysisResults), [analysisResults]);
  const hasMultiple = firewallLabels.length > 1;

  const aggregateResult = useMemo(() => {
    const entries = Object.values(analysisResults);
    if (entries.length === 0) return null;
    if (entries.length === 1) return entries[0];
    const merged: AnalysisResult = {
      stats: entries[0].stats,
      findings: entries.flatMap((e) => e.findings),
      inspectionPosture: entries[0].inspectionPosture,
    };
    return merged;
  }, [analysisResults]);

  const centralSessionActive = centralEnrichmentActive || centralLinked;
  const haLabels = centralHaConfirmedLabels ?? NO_CENTRAL_HA_LABELS;

  const centralAutoOverall = useMemo(
    () => seCentralAutoForOverall(centralSessionActive, haLabels),
    [centralSessionActive, haLabels],
  );

  const bpScore = useMemo(() => {
    if (!aggregateResult) return null;
    const auto = hasMultiple
      ? centralAutoOverall
      : seCentralAutoForLabel(centralSessionActive, firewallLabels[0] ?? "", haLabels);
    return computeSophosBPScore(
      aggregateResult,
      licence,
      manualOverrides,
      auto,
      seThreatResponseAck,
      seExcludedBpChecks,
    );
  }, [
    aggregateResult,
    licence,
    manualOverrides,
    centralAutoOverall,
    hasMultiple,
    centralSessionActive,
    firewallLabels,
    haLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
  ]);

  const perFirewallScores = useMemo(() => {
    if (!hasMultiple) return {};
    const result: Record<string, ReturnType<typeof computeSophosBPScore>> = {};
    for (const [label, ar] of Object.entries(analysisResults)) {
      result[label] = computeSophosBPScore(
        ar,
        licence,
        manualOverrides,
        seCentralAutoForLabel(centralSessionActive, label, haLabels),
        seThreatResponseAck,
        seExcludedBpChecks,
      );
    }
    return result;
  }, [
    hasMultiple,
    analysisResults,
    licence,
    manualOverrides,
    centralSessionActive,
    haLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
  ]);

  const perFwCheckStatus = useMemo(() => {
    if (!hasMultiple) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    for (const [label, score] of Object.entries(perFirewallScores)) {
      for (const r of score.results) {
        if (r.status === "fail" || r.status === "warn") {
          if (!map.has(r.check.id)) map.set(r.check.id, []);
          map.get(r.check.id)!.push(label);
        }
      }
    }
    return map;
  }, [hasMultiple, perFirewallScores]);

  if (!bpScore) return null;

  const currentScore = activeTab === "overall" ? bpScore : perFirewallScores[activeTab];
  if (!currentScore) return null;

  const manualCount = currentScore.results.filter((r) => r.manualOverride).length;

  const grouped = new Map<string, typeof currentScore.results>();
  for (const r of currentScore.results) {
    const cat = r.check.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(r);
  }

  return (
    <div className="space-y-5">
      {/* Licence Picker */}
      <div className="rounded-[28px] border border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-md bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.92),rgba(12,18,34,0.92))] p-5 sm:p-6 shadow-[0_18px_50px_rgba(32,6,247,0.12)] space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[220px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
              Licence assumption
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#2006F7]" />
              <h3 className="text-base font-display font-black text-foreground tracking-tight">
                Sophos Licence Selection
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Select the protection tier that best matches the firewall so best-practice scoring
              reflects the controls that should reasonably be available.
            </p>
          </div>
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]">
              <Lock className="h-2.5 w-2.5" />
              Auto-detected from Sophos Central
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Why it matters
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Scoring should match the controls your licence actually enables
            </p>
          </div>
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Best use
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Validate expected protections before interpreting best-practice gaps
            </p>
          </div>
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Outcome
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              More credible posture scoring and cleaner customer conversations
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {(Object.entries(TIER_INFO) as [LicenceTier, typeof TIER_INFO.standard][]).map(
            ([key, info]) => {
              const isSelected = tier === key;
              const isDisabled = isLocked && !isSelected;
              return (
                <button
                  key={key}
                  onClick={() =>
                    !isLocked &&
                    setLicenceSelection({
                      tier: key,
                      modules: key === "individual" ? individualModules : [],
                    })
                  }
                  disabled={isLocked}
                  className={`rounded-2xl border p-4 text-left transition-all shadow-sm ${
                    isSelected
                      ? isLocked
                        ? "border-[#00F2B3] bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 ring-1 ring-[#00F2B3]/30"
                        : "border-[#2006F7] bg-brand-accent/10 ring-1 ring-[#2006F7]/30"
                      : isDisabled
                        ? "border-border opacity-40 cursor-not-allowed bg-card/60"
                        : "border-border bg-card/70 hover:border-muted-foreground/30 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-xs font-semibold ${
                        isSelected
                          ? isLocked
                            ? "text-[#007A5A] dark:text-[#00F2B3]"
                            : "text-[#2006F7] dark:text-[#6B5BFF]"
                          : "text-foreground"
                      }`}
                    >
                      {info.label}
                    </p>
                    {isSelected && isLocked && (
                      <Lock className="h-3 w-3 text-[#007A5A] dark:text-[#00F2B3]" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    {info.description}
                  </p>
                </button>
              );
            },
          )}
        </div>

        {/* Individual module checkboxes */}
        {tier === "individual" && (
          <div className="border border-border rounded-2xl bg-card/70 p-4 space-y-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">
              Select Licensed Modules
            </p>
            {Object.values(MODULES).map((mod) => (
              <label
                key={mod.id}
                className="flex items-start gap-2.5 cursor-pointer group rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={individualModules.includes(mod.id)}
                  onChange={() => toggleModule(mod.id)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-[#2006F7] cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground group-hover:text-[#2006F7] transition-colors">
                    {mod.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {mod.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Active modules summary */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {activeModules.map((modId) => (
            <span
              key={modId}
              className="px-2.5 py-1 rounded-full bg-brand-accent/10 text-[#2006F7] dark:text-[#6B5BFF] text-[10px] font-medium border border-brand-accent/10"
            >
              {MODULES[modId].label}
            </span>
          ))}
        </div>
      </div>

      {/* Score Overview */}
      <div className="rounded-[28px] border border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-md bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.92),rgba(12,18,34,0.92))] p-5 sm:p-6 shadow-[0_18px_50px_rgba(32,6,247,0.12)] space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[220px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
              Best-practice posture
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#2006F7]" />
              <h3 className="text-base font-display font-black text-foreground tracking-tight">
                Sophos Best Practice Score
              </h3>
              <button
                onClick={() => setShowHelp(!showHelp)}
                aria-label="How scoring works"
                className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Benchmark the firewall against Sophos best-practice guidance so you can separate
              expected protections from meaningful posture gaps.
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground">based on Sophos documentation</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Score intent
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Show how closely the firewall aligns to Sophos guidance
            </p>
          </div>
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Best for
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              Executive posture reviews and technical gap validation
            </p>
          </div>
          <div className="info-pill">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
              Outcome
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">
              A clearer story around what is misconfigured, missing, or manually verified
            </p>
          </div>
        </div>

        {showHelp && <ScoringMethodology onClose={() => setShowHelp(false)} />}

        {/* Tabs */}
        {hasMultiple && (
          <div
            className="rounded-2xl border border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-sm bg-card/50 p-2 mb-4 overflow-x-auto"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            <div className="flex items-center gap-2 min-w-max">
              <button
                onClick={() => setActiveTab("overall")}
                className={`px-3 py-2 text-[11px] font-semibold rounded-xl transition-colors whitespace-nowrap ${
                  activeTab === "overall"
                    ? "bg-[#2006F7] text-white dark:bg-[#00EDFF] dark:text-slate-950 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                Overall
              </button>
              {firewallLabels.map((label) => (
                <button
                  key={label}
                  onClick={() => setActiveTab(label)}
                  className={`px-3 py-2 text-[11px] font-semibold rounded-xl transition-colors whitespace-nowrap ${
                    activeTab === label
                      ? "bg-[#2006F7] text-white dark:bg-[#00EDFF] dark:text-slate-950 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className="rounded-2xl border border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-sm bg-card/50 p-4 sm:p-5"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <GaugeRing score={currentScore.overall} grade={currentScore.grade} />
              {manualCount > 0 && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/10">
                  <UserCheck className="h-2.5 w-2.5" />
                  {manualCount} manually confirmed
                </span>
              )}
            </div>

            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{currentScore.passed}</p>
                <p className="text-[10px] text-muted-foreground">Passed</p>
              </div>
              <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{currentScore.failed}</p>
                <p className="text-[10px] text-muted-foreground">Failed</p>
              </div>
              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{currentScore.warnings}</p>
                <p className="text-[10px] text-muted-foreground">Verify</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground/70">
                  {currentScore.notApplicable}
                </p>
                <p className="text-[10px] text-muted-foreground">N/A</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Check Results by Category */}
      <div className="space-y-4">
        <div
          className="relative rounded-[24px] border border-slate-900/[0.14] dark:border-white/[0.1] backdrop-blur-md overflow-hidden px-5 py-5 sm:px-7 sm:py-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-slate-900/[0.18] dark:hover:border-white/[0.14] hover:shadow-[0_24px_60px_rgba(32,6,247,0.12)]"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(247,249,255,0.92)), radial-gradient(circle at 0% 0%, rgba(32,6,247,0.08), transparent 45%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
          }}
        >
          <div
            className="absolute inset-0 dark:block hidden pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(9,13,24,0.94), rgba(14,20,38,0.92)), radial-gradient(circle at 0% 0%, rgba(0,237,255,0.08), transparent 42%), radial-gradient(circle at 100% 100%, rgba(32,6,247,0.1), transparent 40%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          />
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none z-10"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(0,237,255,0.35), rgba(32,6,247,0.25), transparent)",
            }}
          />
          <div className="relative z-[1] flex items-start gap-4 flex-wrap">
            <div
              className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl backdrop-blur-sm"
              style={{
                border: "1px solid rgba(0,237,255,0.25)",
                background: "linear-gradient(145deg, rgba(0,237,255,0.12), rgba(32,6,247,0.08))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 0 28px rgba(0,237,255,0.15)",
              }}
            >
              <Shield className="h-7 w-7 text-[#2006F7] dark:text-[#00EDFF]" />
            </div>
            <div className="space-y-2 flex-1 min-w-[220px]">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur-sm border border-[#00F2B3]/35 text-[#00A67A] dark:text-[#00F2B3]"
                style={{
                  background: "linear-gradient(145deg, rgba(0,242,179,0.14), rgba(0,242,179,0.04))",
                  boxShadow: "0 0 20px rgba(0,242,179,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                Findings by category
              </div>
              <p className="text-lg sm:text-xl font-display font-black text-foreground tracking-tight">
                Detailed Sophos best-practice findings
              </p>
              <p className="text-sm text-foreground/55 dark:text-foreground/50 leading-relaxed max-w-2xl">
                Expand each category to review evidence, remediation guidance, and any manually
                validated controls before you present the final posture story.
              </p>
            </div>
          </div>
        </div>
        {Array.from(grouped.entries()).map(([category, checks]) => {
          const isExpanded = expandedCategories.has(category);
          const catPassed = checks.filter((c) => c.status === "pass").length;
          const catApplicable = checks.filter((c) => c.applicable && c.status !== "na").length;
          const catFailed = checks.filter((c) => c.status === "fail").length;
          const theme = CATEGORY_THEME[category] ?? CATEGORY_THEME.Default;

          const allAligned = catApplicable > 0 && catPassed === catApplicable && catFailed === 0;

          return (
            <div
              key={category}
              className="group/card relative rounded-[24px] border border-slate-900/[0.14] dark:border-white/[0.1] backdrop-blur-md overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.28)] transition-all duration-300 hover:border-slate-900/[0.20] dark:hover:border-white/[0.16] hover:shadow-[0_22px_56px_rgba(0,0,0,0.35)] hover:-translate-y-0.5"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-90 dark:opacity-100"
                style={{ background: theme.cardTint }}
              />
              <div
                className="pointer-events-none absolute left-0 top-5 bottom-5 w-1 rounded-full z-[1]"
                style={{
                  background: theme.accentBar,
                  boxShadow: "0 0 14px rgba(255,255,255,0.15)",
                }}
              />
              <div
                className="absolute inset-x-0 top-0 h-px z-[1] pointer-events-none opacity-70"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
                }}
              />
              <button
                onClick={() => toggleCategory(category)}
                className="relative z-[2] w-full flex items-center gap-3 sm:gap-4 pl-5 sm:pl-6 pr-4 sm:pr-6 py-4 sm:py-5 text-left transition-all hover:bg-slate-950/[0.05] dark:hover:bg-white/[0.04]"
              >
                <div
                  className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl border flex items-center justify-center shrink-0 backdrop-blur-sm ${theme.iconWrap}`}
                  style={{
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 24px rgba(0,0,0,0.25), 0 0 20px rgba(0,237,255,0.1)",
                  }}
                >
                  <Shield className="h-5 w-5 text-[#2006F7] dark:text-[#00EDFF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-base font-display font-bold ${theme.title}`}>{category}</p>
                    <span
                      className={`px-2.5 py-1 rounded-full border text-[11px] font-bold backdrop-blur-sm ${theme.pill}`}
                      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
                    >
                      {checks.length} check{checks.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className={`text-xs mt-1.5 font-medium ${theme.summary}`}>
                    {catPassed} aligned • {Math.max(catApplicable - catPassed, 0)} need attention
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {catFailed > 0 && (
                    <span
                      className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide text-red-400 border border-red-500/35 backdrop-blur-sm"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(239,68,68,0.2), rgba(239,68,68,0.06))",
                        boxShadow:
                          "0 0 14px rgba(239,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
                      }}
                    >
                      {catFailed} fail
                    </span>
                  )}
                  {catApplicable > 0 && (
                    <span
                      className={`px-2.5 py-1 rounded-lg border text-xs font-black tabular-nums backdrop-blur-sm ${
                        allAligned
                          ? "border-emerald-400/40 text-emerald-200"
                          : "border-slate-900/[0.16] dark:border-white/[0.12] text-foreground/85"
                      }`}
                      style={{
                        background: allAligned
                          ? "linear-gradient(145deg, rgba(52,211,153,0.22), rgba(52,211,153,0.06))"
                          : "linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))",
                        boxShadow: allAligned
                          ? "0 0 18px rgba(52,211,153,0.25), inset 0 1px 0 rgba(255,255,255,0.1)"
                          : "inset 0 1px 0 rgba(255,255,255,0.06)",
                      }}
                    >
                      {catPassed}/{catApplicable}
                    </span>
                  )}
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center backdrop-blur-sm border border-slate-900/[0.14] dark:border-white/[0.1]"
                    style={{
                      background:
                        "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  >
                    <ChevronDown
                      className={`h-4 w-4 text-foreground/50 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div
                  className="relative z-[2] border-t border-slate-900/[0.12] dark:border-white/[0.08] backdrop-blur-lg divide-y divide-white/[0.06]"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  }}
                >
                  {checks.map((result) => {
                    const isOverridden = result.manualOverride === true;
                    const isWarnAndOverrideable = result.status === "warn" && result.applicable;
                    const skipManualComply =
                      isSeHealthCheckBp &&
                      SE_HEALTH_CHECK_BP_NO_MANUAL_COMPLY_IDS.has(result.check.id);
                    const showManualOverrideButton =
                      (!skipManualComply && isWarnAndOverrideable) || isOverridden;
                    const cfg = STATUS_CONFIG[result.status];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={result.check.id}
                        className={`px-4 sm:pl-6 sm:pr-6 py-4 sm:py-5 flex items-start gap-3 sm:gap-4 transition-colors ${cfg.rowHover} ${!result.applicable ? "opacity-40" : ""}`}
                      >
                        <div
                          className={`mt-0.5 h-10 w-10 rounded-xl border border-slate-900/[0.16] dark:border-white/[0.12] ${cfg.bg} flex items-center justify-center shrink-0 backdrop-blur-sm ${cfg.iconGlow}`}
                          style={{
                            boxShadow:
                              "inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 12px rgba(0,0,0,0.2)",
                          }}
                        >
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-display font-bold text-foreground leading-snug">
                              {result.check.title}
                            </p>
                            {isOverridden && (
                              <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                                Manual
                              </span>
                            )}
                            {activeTab === "overall" &&
                              hasMultiple &&
                              (result.status === "fail" || result.status === "warn") &&
                              perFwCheckStatus.has(result.check.id) && (
                                <span className="px-2 py-0.5 rounded-full text-[8px] font-medium bg-muted text-muted-foreground border border-border">
                                  {perFwCheckStatus.get(result.check.id)!.join(", ")}
                                </span>
                              )}
                          </div>
                          <p className="text-sm text-foreground/55 mt-1 leading-relaxed">
                            {result.detail}
                          </p>
                          {result.status === "fail" && (
                            <p
                              className="text-sm text-amber-400 mt-2 leading-relaxed rounded-lg px-3 py-2 border border-amber-500/20 backdrop-blur-sm"
                              style={{
                                background:
                                  "linear-gradient(105deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))",
                              }}
                            >
                              <span className="font-bold">Sophos recommendation:</span>{" "}
                              {result.check.recommendation}
                            </p>
                          )}
                          {/* Manual comply toggle for checks not verifiable from export */}
                          {showManualOverrideButton && (
                            <button
                              onClick={() => toggleOverride(result.check.id)}
                              className={`mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                                isOverridden
                                  ? "border-emerald-500/10 bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/10"
                                  : "border-brand-accent/10 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20"
                              }`}
                            >
                              {isOverridden ? (
                                <>
                                  <Undo2 className="h-3 w-3" />
                                  Revert to Unverified
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3 w-3" />
                                  Mark as Compliant
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <a
                          href={result.check.reference}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl text-foreground/35 hover:text-[#2006F7] dark:hover:text-[#00EDFF] transition-colors shrink-0 border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] hover:bg-slate-950/[0.06] dark:hover:bg-white/[0.05]"
                          title="View Sophos docs"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

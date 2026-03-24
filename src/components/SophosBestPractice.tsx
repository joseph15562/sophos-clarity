import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Shield, CheckCircle2, XCircle, AlertTriangle, MinusCircle, ExternalLink, ChevronDown, UserCheck, Undo2, Lock, HelpCircle } from "lucide-react";
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

const STATUS_CONFIG: Record<CheckStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  pass: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Pass" },
  fail: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Fail" },
  warn: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", label: "Verify" },
  na: { icon: MinusCircle, color: "text-muted-foreground/70", bg: "bg-muted/30", label: "N/A" },
  unknown: { icon: AlertTriangle, color: "text-muted-foreground", bg: "bg-muted/20", label: "Unknown" },
};

const CATEGORY_THEME: Record<string, { iconWrap: string; title: string; summary: string; pill: string }> = {
  "Device Hardening": {
    iconWrap: "border-cyan-500/15 bg-cyan-500/10",
    title: "text-cyan-600 dark:text-cyan-300",
    summary: "text-cyan-700/80 dark:text-cyan-200/80",
    pill: "border-cyan-500/15 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  },
  Authentication: {
    iconWrap: "border-violet-500/15 bg-violet-500/10",
    title: "text-violet-600 dark:text-violet-300",
    summary: "text-violet-700/80 dark:text-violet-200/80",
    pill: "border-violet-500/15 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  },
  Networking: {
    iconWrap: "border-blue-500/15 bg-blue-500/10",
    title: "text-blue-600 dark:text-blue-300",
    summary: "text-blue-700/80 dark:text-blue-200/80",
    pill: "border-blue-500/15 bg-blue-500/10 text-blue-700 dark:text-blue-200",
  },
  VPN: {
    iconWrap: "border-indigo-500/15 bg-indigo-500/10",
    title: "text-indigo-600 dark:text-indigo-300",
    summary: "text-indigo-700/80 dark:text-indigo-200/80",
    pill: "border-indigo-500/15 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  },
  HA: {
    iconWrap: "border-sky-500/15 bg-sky-500/10",
    title: "text-sky-600 dark:text-sky-300",
    summary: "text-sky-700/80 dark:text-sky-200/80",
    pill: "border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  },
  Logging: {
    iconWrap: "border-amber-500/15 bg-amber-500/10",
    title: "text-amber-600 dark:text-amber-300",
    summary: "text-amber-700/80 dark:text-amber-200/80",
    pill: "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  },
  Email: {
    iconWrap: "border-rose-500/15 bg-rose-500/10",
    title: "text-rose-600 dark:text-rose-300",
    summary: "text-rose-700/80 dark:text-rose-200/80",
    pill: "border-rose-500/15 bg-rose-500/10 text-rose-700 dark:text-rose-200",
  },
  Default: {
    iconWrap: "border-brand-accent/15 bg-brand-accent/10",
    title: "text-foreground",
    summary: "text-muted-foreground",
    pill: "border-border bg-background/70 text-muted-foreground",
  },
};

function GaugeRing({ score, grade }: { score: number; grade: string }) {
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = GRADE_COLORS[grade] ?? GRADE_COLORS.C;

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Best practice score: ${score}, grade ${grade}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 60 60)" className="transition-all duration-700"
      />
      <text x="60" y="54" textAnchor="middle" fill={color} fontSize="28" fontWeight="700" style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}>{score}</text>
      <text x="60" y="72" textAnchor="middle" fill={color} fontSize="12" fontWeight="600" style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}>Grade {grade}</text>
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

  const detectedTier = useMemo(() => detectBpLicenceTierFromCentral(centralLicences), [centralLicences]);
  const isLocked = detectedTier !== null;

  const isControlled = licenceFromParent !== undefined;

  const [internalTier, setInternalTier] = useState<LicenceTier>("xstream");
  const [internalIndividualModules, setInternalIndividualModules] = useState<ModuleId[]>([
    "networkProtection",
    "webProtection",
  ]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [manualOverrides, setManualOverrides] = useState<Set<string>>(() => loadOverrides(storageKey));
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
    return () => { cancelled = true; };
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
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const toggleOverride = useCallback((checkId: string) => {
    setManualOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) next.delete(checkId); else next.add(checkId);
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
    return computeSophosBPScore(aggregateResult, licence, manualOverrides, auto, seThreatResponseAck, seExcludedBpChecks);
  }, [aggregateResult, licence, manualOverrides, centralAutoOverall, hasMultiple, centralSessionActive, firewallLabels, haLabels, seThreatResponseAck, seExcludedBpChecks]);

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
  }, [hasMultiple, analysisResults, licence, manualOverrides, centralSessionActive, haLabels, seThreatResponseAck, seExcludedBpChecks]);

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
      <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-5 sm:p-6 shadow-[0_18px_50px_rgba(32,6,247,0.08)] space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[220px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
              Licence assumption
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#2006F7]" />
              <h3 className="text-base font-display font-black text-foreground tracking-tight">Sophos Licence Selection</h3>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Select the protection tier that best matches the firewall so best-practice scoring reflects the controls that should reasonably be available.
            </p>
          </div>
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]">
              <Lock className="h-2.5 w-2.5" />
              Auto-detected from Sophos Central
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Why it matters</p>
            <p className="text-sm font-semibold text-foreground mt-1">Scoring should match the controls your licence actually enables</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Best use</p>
            <p className="text-sm font-semibold text-foreground mt-1">Validate expected protections before interpreting best-practice gaps</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Outcome</p>
            <p className="text-sm font-semibold text-foreground mt-1">More credible posture scoring and cleaner customer conversations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {(Object.entries(TIER_INFO) as [LicenceTier, typeof TIER_INFO.standard][]).map(([key, info]) => {
            const isSelected = tier === key;
            const isDisabled = isLocked && !isSelected;
            return (
              <button
                key={key}
                onClick={() =>
                  !isLocked &&
                  setLicenceSelection({ tier: key, modules: key === "individual" ? individualModules : [] })
                }
                disabled={isLocked}
                className={`rounded-2xl border p-4 text-left transition-all shadow-sm ${
                  isSelected
                    ? isLocked
                      ? "border-[#00F2B3] bg-[#00F2B3]/10 ring-1 ring-[#00F2B3]/30"
                      : "border-[#2006F7] bg-brand-accent/10 ring-1 ring-[#2006F7]/30"
                    : isDisabled
                      ? "border-border opacity-40 cursor-not-allowed bg-card/60"
                      : "border-border bg-card/70 hover:border-muted-foreground/30 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-semibold ${
                    isSelected
                      ? isLocked ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#2006F7] dark:text-[#6B5BFF]"
                      : "text-foreground"
                  }`}>
                    {info.label}
                  </p>
                  {isSelected && isLocked && <Lock className="h-3 w-3 text-[#00F2B3] dark:text-[#00F2B3]" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{info.description}</p>
              </button>
            );
          })}
        </div>

        {/* Individual module checkboxes */}
        {tier === "individual" && (
          <div className="border border-border rounded-2xl bg-card/70 p-4 space-y-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Select Licensed Modules</p>
            {(Object.values(MODULES)).map((mod) => (
              <label key={mod.id} className="flex items-start gap-2.5 cursor-pointer group rounded-xl border border-border/70 bg-background/60 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={individualModules.includes(mod.id)}
                  onChange={() => toggleModule(mod.id)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-[#2006F7] cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground group-hover:text-[#2006F7] transition-colors">{mod.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{mod.description}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Active modules summary */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {activeModules.map((modId) => (
            <span key={modId} className="px-2.5 py-1 rounded-full bg-brand-accent/10 text-[#2006F7] dark:text-[#6B5BFF] text-[10px] font-medium border border-brand-accent/10">
              {MODULES[modId].label}
            </span>
          ))}
        </div>
      </div>

      {/* Score Overview */}
      <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] p-5 sm:p-6 shadow-[0_18px_50px_rgba(32,6,247,0.08)] space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[220px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
              Best-practice posture
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#2006F7]" />
              <h3 className="text-base font-display font-black text-foreground tracking-tight">Sophos Best Practice Score</h3>
              <button onClick={() => setShowHelp(!showHelp)} aria-label="How scoring works" className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Benchmark the firewall against Sophos best-practice guidance so you can separate expected protections from meaningful posture gaps.
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground">based on Sophos documentation</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Score intent</p>
            <p className="text-sm font-semibold text-foreground mt-1">Show how closely the firewall aligns to Sophos guidance</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Best for</p>
            <p className="text-sm font-semibold text-foreground mt-1">Executive posture reviews and technical gap validation</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Outcome</p>
            <p className="text-sm font-semibold text-foreground mt-1">A clearer story around what is misconfigured, missing, or manually verified</p>
          </div>
        </div>

        {showHelp && <ScoringMethodology onClose={() => setShowHelp(false)} />}

        {/* Tabs */}
        {hasMultiple && (
          <div className="rounded-2xl border border-border/70 bg-card/70 p-2 mb-4 overflow-x-auto">
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

        <div className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5">
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
                <p className="text-2xl font-bold text-muted-foreground/70">{currentScore.notApplicable}</p>
                <p className="text-[10px] text-muted-foreground">N/A</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Check Results by Category */}
      <div className="space-y-3">
        <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(247,249,255,0.96))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.96),rgba(12,18,34,0.96))] px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="space-y-1 flex-1 min-w-[220px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                Findings by category
              </div>
              <p className="text-sm font-display font-black text-foreground">Detailed Sophos best-practice findings</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Expand each category to review evidence, remediation guidance, and any manually validated controls before you present the final posture story.
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

          return (
            <div key={category} className="rounded-[24px] border border-border/80 bg-card/90 overflow-hidden shadow-sm">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-muted/20 transition-colors"
              >
                <div className={`h-10 w-10 rounded-2xl border flex items-center justify-center shrink-0 ${theme.iconWrap}`}>
                  <Shield className="h-4 w-4 text-[#2006F7]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${theme.title}`}>{category}</p>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${theme.pill}`}>
                      {checks.length} check{checks.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-1 ${theme.summary}`}>{catPassed} aligned • {Math.max(catApplicable - catPassed, 0)} need attention</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {catFailed > 0 && (
                    <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-400 text-[10px] font-medium border border-red-500/10">
                      {catFailed} fail
                    </span>
                  )}
                  {catApplicable > 0 && (
                    <span className="px-2 py-1 rounded-full border border-border bg-background/60 text-[10px] text-muted-foreground font-medium">
                      {catPassed}/{catApplicable}
                    </span>
                  )}
                  <div className="h-8 w-8 rounded-full border border-border bg-background/70 flex items-center justify-center">
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/80 bg-muted/[0.08] divide-y divide-border/80">
                  {checks.map((result) => {
                    const isOverridden = result.manualOverride === true;
                    const isWarnAndOverrideable = result.status === "warn" && result.applicable;
                    const skipManualComply =
                      isSeHealthCheckBp && SE_HEALTH_CHECK_BP_NO_MANUAL_COMPLY_IDS.has(result.check.id);
                    const showManualOverrideButton =
                      (!skipManualComply && isWarnAndOverrideable) || isOverridden;
                    const cfg = STATUS_CONFIG[result.status];
                    const Icon = cfg.icon;
                    return (
                      <div key={result.check.id} className={`px-4 sm:px-5 py-4 flex items-start gap-3 ${!result.applicable ? "opacity-40" : ""}`}>
                        <div className={`mt-0.5 h-8 w-8 rounded-xl border border-border/60 ${cfg.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-3 w-3 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{result.check.title}</p>
                            {isOverridden && (
                              <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                                Manual
                              </span>
                            )}
                            {activeTab === "overall" && hasMultiple && (result.status === "fail" || result.status === "warn") && perFwCheckStatus.has(result.check.id) && (
                              <span className="px-2 py-0.5 rounded-full text-[8px] font-medium bg-muted text-muted-foreground border border-border">
                                {perFwCheckStatus.get(result.check.id)!.join(", ")}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{result.detail}</p>
                          {result.status === "fail" && (
                            <p className="text-[10px] text-amber-400/90 mt-1 leading-relaxed">
                              <span className="font-medium">Sophos recommendation:</span> {result.check.recommendation}
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
                          className="mt-0.5 text-muted-foreground/40 hover:text-[#2006F7] transition-colors shrink-0"
                          title="View Sophos docs"
                        >
                          <ExternalLink className="h-3 w-3" />
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

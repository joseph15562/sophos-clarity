import { useState, useMemo, useCallback, useEffect } from "react";
import { Shield, CheckCircle2, XCircle, AlertTriangle, MinusCircle, ExternalLink, ChevronDown, UserCheck, Undo2, Lock } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  type LicenceTier,
  type LicenceSelection,
  type ModuleId,
  type CheckStatus,
  MODULES,
  getActiveModules,
  computeSophosBPScore,
} from "@/lib/sophos-licence";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getCentralStatus } from "@/lib/sophos-central";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  centralLicences?: Array<{ product: string; endDate: string; type: string }>;
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
  na: { icon: MinusCircle, color: "text-muted-foreground/50", bg: "bg-muted/30", label: "N/A" },
};

const GRADE_COLORS: Record<string, string> = {
  A: "#00F2B3",
  B: "#00F2B3",
  C: "#F8E300",
  D: "#F29400",
  F: "#EA0022",
};

function GaugeRing({ score, grade }: { score: number; grade: string }) {
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = GRADE_COLORS[grade] ?? GRADE_COLORS.C;

  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 60 60)" className="transition-all duration-700"
      />
      <text x="60" y="54" textAnchor="middle" fill={color} fontSize="28" fontWeight="700">{score}</text>
      <text x="60" y="72" textAnchor="middle" fill={color} fontSize="12" fontWeight="600">Grade {grade}</text>
    </svg>
  );
}

const OVERRIDES_KEY = "sophos-bp-manual-overrides";

function loadOverrides(): Set<string> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveOverrides(overrides: Set<string>) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify([...overrides]));
}

function detectTierFromCentral(licences: Array<{ product: string; endDate: string; type: string }> | undefined): LicenceTier | null {
  if (!licences || licences.length === 0) return null;
  const names = licences.map((l) => l.product.toLowerCase());
  if (names.some((n) => n.includes("xstream"))) return "xstream";
  if (names.some((n) => n.includes("standard"))) return "standard";
  return null;
}

export function SophosBestPractice({ analysisResults, centralLicences }: Props) {
  const { org, isGuest } = useAuth();
  const orgId = org?.id ?? "";

  const detectedTier = useMemo(() => detectTierFromCentral(centralLicences), [centralLicences]);
  const isLocked = detectedTier !== null;

  const [tier, setTier] = useState<LicenceTier>("xstream");
  const [individualModules, setIndividualModules] = useState<ModuleId[]>([
    "networkProtection",
    "webProtection",
  ]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [manualOverrides, setManualOverrides] = useState<Set<string>>(loadOverrides);
  const [centralLinked, setCentralLinked] = useState(false);

  useEffect(() => {
    if (detectedTier) setTier(detectedTier);
  }, [detectedTier]);

  useEffect(() => { saveOverrides(manualOverrides); }, [manualOverrides]);

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
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [orgId, isGuest]);

  const licence: LicenceSelection = useMemo(
    () => ({ tier, modules: individualModules }),
    [tier, individualModules],
  );

  const activeModules = useMemo(() => getActiveModules(licence), [licence]);

  const toggleModule = useCallback((mod: ModuleId) => {
    setIndividualModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }, []);

  const toggleOverride = useCallback((checkId: string) => {
    setManualOverrides((prev) => {
      const next = new Set(prev);
      next.has(checkId) ? next.delete(checkId) : next.add(checkId);
      return next;
    });
  }, []);

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

  const centralAutoChecks = useMemo(() => {
    if (!centralLinked) return undefined;
    return new Set(["bp-central-mgmt"]);
  }, [centralLinked]);

  const bpScore = useMemo(() => {
    if (!aggregateResult) return null;
    return computeSophosBPScore(aggregateResult, licence, manualOverrides, centralAutoChecks);
  }, [aggregateResult, licence, manualOverrides, centralAutoChecks]);

  if (!bpScore) return null;

  const manualCount = bpScore.results.filter((r) => r.manualOverride).length;

  const grouped = new Map<string, typeof bpScore.results>();
  for (const r of bpScore.results) {
    const cat = r.check.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(r);
  }

  return (
    <div className="space-y-5">
      {/* Licence Picker */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[#2006F7]" />
          <h3 className="text-sm font-display font-bold text-foreground">Sophos Licence Selection</h3>
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3] ml-auto">
              <Lock className="h-2.5 w-2.5" />
              Auto-detected from Sophos Central
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {(Object.entries(TIER_INFO) as [LicenceTier, typeof TIER_INFO.standard][]).map(([key, info]) => {
            const isSelected = tier === key;
            const isDisabled = isLocked && !isSelected;
            return (
              <button
                key={key}
                onClick={() => !isLocked && setTier(key)}
                disabled={isLocked}
                className={`rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? isLocked
                      ? "border-[#00995a] bg-[#00995a]/10 ring-1 ring-[#00995a]/30"
                      : "border-[#2006F7] bg-[#2006F7]/10 ring-1 ring-[#2006F7]/30"
                    : isDisabled
                      ? "border-border opacity-40 cursor-not-allowed"
                      : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-semibold ${
                    isSelected
                      ? isLocked ? "text-[#00995a] dark:text-[#00F2B3]" : "text-[#2006F7] dark:text-[#6B5BFF]"
                      : "text-foreground"
                  }`}>
                    {info.label}
                  </p>
                  {isSelected && isLocked && <Lock className="h-3 w-3 text-[#00995a] dark:text-[#00F2B3]" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{info.description}</p>
              </button>
            );
          })}
        </div>

        {/* Individual module checkboxes */}
        {tier === "individual" && (
          <div className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">Select Licensed Modules</p>
            {(Object.values(MODULES)).map((mod) => (
              <label key={mod.id} className="flex items-start gap-2.5 cursor-pointer group">
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
            <span key={modId} className="px-2 py-0.5 rounded-full bg-[#2006F7]/10 text-[#2006F7] dark:text-[#6B5BFF] text-[10px] font-medium">
              {MODULES[modId].label}
            </span>
          ))}
        </div>
      </div>

      {/* Score Overview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[#2006F7]" />
          <h3 className="text-sm font-display font-bold text-foreground">Sophos Best Practice Score</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">based on Sophos documentation</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <GaugeRing score={bpScore.overall} grade={bpScore.grade} />
            {manualCount > 0 && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <UserCheck className="h-2.5 w-2.5" />
                {manualCount} manually confirmed
              </span>
            )}
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{bpScore.passed}</p>
              <p className="text-[10px] text-muted-foreground">Passed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{bpScore.failed}</p>
              <p className="text-[10px] text-muted-foreground">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{bpScore.warnings}</p>
              <p className="text-[10px] text-muted-foreground">Verify</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground/50">{bpScore.notApplicable}</p>
              <p className="text-[10px] text-muted-foreground">N/A</p>
            </div>
          </div>
        </div>
      </div>

      {/* Check Results by Category */}
      <div className="space-y-2">
        {Array.from(grouped.entries()).map(([category, checks]) => {
          const isExpanded = expandedCategories.has(category);
          const catPassed = checks.filter((c) => c.status === "pass").length;
          const catApplicable = checks.filter((c) => c.applicable && c.status !== "na").length;
          const catFailed = checks.filter((c) => c.status === "fail").length;

          return (
            <div key={category} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <Shield className="h-4 w-4 text-[#2006F7] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{category}</p>
                  <p className="text-[10px] text-muted-foreground">{checks.length} check{checks.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {catFailed > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-medium">
                      {catFailed} fail
                    </span>
                  )}
                  {catApplicable > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {catPassed}/{catApplicable}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {checks.map((result) => {
                    const isOverridden = result.manualOverride === true;
                    const isWarnAndOverrideable = result.status === "warn" && result.applicable;
                    const cfg = STATUS_CONFIG[result.status];
                    const Icon = cfg.icon;
                    return (
                      <div key={result.check.id} className={`px-4 py-3 flex items-start gap-3 ${!result.applicable ? "opacity-40" : ""}`}>
                        <div className={`mt-0.5 h-5 w-5 rounded-md ${cfg.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-3 w-3 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-foreground">{result.check.title}</p>
                            {isOverridden && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400">
                                Manual
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
                          {(isWarnAndOverrideable || isOverridden) && (
                            <button
                              onClick={() => toggleOverride(result.check.id)}
                              className={`mt-2 flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                                isOverridden
                                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400"
                                  : "bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF] hover:bg-[#2006F7]/20"
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

import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import {
  BookOpen,
  Search,
  ArrowLeft,
  Clock,
  Star,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  Shield,
  Lock,
  Wifi,
  Eye,
  AlertTriangle,
  Zap,
  Sun,
  Moon,
  Globe,
  Radio,
  Layers,
  Activity,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { useRemediationPlaybookToggleMutation } from "@/hooks/queries/use-remediation-status-mutations";
import { useRemediationPlaybookIdsQuery } from "@/hooks/queries/use-remediation-playbook-ids-query";
import { warnOptionalError } from "@/lib/client-error-feedback";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { BEST_PRACTICE_CHECKS, MODULES, type BestPracticeCheck } from "@/lib/sophos-licence";
import { ALL_FRAMEWORK_NAMES } from "@/lib/compliance-map";

const REMEDIATION_CUSTOMER_HASH = "__org_default__";

/* ------------------------------------------------------------------ */
/*  Category configuration                                             */
/* ------------------------------------------------------------------ */

const CATEGORY_COLOURS: Record<string, string> = {
  "Device Hardening": "#2006F7",
  "Visibility & Monitoring": "#5A00FF",
  "Encryption & Inspection": "#00EDFF",
  "Rule Hygiene": "#F29400",
  "Network Protection": "#009CFB",
  "Web Protection": "#00F2B3",
  "Zero-Day Protection": "#EA0022",
  "Central Orchestration": "#7C3AED",
  "DNS Protection": "#06B6D4",
  "Active Threat Response": "#EF4444",
  "Synchronized Security": "#3B82F6",
  Resilience: "#10B981",
  "DoS & Spoof Protection": "#F59E0B",
  "VPN Security": "#8B5CF6",
};

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "Device Hardening": Shield,
  "Visibility & Monitoring": Eye,
  "Encryption & Inspection": Lock,
  "Rule Hygiene": Zap,
  "Network Protection": Activity,
  "Web Protection": Globe,
  "Zero-Day Protection": AlertTriangle,
  "Central Orchestration": Cloud,
  "DNS Protection": Globe,
  "Active Threat Response": Radio,
  "Synchronized Security": Wifi,
  Resilience: Layers,
  "DoS & Spoof Protection": Shield,
  "VPN Security": Lock,
};

const DIFFICULTY_COLOUR: Record<string, string> = {
  Easy: "#00F2B3",
  Medium: "#F29400",
  Hard: "#EA0022",
};

const FRAMEWORK_COLOUR: Record<string, string> = {
  PSN: "#2006F7",
  "NCSC CAF": "#009CFB",
  "ISO 27001": "#00F2B3",
  "Cyber Essentials / CE+": "#F29400",
  "PCI DSS": "#EA0022",
  "NIST 800-53": "#5A00FF",
  GDPR: "#7C3AED",
  NIS2: "#0EA5E9",
  "DfE / KCSIE": "#06B6D4",
  HIPAA: "#8B5CF6",
  SOX: "#D946EF",
  FCA: "#F43F5E",
  CMMC: "#14B8A6",
  "IEC 62443": "#EAB308",
  "MOD Cyber / ITAR": "#64748B",
  CIPA: "#FB923C",
  FedRAMP: "#3B82F6",
  "NERC CIP": "#10B981",
  "NCSC Guidelines": "#0284C7",
  HITECH: "#A855F7",
  PRA: "#E11D48",
  "NIST 800-82": "#6366F1",
  "Ohio DPA": "#059669",
};

const CATEGORY_FRAMEWORKS: Record<string, string[]> = {
  "Device Hardening": ["Cyber Essentials / CE+", "NCSC CAF", "PSN", "ISO 27001", "NIST 800-53"],
  "Visibility & Monitoring": ["NCSC CAF", "PSN", "ISO 27001", "PCI DSS", "SOX", "GDPR"],
  "Encryption & Inspection": [
    "NCSC CAF",
    "PSN",
    "ISO 27001",
    "PCI DSS",
    "DfE / KCSIE",
    "NIST 800-53",
  ],
  "Rule Hygiene": ["NCSC CAF", "ISO 27001", "PCI DSS", "NIST 800-53", "FCA"],
  "Network Protection": ["NCSC CAF", "PSN", "ISO 27001", "PCI DSS", "NIST 800-53", "NIS2"],
  "Web Protection": [
    "NCSC CAF",
    "PSN",
    "Cyber Essentials / CE+",
    "ISO 27001",
    "DfE / KCSIE",
    "CIPA",
  ],
  "Zero-Day Protection": ["NCSC CAF", "ISO 27001", "PCI DSS", "NIST 800-53", "NIS2"],
  "Central Orchestration": ["NCSC CAF", "PSN"],
  "DNS Protection": ["Cyber Essentials / CE+", "DfE / KCSIE", "NCSC CAF"],
  "Active Threat Response": [
    "NCSC CAF",
    "PSN",
    "ISO 27001",
    "NIST 800-53",
    "NIS2",
    "MOD Cyber / ITAR",
  ],
  "Synchronized Security": ["NCSC CAF", "PSN", "ISO 27001"],
  Resilience: ["NCSC CAF", "PSN", "ISO 27001", "NIS2"],
  "DoS & Spoof Protection": ["NCSC CAF", "PSN", "ISO 27001", "NIST 800-53", "NIS2", "IEC 62443"],
  "VPN Security": ["NCSC CAF", "PSN", "ISO 27001", "PCI DSS", "NIST 800-53", "NIS2"],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getDifficulty(weight: number): "Easy" | "Medium" | "Hard" {
  if (weight >= 9) return "Hard";
  if (weight >= 7) return "Medium";
  return "Easy";
}

function getTimeMinutes(weight: number): number {
  return weight * 2;
}

function deriveSteps(recommendation: string): string[] {
  const cleaned = recommendation.endsWith(".") ? recommendation.slice(0, -1) : recommendation;
  const parts = cleaned
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [recommendation];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function PlaybookLibraryInner() {
  const { setTheme } = useTheme();
  const { org } = useAuth();
  const { mutate: syncPlaybookRemediation } = useRemediationPlaybookToggleMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const appliedHighlightRef = useRef(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [expandedPlaybook, setExpandedPlaybook] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(() => {
    const set = new Set<string>();
    try {
      BEST_PRACTICE_CHECKS.forEach((c) => {
        if (localStorage.getItem(`firecomply_playbook_completed_${c.id}`)) {
          set.add(c.id);
        }
      });
    } catch {
      /* localStorage unavailable */
    }
    return set;
  });

  const remediationIdsQuery = useRemediationPlaybookIdsQuery(
    org?.id ?? null,
    org?.id ? REMEDIATION_CUSTOMER_HASH : null,
  );

  useEffect(() => {
    if (!remediationIdsQuery.isSuccess || !org?.id) return;
    const rows = remediationIdsQuery.data;
    if (!rows?.length) return;
    setCompleted((prev) => {
      const next = new Set(prev);
      for (const playbook_id of rows) {
        next.add(playbook_id);
        try {
          localStorage.setItem(`firecomply_playbook_completed_${playbook_id}`, "true");
        } catch (e) {
          warnOptionalError("PlaybookLibrary.markCompletedLocal", e);
        }
      }
      return next;
    });
  }, [org?.id, remediationIdsQuery.isSuccess, remediationIdsQuery.data]);

  const isDark = useResolvedIsDark();

  useEffect(() => {
    if (appliedHighlightRef.current) return;
    const h = searchParams.get("highlight")?.trim();
    if (!h) {
      appliedHighlightRef.current = true;
      return;
    }
    appliedHighlightRef.current = true;
    const byId = BEST_PRACTICE_CHECKS.find((c) => c.id === h);
    setSearch(byId ? byId.title : h);
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete("highlight");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const allCategories = useMemo(() => {
    const cats = [...new Set(BEST_PRACTICE_CHECKS.map((c) => c.category))];
    cats.sort();
    return ["All", ...cats];
  }, []);

  const filtered = useMemo(() => {
    return BEST_PRACTICE_CHECKS.filter((check) => {
      const matchesCategory = selectedCategory === "All" || check.category === selectedCategory;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        check.title.toLowerCase().includes(q) ||
        check.recommendation.toLowerCase().includes(q) ||
        check.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

  const avgTime = Math.round(
    BEST_PRACTICE_CHECKS.reduce((s, c) => s + getTimeMinutes(c.weight), 0) /
      BEST_PRACTICE_CHECKS.length,
  );
  const uniqueCategories = new Set(BEST_PRACTICE_CHECKS.map((c) => c.category)).size;

  function toggleComplete(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      const adding = !next.has(id);
      if (next.has(id)) {
        next.delete(id);
        localStorage.removeItem(`firecomply_playbook_completed_${id}`);
      } else {
        next.add(id);
        localStorage.setItem(`firecomply_playbook_completed_${id}`, "true");
      }
      if (org?.id) {
        syncPlaybookRemediation({
          orgId: org.id,
          adding,
          playbookId: id,
          customerHash: REMEDIATION_CUSTOMER_HASH,
        });
      }
      return next;
    });
  }

  const expandedCheck = expandedPlaybook
    ? (BEST_PRACTICE_CHECKS.find((c) => c.id === expandedPlaybook) ?? null)
    : null;

  const expandedDifficulty = expandedCheck ? getDifficulty(expandedCheck.weight) : null;
  const expandedTimeMin = expandedCheck ? getTimeMinutes(expandedCheck.weight) : 0;
  const expandedSteps = expandedCheck ? deriveSteps(expandedCheck.recommendation) : [];
  const expandedFrameworks = expandedCheck
    ? (CATEGORY_FRAMEWORKS[expandedCheck.category] ?? []).filter((fw) =>
        ALL_FRAMEWORK_NAMES.includes(fw),
      )
    : [];
  const ExpandedCatIcon = expandedCheck
    ? (CATEGORY_ICON_MAP[expandedCheck.category] ?? Shield)
    : Shield;

  const cardBg = isDark
    ? "linear-gradient(145deg, rgba(90,0,255,0.07), rgba(0,237,255,0.025))"
    : "linear-gradient(145deg, rgba(255,255,255,0.99), rgba(247,249,255,0.96))";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header
        className="relative overflow-hidden border-b border-white/[0.06]"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #001030 0%, #001A47 40%, #0D1B4A 100%)"
            : "linear-gradient(135deg, #001A47 0%, #002366 40%, #0D2B6B 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 20% 50%, rgba(32,6,247,0.25), transparent 50%), radial-gradient(circle at 80% 30%, rgba(0,237,255,0.15), transparent 50%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#2006F7]/40 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-6 pt-6 pb-8">
          <nav className="flex items-center gap-2 text-xs text-white/50 mb-6">
            <Link to="/" className="hover:text-white/80 transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white/80">Remediation Playbooks</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-[#2006F7]/20 border border-[#2006F7]/30 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-[#00EDFF]" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Remediation Playbooks
                </h1>
              </div>
              <p className="text-sm text-white/60 max-w-lg">
                Step-by-step Sophos firewall security guides sourced from{" "}
                {BEST_PRACTICE_CHECKS.length} best-practice checks. Follow these playbooks to harden
                your firewall, close compliance gaps, and improve your security posture.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.15] transition-all"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search playbooks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/[0.08] border border-white/[0.12] text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#2006F7]/50 focus:border-[#2006F7]/50 transition-all backdrop-blur-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <WorkspacePrimaryNav />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Category chips ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {allCategories.map((cat) => {
            const active = selectedCategory === cat;
            const colour = cat === "All" ? "#2006F7" : CATEGORY_COLOURS[cat] || "#666";
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border"
                style={{
                  background: active ? colour + "22" : "transparent",
                  borderColor: active ? colour + "55" : "var(--border)",
                  color: active ? colour : "var(--muted-foreground)",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Playbooks",
              value: BEST_PRACTICE_CHECKS.length,
              icon: <BookOpen className="h-4 w-4" />,
            },
            { label: "Categories", value: uniqueCategories, icon: <Star className="h-4 w-4" /> },
            {
              label: "Avg. Completion",
              value: `${avgTime} min`,
              icon: <Clock className="h-4 w-4" />,
            },
            {
              label: "Completed",
              value: `${completed.size}/${BEST_PRACTICE_CHECKS.length}`,
              icon: <CheckCircle2 className="h-4 w-4" />,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-md p-4 flex items-center gap-4 shadow-sm"
            >
              <div className="h-10 w-10 rounded-xl bg-[#2006F7]/10 border border-[#2006F7]/20 flex items-center justify-center text-[#2006F7]">
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Grid + Detail panel ── */}
        <div className={`flex flex-col ${expandedCheck ? "lg:flex-row" : ""} gap-6`}>
          <div
            className={`grid gap-4 ${expandedCheck ? "lg:w-1/2 grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}
          >
            {filtered.map((check) => {
              const isExpanded = expandedPlaybook === check.id;
              const isComplete = completed.has(check.id);
              const catColour = CATEGORY_COLOURS[check.category] || "#666";
              const difficulty = getDifficulty(check.weight);
              const timeMin = getTimeMinutes(check.weight);
              const CatIcon = CATEGORY_ICON_MAP[check.category] || Shield;
              const frameworks = (CATEGORY_FRAMEWORKS[check.category] ?? []).slice(0, 4);

              return (
                <div
                  key={check.id}
                  className={`group relative rounded-2xl border backdrop-blur-md p-5 transition-all duration-200 cursor-pointer ${
                    isExpanded
                      ? "border-[#2006F7]/40 shadow-[0_0_24px_rgba(32,6,247,0.1)]"
                      : "border-slate-900/[0.10] dark:border-white/[0.06] hover:border-[#2006F7]/25 hover:shadow-md"
                  } ${isComplete ? "opacity-75" : ""}`}
                  style={{
                    background: isExpanded
                      ? isDark
                        ? "rgba(32,6,247,0.06)"
                        : "rgba(32,6,247,0.04)"
                      : cardBg,
                  }}
                  onClick={() => setExpandedPlaybook(isExpanded ? null : check.id)}
                >
                  {isComplete && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="h-5 w-5 text-[#00F2B3]" />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: catColour + "18", color: catColour }}
                    >
                      <CatIcon className="h-3.5 w-3.5" />
                      {check.category}
                    </span>
                    {check.requiredModule && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Requires {MODULES[check.requiredModule].label}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold mb-1 leading-snug pr-6">{check.title}</h3>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeMin} min
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      style={{
                        background: DIFFICULTY_COLOUR[difficulty] + "18",
                        color: DIFFICULTY_COLOUR[difficulty],
                      }}
                    >
                      {difficulty}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                    {check.recommendation}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {frameworks.map((fw) => (
                      <span
                        key={fw}
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
                        style={{
                          background: (FRAMEWORK_COLOUR[fw] || "#666") + "15",
                          color: FRAMEWORK_COLOUR[fw] || "#666",
                        }}
                      >
                        {fw}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      className="text-xs font-semibold text-[#2006F7] hover:text-[#1400d6] transition-colors flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPlaybook(isExpanded ? null : check.id);
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Hide Guide
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-3.5 w-3.5" />
                          View Guide
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  className="!py-12"
                  icon={<Search className="h-6 w-6 text-muted-foreground/50" />}
                  title="No playbooks match your search"
                  description="Try a different category, difficulty, or clear the search box."
                />
              </div>
            )}
          </div>

          {/* ── Expanded detail panel ── */}
          {expandedCheck && (
            <div className="lg:w-1/2 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-lg overflow-hidden">
                <div
                  className="p-6 border-b border-white/[0.06]"
                  style={{
                    background: isDark
                      ? "linear-gradient(135deg, #001030, #001A47)"
                      : "linear-gradient(135deg, #001A47, #002366)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: (CATEGORY_COLOURS[expandedCheck.category] || "#666") + "22",
                        color: CATEGORY_COLOURS[expandedCheck.category] || "#fff",
                      }}
                    >
                      <ExpandedCatIcon className="h-3.5 w-3.5" />
                      {expandedCheck.category}
                    </span>
                    <button
                      onClick={() => setExpandedPlaybook(null)}
                      className="text-white/40 hover:text-white/80 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <h2 className="text-lg font-bold text-white mb-2">{expandedCheck.title}</h2>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {expandedTimeMin} min
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      style={{
                        background: DIFFICULTY_COLOUR[expandedDifficulty!] + "25",
                        color: DIFFICULTY_COLOUR[expandedDifficulty!],
                      }}
                    >
                      {expandedDifficulty}
                    </span>
                    {expandedCheck.requiredModule && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400">
                        {MODULES[expandedCheck.requiredModule].label}
                      </span>
                    )}
                    {completed.has(expandedCheck.id) && (
                      <span className="flex items-center gap-1 text-[#007A5A] dark:text-[#00F2B3]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Completed
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-6 max-h-[calc(100vh-240px)] overflow-y-auto">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#F29400]" />
                      Why This Matters
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {expandedCheck.recommendation}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-[#2006F7]" />
                      Remediation Steps
                    </h4>
                    <ol className="space-y-3">
                      {expandedSteps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#2006F7]/10 border border-[#2006F7]/20 text-[#2006F7] text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <div className="pt-0.5">
                            <p className="text-sm leading-relaxed">{step}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-[#00F2B3]" />
                      Compliance Frameworks
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {expandedFrameworks.map((fw) => (
                        <span
                          key={fw}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold border"
                          style={{
                            background: (FRAMEWORK_COLOUR[fw] || "#666") + "10",
                            color: FRAMEWORK_COLOUR[fw] || "#666",
                            borderColor: (FRAMEWORK_COLOUR[fw] || "#666") + "20",
                          }}
                        >
                          {fw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <a
                    href={expandedCheck.reference}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs font-semibold text-[#009CFB] hover:text-[#2006F7] transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Sophos Documentation
                  </a>

                  <Button
                    className="w-full"
                    variant={completed.has(expandedCheck.id) ? "outline" : "default"}
                    onClick={() => toggleComplete(expandedCheck.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {completed.has(expandedCheck.id) ? "Mark Incomplete" : "Mark Complete"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PlaybookLibrary() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <PlaybookLibraryInner />
    </AuthProvider>
  );
}

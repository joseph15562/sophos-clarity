import { lazy, Suspense, useRef, useEffect, useState, useCallback } from "react";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import {
  ArrowLeftRight,
  Download,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  Wrench,
  ClipboardCheck,
  SlidersHorizontal,
  Scale,
  Shield,
  ChevronDown,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EstateOverview } from "@/components/EstateOverview";
import { ReportUpsellStrip } from "@/components/ReportUpsellStrip";
import { FindingsChanges } from "@/components/FindingsChanges";
import { HeroOutcomePanel } from "@/components/HeroOutcomePanel";
import { CriticalActionsPanel } from "@/components/CriticalActionsPanel";
import { ChartSkeleton, StatGridSkeleton, CardSkeleton } from "@/components/DashboardSkeleton";
import { WidgetCustomiser } from "@/components/WidgetCustomiser";
import { downloadRiskRegisterCSV, downloadRiskRegisterExcel } from "@/lib/risk-register";
import { downloadInteractiveHtml } from "@/lib/analysis-interactive-html";
import {
  loadWidgetPreferences,
  isWidgetVisible,
  type WidgetPreferences,
} from "@/lib/widget-preferences";
import { TourHint } from "@/components/TourHint";
import type { AnalysisResult } from "@/lib/analyse-config";
import type { InspectionPosture } from "@/lib/analyse-config";
import type { BrandingData } from "@/components/BrandingSetup";
import type { ParsedFile } from "@/hooks/use-report-generation";
import type { RiskScoreResult } from "@/lib/risk-score";
import type { FindingsCsvReviewerSignoff } from "@/lib/findings-export";
import type { ComplianceFramework } from "@/lib/compliance-context-options";
import { SecurityPostureScorecard } from "@/components/SecurityPostureScorecard";
import { cn } from "@/lib/utils";
import {
  accentKindFromHex,
  statDarkGradientOverlayStyle,
  statValueTextClass,
} from "@/lib/stat-accent";
import { ScoreDialGauge } from "@/components/ScoreDialGauge";
import { ScoreDeltaBanner } from "@/components/ScoreDeltaBanner";
import { QuickActions } from "@/components/QuickActions";
import { RiskScoreDashboard } from "@/components/RiskScoreDashboard";
import { RemediationPlaybooks } from "@/components/RemediationPlaybooks";
import { ComplianceHeatmap } from "@/components/ComplianceHeatmap";
import { CertificatePostureStrip } from "@/components/CertificatePostureStrip";
import { VpnTopologyDiagram } from "@/components/VpnTopologyDiagram";
import { InsuranceReadiness } from "@/components/InsuranceReadiness";
import { RuleOptimiser } from "@/components/RuleOptimiser";
import { SophosBestPractice } from "@/components/SophosBestPractice";

const ConsistencyChecker = lazy(() =>
  import("@/components/ConsistencyChecker").then((m) => ({ default: m.ConsistencyChecker })),
);
const ScoreSimulator = lazy(() =>
  import("@/components/ScoreSimulator").then((m) => ({ default: m.ScoreSimulator })),
);
const AttackSurfaceMap = lazy(() =>
  import("@/components/AttackSurfaceMap").then((m) => ({ default: m.AttackSurfaceMap })),
);
const SeverityBreakdown = lazy(() =>
  import("@/components/SecurityDashboards").then((m) => ({ default: m.SeverityBreakdown })),
);
const SecurityFeatureCoverage = lazy(() =>
  import("@/components/SecurityDashboards").then((m) => ({ default: m.SecurityFeatureCoverage })),
);
const ZoneTrafficFlow = lazy(() =>
  import("@/components/SecurityDashboards").then((m) => ({ default: m.ZoneTrafficFlow })),
);
const TopFindings = lazy(() =>
  import("@/components/SecurityDashboards").then((m) => ({ default: m.TopFindings })),
);
const RuleHealthOverview = lazy(() =>
  import("@/components/SecurityDashboards").then((m) => ({ default: m.RuleHealthOverview })),
);
const FindingsBySection = lazy(() =>
  import("@/components/SecurityDashboards").then((m) => ({ default: m.FindingsBySection })),
);
const PriorityMatrix = lazy(() =>
  import("@/components/PriorityMatrix").then((m) => ({ default: m.PriorityMatrix })),
);
const CentralEnrichment = lazy(() =>
  import("@/components/CentralEnrichment").then((m) => ({ default: m.CentralEnrichment })),
);
const ProtocolServiceWidget = lazy(() =>
  import("@/components/ProtocolServiceWidget").then((m) => ({ default: m.ProtocolServiceWidget })),
);
const ComplianceGapWidget = lazy(() =>
  import("@/components/ComplianceGapWidget").then((m) => ({ default: m.ComplianceGapWidget })),
);
const RiskRoiWidget = lazy(() =>
  import("@/components/RiskRoiWidget").then((m) => ({ default: m.RiskRoiWidget })),
);
const RuleAnalysisWidget = lazy(() =>
  import("@/components/RuleAnalysisWidget").then((m) => ({ default: m.RuleAnalysisWidget })),
);
const FindingsByAge = lazy(() =>
  import("@/components/FindingsByAge").then((m) => ({ default: m.FindingsByAge })),
);
const RemediationVelocity = lazy(() =>
  import("@/components/RemediationVelocity").then((m) => ({ default: m.RemediationVelocity })),
);
const SlaComplianceGauge = lazy(() =>
  import("@/components/SlaComplianceGauge").then((m) => ({ default: m.SlaComplianceGauge })),
);
const AlertFeedWidget = lazy(() =>
  import("@/components/AlertFeed").then((m) => ({ default: m.AlertFeed })),
);
const CategoryScoreBars = lazy(() =>
  import("@/components/CategoryScoreBars").then((m) => ({ default: m.CategoryScoreBars })),
);
const RuleActionDistribution = lazy(() =>
  import("@/components/RuleActionDistribution").then((m) => ({
    default: m.RuleActionDistribution,
  })),
);
const CoverageMatrix = lazy(() =>
  import("@/components/CoverageMatrix").then((m) => ({ default: m.CoverageMatrix })),
);
const RiskDistributionWidget = lazy(() =>
  import("@/components/RiskDistribution").then((m) => ({ default: m.RiskDistribution })),
);
const CategoryTrends = lazy(() =>
  import("@/components/CategoryTrends").then((m) => ({ default: m.CategoryTrends })),
);
const FindingHeatmapTime = lazy(() =>
  import("@/components/FindingHeatmapTime").then((m) => ({ default: m.FindingHeatmapTime })),
);
const AdminExposureMap = lazy(() =>
  import("@/components/AdminExposureMap").then((m) => ({ default: m.AdminExposureMap })),
);
const VpnSecuritySummary = lazy(() =>
  import("@/components/VpnSecuritySummary").then((m) => ({ default: m.VpnSecuritySummary })),
);
const NetworkZoneMap = lazy(() =>
  import("@/components/NetworkZoneMap").then((m) => ({ default: m.NetworkZoneMap })),
);
const PolicyComplexity = lazy(() =>
  import("@/components/PolicyComplexity").then((m) => ({ default: m.PolicyComplexity })),
);
const UnusedObjects = lazy(() =>
  import("@/components/UnusedObjects").then((m) => ({ default: m.UnusedObjects })),
);
const ConfigSizeMetrics = lazy(() =>
  import("@/components/ConfigSizeMetrics").then((m) => ({ default: m.ConfigSizeMetrics })),
);
const CompliancePostureRing = lazy(() =>
  import("@/components/CompliancePostureRing").then((m) => ({ default: m.CompliancePostureRing })),
);
const FrameworkCoverageBars = lazy(() =>
  import("@/components/FrameworkCoverageBars").then((m) => ({ default: m.FrameworkCoverageBars })),
);
const GeographicFleetMap = lazy(() =>
  import("@/components/GeographicFleetMap").then((m) => ({ default: m.GeographicFleetMap })),
);
const ExportCentre = lazy(() =>
  import("@/components/ExportCentre").then((m) => ({ default: m.ExportCentre })),
);
// WhatIfComparison removed — functionality consolidated into ScoreSimulator (Remediation Impact Simulator)
const RemediationRoadmap = lazy(() =>
  import("@/components/RemediationRoadmap").then((m) => ({ default: m.RemediationRoadmap })),
);
const FixEffortBreakdown = lazy(() =>
  import("@/components/FixEffortBreakdown").then((m) => ({ default: m.FixEffortBreakdown })),
);
const ImpactEffortBubble = lazy(() =>
  import("@/components/ImpactEffortBubble").then((m) => ({ default: m.ImpactEffortBubble })),
);
const RemediationProgress = lazy(() =>
  import("@/components/RemediationProgress").then((m) => ({ default: m.RemediationProgress })),
);
const ThreatFeedTimeline = lazy(() =>
  import("@/components/ThreatFeedTimeline").then((m) => ({ default: m.ThreatFeedTimeline })),
);
const MdrStatus = lazy(() =>
  import("@/components/MdrStatus").then((m) => ({ default: m.MdrStatus })),
);
const FirmwareTracker = lazy(() =>
  import("@/components/FirmwareTracker").then((m) => ({ default: m.FirmwareTracker })),
);
const AssessmentPulse = lazy(() =>
  import("@/components/AssessmentPulse").then((m) => ({ default: m.AssessmentPulse })),
);
const EvidenceCollection = lazy(() =>
  import("@/components/EvidenceCollection").then((m) => ({ default: m.EvidenceCollection })),
);
const RegulatoryTracker = lazy(() =>
  import("@/components/RegulatoryTracker").then((m) => ({ default: m.RegulatoryTracker })),
);
const BaselineManager = lazy(() =>
  import("@/components/BaselineManager").then((m) => ({ default: m.BaselineManager })),
);
const CompareToSavedBaseline = lazy(() =>
  import("@/components/CompareToSavedBaseline").then((m) => ({
    default: m.CompareToSavedBaseline,
  })),
);
const FindingsBulkView = lazy(() =>
  import("@/components/FindingsBulkView").then((m) => ({ default: m.FindingsBulkView })),
);

/**
 * Radix Tabs unmount inactive panels; each tab’s `React.lazy` chunks only start loading on first
 * open. In Vite dev, cold dynamic imports can leave Suspense fallbacks visible until a tab switch
 * remounts after modules are cached. Preload every lazy module used in this file once analysis
 * exists (plus a short dev-only second pass) so Overview and other default views hydrate without
 * forcing a tab hop.
 */
function preloadAnalysisTabsLazyChunks() {
  void import("@/components/ConsistencyChecker");
  void import("@/components/ScoreSimulator");
  void import("@/components/AttackSurfaceMap");
  void import("@/components/SecurityDashboards");
  void import("@/components/PriorityMatrix");
  void import("@/components/CentralEnrichment");
  void import("@/components/RiskSummaryCards");
  void import("@/components/ProtocolServiceWidget");
  void import("@/components/ComplianceGapWidget");
  void import("@/components/RiskRoiWidget");
  void import("@/components/RuleAnalysisWidget");
  void import("@/components/FindingsByAge");
  void import("@/components/RemediationVelocity");
  void import("@/components/SlaComplianceGauge");
  void import("@/components/AlertFeed");
  void import("@/components/CategoryScoreBars");
  void import("@/components/RuleActionDistribution");
  void import("@/components/CoverageMatrix");
  void import("@/components/RiskDistribution");
  void import("@/components/CategoryTrends");
  void import("@/components/FindingHeatmapTime");
  void import("@/components/AdminExposureMap");
  void import("@/components/VpnSecuritySummary");
  void import("@/components/NetworkZoneMap");
  void import("@/components/PolicyComplexity");
  void import("@/components/UnusedObjects");
  void import("@/components/ConfigSizeMetrics");
  void import("@/components/CompliancePostureRing");
  void import("@/components/FrameworkCoverageBars");
  void import("@/components/GeographicFleetMap");
  void import("@/components/ExportCentre");
  void import("@/components/RemediationRoadmap");
  void import("@/components/FixEffortBreakdown");
  void import("@/components/ImpactEffortBubble");
  void import("@/components/RemediationProgress");
  void import("@/components/ThreatFeedTimeline");
  void import("@/components/MdrStatus");
  void import("@/components/FirmwareTracker");
  void import("@/components/AssessmentPulse");
  void import("@/components/EvidenceCollection");
  void import("@/components/RegulatoryTracker");
  void import("@/components/BaselineManager");
  void import("@/components/CompareToSavedBaseline");
  void import("@/components/FindingsBulkView");
}

type DiffSelection = { beforeIdx: number; afterIdx: number } | null;

export interface SecurityStats {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  criticalHigh: number;
  coverage: number;
  totalRules: number;
}

export interface AnalysisTabsProps {
  analysisResult: Record<string, AnalysisResult>;
  files: ParsedFile[];
  branding: BrandingData;
  activeTab: string;
  setActiveTab: (v: string) => void;
  totalFindings: number;
  totalRules: number;
  totalSections: number;
  totalPopulated: number;
  extractionPct: number;
  aggregatedPosture: InspectionPosture;
  securityStats: SecurityStats | null;
  configMetas: Array<{ label: string; hostname?: string; configHash: string }>;
  diffSelection: DiffSelection;
  setDiffSelection: React.Dispatch<React.SetStateAction<DiffSelection>>;
  projectedScore: RiskScoreResult | null;
  setProjectedScore: React.Dispatch<React.SetStateAction<RiskScoreResult | null>>;
  isGuest: boolean;
  localMode: boolean;
  onExplainFinding: (title: string) => void;
  /** Organisation id for score-history widgets (authenticated). */
  orgId?: string;
  hasReports?: boolean;
  /** Historical trend snapshot to show on the score dial */
  trendSnapshot?: { score: number; grade: string; date: string } | null;
  /** For ConnectWise ticket creation from findings */
  firecomplyCustomerKey?: string;
  /** Cloud reviewer sign-off for the linked assessment snapshot (Export Centre CSV). */
  exportReviewerSignoff?: FindingsCsvReviewerSignoff | null;
  /** Union of per-config compliance frameworks (overrides branding.selectedFrameworks for heatmap). */
  aggregatedSelectedFrameworks?: string[];
}

function fileLabel(f: ParsedFile) {
  return f.label || f.fileName.replace(/\.(html|htm)$/i, "");
}

function SecurityWidgetShell({
  children,
  className: _className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <>{children}</>;
}

export function AnalysisTabs({
  analysisResult,
  files,
  branding,
  activeTab,
  setActiveTab,
  totalFindings,
  totalRules,
  totalSections,
  totalPopulated,
  extractionPct,
  aggregatedPosture,
  securityStats,
  configMetas,
  diffSelection,
  setDiffSelection,
  projectedScore,
  setProjectedScore,
  isGuest,
  localMode,
  onExplainFinding,
  orgId = "",
  hasReports = false,
  trendSnapshot,
  firecomplyCustomerKey,
  exportReviewerSignoff = null,
  aggregatedSelectedFrameworks,
}: AnalysisTabsProps) {
  const complianceFrameworks: string[] =
    aggregatedSelectedFrameworks && aggregatedSelectedFrameworks.length > 0
      ? aggregatedSelectedFrameworks
      : branding.selectedFrameworks;
  const analysisTabBarDark = useResolvedIsDark();
  const panelRef = useRef<HTMLDivElement>(null);
  const [widgetPrefs, setWidgetPrefs] = useState<WidgetPreferences>(() => loadWidgetPreferences());
  const w = (id: string) => isWidgetVisible(widgetPrefs, id);

  const analysisFileCount = Object.keys(analysisResult).length;
  useEffect(() => {
    if (analysisFileCount === 0) return;
    preloadAnalysisTabsLazyChunks();
    if (!import.meta.env.DEV) return;
    const t = window.setTimeout(() => preloadAnalysisTabsLazyChunks(), 250);
    return () => clearTimeout(t);
  }, [analysisFileCount]);

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    },
    [setActiveTab],
  );

  useEffect(() => {
    const t = setTimeout(() => panelRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [activeTab]);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* Hero outcome summary — visible above all tabs */}
      <HeroOutcomePanel
        analysisResults={analysisResult}
        totalFindings={totalFindings}
        fileCount={files.length}
        extractionPct={extractionPct}
        hasComplianceFrameworks={complianceFrameworks.length > 0}
        hasReports={hasReports}
      />

      <div
        className={cn(
          "sticky top-[53px] z-20 mt-5 rounded-xl px-5 py-4 backdrop-blur-xl",
          analysisTabBarDark ? "border border-white/[0.06]" : "border border-slate-200/90",
        )}
        style={{
          background: analysisTabBarDark
            ? "linear-gradient(135deg, rgba(10,14,28,0.88), rgba(14,18,36,0.92))"
            : "linear-gradient(135deg, rgba(255,255,255,0.97), rgba(248,250,252,0.99))",
          boxShadow: analysisTabBarDark
            ? "0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)"
            : "0 4px 24px rgba(15,23,42,0.07), inset 0 1px 0 rgba(255,255,255,0.95)",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: analysisTabBarDark
              ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)"
              : "linear-gradient(90deg, transparent, rgba(32,6,247,0.14), rgba(0,156,251,0.1), transparent)",
          }}
        />
        <h2 className="relative text-sm font-semibold text-foreground tracking-tight px-1 mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-accent/70" />
          Detailed Security Analysis
          <TourHint
            tourId="analysis-tabs"
            title="Analysis Tabs"
            description="Deep-dive into security analysis, compliance, remediation, optimisation, tools, and insurance readiness. Click any tab to explore."
          />
        </h2>
        <div
          className="relative overflow-x-auto overflow-y-visible scrollbar-hide"
          style={{ padding: "4px 4px" }}
        >
          <TabsList
            className="flex-nowrap whitespace-nowrap w-max min-w-full inline-flex"
            data-tour="analysis-tabs"
          >
            <TabsTrigger
              value="overview"
              className="gap-2"
              onPointerEnter={preloadAnalysisTabsLazyChunks}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Overview
              {totalFindings > 0 && (
                <span className="text-[10px] font-semibold min-w-[20px] text-center px-1.5 py-px rounded-full tabular-nums bg-destructive/90 text-white">
                  {totalFindings}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="gap-2"
              onPointerEnter={preloadAnalysisTabsLazyChunks}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Security Analysis
            </TabsTrigger>
            <TabsTrigger
              value="compliance"
              className="gap-2"
              onPointerEnter={preloadAnalysisTabsLazyChunks}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Compliance
            </TabsTrigger>
            {totalFindings > 0 && (
              <TabsTrigger
                value="remediation"
                className="gap-2"
                onPointerEnter={preloadAnalysisTabsLazyChunks}
              >
                <Wrench className="h-3.5 w-3.5" />
                Remediation
              </TabsTrigger>
            )}
            <TabsTrigger
              value="optimisation"
              className="gap-2"
              onPointerEnter={preloadAnalysisTabsLazyChunks}
            >
              <Zap className="h-3.5 w-3.5" />
              Optimisation
            </TabsTrigger>
            <TabsTrigger
              value="tools"
              className="gap-2"
              onPointerEnter={preloadAnalysisTabsLazyChunks}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Tools
            </TabsTrigger>
            <TabsTrigger
              value="insurance-readiness"
              className="gap-2"
              onPointerEnter={preloadAnalysisTabsLazyChunks}
            >
              <Shield className="h-3.5 w-3.5" />
              Insurance Readiness
            </TabsTrigger>
            {files.length >= 2 && (
              <TabsTrigger
                value="compare"
                className="gap-2"
                data-tour="compare-tab"
                onPointerEnter={preloadAnalysisTabsLazyChunks}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Compare
              </TabsTrigger>
            )}
          </TabsList>
        </div>
      </div>

      <div className="mt-4 px-1 flex items-start justify-between gap-4 flex-wrap">
        <p className="text-[10px] text-muted-foreground leading-relaxed max-w-3xl">
          FireComply provides automated security analysis based on firewall configuration data.
          Results should be validated by a qualified security professional. Compliance mappings are
          indicative and do not constitute a formal audit.
        </p>
        <div className="flex items-center gap-1">
          <WidgetCustomiser tab={activeTab} prefs={widgetPrefs} onChange={setWidgetPrefs} />
          <TourHint
            tourId="widget-customiser"
            title="Customise Widgets"
            description="Toggle optional widgets on each analysis tab — Assessment Pulse, Quick Actions, Findings by Age, Coverage Matrix, and more."
          />
        </div>
      </div>

      <div
        ref={panelRef}
        tabIndex={-1}
        aria-live="polite"
        className="outline-none scroll-mt-[180px]"
      >
        {/* Overview */}
        <TabsContent
          value="overview"
          className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ErrorBoundary fallbackTitle="Overview failed to load">
            <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] shadow-[0_18px_50px_rgba(32,6,247,0.08)] p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                    Executive posture overview
                  </div>
                  <h3 className="text-2xl font-display font-black text-foreground tracking-tight">
                    Overview
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Surface the headline score, posture trend, top actions, and estate-wide summary
                    in a stronger executive-grade overview surface.
                  </p>
                </div>
              </div>

              <ScoreDeltaBanner analysisResults={analysisResult} />
              <SecurityWidgetShell>
                <ScoreDialGauge analysisResults={analysisResult} trendSnapshot={trendSnapshot} />
              </SecurityWidgetShell>

              <SecurityWidgetShell>
                <SecurityPostureScorecard analysisResults={analysisResult} />
              </SecurityWidgetShell>

              {totalFindings > 0 && (
                <button
                  onClick={() => handleTabChange("tools")}
                  className="w-full rounded-xl border border-dashed border-[#5A00FF]/30 dark:border-[#00EDFF]/30 bg-gradient-to-r from-[#5A00FF]/[0.03] to-[#00EDFF]/[0.03] hover:from-[#5A00FF]/[0.06] hover:to-[#00EDFF]/[0.06] transition-colors px-5 py-3.5 text-left flex items-center gap-3 group"
                  data-tour="remediation-simulator-cta"
                >
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#5A00FF]/20 to-[#00EDFF]/20 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-[#5A00FF] dark:text-[#00EDFF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      Remediation Impact Simulator
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      See how recommended security actions would improve your score, grade, and
                      coverage →
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </button>
              )}

              <ReportUpsellStrip
                fileCount={files.length}
                averageScore={securityStats?.score}
                hasComplianceFrameworks={complianceFrameworks.length > 0}
                isGuest={isGuest}
              />

              {w("assessment-pulse") && (
                <SecurityWidgetShell>
                  <Suspense fallback={<CardSkeleton />}>
                    <AssessmentPulse
                      orgId={orgId}
                      currentScore={securityStats?.score}
                      currentGrade={securityStats?.grade}
                      isGuest={isGuest}
                    />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              <SecurityWidgetShell>
                <QuickActions onNavigate={handleTabChange} />
              </SecurityWidgetShell>

              {totalFindings > 0 && (
                <div
                  className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-4 flex flex-wrap items-center gap-3 transition-all duration-200 hover:border-slate-900/[0.14] dark:hover:border-white/[0.10]"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(32,6,247,0.06), rgba(0,237,255,0.02))",
                    boxShadow:
                      "0 8px 30px rgba(32,6,247,0.05), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                  data-tour="export-buttons"
                >
                  {/* Shimmer */}
                  <div
                    className="absolute inset-x-0 top-0 h-px pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(32,6,247,0.25), rgba(0,237,255,0.15), transparent)",
                    }}
                  />
                  <TourHint
                    tourId="export-buttons"
                    title="Export Options"
                    description="Export your risk register as CSV, Excel, or interactive HTML for offline review and sharing."
                  />
                  {(
                    [
                      {
                        label: "Export Risk Register (CSV)",
                        onClick: () =>
                          downloadRiskRegisterCSV(analysisResult, branding.customerName),
                        tour: "export-risk-register",
                        hex: "#2006F7",
                      },
                      {
                        label: "Export Excel",
                        onClick: () =>
                          downloadRiskRegisterExcel(analysisResult, branding.customerName),
                        tour: "export-excel",
                        hex: "#5A00FF",
                      },
                      {
                        label: "Export Interactive HTML",
                        onClick: () =>
                          downloadInteractiveHtml(analysisResult, {
                            customerName: branding.customerName,
                            mspName: branding.companyName,
                            logoUrl: branding.logoUrl ?? undefined,
                          }),
                        tour: "export-interactive-html",
                        hex: "#00EDFF",
                      },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.tour}
                      onClick={btn.onClick}
                      className="group/btn relative overflow-hidden flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08] text-xs font-bold text-foreground hover:border-slate-900/[0.20] dark:hover:border-white/[0.16] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_4px_20px_rgba(32,6,247,0.15)]"
                      style={{
                        background: `linear-gradient(145deg, ${btn.hex}12, ${btn.hex}04)`,
                      }}
                      data-tour={btn.tour}
                    >
                      <div
                        className="absolute -top-3 -right-3 h-8 w-8 rounded-full blur-[12px] opacity-0 transition-opacity duration-200 group-hover/btn:opacity-35 pointer-events-none"
                        style={{ backgroundColor: btn.hex }}
                      />
                      <div
                        className="absolute inset-x-0 top-0 h-px pointer-events-none"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${btn.hex}30, transparent)`,
                        }}
                      />
                      <Download
                        className="h-3.5 w-3.5"
                        style={{ color: btn.hex, filter: `drop-shadow(0 0 3px ${btn.hex}50)` }}
                      />
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
              {totalFindings > 0 && (
                <SecurityWidgetShell>
                  <CriticalActionsPanel
                    analysisResults={analysisResult}
                    onExplainFinding={onExplainFinding}
                  />
                </SecurityWidgetShell>
              )}
              <Collapsible defaultOpen={false} className="space-y-4">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors [&[data-state=open]_svg]:rotate-180">
                  <span>Extended overview, estate &amp; enrichment</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4">
                  <SecurityWidgetShell>
                    <FindingsChanges analysisResults={analysisResult} />
                  </SecurityWidgetShell>

                  {totalFindings > 0 &&
                    (w("findings-by-age") ||
                      w("sla-compliance-gauge") ||
                      w("remediation-velocity") ||
                      w("alert-feed")) && (
                      <div className="grid gap-4 lg:grid-cols-2 items-start">
                        {w("findings-by-age") && (
                          <Suspense fallback={<ChartSkeleton />}>
                            <FindingsByAge analysisResults={analysisResult} />
                          </Suspense>
                        )}
                        {w("sla-compliance-gauge") && (
                          <Suspense fallback={<ChartSkeleton />}>
                            <SlaComplianceGauge analysisResults={analysisResult} />
                          </Suspense>
                        )}
                        {w("remediation-velocity") && (
                          <Suspense fallback={<ChartSkeleton />}>
                            <RemediationVelocity analysisResults={analysisResult} />
                          </Suspense>
                        )}
                        {w("alert-feed") && (
                          <Suspense fallback={<CardSkeleton />}>
                            <AlertFeedWidget analysisResults={analysisResult} />
                          </Suspense>
                        )}
                      </div>
                    )}

                  <SecurityWidgetShell>
                    <EstateOverview
                      fileCount={files.length}
                      analysisResults={analysisResult}
                      totalFindings={totalFindings}
                      totalRules={totalRules}
                      totalSections={totalSections}
                      totalPopulated={totalPopulated}
                      extractionPct={extractionPct}
                      aggregatedPosture={aggregatedPosture}
                      selectedFrameworks={complianceFrameworks}
                      onExplainFinding={onExplainFinding}
                    />
                  </SecurityWidgetShell>
                  {!isGuest && !localMode && configMetas.length > 0 && (
                    <Suspense fallback={null}>
                      <CentralEnrichment
                        configMetas={configMetas}
                        customerName={branding.customerName}
                      />
                    </Suspense>
                  )}

                  {(w("mdr-status") || w("firmware-tracker")) && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      {w("mdr-status") && (
                        <SecurityWidgetShell>
                          <Suspense fallback={<CardSkeleton />}>
                            <MdrStatus analysisResults={analysisResult} files={files} />
                          </Suspense>
                        </SecurityWidgetShell>
                      )}
                      {w("firmware-tracker") && (
                        <SecurityWidgetShell>
                          <Suspense fallback={<CardSkeleton />}>
                            <FirmwareTracker files={files} />
                          </Suspense>
                        </SecurityWidgetShell>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ErrorBoundary>
        </TabsContent>

        {/* Security Analysis */}
        <TabsContent
          value="security"
          className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ErrorBoundary fallbackTitle="Security analysis failed to load">
            <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] shadow-[0_18px_50px_rgba(32,6,247,0.08)] p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                    Deep-dive security posture
                  </div>
                  <h3 className="text-2xl font-display font-black text-foreground tracking-tight">
                    Detailed Security Analysis
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Explore score drivers, rule health, traffic exposure, findings distribution, and
                    security control coverage in a stronger executive-grade analysis surface.
                  </p>
                </div>
              </div>

              {securityStats &&
                (() => {
                  const scoreHex =
                    securityStats.score >= 75
                      ? "#00F2B3"
                      : securityStats.score >= 50
                        ? "#F29400"
                        : "#EA0022";
                  const critHex = securityStats.criticalHigh === 0 ? "#00F2B3" : "#EA0022";
                  const covHex =
                    securityStats.coverage >= 75
                      ? "#00F2B3"
                      : securityStats.coverage >= 40
                        ? "#F29400"
                        : "#EA0022";
                  const neutralHex = "#64748b";
                  const statCards = [
                    {
                      label: "Score",
                      value: securityStats.score,
                      hex: scoreHex,
                      suffix: "",
                      badge: securityStats.grade,
                    },
                    {
                      label: "Critical Issues",
                      value: securityStats.criticalHigh,
                      hex: critHex,
                      suffix: "",
                    },
                    {
                      label: "Coverage",
                      value: securityStats.coverage,
                      hex: covHex,
                      suffix: "%",
                    },
                    {
                      label: "Rules Analysed",
                      value: securityStats.totalRules,
                      hex: neutralHex,
                      suffix: "",
                    },
                  ];
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {statCards.map((card) => {
                        const kind = accentKindFromHex(card.hex);
                        return (
                          <div
                            key={card.label}
                            className={cn(
                              "group relative cursor-default overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:scale-[1.03] hover:shadow-elevated",
                              "border-slate-200/90 bg-card shadow-sm",
                              "dark:border-white/[0.06] dark:bg-transparent dark:shadow-none",
                              "hover:border-slate-300/90 dark:hover:border-white/[0.12]",
                            )}
                          >
                            <div
                              className="pointer-events-none absolute inset-0 hidden dark:block"
                              style={statDarkGradientOverlayStyle(card.hex)}
                            />
                            <div
                              className="absolute inset-x-0 top-0 h-px pointer-events-none hidden dark:block"
                              style={{
                                background: `linear-gradient(90deg, transparent, ${card.hex}20, transparent)`,
                              }}
                            />
                            <div
                              className="pointer-events-none absolute -right-4 -top-4 hidden h-12 w-12 rounded-full blur-[20px] opacity-15 transition-opacity group-hover:opacity-30 dark:block"
                              style={{ backgroundColor: card.hex }}
                            />
                            <div className="relative">
                              <div className="text-[10px] font-semibold text-slate-600 dark:text-muted-foreground/70 uppercase tracking-wider">
                                {card.label}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  className={cn(
                                    "text-2xl font-extrabold tabular-nums",
                                    statValueTextClass(kind),
                                  )}
                                >
                                  {card.value}
                                  {card.suffix}
                                </span>
                                {card.badge && (
                                  <span
                                    className={cn(
                                      "rounded border px-1.5 py-0.5 text-[10px] font-bold",
                                      kind === "green" &&
                                        "border-emerald-300/70 bg-emerald-100/90 text-emerald-900 dark:border-[#00F2B3]/35 dark:bg-[#00F2B3]/14 dark:text-[#00F2B3]",
                                      kind === "amber" &&
                                        "border-amber-300/70 bg-amber-100/90 text-amber-950 dark:border-[#F29400]/35 dark:bg-[#F29400]/14 dark:text-[#F29400]",
                                      kind === "red" &&
                                        "border-rose-300/70 bg-rose-100/90 text-rose-900 dark:border-[#EA0022]/35 dark:bg-[#EA0022]/14 dark:text-[#EA0022]",
                                      (kind === "slate" ||
                                        kind === "violet" ||
                                        kind === "purple" ||
                                        kind === "cyan") &&
                                        "border-slate-200 bg-slate-100 text-slate-800 dark:border-white/10 dark:bg-white/10 dark:text-slate-100",
                                    )}
                                  >
                                    {card.badge}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              <SecurityWidgetShell>
                <RiskScoreDashboard analysisResults={analysisResult} />
              </SecurityWidgetShell>

              <div className="grid gap-6 lg:grid-cols-2">
                <SecurityWidgetShell>
                  <Suspense fallback={<StatGridSkeleton />}>
                    <RuleHealthOverview analysisResults={analysisResult} />
                  </Suspense>
                </SecurityWidgetShell>
                <SecurityWidgetShell>
                  <Suspense fallback={<StatGridSkeleton count={4} />}>
                    <SecurityFeatureCoverage analysisResults={analysisResult} />
                  </Suspense>
                </SecurityWidgetShell>
              </div>

              {totalFindings > 0 && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <SecurityWidgetShell>
                    <Suspense fallback={<ChartSkeleton />}>
                      <SeverityBreakdown analysisResults={analysisResult} />
                    </Suspense>
                  </SecurityWidgetShell>
                  <SecurityWidgetShell>
                    <Suspense fallback={<ChartSkeleton />}>
                      <FindingsBySection analysisResults={analysisResult} />
                    </Suspense>
                  </SecurityWidgetShell>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <SecurityWidgetShell>
                  <Suspense fallback={<ChartSkeleton />}>
                    <ZoneTrafficFlow files={files} />
                  </Suspense>
                </SecurityWidgetShell>
                {totalFindings > 0 && (
                  <SecurityWidgetShell>
                    <Suspense fallback={<CardSkeleton />}>
                      <TopFindings analysisResults={analysisResult} />
                    </Suspense>
                  </SecurityWidgetShell>
                )}
              </div>

              {totalFindings > 0 && (
                <SecurityWidgetShell>
                  <Suspense fallback={<ChartSkeleton />}>
                    <PriorityMatrix analysisResults={analysisResult} />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {w("category-score-bars") && (
                <SecurityWidgetShell>
                  <Suspense fallback={<CardSkeleton />}>
                    <CategoryScoreBars analysisResults={analysisResult} />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {w("coverage-matrix") && (
                <SecurityWidgetShell>
                  <Suspense fallback={<CardSkeleton />}>
                    <CoverageMatrix analysisResults={analysisResult} />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {(w("category-trends") || w("risk-distribution")) && (
                <div className="grid gap-6 lg:grid-cols-2">
                  {w("category-trends") && (
                    <SecurityWidgetShell>
                      <Suspense fallback={<ChartSkeleton />}>
                        <CategoryTrends analysisResults={analysisResult} />
                      </Suspense>
                    </SecurityWidgetShell>
                  )}
                  {w("risk-distribution") && (
                    <SecurityWidgetShell>
                      <Suspense fallback={<ChartSkeleton />}>
                        <RiskDistributionWidget analysisResults={analysisResult} />
                      </Suspense>
                    </SecurityWidgetShell>
                  )}
                </div>
              )}

              {w("admin-exposure-map") && (
                <SecurityWidgetShell>
                  <Suspense fallback={<CardSkeleton />}>
                    <AdminExposureMap analysisResults={analysisResult} files={files} />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {(w("vpn-security-summary") || w("network-zone-map")) && (
                <div className="grid gap-6 lg:grid-cols-2">
                  {w("vpn-security-summary") && (
                    <SecurityWidgetShell>
                      <Suspense fallback={<CardSkeleton />}>
                        <VpnSecuritySummary files={files} />
                      </Suspense>
                    </SecurityWidgetShell>
                  )}
                  {w("network-zone-map") && (
                    <SecurityWidgetShell>
                      <Suspense fallback={<ChartSkeleton />}>
                        <NetworkZoneMap files={files} />
                      </Suspense>
                    </SecurityWidgetShell>
                  )}
                </div>
              )}

              {w("vpn-security-summary") && files[0] && (
                <SecurityWidgetShell>
                  <VpnTopologyDiagram
                    extractedData={files[0].extractedData}
                    firewallLabel={files[0].label}
                  />
                </SecurityWidgetShell>
              )}

              {w("protocol-service-usage") && (
                <SecurityWidgetShell>
                  <Suspense fallback={<ChartSkeleton />}>
                    <ProtocolServiceWidget files={files} />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {w("rule-action-dist") && (
                <SecurityWidgetShell>
                  <Suspense fallback={<ChartSkeleton />}>
                    <RuleActionDistribution files={files} />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {w("finding-heatmap-time") && (
                <SecurityWidgetShell>
                  <Suspense fallback={<ChartSkeleton />}>
                    <FindingHeatmapTime analysisResults={analysisResult} />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {w("threat-feed-timeline") && (
                <SecurityWidgetShell>
                  <Suspense fallback={<CardSkeleton />}>
                    <ThreatFeedTimeline files={files} />
                  </Suspense>
                </SecurityWidgetShell>
              )}
            </div>
          </ErrorBoundary>
        </TabsContent>

        {/* Compliance */}
        <TabsContent
          value="compliance"
          className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ErrorBoundary fallbackTitle="Compliance view failed to load">
            <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] shadow-[0_18px_50px_rgba(32,6,247,0.08)] p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
                    Compliance readiness
                  </div>
                  <h3 className="text-2xl font-display font-black text-foreground tracking-tight">
                    Compliance Analysis
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Review control alignment, framework coverage, evidence readiness, and
                    audit-focused posture across your selected standards.
                  </p>
                </div>
              </div>

              <div
                className="rounded-[26px] border border-[#5A00FF]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,246,255,0.86))] dark:bg-[linear-gradient(180deg,rgba(14,18,32,0.86),rgba(20,16,34,0.86))] shadow-[0_14px_34px_rgba(90,0,255,0.08)] p-5 space-y-4"
                data-tour="compliance-heatmap"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Scale className="h-4 w-4 text-brand-accent" />
                  <h3 className="text-base font-display font-black text-foreground tracking-tight">
                    Compliance Heatmap
                  </h3>
                  <TourHint
                    tourId="compliance-heatmap"
                    title="Compliance Heatmap"
                    description="View control coverage, gaps, and readiness across NIST 800-53, ISO 27001, CIS, SOC 2, PCI DSS, HIPAA, Essential Eight, Cyber Essentials, and more."
                  />
                  {complianceFrameworks.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B47AFF] font-bold">
                      {complianceFrameworks.length} framework
                      {complianceFrameworks.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="info-pill">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                      Coverage
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      See where controls are present, partial, or missing
                    </p>
                  </div>
                  <div className="info-pill">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                      Priority
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      Focus remediation on the frameworks that matter most
                    </p>
                  </div>
                  <div className="info-pill">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                      Readiness
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      Turn technical findings into audit-facing context
                    </p>
                  </div>
                </div>
                <ComplianceHeatmap
                  analysisResults={analysisResult}
                  selectedFrameworks={complianceFrameworks}
                />
                <CertificatePostureStrip analysisResults={analysisResult} />
              </div>

              <SecurityWidgetShell className="border-[#5A00FF]/10">
                <div data-tour="sophos-best-practice">
                  <SophosBestPractice
                    analysisResults={analysisResult}
                    centralLicences={
                      files.find((f) => f.centralEnrichment?.licences)?.centralEnrichment?.licences
                    }
                  />
                </div>
              </SecurityWidgetShell>

              {w("compliance-summary") && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <SecurityWidgetShell className="border-[#5A00FF]/10">
                    <Suspense fallback={<ChartSkeleton />}>
                      <CompliancePostureRing
                        analysisResults={analysisResult}
                        selectedFrameworks={complianceFrameworks}
                      />
                    </Suspense>
                  </SecurityWidgetShell>
                  <SecurityWidgetShell className="border-[#5A00FF]/10">
                    <Suspense fallback={<ChartSkeleton />}>
                      <FrameworkCoverageBars
                        analysisResults={analysisResult}
                        selectedFrameworks={complianceFrameworks}
                      />
                    </Suspense>
                  </SecurityWidgetShell>
                </div>
              )}

              {w("compliance-gaps") && (
                <SecurityWidgetShell className="border-[#5A00FF]/10">
                  <Suspense fallback={<CardSkeleton />}>
                    <ComplianceGapWidget
                      analysisResults={analysisResult}
                      selectedFrameworks={complianceFrameworks}
                    />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {w("evidence-collection") && (
                <SecurityWidgetShell className="border-[#5A00FF]/10">
                  <Suspense fallback={<CardSkeleton />}>
                    <EvidenceCollection
                      analysisResults={analysisResult}
                      selectedFrameworks={complianceFrameworks}
                    />
                  </Suspense>
                </SecurityWidgetShell>
              )}

              {w("regulatory-tracker") && (
                <SecurityWidgetShell className="border-[#5A00FF]/10">
                  <Suspense fallback={<CardSkeleton />}>
                    <RegulatoryTracker />
                  </Suspense>
                </SecurityWidgetShell>
              )}
            </div>
          </ErrorBoundary>
        </TabsContent>

        {/* Insurance Readiness */}
        <TabsContent
          value="insurance-readiness"
          className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ErrorBoundary fallbackTitle="Insurance readiness failed to load">
            <div className="rounded-[28px] border border-brand-accent/15 bg-[radial-gradient(circle_at_top_left,rgba(234,0,34,0.08),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(247,249,255,0.98))] dark:bg-[radial-gradient(circle_at_top_left,rgba(234,0,34,0.12),transparent_34%),linear-gradient(135deg,rgba(9,13,24,0.98),rgba(12,18,34,0.98))] shadow-[0_18px_50px_rgba(32,6,247,0.08)] p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#EA0022]/20 bg-[#EA0022]/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#EA0022] dark:text-[#ff6b7a]">
                    Carrier conversations
                  </div>
                  <h3 className="text-2xl font-display font-black text-foreground tracking-tight">
                    Insurance Readiness
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Questionnaire-style signals derived from your firewall analysis. Use alongside
                    operational evidence and broker guidance — not a substitute for formal
                    attestation.
                  </p>
                </div>
              </div>
              <InsuranceReadiness
                analysisResults={analysisResult}
                customerName={branding.customerName}
                mspName={branding.companyName}
              />
            </div>
          </ErrorBoundary>
        </TabsContent>

        {/* Optimisation */}
        <TabsContent
          value="optimisation"
          className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ErrorBoundary fallbackTitle="Optimisation view failed to load">
            <RuleOptimiser files={files} />
            {w("config-complexity") && (
              <div className="grid gap-6 lg:grid-cols-2">
                <ErrorBoundary fallbackTitle="Policy Complexity failed">
                  <Suspense fallback={<CardSkeleton />}>
                    <PolicyComplexity analysisResults={analysisResult} files={files} />
                  </Suspense>
                </ErrorBoundary>
                <ErrorBoundary fallbackTitle="Config Composition failed">
                  <Suspense fallback={<CardSkeleton />}>
                    <ConfigSizeMetrics analysisResults={analysisResult} files={files} />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {w("unused-objects") && (
              <Suspense fallback={<CardSkeleton />}>
                <UnusedObjects files={files} />
              </Suspense>
            )}
            {w("rule-analysis") && (
              <Suspense fallback={<CardSkeleton />}>
                <RuleAnalysisWidget files={files} />
              </Suspense>
            )}
            {files.length >= 2 && (
              <Suspense fallback={null}>
                <ConsistencyChecker analysisResults={analysisResult} />
              </Suspense>
            )}
          </ErrorBoundary>
        </TabsContent>

        {/* Tools */}
        <TabsContent
          value="tools"
          className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ErrorBoundary fallbackTitle="Tools failed to load">
            <RiskScoreDashboard analysisResults={analysisResult} projected={projectedScore} />

            {totalFindings > 0 && (
              <Suspense fallback={<CardSkeleton />}>
                <ScoreSimulator
                  analysisResults={analysisResult}
                  onProjectedChange={setProjectedScore}
                  defaultOpen
                />
              </Suspense>
            )}

            <Suspense fallback={<CardSkeleton />}>
              <AttackSurfaceMap files={files} />
            </Suspense>

            {totalFindings > 0 && w("risk-roi") && (
              <Suspense fallback={<CardSkeleton />}>
                <RiskRoiWidget analysisResults={analysisResult} />
              </Suspense>
            )}

            {w("export-centre") && (
              <Suspense fallback={<CardSkeleton />}>
                <ExportCentre
                  analysisResults={analysisResult}
                  branding={{
                    customerName: branding.customerName,
                    selectedFrameworks: complianceFrameworks as ComplianceFramework[],
                  }}
                  reviewerSignoff={exportReviewerSignoff}
                />
              </Suspense>
            )}

            {w("geographic-fleet-map") && (
              <Suspense fallback={<CardSkeleton />}>
                <GeographicFleetMap files={files} />
              </Suspense>
            )}

            {w("baseline-manager") && (
              <Suspense fallback={<CardSkeleton />}>
                <BaselineManager analysisResults={analysisResult} />
              </Suspense>
            )}

            {w("compare-to-baseline") && (
              <Suspense fallback={<CardSkeleton />}>
                <CompareToSavedBaseline
                  analysisResults={analysisResult}
                  customerName={branding.customerName}
                />
              </Suspense>
            )}
          </ErrorBoundary>
        </TabsContent>

        {/* Remediation */}
        <TabsContent
          value="remediation"
          className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ErrorBoundary fallbackTitle="Remediation view failed to load">
            {w("remediation-progress") && (
              <Suspense fallback={<CardSkeleton />}>
                <RemediationProgress analysisResults={analysisResult} />
              </Suspense>
            )}

            {w("remediation-roadmap") && (
              <Suspense fallback={<ChartSkeleton />}>
                <RemediationRoadmap analysisResults={analysisResult} />
              </Suspense>
            )}

            {(w("fix-effort-breakdown") || w("impact-effort-bubble")) && (
              <div className="grid gap-6 lg:grid-cols-2">
                {w("fix-effort-breakdown") && (
                  <Suspense fallback={<ChartSkeleton />}>
                    <FixEffortBreakdown analysisResults={analysisResult} />
                  </Suspense>
                )}
                {w("impact-effort-bubble") && (
                  <Suspense fallback={<ChartSkeleton />}>
                    <ImpactEffortBubble analysisResults={analysisResult} />
                  </Suspense>
                )}
              </div>
            )}

            {w("findings-bulk") && (
              <Suspense fallback={<CardSkeleton />}>
                <FindingsBulkView
                  analysisResults={analysisResult}
                  firecomplyCustomerKey={firecomplyCustomerKey}
                />
              </Suspense>
            )}
            <RemediationPlaybooks analysisResults={analysisResult} />
          </ErrorBoundary>
        </TabsContent>

        {/* Compare */}
        <TabsContent
          value="compare"
          className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <ErrorBoundary fallbackTitle="Compare view failed to load">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Before (baseline)
                  </label>
                  <select
                    className="w-full rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                    value={diffSelection?.beforeIdx ?? 0}
                    data-tour="compare-before"
                    onChange={(e) =>
                      setDiffSelection((prev: DiffSelection) => ({
                        beforeIdx: Number(e.target.value),
                        afterIdx: prev?.afterIdx ?? Math.min(1, files.length - 1),
                      }))
                    }
                  >
                    {files.map((f, i) => (
                      <option key={f.id} value={i}>
                        {fileLabel(f)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    After (current)
                  </label>
                  <select
                    className="w-full rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                    value={diffSelection?.afterIdx ?? Math.min(1, files.length - 1)}
                    data-tour="compare-after"
                    onChange={(e) =>
                      setDiffSelection((prev: DiffSelection) => ({
                        beforeIdx: prev?.beforeIdx ?? 0,
                        afterIdx: Number(e.target.value),
                      }))
                    }
                  >
                    {files.map((f, i) => (
                      <option key={f.id} value={i}>
                        {fileLabel(f)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                size="sm"
                className="gap-2"
                data-tour="compare-button"
                onClick={() =>
                  setDiffSelection({
                    beforeIdx: diffSelection?.beforeIdx ?? 0,
                    afterIdx: diffSelection?.afterIdx ?? Math.min(1, files.length - 1),
                  })
                }
              >
                <ArrowLeftRight className="h-3.5 w-3.5" /> Compare
              </Button>
            </div>
          </ErrorBoundary>
        </TabsContent>
      </div>
    </Tabs>
  );
}

import { lazy, Suspense, useRef, useEffect, useState } from "react";
import { ArrowLeftRight, Download, LayoutDashboard, ShieldCheck, Zap, Wrench, ClipboardCheck, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EstateOverview } from "@/components/EstateOverview";
import { ReportUpsellStrip } from "@/components/ReportUpsellStrip";
import { FindingsChanges } from "@/components/FindingsChanges";
import { PriorityActions } from "@/components/PriorityActions";
import { HeroOutcomePanel } from "@/components/HeroOutcomePanel";
import { CriticalActionsPanel } from "@/components/CriticalActionsPanel";
import { SectionSkeleton, ChartSkeleton, StatGridSkeleton, CardSkeleton } from "@/components/DashboardSkeleton";
import { WidgetCustomiser } from "@/components/WidgetCustomiser";
import { downloadRiskRegisterCSV, downloadRiskRegisterExcel } from "@/lib/risk-register";
import { downloadInteractiveHtml } from "@/lib/analysis-interactive-html";
import { loadWidgetPreferences, isWidgetVisible, type WidgetPreferences } from "@/lib/widget-preferences";
import { TourHint } from "@/components/TourHint";
import type { AnalysisResult } from "@/lib/analyse-config";
import type { InspectionPosture } from "@/lib/analyse-config";
import type { BrandingData } from "@/components/BrandingSetup";
import type { ParsedFile } from "@/hooks/use-report-generation";
import type { RiskScoreResult } from "@/lib/risk-score";
import { SecurityPostureScorecard } from "@/components/SecurityPostureScorecard";

const RiskScoreDashboard = lazy(() => import("@/components/RiskScoreDashboard").then((m) => ({ default: m.RiskScoreDashboard })));
const RemediationPlaybooks = lazy(() => import("@/components/RemediationPlaybooks").then((m) => ({ default: m.RemediationPlaybooks })));
const ChangeApproval = lazy(() => import("@/components/ChangeApproval").then((m) => ({ default: m.ChangeApproval })));
const ComplianceHeatmap = lazy(() => import("@/components/ComplianceHeatmap").then((m) => ({ default: m.ComplianceHeatmap })));
const InsuranceReadiness = lazy(() => import("@/components/InsuranceReadiness").then((m) => ({ default: m.InsuranceReadiness })));
const RuleOptimiser = lazy(() => import("@/components/RuleOptimiser").then((m) => ({ default: m.RuleOptimiser })));
const ConsistencyChecker = lazy(() => import("@/components/ConsistencyChecker").then((m) => ({ default: m.ConsistencyChecker })));
const ScoreSimulator = lazy(() => import("@/components/ScoreSimulator").then((m) => ({ default: m.ScoreSimulator })));
const AttackSurfaceMap = lazy(() => import("@/components/AttackSurfaceMap").then((m) => ({ default: m.AttackSurfaceMap })));
const SophosBestPractice = lazy(() => import("@/components/SophosBestPractice").then((m) => ({ default: m.SophosBestPractice })));
const PeerBenchmark = lazy(() => import("@/components/PeerBenchmark").then((m) => ({ default: m.PeerBenchmark })));
const SeverityBreakdown = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.SeverityBreakdown })));
const SecurityFeatureCoverage = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.SecurityFeatureCoverage })));
const ZoneTrafficFlow = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.ZoneTrafficFlow })));
const TopFindings = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.TopFindings })));
const RuleHealthOverview = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.RuleHealthOverview })));
const FindingsBySection = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.FindingsBySection })));
const PriorityMatrix = lazy(() => import("@/components/PriorityMatrix").then((m) => ({ default: m.PriorityMatrix })));
const CentralEnrichment = lazy(() => import("@/components/CentralEnrichment").then((m) => ({ default: m.CentralEnrichment })));
const ScoreDialGauge = lazy(() => import("@/components/ScoreDialGauge").then((m) => ({ default: m.ScoreDialGauge })));
const ScoreDeltaBanner = lazy(() => import("@/components/ScoreDeltaBanner").then((m) => ({ default: m.ScoreDeltaBanner })));
const RiskSummaryCards = lazy(() => import("@/components/RiskSummaryCards").then((m) => ({ default: m.RiskSummaryCards })));
const ProtocolServiceWidget = lazy(() => import("@/components/ProtocolServiceWidget").then((m) => ({ default: m.ProtocolServiceWidget })));
const ComplianceGapWidget = lazy(() => import("@/components/ComplianceGapWidget").then((m) => ({ default: m.ComplianceGapWidget })));
const RiskRoiWidget = lazy(() => import("@/components/RiskRoiWidget").then((m) => ({ default: m.RiskRoiWidget })));
const RuleAnalysisWidget = lazy(() => import("@/components/RuleAnalysisWidget").then((m) => ({ default: m.RuleAnalysisWidget })));
const QuickActions = lazy(() => import("@/components/QuickActions").then((m) => ({ default: m.QuickActions })));
const FindingsByAge = lazy(() => import("@/components/FindingsByAge").then((m) => ({ default: m.FindingsByAge })));
const RemediationVelocity = lazy(() => import("@/components/RemediationVelocity").then((m) => ({ default: m.RemediationVelocity })));
const SlaComplianceGauge = lazy(() => import("@/components/SlaComplianceGauge").then((m) => ({ default: m.SlaComplianceGauge })));
const AlertFeedWidget = lazy(() => import("@/components/AlertFeed").then((m) => ({ default: m.AlertFeed })));
const AssessmentCountdown = lazy(() => import("@/components/AssessmentCountdown").then((m) => ({ default: m.AssessmentCountdown })));
const CategoryScoreBars = lazy(() => import("@/components/CategoryScoreBars").then((m) => ({ default: m.CategoryScoreBars })));
const RuleActionDistribution = lazy(() => import("@/components/RuleActionDistribution").then((m) => ({ default: m.RuleActionDistribution })));
const CoverageMatrix = lazy(() => import("@/components/CoverageMatrix").then((m) => ({ default: m.CoverageMatrix })));
const RiskDistributionWidget = lazy(() => import("@/components/RiskDistribution").then((m) => ({ default: m.RiskDistribution })));
const CategoryTrends = lazy(() => import("@/components/CategoryTrends").then((m) => ({ default: m.CategoryTrends })));
const FindingHeatmapTime = lazy(() => import("@/components/FindingHeatmapTime").then((m) => ({ default: m.FindingHeatmapTime })));
const EncryptionOverview = lazy(() => import("@/components/EncryptionOverview").then((m) => ({ default: m.EncryptionOverview })));
const AdminExposureMap = lazy(() => import("@/components/AdminExposureMap").then((m) => ({ default: m.AdminExposureMap })));
const VpnSecuritySummary = lazy(() => import("@/components/VpnSecuritySummary").then((m) => ({ default: m.VpnSecuritySummary })));
const NetworkZoneMap = lazy(() => import("@/components/NetworkZoneMap").then((m) => ({ default: m.NetworkZoneMap })));
const PolicyComplexity = lazy(() => import("@/components/PolicyComplexity").then((m) => ({ default: m.PolicyComplexity })));
const UnusedObjects = lazy(() => import("@/components/UnusedObjects").then((m) => ({ default: m.UnusedObjects })));
const ConfigSizeMetrics = lazy(() => import("@/components/ConfigSizeMetrics").then((m) => ({ default: m.ConfigSizeMetrics })));
const CompliancePostureRing = lazy(() => import("@/components/CompliancePostureRing").then((m) => ({ default: m.CompliancePostureRing })));
const FrameworkCoverageBars = lazy(() => import("@/components/FrameworkCoverageBars").then((m) => ({ default: m.FrameworkCoverageBars })));
const GeographicFleetMap = lazy(() => import("@/components/GeographicFleetMap").then((m) => ({ default: m.GeographicFleetMap })));
const ExportCentre = lazy(() => import("@/components/ExportCentre").then((m) => ({ default: m.ExportCentre })));
// WhatIfComparison removed — functionality consolidated into ScoreSimulator (Remediation Impact Simulator)
const RemediationRoadmap = lazy(() => import("@/components/RemediationRoadmap").then((m) => ({ default: m.RemediationRoadmap })));
const FixEffortBreakdown = lazy(() => import("@/components/FixEffortBreakdown").then((m) => ({ default: m.FixEffortBreakdown })));
const ImpactEffortBubble = lazy(() => import("@/components/ImpactEffortBubble").then((m) => ({ default: m.ImpactEffortBubble })));
const RemediationProgress = lazy(() => import("@/components/RemediationProgress").then((m) => ({ default: m.RemediationProgress })));
const ThreatFeedTimeline = lazy(() => import("@/components/ThreatFeedTimeline").then((m) => ({ default: m.ThreatFeedTimeline })));
const MdrStatus = lazy(() => import("@/components/MdrStatus").then((m) => ({ default: m.MdrStatus })));
const FirmwareTracker = lazy(() => import("@/components/FirmwareTracker").then((m) => ({ default: m.FirmwareTracker })));
const AssessmentPulse = lazy(() => import("@/components/AssessmentPulse").then((m) => ({ default: m.AssessmentPulse })));
const EvidenceCollection = lazy(() => import("@/components/EvidenceCollection").then((m) => ({ default: m.EvidenceCollection })));
const ComplianceCalendar = lazy(() => import("@/components/ComplianceCalendar").then((m) => ({ default: m.ComplianceCalendar })));
const AttestationWorkflow = lazy(() => import("@/components/AttestationWorkflow").then((m) => ({ default: m.AttestationWorkflow })));
const RegulatoryTracker = lazy(() => import("@/components/RegulatoryTracker").then((m) => ({ default: m.RegulatoryTracker })));
const FleetComparison = lazy(() => import("@/components/FleetComparison").then((m) => ({ default: m.FleetComparison })));
const BaselineManager = lazy(() => import("@/components/BaselineManager").then((m) => ({ default: m.BaselineManager })));
const CompareToSavedBaseline = lazy(() => import("@/components/CompareToSavedBaseline").then((m) => ({ default: m.CompareToSavedBaseline })));
const FindingsBulkView = lazy(() => import("@/components/FindingsBulkView").then((m) => ({ default: m.FindingsBulkView })));

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
}

function fileLabel(f: ParsedFile) {
  return f.label || f.fileName.replace(/\.(html|htm)$/i, "");
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
}: AnalysisTabsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [widgetPrefs, setWidgetPrefs] = useState<WidgetPreferences>(() => loadWidgetPreferences());
  const w = (id: string) => isWidgetVisible(widgetPrefs, id);

  useEffect(() => {
    const t = setTimeout(() => panelRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [activeTab]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* Hero outcome summary — visible above all tabs */}
      <HeroOutcomePanel
        analysisResults={analysisResult}
        totalFindings={totalFindings}
        fileCount={files.length}
        extractionPct={extractionPct}
        hasComplianceFrameworks={branding.selectedFrameworks.length > 0}
        hasReports={hasReports}
      />

      <div className="sticky top-[53px] z-20 -mx-4 px-4 pt-4 bg-background/95 backdrop-blur-sm mt-4">
        <h2 className="text-sm font-display font-bold text-foreground tracking-tight px-1 mb-2 flex items-center gap-1.5">
          Detailed Security Analysis
          <TourHint
            tourId="analysis-tabs"
            title="Analysis Tabs"
            description="Deep-dive into security analysis, compliance mapping, rule optimisation, and remediation playbooks. Click any tab to explore."
          />
        </h2>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="flex-nowrap whitespace-nowrap w-max inline-flex" data-tour="analysis-tabs">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Overview
            {totalFindings > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EA0022]/10 text-[#EA0022] tabular-nums">{totalFindings}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Security Analysis
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="optimisation" className="gap-2">
            <Zap className="h-3.5 w-3.5" />
            Optimisation
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Tools
          </TabsTrigger>
          {totalFindings > 0 && (
            <TabsTrigger value="remediation" className="gap-2">
              <Wrench className="h-3.5 w-3.5" />
              Remediation
            </TabsTrigger>
          )}
          {files.length >= 2 && (
            <TabsTrigger value="compare" className="gap-2" data-tour="compare-tab">
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Compare
            </TabsTrigger>
          )}
          </TabsList>
        </div>
      </div>

      <div className="mt-3 px-1 flex items-start justify-between gap-4">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          FireComply provides automated security analysis based on firewall configuration data. Results should be validated by a qualified security professional. Compliance mappings are indicative and do not constitute a formal audit.
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

      <div ref={panelRef} tabIndex={-1} aria-live="polite" className="outline-none">
      {/* Overview */}
      <TabsContent value="overview" className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
        <ErrorBoundary fallbackTitle="Overview failed to load">
          <Suspense fallback={null}>
            <ScoreDeltaBanner analysisResults={analysisResult} />
          </Suspense>
          <Suspense fallback={<ChartSkeleton height={200} />}>
            <ScoreDialGauge analysisResults={analysisResult} />
          </Suspense>
          <Suspense fallback={<StatGridSkeleton count={6} />}>
            <RiskSummaryCards analysisResults={analysisResult} />
          </Suspense>

          <SecurityPostureScorecard analysisResults={analysisResult} />

          {totalFindings > 0 && (
            <button
              onClick={() => setActiveTab("tools")}
              className="w-full rounded-xl border border-dashed border-[#5A00FF]/30 dark:border-[#00EDFF]/30 bg-gradient-to-r from-[#5A00FF]/[0.03] to-[#00EDFF]/[0.03] hover:from-[#5A00FF]/[0.06] hover:to-[#00EDFF]/[0.06] transition-colors px-5 py-3.5 text-left flex items-center gap-3 group"
              data-tour="remediation-simulator-cta"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#5A00FF]/20 to-[#00EDFF]/20 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-[#5A00FF] dark:text-[#00EDFF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Remediation Impact Simulator</p>
                <p className="text-[10px] text-muted-foreground">See how recommended security actions would improve your score, grade, and coverage →</p>
              </div>
              <span className="text-muted-foreground text-xs group-hover:translate-x-0.5 transition-transform">→</span>
            </button>
          )}

          <ReportUpsellStrip
            fileCount={files.length}
            averageScore={securityStats?.score}
            hasComplianceFrameworks={branding.selectedFrameworks.length > 0}
            isGuest={isGuest}
          />

          {w("assessment-pulse") && (
            <Suspense fallback={<CardSkeleton />}>
              <AssessmentPulse
                orgId={orgId}
                currentScore={securityStats?.score}
                currentGrade={securityStats?.grade}
                isGuest={isGuest}
              />
            </Suspense>
          )}

          {w("quick-actions") && (
            <Suspense fallback={null}>
              <QuickActions onNavigate={setActiveTab} />
            </Suspense>
          )}

          {totalFindings > 0 && (
            <div className="flex flex-wrap items-center gap-2" data-tour="export-buttons">
              <TourHint
                tourId="export-buttons"
                title="Export Options"
                description="Export your risk register as CSV, Excel, or interactive HTML for offline review and sharing."
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadRiskRegisterCSV(analysisResult, branding.customerName)}
                className="gap-1.5 text-xs"
                data-tour="export-risk-register"
              >
                <Download className="h-3.5 w-3.5" />
                Export Risk Register (CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadRiskRegisterExcel(analysisResult, branding.customerName)}
                className="gap-1.5 text-xs"
                data-tour="export-excel"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadInteractiveHtml(analysisResult, { customerName: branding.customerName, mspName: branding.companyName, logoUrl: branding.logoUrl ?? undefined })}
                className="gap-1.5 text-xs"
                data-tour="export-interactive-html"
              >
                <Download className="h-3.5 w-3.5" />
                Export Interactive HTML
              </Button>
            </div>
          )}
          {totalFindings > 0 && (
            <CriticalActionsPanel analysisResults={analysisResult} onExplainFinding={onExplainFinding} />
          )}
          <FindingsChanges analysisResults={analysisResult} />

          {totalFindings > 0 && (w("findings-by-age") || w("sla-compliance-gauge")) && (
            <div className="grid gap-6 lg:grid-cols-2">
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
            </div>
          )}

          {(w("remediation-velocity") || w("alert-feed")) && (
            <div className="grid gap-6 lg:grid-cols-2">
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

          {w("assessment-countdown") && (
            <Suspense fallback={null}>
              <AssessmentCountdown />
            </Suspense>
          )}

          <EstateOverview
            fileCount={files.length}
            analysisResults={analysisResult}
            totalFindings={totalFindings}
            totalRules={totalRules}
            totalSections={totalSections}
            totalPopulated={totalPopulated}
            extractionPct={extractionPct}
            aggregatedPosture={aggregatedPosture}
            selectedFrameworks={branding.selectedFrameworks}
            onExplainFinding={onExplainFinding}
          />
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
                <Suspense fallback={<CardSkeleton />}>
                  <MdrStatus analysisResults={analysisResult} files={files} />
                </Suspense>
              )}
              {w("firmware-tracker") && (
                <Suspense fallback={<CardSkeleton />}>
                  <FirmwareTracker files={files} />
                </Suspense>
              )}
            </div>
          )}
        </ErrorBoundary>
      </TabsContent>

      {/* Security Analysis */}
      <TabsContent value="security" className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
        <ErrorBoundary fallbackTitle="Security analysis failed to load">
          {securityStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                className={`rounded-xl border bg-card p-4 ${
                  securityStats.score >= 75
                    ? "border-[#00F2B3]/20 bg-[#00F2B3]/[0.04] dark:bg-[#00F2B3]/[0.06]"
                    : securityStats.score >= 50
                      ? "border-[#F29400]/20 bg-[#F29400]/[0.04]"
                      : "border-[#EA0022]/20 bg-[#EA0022]/[0.04]"
                }`}
              >
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Score</div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-2xl font-extrabold tabular-nums ${
                      securityStats.score >= 75
                        ? "text-[#00F2B3] dark:text-[#00F2B3]"
                        : securityStats.score >= 50
                          ? "text-[#F29400]"
                          : "text-[#EA0022]"
                    }`}
                  >
                    {securityStats.score}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      securityStats.score >= 75
                        ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3]"
                        : securityStats.score >= 50
                          ? "bg-[#F29400]/10 text-[#F29400]"
                          : "bg-[#EA0022]/10 text-[#EA0022]"
                    }`}
                  >
                    {securityStats.grade}
                  </span>
                </div>
              </div>
              <div
                className={`rounded-xl border border-border bg-card p-4 ${
                  securityStats.criticalHigh === 0
                    ? "border-[#00F2B3]/20 bg-[#00F2B3]/[0.04] dark:bg-[#00F2B3]/[0.06]"
                    : "border-[#EA0022]/20 bg-[#EA0022]/[0.04]"
                }`}
              >
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Critical Issues</div>
                <div
                  className={`text-2xl font-extrabold tabular-nums mt-1 ${
                    securityStats.criticalHigh === 0 ? "text-[#00F2B3] dark:text-[#00F2B3]" : "text-[#EA0022]"
                  }`}
                >
                  {securityStats.criticalHigh}
                </div>
              </div>
              <div
                className={`rounded-xl border border-border bg-card p-4 ${
                  securityStats.coverage >= 75
                    ? "border-[#00F2B3]/20 bg-[#00F2B3]/[0.04] dark:bg-[#00F2B3]/[0.06]"
                    : securityStats.coverage >= 40
                      ? "border-[#F29400]/20 bg-[#F29400]/[0.04]"
                      : "border-[#EA0022]/20 bg-[#EA0022]/[0.04]"
                }`}
              >
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Coverage</div>
                <div
                  className={`text-2xl font-extrabold tabular-nums mt-1 ${
                    securityStats.coverage >= 75
                      ? "text-[#00F2B3] dark:text-[#00F2B3]"
                      : securityStats.coverage >= 40
                        ? "text-[#F29400]"
                        : "text-[#EA0022]"
                  }`}
                >
                  {securityStats.coverage}%
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rules Analysed</div>
                <div className="text-2xl font-extrabold tabular-nums mt-1 text-foreground">
                  {securityStats.totalRules}
                </div>
              </div>
            </div>
          )}
          <Suspense fallback={<ChartSkeleton height={220} />}>
            <RiskScoreDashboard analysisResults={analysisResult} />
          </Suspense>

          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<StatGridSkeleton />}>
              <RuleHealthOverview analysisResults={analysisResult} />
            </Suspense>
            <Suspense fallback={<StatGridSkeleton count={4} />}>
              <SecurityFeatureCoverage analysisResults={analysisResult} />
            </Suspense>
          </div>

          {totalFindings > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Suspense fallback={<ChartSkeleton />}>
                <SeverityBreakdown analysisResults={analysisResult} />
              </Suspense>
              <Suspense fallback={<ChartSkeleton />}>
                <FindingsBySection analysisResults={analysisResult} />
              </Suspense>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<ChartSkeleton />}>
              <ZoneTrafficFlow files={files} />
            </Suspense>
            {totalFindings > 0 && (
              <Suspense fallback={<CardSkeleton />}>
                <TopFindings analysisResults={analysisResult} />
              </Suspense>
            )}
          </div>

          {totalFindings > 0 && (
            <Suspense fallback={<ChartSkeleton />}>
              <PriorityMatrix analysisResults={analysisResult} />
            </Suspense>
          )}

          {w("category-score-bars") && (
            <Suspense fallback={<CardSkeleton />}>
              <CategoryScoreBars analysisResults={analysisResult} />
            </Suspense>
          )}

          {w("coverage-matrix") && (
            <Suspense fallback={<CardSkeleton />}>
              <CoverageMatrix analysisResults={analysisResult} />
            </Suspense>
          )}

          {(w("category-trends") || w("risk-distribution")) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {w("category-trends") && (
                <Suspense fallback={<ChartSkeleton />}>
                  <CategoryTrends analysisResults={analysisResult} />
                </Suspense>
              )}
              {w("risk-distribution") && (
                <Suspense fallback={<ChartSkeleton />}>
                  <RiskDistributionWidget analysisResults={analysisResult} />
                </Suspense>
              )}
            </div>
          )}

          {(w("encryption-overview") || w("admin-exposure-map")) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {w("encryption-overview") && (
                <Suspense fallback={<ChartSkeleton />}>
                  <EncryptionOverview analysisResults={analysisResult} files={files} />
                </Suspense>
              )}
              {w("admin-exposure-map") && (
                <Suspense fallback={<CardSkeleton />}>
                  <AdminExposureMap analysisResults={analysisResult} files={files} />
                </Suspense>
              )}
            </div>
          )}

          {(w("vpn-security-summary") || w("network-zone-map")) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {w("vpn-security-summary") && (
                <Suspense fallback={<CardSkeleton />}>
                  <VpnSecuritySummary files={files} />
                </Suspense>
              )}
              {w("network-zone-map") && (
                <Suspense fallback={<ChartSkeleton />}>
                  <NetworkZoneMap files={files} />
                </Suspense>
              )}
            </div>
          )}

          {w("protocol-service-usage") && (
            <Suspense fallback={<ChartSkeleton />}>
              <ProtocolServiceWidget files={files} />
            </Suspense>
          )}

          {w("rule-action-dist") && (
            <Suspense fallback={<ChartSkeleton />}>
              <RuleActionDistribution files={files} />
            </Suspense>
          )}

          {w("finding-heatmap-time") && (
            <Suspense fallback={<ChartSkeleton />}>
              <FindingHeatmapTime analysisResults={analysisResult} />
            </Suspense>
          )}

          {w("threat-feed-timeline") && (
            <Suspense fallback={<CardSkeleton />}>
              <ThreatFeedTimeline files={files} />
            </Suspense>
          )}
        </ErrorBoundary>
      </TabsContent>

      {/* Compliance */}
      <TabsContent value="compliance" className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
        <ErrorBoundary fallbackTitle="Compliance view failed to load">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4" data-tour="compliance-heatmap">
            <div className="flex items-center gap-2">
              <img src="/icons/sophos-governance.svg" alt="" className="h-4 w-4 sophos-icon" />
              <h3 className="text-sm font-semibold text-foreground">Compliance Heatmap</h3>
              <TourHint
                tourId="compliance-heatmap"
                title="Compliance Heatmap"
                description="View control coverage, gaps, and readiness across NIST 800-53, ISO 27001, CIS, PCI DSS, HIPAA, Essential Eight, Cyber Essentials, and more."
              />
              {branding.selectedFrameworks.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B47AFF] font-bold">
                  {branding.selectedFrameworks.length} framework{branding.selectedFrameworks.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <Suspense fallback={<ChartSkeleton height={120} />}>
              <ComplianceHeatmap
                analysisResults={analysisResult}
                selectedFrameworks={branding.selectedFrameworks}
              />
            </Suspense>
          </div>

          <div data-tour="sophos-best-practice">
            <Suspense fallback={<CardSkeleton />}>
              <SophosBestPractice
                analysisResults={analysisResult}
                centralLicences={files.find((f) => f.centralEnrichment?.licences)?.centralEnrichment?.licences}
              />
            </Suspense>
          </div>

          <Suspense fallback={<CardSkeleton />}>
            <PeerBenchmark analysisResults={analysisResult} environment={branding.environment} />
          </Suspense>

          <Suspense fallback={<CardSkeleton />}>
            <InsuranceReadiness analysisResults={analysisResult} />
          </Suspense>

          {w("compliance-summary") && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Suspense fallback={<ChartSkeleton />}>
                <CompliancePostureRing analysisResults={analysisResult} selectedFrameworks={branding.selectedFrameworks} />
              </Suspense>
              <Suspense fallback={<ChartSkeleton />}>
                <FrameworkCoverageBars analysisResults={analysisResult} selectedFrameworks={branding.selectedFrameworks} />
              </Suspense>
            </div>
          )}

          {w("compliance-gaps") && (
            <Suspense fallback={<CardSkeleton />}>
              <ComplianceGapWidget analysisResults={analysisResult} selectedFrameworks={branding.selectedFrameworks} />
            </Suspense>
          )}

          {w("evidence-collection") && (
            <Suspense fallback={<CardSkeleton />}>
              <EvidenceCollection
                analysisResults={analysisResult}
                selectedFrameworks={branding.selectedFrameworks}
              />
            </Suspense>
          )}

          {(w("compliance-calendar") || w("attestation-workflow")) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {w("compliance-calendar") && (
                <Suspense fallback={<CardSkeleton />}>
                  <ComplianceCalendar files={files} />
                </Suspense>
              )}
              {w("attestation-workflow") && (
                <Suspense fallback={<CardSkeleton />}>
                  <AttestationWorkflow frameworks={branding.selectedFrameworks.length > 0 ? branding.selectedFrameworks : undefined} />
                </Suspense>
              )}
            </div>
          )}

          {w("regulatory-tracker") && (
            <Suspense fallback={<CardSkeleton />}>
              <RegulatoryTracker />
            </Suspense>
          )}
        </ErrorBoundary>
      </TabsContent>

      {/* Optimisation */}
      <TabsContent value="optimisation" className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
        <ErrorBoundary fallbackTitle="Optimisation view failed to load">
          <Suspense fallback={<SectionSkeleton />}>
            <RuleOptimiser files={files} />
          </Suspense>
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
      <TabsContent value="tools" className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
        <ErrorBoundary fallbackTitle="Tools failed to load">
          <Suspense fallback={<ChartSkeleton height={220} />}>
            <RiskScoreDashboard analysisResults={analysisResult} projected={projectedScore} />
          </Suspense>

          {totalFindings > 0 && (
            <Suspense fallback={<CardSkeleton />}>
              <ScoreSimulator analysisResults={analysisResult} onProjectedChange={setProjectedScore} defaultOpen />
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
              <ExportCentre analysisResults={analysisResult} branding={{ customerName: branding.customerName, selectedFrameworks: branding.selectedFrameworks }} />
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
              <CompareToSavedBaseline analysisResults={analysisResult} customerName={branding.customerName} />
            </Suspense>
          )}
        </ErrorBoundary>
      </TabsContent>

      {/* Remediation */}
      <TabsContent value="remediation" className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
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
              <FindingsBulkView analysisResults={analysisResult} />
            </Suspense>
          )}
          <Suspense fallback={null}>
            <RemediationPlaybooks analysisResults={analysisResult} />
          </Suspense>
          <Suspense fallback={null}>
            <ChangeApproval />
          </Suspense>
        </ErrorBoundary>
      </TabsContent>

      {/* Compare */}
      <TabsContent value="compare" className="space-y-6 mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
        <ErrorBoundary fallbackTitle="Compare view failed to load">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Before (baseline)</label>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                  value={diffSelection?.beforeIdx ?? 0}
                  data-tour="compare-before"
                  onChange={(e) => setDiffSelection((prev: DiffSelection) => ({
                    beforeIdx: Number(e.target.value),
                    afterIdx: prev?.afterIdx ?? Math.min(1, files.length - 1),
                  }))}
                >
                  {files.map((f, i) => (
                    <option key={f.id} value={i}>{fileLabel(f)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">After (current)</label>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                  value={diffSelection?.afterIdx ?? Math.min(1, files.length - 1)}
                  data-tour="compare-after"
                  onChange={(e) => setDiffSelection((prev: DiffSelection) => ({
                    beforeIdx: prev?.beforeIdx ?? 0,
                    afterIdx: Number(e.target.value),
                  }))}
                >
                  {files.map((f, i) => (
                    <option key={f.id} value={i}>{fileLabel(f)}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-2"
              data-tour="compare-button"
              onClick={() => setDiffSelection({
                beforeIdx: diffSelection?.beforeIdx ?? 0,
                afterIdx: diffSelection?.afterIdx ?? Math.min(1, files.length - 1),
              })}
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

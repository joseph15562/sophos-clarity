import { useState, useCallback, useEffect, useMemo, lazy, Suspense, type ReactNode } from "react";
import { ArrowLeftRight, ChevronDown, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileUpload, UploadedFile } from "@/components/FileUpload";
import { BrandingSetup, BrandingData } from "@/components/BrandingSetup";
import { AppHeader } from "@/components/AppHeader";
import { EstateOverview } from "@/components/EstateOverview";
import { ReportCards } from "@/components/ReportCards";
import { extractSections } from "@/lib/extract-sections";
import { useReportGeneration, ParsedFile } from "@/hooks/use-report-generation";
import { useFirewallAnalysis } from "@/hooks/use-firewall-analysis";
import { useAutoSave, loadSession, clearSession } from "@/hooks/use-session-persistence";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getCentralStatus, getCachedFirewalls, getAlerts, getFirewallLicences } from "@/lib/sophos-central";
import type { CentralEnrichment as CentralEnrichmentType } from "@/lib/stream-ai";
import { AuthGate } from "@/components/AuthGate";
import { OrgSetup } from "@/components/OrgSetup";
import { saveReportCloud, saveReportLocal, type SavedReportEntry, type AnalysisSummary } from "@/lib/saved-reports";
import { saveAssessmentCloud } from "@/lib/assessment-cloud";
import { saveAssessment as saveAssessmentLocal } from "@/lib/assessment-history";
import type { LoadSavedReportArgs } from "@/components/SavedReportsLibrary";
import { logAudit } from "@/lib/audit";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationCentre } from "@/components/NotificationCentre";
import { useKeyboardShortcuts, type ShortcutAction } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcuts";
import { ManagementDrawer } from "@/components/ManagementDrawer";
import { SetupWizard, isSetupComplete, resetSetupFlag } from "@/components/SetupWizard";

const DocumentPreview = lazy(() => import("@/components/DocumentPreview").then((m) => ({ default: m.DocumentPreview })));
const ConfigDiff = lazy(() => import("@/components/ConfigDiff").then((m) => ({ default: m.ConfigDiff })));
const RiskScoreDashboard = lazy(() => import("@/components/RiskScoreDashboard").then((m) => ({ default: m.RiskScoreDashboard })));
const RemediationPlaybooks = lazy(() => import("@/components/RemediationPlaybooks").then((m) => ({ default: m.RemediationPlaybooks })));
const ComplianceHeatmap = lazy(() => import("@/components/ComplianceHeatmap").then((m) => ({ default: m.ComplianceHeatmap })));
const AIChatPanel = lazy(() => import("@/components/AIChatPanel").then((m) => ({ default: m.AIChatPanel })));
const ScoreSimulator = lazy(() => import("@/components/ScoreSimulator").then((m) => ({ default: m.ScoreSimulator })));
const AttackSurfaceMap = lazy(() => import("@/components/AttackSurfaceMap").then((m) => ({ default: m.AttackSurfaceMap })));
const ConsistencyChecker = lazy(() => import("@/components/ConsistencyChecker").then((m) => ({ default: m.ConsistencyChecker })));
const PeerBenchmark = lazy(() => import("@/components/PeerBenchmark").then((m) => ({ default: m.PeerBenchmark })));
const SophosBestPractice = lazy(() => import("@/components/SophosBestPractice").then((m) => ({ default: m.SophosBestPractice })));
const RuleOptimiser = lazy(() => import("@/components/RuleOptimiser").then((m) => ({ default: m.RuleOptimiser })));
const PriorityMatrix = lazy(() => import("@/components/PriorityMatrix").then((m) => ({ default: m.PriorityMatrix })));
const FirewallLinker = lazy(() => import("@/components/FirewallLinker").then((m) => ({ default: m.FirewallLinker })));
const CentralEnrichment = lazy(() => import("@/components/CentralEnrichment").then((m) => ({ default: m.CentralEnrichment })));
const SeverityBreakdown = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.SeverityBreakdown })));
const SecurityFeatureCoverage = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.SecurityFeatureCoverage })));
const ZoneTrafficFlow = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.ZoneTrafficFlow })));
const TopFindings = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.TopFindings })));
const RuleHealthOverview = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.RuleHealthOverview })));
const FindingsBySection = lazy(() => import("@/components/SecurityDashboards").then((m) => ({ default: m.FindingsBySection })));
import { DashboardLoadingSkeleton, SectionSkeleton, ChartSkeleton, StatGridSkeleton, CardSkeleton } from "@/components/DashboardSkeleton";

type DiffSelection = { beforeIdx: number; afterIdx: number } | null;

function CollapsibleSection({ title, subtitle, icon, iconBg, defaultOpen = false, badge, children }: {
  title: string; subtitle?: string; icon: ReactNode; iconBg: string;
  defaultOpen?: boolean; badge?: ReactNode; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={`h-7 w-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-display font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </section>
  );
}

function InnerApp() {
  const { isGuest, org } = useAuth();
  const { notifications, unreadCount, addNotification, markRead, markAllRead, dismiss: dismissNotif, clearAll: clearNotifs } = useNotifications();
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [branding, setBranding] = useState<BrandingData>({ companyName: "", logoUrl: null, customerName: "", environment: "", country: "", selectedFrameworks: [] });
  const [diffSelection, setDiffSelection] = useState<DiffSelection>(null);
  const [restoredSession, setRestoredSession] = useState(false);
  const [savingReports, setSavingReports] = useState(false);
  const [reportsSaved, setReportsSaved] = useState(false);
  const [savedReportsTrigger, setSavedReportsTrigger] = useState(0);

  const {
    reports, setReports, activeReportId, setActiveReportId,
    isLoading, loadingReportIds, failedReportIds,
    generateIndividual, generateExecutive, generateCompliance, generateAll, handleRetry,
  } = useReportGeneration(files, branding);

  const {
    analysisResults, totalFindings, totalRules, totalSections,
    totalPopulated, extractionPct, aggregatedPosture,
  } = useFirewallAnalysis(files);

  const configMetas = useMemo(() =>
    files.map((f) => {
      const result = analysisResults[f.label || f.fileName.replace(/\.(html|htm)$/i, "")];
      return {
        label: f.label || f.fileName.replace(/\.(html|htm)$/i, ""),
        hostname: result?.hostname,
        configHash: f.id,
      };
    }),
  [files, analysisResults]);

  useAutoSave(branding, reports, activeReportId);

  // Restore session on mount
  useEffect(() => {
    const session = loadSession();
    if (session && session.reports.length > 0) {
      setBranding(session.branding);
      setReports(session.reports);
      setActiveReportId(session.activeReportId);
      setRestoredSession(true);
      setViewingReports(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilesChange = useCallback((uploaded: UploadedFile[]) => {
    const parsed: ParsedFile[] = uploaded.map((f) => {
      const existing = files.find((pf) => pf.id === f.id);
      if (existing) return { ...existing, label: f.label };
      const extractedData = extractSections(f.content);
      return { ...f, extractedData };
    });
    setFiles(parsed);
    if (reports.length > 0) {
      setReports([]);
      setActiveReportId("");
    }
    setReportsSaved(false);
    if (org?.id) {
      const newFiles = parsed.filter((p) => !files.find((f) => f.id === p.id));
      if (newFiles.length > 0) logAudit(org.id, "config.uploaded", "config", "", { count: newFiles.length });
    }
  }, [files, reports.length, setReports, setActiveReportId, org?.id]);

  // Enrich files with Sophos Central live data when firewalls are linked
  const [centralEnriched, setCentralEnriched] = useState(false);
  const fileIds = useMemo(() => files.map((f) => f.id).join(","), [files]);

  useEffect(() => { setCentralEnriched(false); }, [fileIds]);

  useEffect(() => {
    if (!org?.id || isGuest || files.length === 0 || centralEnriched) return;
    let cancelled = false;
    const orgId = org.id;

    (async () => {
      try {
        const status = await getCentralStatus(orgId);
        if (!status?.connected || cancelled) return;

        const hashes = files.map((f) => f.id);
        const { data: links } = await supabase
          .from("firewall_config_links")
          .select("config_hash, central_firewall_id, central_tenant_id")
          .eq("org_id", orgId)
          .in("config_hash", hashes);

        if (!links || links.length === 0 || cancelled) return;

        const cachedFws = await getCachedFirewalls(orgId);
        const tenantIds = [...new Set(links.map((l) => l.central_tenant_id))];

        const alertsByTenant: Record<string, Awaited<ReturnType<typeof getAlerts>>> = {};
        for (const tid of tenantIds) {
          try { alertsByTenant[tid] = await getAlerts(orgId, tid); } catch { alertsByTenant[tid] = []; }
        }

        // Fetch per-firewall licence data
        let fwLicenceMap: Record<string, Array<{ product: string; endDate: string; type: string }>> = {};
        try {
          const fwLicences = await getFirewallLicences(orgId);
          for (const fwl of fwLicences) {
            fwLicenceMap[fwl.serialNumber] = fwl.licenses.map((l) => ({
              product: l.product?.name || l.product?.code || l.type,
              endDate: l.endDate ?? (l.perpetual ? "Perpetual" : ""),
              type: l.type,
            }));
          }
        } catch { /* licensing API may not be available */ }

        if (cancelled) return;

        const enrichments: Record<string, CentralEnrichmentType> = {};
        for (const link of links) {
          const fw = cachedFws.find((f) => f.firewallId === link.central_firewall_id);
          if (!fw) continue;
          const fwAlerts = (alertsByTenant[link.central_tenant_id] ?? [])
            .filter((a) => a.managedAgent?.id === link.central_firewall_id);

          const cluster = fw.cluster as { mode?: string; status?: string } | null;

          enrichments[link.config_hash] = {
            firmware: fw.firmwareVersion,
            model: fw.model,
            serialNumber: fw.serialNumber,
            connected: (fw.status as { connected?: boolean } | null)?.connected ?? false,
            haCluster: cluster ? { mode: cluster.mode, status: cluster.status } : undefined,
            licences: fwLicenceMap[fw.serialNumber] ?? undefined,
            alerts: fwAlerts.map((a) => ({
              severity: a.severity,
              description: a.description,
              category: a.category,
              raisedAt: a.raisedAt,
            })),
          };
        }

        if (cancelled || Object.keys(enrichments).length === 0) return;

        setFiles((prev) =>
          prev.map((f) =>
            enrichments[f.id] ? { ...f, centralEnrichment: enrichments[f.id] } : f
          )
        );
        setCentralEnriched(true);
      } catch { /* Central not available — no enrichment */ }
    })();

    return () => { cancelled = true; };
  }, [org?.id, isGuest, files.length, centralEnriched]); // eslint-disable-line react-hooks/exhaustive-deps

  const [saveError, setSaveError] = useState("");

  const handleSaveReports = useCallback(async (includeReports: boolean) => {
    if (Object.keys(analysisResults).length === 0) return;
    setSavingReports(true);
    setSaveError("");
    try {
      const reportEntries: SavedReportEntry[] = includeReports
        ? reports.filter((r) => r.markdown).map((r) => ({ id: r.id, label: r.label, markdown: r.markdown }))
        : [];
      let result: unknown;
      if (!isGuest && org) {
        result = await saveReportCloud(org.id, branding.customerName, branding.environment, reportEntries, analysisResults);
        // Also save an assessment snapshot so the Multi-Tenant Dashboard populates
        try { await saveAssessmentCloud(analysisResults, branding.customerName, branding.environment, org.id); } catch { /* best-effort */ }
      } else {
        result = await saveReportLocal(branding.customerName, branding.environment, reportEntries, analysisResults);
        try { await saveAssessmentLocal(analysisResults, branding.customerName, branding.environment); } catch { /* best-effort */ }
      }
      if (!result) {
        setSaveError("Save failed — have you run the 003_saved_reports.sql migration in Supabase?");
      } else {
        setReportsSaved(true);
        setSavedReportsTrigger((n) => n + 1);
        setTimeout(() => setReportsSaved(false), 3000);
        if (org?.id) {
          logAudit(org.id, includeReports ? "report.saved" : "assessment.saved", "report", branding.customerName, { reportCount: reportEntries.length });
        }
        addNotification("success", includeReports ? "Reports Saved" : "Assessment Saved", `${branding.customerName || "Assessment"} saved successfully with ${reportEntries.length} report${reportEntries.length !== 1 ? "s" : ""}.`);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
    setSavingReports(false);
  }, [analysisResults, reports, isGuest, org, branding.customerName, branding.environment]);

  const [loadedSavedSummary, setLoadedSavedSummary] = useState<{ customerName: string; summary: AnalysisSummary } | null>(null);

  const handleLoadSavedReports = useCallback((args: LoadSavedReportArgs) => {
    const { reports: savedReports, customerName, environment, analysisSummary } = args;
    if (savedReports.length > 0) {
      setReports(savedReports.map((r) => ({ id: r.id, label: r.label, markdown: r.markdown })));
      setActiveReportId(savedReports[0].id);
      setLoadedSavedSummary(null);
      setViewingReports(true);
      setDrawerOpen(false);
    } else {
      setLoadedSavedSummary({ customerName, summary: analysisSummary });
    }
    setBranding((prev) => ({ ...prev, customerName, environment }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setReports, setActiveReportId]);

  const handleStartOver = useCallback(() => {
    setReports([]);
    setActiveReportId("");
    setFiles([]);
    setRestoredSession(false);
    setViewingReports(false);
    clearSession();
  }, [setReports, setActiveReportId]);

  const [viewingReports, setViewingReports] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(() => !isGuest && !!org && !isSetupComplete());
  const hasReports = reports.length > 0;
  const hasFiles = files.length > 0;
  const inDiffMode = diffSelection !== null;

  const keyboardShortcuts = useMemo<ShortcutAction[]>(() => [
    { key: "?", description: "Show keyboard shortcuts", handler: () => setShortcutsOpen((v) => !v) },
    { key: "Escape", description: "Go back / close modal", handler: () => {
      if (shortcutsOpen) { setShortcutsOpen(false); return; }
      if (drawerOpen) { setDrawerOpen(false); return; }
      if (viewingReports) setViewingReports(false);
      if (inDiffMode) setDiffSelection(null);
    }},
    { key: "s", ctrl: true, description: "Save reports", handler: () => { if (hasReports) handleSaveReports(true); else if (hasFiles && totalFindings > 0) handleSaveReports(false); }},
    { key: "g", ctrl: true, description: "Generate all reports", handler: () => { if (hasFiles && !isLoading) { setViewingReports(true); generateAll(); } }},
    ...Array.from({ length: 9 }, (_, i) => ({
      key: String(i + 1),
      description: `Switch to report tab ${i + 1}`,
      handler: () => { if (viewingReports && reports[i]) setActiveReportId(reports[i].id); },
    })),
  ], [shortcutsOpen, drawerOpen, viewingReports, inDiffMode, hasReports, hasFiles, totalFindings, isLoading, reports, handleSaveReports, generateAll, setActiveReportId]);

  useKeyboardShortcuts(keyboardShortcuts);

  const fileLabel = (f: ParsedFile) => f.label || f.fileName.replace(/\.(html|htm)$/i, "");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        hasFiles={hasFiles}
        fileCount={files.length}
        customerName={branding.customerName}
        environment={branding.environment}
        selectedFrameworks={branding.selectedFrameworks}
        reportCount={reports.length}
        onOrgClick={() => setDrawerOpen(true)}
        notificationSlot={
          <NotificationCentre
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onDismiss={dismissNotif}
            onClearAll={clearNotifs}
          />
        }
      />

      <main className={`mx-auto px-4 py-8 space-y-8 ${viewingReports ? "max-w-full w-full" : "max-w-5xl"}`}>
        {/* Restored session banner */}
        {restoredSession && viewingReports && hasReports && !isLoading && (
          <div className="no-print rounded-lg border border-[#2006F7]/20 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] px-4 py-2.5 flex items-center gap-3 text-sm">
            <RotateCcw className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF] shrink-0" />
            <span className="text-foreground">Previous session restored — {reports.length} report{reports.length !== 1 ? "s" : ""} recovered.</span>
            <span className="text-muted-foreground text-xs">Reports are saved locally for 24 hours.</span>
          </div>
        )}

        {/* Loaded from saved Pre-AI assessment */}
        {loadedSavedSummary && (
          <div className="no-print rounded-xl border border-[#00995a]/20 dark:border-[#00F2B3]/20 bg-[#00995a]/[0.04] dark:bg-[#00F2B3]/[0.04] px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#00995a]/10 dark:bg-[#00F2B3]/10 flex items-center justify-center">
                  <img src="/icons/sophos-chart.svg" alt="" className="h-4 w-4 sophos-icon" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Saved Assessment — {loadedSavedSummary.customerName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Pre-AI deterministic analysis loaded from saved reports
                  </p>
                </div>
              </div>
              <button onClick={() => setLoadedSavedSummary(null)} className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-muted/50 transition-colors">
                Dismiss
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                loadedSavedSummary.summary.overallScore >= 75 ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" :
                loadedSavedSummary.summary.overallScore >= 50 ? "bg-[#F29400]/10 text-[#F29400]" :
                "bg-[#EA0022]/10 text-[#EA0022]"
              }`}>
                Score: {loadedSavedSummary.summary.overallScore} ({loadedSavedSummary.summary.overallGrade})
              </span>
              <span className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
                {loadedSavedSummary.summary.totalFindings} findings
              </span>
              <span className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
                {loadedSavedSummary.summary.totalRules} rules
              </span>
              {loadedSavedSummary.summary.categories.map((c) => (
                <span key={c.label} className={`text-[10px] px-2 py-1 rounded-md ${
                  c.pct >= 80 ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]" :
                  c.pct >= 50 ? "bg-[#F29400]/10 text-[#F29400]" :
                  "bg-[#EA0022]/10 text-[#EA0022]"
                }`}>
                  {c.label}: {c.pct}%
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Upload the firewall config to run a full analysis, or generate AI reports from the live data.
            </p>
          </div>
        )}

        {/* Config Diff Mode */}
        {inDiffMode && (
          <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Loading diff viewer…</div>}>
            <ConfigDiff
              beforeLabel={fileLabel(files[diffSelection.beforeIdx])}
              afterLabel={fileLabel(files[diffSelection.afterIdx])}
              beforeSections={files[diffSelection.beforeIdx].extractedData}
              afterSections={files[diffSelection.afterIdx].extractedData}
              onClose={() => setDiffSelection(null)}
            />
          </Suspense>
        )}

        {!viewingReports && !isLoading && !inDiffMode && (
          <>
            {/* Landing hero */}
            {!hasFiles && (
              <section className="text-center py-6 space-y-4">
                <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">
                  Turn Sophos Firewall Exports into Audit-Ready Documentation
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
                  Drop in your Sophos XGS configuration exports and get instant security findings, risk scoring,
                  and compliance mapping — no AI required. Generate branded reports, remediation playbooks,
                  and evidence packs ready for customer handoff or audit.
                </p>
                <div className="flex flex-wrap justify-center gap-6 pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><img src="/icons/sophos-document.svg" alt="" className="h-4 w-4 sophos-icon" /> Technical Reports</span>
                  <span className="flex items-center gap-1.5"><img src="/icons/sophos-chart.svg" alt="" className="h-4 w-4 sophos-icon" /> Executive Briefs</span>
                  <span className="flex items-center gap-1.5"><img src="/icons/sophos-governance.svg" alt="" className="h-4 w-4 sophos-icon" /> Compliance Packs</span>
                  <span className="flex items-center gap-1.5"><img src="/icons/sophos-security.svg" alt="" className="h-4 w-4 sophos-icon" /> Data Anonymised</span>
                </div>
              </section>
            )}


            {/* Step 1 — Upload */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">1</span>
                <h2 className="text-lg font-display font-bold text-foreground">Upload Firewall Exports</h2>
              </div>
              <FileUpload files={files} onFilesChange={handleFilesChange} />
            </section>

            {/* Step 2 — Assessment Context (before findings so compliance tags are dynamic) */}
            {hasFiles && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-[#2006F7] text-white text-xs font-bold ring-4 ring-[#2006F7]/15 dark:ring-[#2006F7]/25">2</span>
                  <h2 className="text-lg font-display font-bold text-foreground">Assessment Context</h2>
                  <span className="text-xs text-muted-foreground">(optional — select frameworks to tag findings)</span>
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <BrandingSetup branding={branding} onChange={setBranding} />
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Sophos Central Firewall Linking */}
            {hasFiles && !isGuest && configMetas.length > 0 && (
              <Suspense fallback={null}>
                <FirewallLinker
                  configs={configMetas}
                  customerName={branding.customerName}
                  analysisResults={analysisResults}
                  onLink={() => setCentralEnriched(false)}
                />
              </Suspense>
            )}

            {/* Privacy banner */}
            {hasFiles && (
              <div className="rounded-xl border border-[#00995a]/20 dark:border-[#00F2B3]/20 border-l-4 border-l-[#00995a] dark:border-l-[#00F2B3] bg-[#00995a]/[0.04] dark:bg-[#00F2B3]/[0.04] px-5 py-4 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-[#00995a]/10 dark:bg-[#00F2B3]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <img src="/icons/sophos-security.svg" alt="" className="h-5 w-5 sophos-icon" />
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-bold text-[#00774a] dark:text-[#00F2B3]">Data Privacy Protected</span> — All IP addresses, customer names, and firewall identifiers are automatically anonymised before being sent to the AI. Your sensitive network data never leaves the browser; only sanitised structural data is transmitted for analysis. Real values are restored locally in the final report.
                </div>
              </div>
            )}

            {/* Generate Reports — always visible */}
            {hasFiles && (
              <ReportCards
                fileCount={files.length}
                onGenerateIndividual={() => { setViewingReports(true); generateIndividual(); if (org?.id) logAudit(org.id, "report.generated", "report", "individual"); }}
                onGenerateExecutive={() => { setViewingReports(true); generateExecutive(); if (org?.id) logAudit(org.id, "report.generated", "report", "executive"); }}
                onGenerateCompliance={() => { setViewingReports(true); generateCompliance(); if (org?.id) logAudit(org.id, "report.generated", "report", "compliance"); }}
                onGenerateAll={() => { setViewingReports(true); generateAll(); if (org?.id) logAudit(org.id, "report.generated", "report", "all"); addNotification("info", "Generating Reports", `Generating all reports for ${branding.customerName || "this assessment"}…`); }}
              />
            )}

            {/* View Reports banner — shown when reports exist but user is on dashboard */}
            {hasReports && (
              <div className="rounded-xl border border-[#2006F7]/20 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] px-5 py-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center shrink-0">
                  <img src="/icons/sophos-document.svg" alt="" className="h-5 w-5 sophos-icon" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {reports.length} Report{reports.length !== 1 ? "s" : ""} Ready
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Your generated reports are available to view, print, or save.
                  </p>
                </div>
                <Button onClick={() => setViewingReports(true)} className="gap-2 bg-[#2006F7] hover:bg-[#10037C] text-white">
                  <img src="/icons/sophos-document.svg" alt="" className="h-4 w-4 brightness-0 invert" />
                  View Reports
                </Button>
              </div>
            )}

            {/* Save Assessment (pre-AI) */}
            {hasFiles && totalFindings > 0 && !hasReports && (
              <div className="flex items-center justify-end gap-3">
                {saveError && <span className="text-[10px] text-[#EA0022]">{saveError}</span>}
                <button
                  onClick={() => handleSaveReports(false)}
                  disabled={savingReports}
                  className={`no-print flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                    reportsSaved
                      ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]"
                      : "bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF] hover:bg-[#2006F7]/20"
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  {reportsSaved ? "Saved!" : savingReports ? "Saving…" : "Save Assessment (Pre-AI)"}
                </button>
              </div>
            )}

            {/* Detailed Analysis divider */}
            {hasFiles && (
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Detailed Security Analysis
                  </span>
                </div>
              </div>
            )}

            {hasFiles && (
              <CollapsibleSection
                title="Initial Findings &amp; Estate Overview"
                subtitle={`${totalFindings} issue${totalFindings !== 1 ? "s" : ""} · ${totalRules} rules · ${files.length} firewall${files.length !== 1 ? "s" : ""}`}
                icon={<img src="/icons/sophos-alert.svg" alt="" className="h-4 w-4 brightness-0 invert" />}
                iconBg={totalFindings > 0 ? "bg-[#EA0022]" : "bg-[#00995a]"}
                defaultOpen
                badge={totalFindings > 0 ? (
                  <div className="flex items-center gap-1">
                    {(() => {
                      const counts: Record<string, number> = {};
                      Object.values(analysisResults).forEach((r) =>
                        r.findings.forEach((f) => { counts[f.severity] = (counts[f.severity] || 0) + 1; })
                      );
                      return Object.entries(counts).map(([sev, count]) => (
                        <span key={sev} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sev === "critical" ? "bg-[#EA0022]/10 text-[#EA0022]" : sev === "high" ? "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]" : sev === "medium" ? "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]" : sev === "low" ? "bg-[#00F2B3]/10 text-[#00995a] dark:text-[#00F2B3]" : "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]"}`}>
                          {count}{sev[0].toUpperCase()}
                        </span>
                      ));
                    })()}
                  </div>
                ) : undefined}
              >
                <div className="p-5 space-y-6">
                  <EstateOverview
                    fileCount={files.length}
                    analysisResults={analysisResults}
                    totalFindings={totalFindings}
                    totalRules={totalRules}
                    totalSections={totalSections}
                    totalPopulated={totalPopulated}
                    extractionPct={extractionPct}
                    aggregatedPosture={aggregatedPosture}
                    selectedFrameworks={branding.selectedFrameworks}
                  />
                  {!isGuest && configMetas.length > 0 && (
                    <Suspense fallback={null}>
                      <CentralEnrichment
                        configMetas={configMetas}
                        customerName={branding.customerName}
                      />
                    </Suspense>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Security Risk Score, Compliance & Benchmark */}
            {hasFiles && (
              <CollapsibleSection
                title="Security Risk Score, Compliance &amp; Benchmark"
                subtitle={`Risk scoring, compliance mapping${branding.environment ? `, peer comparison (${branding.environment})` : ""}`}
                icon={<img src="/icons/sophos-security.svg" alt="" className="h-4 w-4 sophos-icon" />}
                iconBg="bg-[#2006F7]/10 dark:bg-[#00EDFF]/10"
                defaultOpen
              >
                <div className="p-5 space-y-6">
                  {/* Risk Score — full width */}
                  <Suspense fallback={<ChartSkeleton height={220} />}>
                    <RiskScoreDashboard analysisResults={analysisResults} />
                  </Suspense>

                  {/* Config Health + Feature Coverage side by side */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Suspense fallback={<StatGridSkeleton />}>
                      <RuleHealthOverview analysisResults={analysisResults} />
                    </Suspense>
                    <Suspense fallback={<StatGridSkeleton count={4} />}>
                      <SecurityFeatureCoverage analysisResults={analysisResults} />
                    </Suspense>
                  </div>

                  {/* Severity Donut + Findings by Section */}
                  {totalFindings > 0 && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <Suspense fallback={<ChartSkeleton />}>
                        <SeverityBreakdown analysisResults={analysisResults} />
                      </Suspense>
                      <Suspense fallback={<ChartSkeleton />}>
                        <FindingsBySection analysisResults={analysisResults} />
                      </Suspense>
                    </div>
                  )}

                  {/* Zone Traffic Flow + Top Findings */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Suspense fallback={<ChartSkeleton />}>
                      <ZoneTrafficFlow files={files} />
                    </Suspense>
                    {totalFindings > 0 && (
                      <Suspense fallback={<CardSkeleton />}>
                        <TopFindings analysisResults={analysisResults} />
                      </Suspense>
                    )}
                  </div>

                  {/* Peer Benchmark + Best Practice */}
                  <Suspense fallback={<CardSkeleton />}>
                    <PeerBenchmark analysisResults={analysisResults} environment={branding.environment} />
                  </Suspense>
                  <Suspense fallback={<CardSkeleton />}>
                    <SophosBestPractice
                      analysisResults={analysisResults}
                      centralLicences={files.find((f) => f.centralEnrichment?.licences)?.centralEnrichment?.licences}
                    />
                  </Suspense>

                  {/* Compliance Heatmap */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <img src="/icons/sophos-governance.svg" alt="" className="h-4 w-4 sophos-icon" />
                      <h3 className="text-sm font-semibold text-foreground">Compliance Heatmap</h3>
                      {branding.selectedFrameworks.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5A00FF]/10 text-[#5A00FF] dark:text-[#B47AFF] font-bold">
                          {branding.selectedFrameworks.length} framework{branding.selectedFrameworks.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <Suspense fallback={<ChartSkeleton height={120} />}>
                      <ComplianceHeatmap
                        analysisResults={analysisResults}
                        selectedFrameworks={branding.selectedFrameworks}
                      />
                    </Suspense>
                  </div>

                  {/* Finding Priority Matrix */}
                  {totalFindings > 0 && (
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <img src="/icons/sophos-chart.svg" alt="" className="h-4 w-4 sophos-icon" />
                        <h3 className="text-sm font-semibold text-foreground">Finding Priority Matrix</h3>
                        <span className="text-[10px] text-muted-foreground">Impact vs effort quadrant</span>
                      </div>
                      <Suspense fallback={<ChartSkeleton />}>
                        <PriorityMatrix analysisResults={analysisResults} />
                      </Suspense>
                    </div>
                  )}

                  {/* What-If Score Simulator */}
                  {totalFindings > 0 && (
                    <Suspense fallback={<CardSkeleton />}>
                      <ScoreSimulator analysisResults={analysisResults} />
                    </Suspense>
                  )}

                  {/* Attack Surface Map */}
                  <Suspense fallback={<CardSkeleton />}>
                    <AttackSurfaceMap files={files} />
                  </Suspense>
                </div>
              </CollapsibleSection>
            )}

            {/* Rule Optimisation */}
            {hasFiles && (
              <CollapsibleSection
                title="Rule Optimisation Engine"
                subtitle="Detect duplicate, shadowed, and mergeable firewall rules"
                icon={<img src="/icons/sophos-security.svg" alt="" className="h-4 w-4 brightness-0 invert" />}
                iconBg="bg-[#10037C]"
              >
              <Suspense fallback={<SectionSkeleton />}>
                <RuleOptimiser files={files} />
              </Suspense>
              </CollapsibleSection>
            )}

            {/* Multi-Firewall Consistency */}
            {hasFiles && files.length >= 2 && (
              <Suspense fallback={null}>
                <ConsistencyChecker analysisResults={analysisResults} />
              </Suspense>
            )}

            {/* Remediation Playbooks */}
            {hasFiles && totalFindings > 0 && (
              <CollapsibleSection
                title="Quick Remediation Playbooks"
                subtitle="Step-by-step Sophos Firewall instructions to resolve each finding"
                icon={<img src="/icons/sophos-security.svg" alt="" className="h-4 w-4 brightness-0 invert" />}
                iconBg="bg-[#00995a]"
              >
                <div className="p-5">
                  <Suspense fallback={null}>
                    <RemediationPlaybooks analysisResults={analysisResults} />
                  </Suspense>
                </div>
              </CollapsibleSection>
            )}


            {/* Config diff — compare two configs */}
            {files.length >= 2 && (
              <CollapsibleSection
                title="Compare Configurations"
                subtitle="Side-by-side diff for change reviews and drift auditing"
                icon={<ArrowLeftRight className="h-4 w-4 text-white" />}
                iconBg="bg-[#10037C]"
              >
                <div className="p-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Before (baseline)</label>
                      <select
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
                        value={diffSelection?.beforeIdx ?? 0}
                        onChange={(e) => setDiffSelection((prev) => ({
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
                        onChange={(e) => setDiffSelection((prev) => ({
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
                    onClick={() => setDiffSelection({
                      beforeIdx: diffSelection?.beforeIdx ?? 0,
                      afterIdx: diffSelection?.afterIdx ?? Math.min(1, files.length - 1),
                    })}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Compare
                  </Button>
                </div>
              </CollapsibleSection>
            )}
          </>
        )}

        {/* Report view */}
        {(viewingReports || isLoading) && (
          <>
            {/* Top bar: Back to Dashboard + actions */}
            {hasReports && !isLoading && (
              <div className="no-print flex flex-wrap items-center gap-3 mb-2">
                <Button variant="outline" onClick={() => setViewingReports(false)} className="gap-2">
                  <ArrowLeftRight className="h-3.5 w-3.5 rotate-180" />
                  Back to Dashboard
                </Button>
                <div className="flex-1" />
                <div className="flex flex-wrap gap-2">
                  {files.length >= 2 && !reports.find((r) => r.id === "report-executive") && (
                    <Button variant="secondary" size="sm" onClick={() => generateExecutive()} className="gap-1.5 text-xs">
                      <img src="/icons/sophos-chart.svg" alt="" className="h-3.5 w-3.5 sophos-icon" /> Add Executive Brief
                    </Button>
                  )}
                  {!reports.find((r) => r.id === "report-compliance") && (
                    <Button variant="outline" size="sm" onClick={generateCompliance} className="gap-1.5 text-xs">
                      <img src="/icons/sophos-governance.svg" alt="" className="h-3.5 w-3.5 sophos-icon" /> Add Compliance Pack
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Stats bar */}
            {hasReports && !isLoading && (
              <div className="no-print flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-[11px]">
                <span className="font-semibold text-foreground mr-1">{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
                <span className="w-px h-3 bg-border" />
                <span className="text-muted-foreground">{files.length} firewall{files.length !== 1 ? "s" : ""}</span>
                <span className="w-px h-3 bg-border" />
                <span className="text-muted-foreground">{totalRules} rules</span>
                {totalFindings > 0 && (
                  <>
                    <span className="w-px h-3 bg-border" />
                    {(() => {
                      const counts: Record<string, number> = {};
                      Object.values(analysisResults).forEach((r) =>
                        r.findings.forEach((f) => { counts[f.severity] = (counts[f.severity] || 0) + 1; })
                      );
                      return Object.entries(counts).map(([sev, count]) => (
                        <span key={sev} className={`px-1.5 py-0.5 rounded font-medium ${sev === "critical" ? "bg-[#EA0022]/10 text-[#EA0022]" : sev === "high" ? "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]" : sev === "medium" ? "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]" : sev === "low" ? "bg-[#00F2B3]/10 text-[#00995a] dark:text-[#00F2B3]" : "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]"}`}>
                          {count} {sev}
                        </span>
                      ));
                    })()}
                  </>
                )}
              </div>
            )}

            <Suspense fallback={null}>
              <DocumentPreview
                reports={reports}
                activeReportId={activeReportId}
                onActiveChange={setActiveReportId}
                isLoading={isLoading}
                loadingReportIds={loadingReportIds}
                failedReportIds={failedReportIds}
                onRetry={handleRetry}
                branding={branding}
                analysisResults={analysisResults}
              />
            </Suspense>

            {/* Bottom actions */}
            {hasReports && !isLoading && (
              <div className="no-print flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => setViewingReports(false)} className="gap-2">
                  <ArrowLeftRight className="h-3.5 w-3.5 rotate-180" />
                  Back to Dashboard
                </Button>
                <button
                  onClick={() => handleSaveReports(true)}
                  disabled={savingReports}
                  className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
                    reportsSaved
                      ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3]"
                      : "bg-[#2006F7] text-white hover:bg-[#10037C]"
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  {reportsSaved ? "Reports Saved!" : savingReports ? "Saving…" : "Save Reports"}
                </button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={handleStartOver} className="text-muted-foreground hover:text-foreground text-xs">
                  Start Over
                </Button>
                {saveError && <span className="text-[10px] text-[#EA0022]">{saveError}</span>}
              </div>
            )}
          </>
        )}
      </main>

      {/* AI Chat — floating panel, available whenever files are loaded */}
      {hasFiles && (
        <Suspense fallback={null}>
          <AIChatPanel
            analysisResults={analysisResults}
            reports={reports}
            customerName={branding.customerName}
            environment={branding.environment}
          />
        </Suspense>
      )}

      {/* First-Time Setup Wizard */}
      <SetupWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        branding={branding}
        onBrandingChange={setBranding}
        orgName={org?.name}
      />

      {/* Management Drawer */}
      <ManagementDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isGuest={isGuest}
        orgName={org?.name}
        analysisResults={analysisResults}
        customerName={branding.customerName}
        environment={branding.environment}
        onLoadReports={handleLoadSavedReports}
        savedReportsTrigger={savedReportsTrigger}
        hasFiles={hasFiles}
        onRerunSetup={() => { resetSetupFlag(); setDrawerOpen(false); setWizardOpen(true); }}
      />

      {/* Keyboard shortcut hint */}
      <div className="fixed bottom-4 right-4 z-10 no-print">
        <button
          onClick={() => setShortcutsOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card/80 backdrop-blur-sm text-[10px] text-muted-foreground hover:text-foreground hover:border-[#2006F7]/30 transition-colors shadow-sm"
          title="Keyboard shortcuts (?)"
        >
          <kbd className="inline-flex items-center justify-center w-4 h-4 rounded border border-border bg-muted text-[9px] font-mono font-bold">?</kbd>
          Shortcuts
        </button>
      </div>

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

const Index = () => {
  const auth = useAuthProvider();
  const [guestMode, setGuestMode] = useState(false);

  if (auth.isLoading) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <span className="animate-spin h-6 w-6 border-2 border-[#2006F7]/30 border-t-[#2006F7] rounded-full" />
        </div>
      </AuthProvider>
    );
  }

  if (auth.isGuest && !guestMode) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background">
          <header className="border-b border-[#10037C]/20 bg-[#001A47]">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
              <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              <div className="flex-1">
                <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">Sophos FireComply</h1>
                <p className="text-[11px] text-[#6A889B]">Firewall Configuration Assessment & Compliance Reporting</p>
              </div>
            </div>
          </header>
          <AuthGate onSignIn={auth.signIn} onSignUp={auth.signUp} onSkip={() => setGuestMode(true)} />
        </div>
      </AuthProvider>
    );
  }

  if (auth.needsOrg) {
    return (
      <AuthProvider value={auth}>
        <div className="min-h-screen bg-background">
          <header className="border-b border-[#10037C]/20 bg-[#001A47]">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
              <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
              <div className="flex-1">
                <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">Sophos FireComply</h1>
                <p className="text-[11px] text-[#6A889B]">Firewall Configuration Assessment & Compliance Reporting</p>
              </div>
            </div>
          </header>
          <OrgSetup userEmail={auth.user?.email ?? ""} onCreateOrg={auth.createOrg} onSignOut={auth.signOut} />
        </div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider value={auth}>
      <InnerApp />
    </AuthProvider>
  );
};

export default Index;

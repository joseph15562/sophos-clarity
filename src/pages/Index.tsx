import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeftRight, RotateCcw, Save, BarChart3, Scale, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadedFile } from "@/components/FileUpload";
import { BrandingData } from "@/components/BrandingSetup";
import { AppHeader } from "@/components/AppHeader";
import { UploadSection } from "@/components/UploadSection";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { resolveCustomerName } from "@/lib/customer-name";

import { AuthFlow } from "@/components/AuthFlow";
import {
  extractSections,
  extractSectionsWithMeta,
  buildMetaFromSections,
  type ExtractedSections,
  type ExtractionMeta,
} from "@/lib/extract-sections";
import { rawConfigToSections } from "@/lib/raw-config-to-sections";
import { parseEntitiesXml } from "@/lib/parse-entities-xml";
import { useReportGeneration, ParsedFile } from "@/hooks/use-report-generation";
import { useFirewallAnalysis } from "@/hooks/use-firewall-analysis";
import type { AnalysisResult } from "@/lib/analyse-config";
import { useAutoSave, loadSession, clearSession } from "@/hooks/use-session-persistence";
import { useAuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getCentralStatus,
  getCachedFirewalls,
  getAlerts,
  getFirewallLicences,
} from "@/lib/sophos-central";
import type { CentralEnrichment as CentralEnrichmentType } from "@/lib/stream-ai";
import { fetchParseConfigDebug } from "@/lib/stream-ai";
import {
  saveReportCloud,
  saveReportLocal,
  type SavedReportEntry,
  type AnalysisSummary,
} from "@/lib/saved-reports";
import { saveAssessmentCloud } from "@/lib/assessment-cloud";
import { saveAssessment as saveAssessmentLocal } from "@/lib/assessment-history";
import type { LoadSavedReportArgs } from "@/components/SavedReportsLibrary";
import { logAudit } from "@/lib/audit";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationCentre } from "@/components/NotificationCentre";
import { useKeyboardShortcuts, type ShortcutAction } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcuts";
import { ManagementDrawer } from "@/components/ManagementDrawer";
import { GuidedTourButton } from "@/components/GuidedTourButton";
import type { TourCallbacks } from "@/lib/guided-tours";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SetupWizard, isSetupComplete, resetSetupFlag } from "@/components/SetupWizard";
import { toast } from "sonner";
import { isLocalMode, setLocalMode } from "@/lib/local-mode";
import {
  readManagePanelParams,
  stripManagePanelParams,
  settingsSectionExpandAllowed,
} from "@/lib/workspace-deeplink";
import { CentralHealthBanner } from "@/components/CentralHealthBanner";
import { MspAttentionSurface } from "@/components/MspAttentionSurface";
import { MspSetupChecklist } from "@/components/MspSetupChecklist";
import { getDemoConfigHtml, DEMO_FILE_NAME, DEMO_LABEL } from "@/lib/demo-mode";
import { trackProductEvent } from "@/lib/product-telemetry";

const DocumentPreview = lazy(() =>
  import("@/components/DocumentPreview").then((m) => ({ default: m.DocumentPreview })),
);
const ConfigDiff = lazy(() =>
  import("@/components/ConfigDiff").then((m) => ({ default: m.ConfigDiff })),
);
const AIChatPanel = lazy(() =>
  import("@/components/AIChatPanel").then((m) => ({ default: m.AIChatPanel })),
);
import { computeRiskScore, type RiskScoreResult } from "@/lib/risk-score";
import { saveFindingSnapshot } from "@/lib/finding-snapshots";
import { saveScoreSnapshot, loadScoreHistoryForFleet } from "@/lib/score-history";
import { saveConfigSnapshot, hashConfig } from "@/lib/config-snapshots";
import { checkMilestones } from "@/lib/milestone-toasts";
import { downloadRiskRegisterCSV } from "@/lib/risk-register";
import { downloadInteractiveHtml } from "@/lib/analysis-interactive-html";
import { ProgressNarrative } from "@/components/ProgressNarrative";
import { QbrPackChecklist } from "@/components/QbrPackChecklist";
import { ExtractionSummary } from "@/components/ExtractionSummary";
import { StickyActionBar } from "@/components/StickyActionBar";

type DiffSelection = { beforeIdx: number; afterIdx: number } | null;

/** Scroll to top in a way that works in Chrome (double rAF + both window and document scroll). */
function scrollPageToTop() {
  const run = () => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
  setTimeout(run, 50);
}

function InnerApp({ onShowAuth }: { onShowAuth?: () => void }) {
  const { isGuest, org, isViewerOnly, canManageTeam } = useAuth();
  const {
    notifications,
    unreadCount,
    addNotification,
    markRead,
    markAllRead,
    dismiss: dismissNotif,
    clearAll: clearNotifs,
  } = useNotifications();
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [branding, setBranding] = useState<BrandingData>({
    companyName: "",
    logoUrl: null,
    customerName: "",
    environment: "",
    country: "",
    selectedFrameworks: [],
    webFilterComplianceMode: "strict",
    webFilterExemptRuleNames: [],
  });
  const [diffSelection, setDiffSelection] = useState<DiffSelection>(null);
  const [restoredSession, setRestoredSession] = useState(false);
  const [savingReports, setSavingReports] = useState(false);
  const [reportsSaved, setReportsSaved] = useState(false);
  const [savedReportsTrigger, setSavedReportsTrigger] = useState(0);
  const [viewingReports, setViewingReports] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<string | undefined>(undefined);
  const [drawerSection, setDrawerSection] = useState<string | undefined>(undefined);
  const [localMode, setLocalModeState] = useState(() => isLocalMode());
  const [saveError, setSaveError] = useState("");
  const [loadedSavedSummary, setLoadedSavedSummary] = useState<{
    customerName: string;
    summary: AnalysisSummary;
  } | null>(null);
  const [centralEnriched, setCentralEnriched] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(() => !isGuest && !!org && !isSetupComplete());
  const [analysisTab, setAnalysisTab] = useState("overview");
  const [projectedScore, setProjectedScore] = useState<RiskScoreResult | null>(null);
  const [trendSnapshot, setTrendSnapshot] = useState<{
    score: number;
    grade: string;
    date: string;
  } | null>(null);
  const [analysisOverride, setAnalysisOverride] = useState<Record<string, AnalysisResult> | null>(
    null,
  );
  const prevResultCountRef = useRef(0);
  const findingsRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const reportsRef = useRef<HTMLDivElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const qbrRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatInitialMessage, setAiChatInitialMessage] = useState<string | undefined>(undefined);
  const [parsingProgress, setParsingProgress] = useState<{
    current: number;
    total: number;
    phase: string;
  } | null>(null);
  const [activeTenantName, setActiveTenantName] = useState<string | undefined>(undefined);
  const [backendDebugInfo, setBackendDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [dpiExemptZones, setDpiExemptZones] = useState<string[]>([]);
  const [dpiExemptNetworks, setDpiExemptNetworks] = useState<string[]>([]);
  const [reportAttributionHydrated, setReportAttributionHydrated] = useState(false);

  const firewallAnalysisOpts = useMemo(
    () => ({
      dpiExemptZones,
      dpiExemptNetworks,
      webFilterComplianceMode: branding.webFilterComplianceMode,
      webFilterExemptRuleNames: branding.webFilterExemptRuleNames,
    }),
    [
      dpiExemptZones,
      dpiExemptNetworks,
      branding.webFilterComplianceMode,
      branding.webFilterExemptRuleNames,
    ],
  );

  const {
    analysisResults: rawAnalysisResults,
    totalFindings: rawTotalFindings,
    totalRules: rawTotalRules,
    totalSections: rawTotalSections,
    totalPopulated: rawTotalPopulated,
    extractionPct: rawExtractionPct,
    aggregatedPosture: rawAggregatedPosture,
  } = useFirewallAnalysis(files, firewallAnalysisOpts);

  const analysisResults = analysisOverride ?? rawAnalysisResults;

  const {
    reports,
    setReports,
    activeReportId,
    setActiveReportId,
    isLoading,
    loadingReportIds,
    failedReportIds,
    generateIndividual,
    generateExecutive,
    generateExecutiveOnePager,
    generateCompliance,
    generateAll,
    handleRetry,
  } = useReportGeneration(files, branding, analysisResults);

  useEffect(() => {
    const raw = searchParams.get("reportTemplate")?.trim().toLowerCase();
    if (!raw) return;

    const allowed = new Set(["board-summary", "technical", "compliance", "qbr", "insurance"]);
    if (!allowed.has(raw)) {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.delete("reportTemplate");
          return next;
        },
        { replace: true },
      );
      return;
    }

    if (files.length < 1) {
      reportsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast.info(
        "Upload or select a firewall configuration first. Keep this page open — the template will run when a config is ready.",
      );
      return;
    }

    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete("reportTemplate");
        return next;
      },
      { replace: true },
    );

    if (isGuest || isViewerOnly) {
      toast.warning("Sign in with edit access to generate reports.");
      return;
    }

    const aiTemplates = new Set(["board-summary", "technical", "compliance"]);
    if (localMode && aiTemplates.has(raw)) {
      reportsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      toast.warning(
        "AI templates need online mode. Use Generate Executive One-Pager or disable Local mode.",
      );
      return;
    }

    switch (raw) {
      case "board-summary":
        setViewingReports(true);
        generateExecutive();
        toast.success("Generating Executive Brief (Board Summary)…");
        break;
      case "technical":
        setViewingReports(true);
        generateIndividual();
        toast.success("Generating technical reports…");
        break;
      case "compliance":
        setViewingReports(true);
        generateCompliance();
        toast.success("Generating compliance report…");
        break;
      case "qbr":
        setViewingReports(false);
        window.setTimeout(
          () => qbrRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          100,
        );
        toast.info("QBR Pack: use the checklist and generate Executive + Compliance as needed.");
        break;
      case "insurance":
        setViewingReports(false);
        setAnalysisTab("insurance-readiness");
        window.setTimeout(
          () => findingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          100,
        );
        toast.info(
          "Open the Insurance Readiness tab below for questionnaire-style posture signals.",
        );
        break;
      default:
        break;
    }
  }, [
    searchParams,
    setSearchParams,
    files.length,
    isGuest,
    isViewerOnly,
    localMode,
    generateExecutive,
    generateIndividual,
    generateCompliance,
  ]);

  /** Pending deep-link from Customer Management (must not share an effect with setSearchParams — stripping params re-runs the effect and clearTimeout cancels the scroll). */
  const [customerDeepLink, setCustomerDeepLink] = useState<{
    customer?: string;
    openUpload: boolean;
  } | null>(null);

  useEffect(() => {
    const customer = searchParams.get("customer")?.trim();
    const openUpload = searchParams.get("openUpload") === "1";
    if (!customer && !openUpload) return;

    if (customer) {
      setBranding((prev) =>
        prev.customerName === customer ? prev : { ...prev, customerName: customer },
      );
    }

    const next = new URLSearchParams(searchParams);
    next.delete("customer");
    next.delete("openUpload");
    if (searchParams.has("customer") || searchParams.has("openUpload")) {
      setSearchParams(next, { replace: true });
    }

    setCustomerDeepLink({
      customer: customer || undefined,
      openUpload,
    });
  }, [searchParams, setSearchParams]);

  /** Deep-link: /?panel=dashboard|reports|history|settings&section=… (settings only) — opens management drawer then strips params. */
  useEffect(() => {
    const parsed = readManagePanelParams(searchParams);
    if (!parsed) return;

    const sec = parsed.section;
    const blocked =
      parsed.panel === "settings" &&
      !!sec &&
      !settingsSectionExpandAllowed(sec, { canManageTeam, isViewerOnly, localMode });
    if (blocked) {
      toast.warning("Ask an org admin to open this workspace settings section.");
      setDrawerOpen(true);
      setDrawerTab("settings");
      setDrawerSection(undefined);
    } else {
      setDrawerOpen(true);
      setDrawerTab(parsed.panel);
      setDrawerSection(parsed.section);
    }

    const next = stripManagePanelParams(searchParams);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, isViewerOnly, canManageTeam, localMode]);

  /** Load Prepared By / footer from org `report_template`. */
  useEffect(() => {
    if (!org?.id || isGuest) {
      setReportAttributionHydrated(false);
      return;
    }
    setReportAttributionHydrated(false);
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("organisations")
          .select("report_template")
          .eq("id", org.id)
          .single();
        if (cancelled) return;
        const rt = (data as { report_template?: Record<string, unknown> } | null)?.report_template;
        if (rt && typeof rt === "object") {
          const pb = rt.prepared_by;
          const ft = rt.report_footer_text;
          setBranding((prev) => ({
            ...prev,
            preparedBy: typeof pb === "string" ? pb : prev.preparedBy,
            footerText: typeof ft === "string" ? ft : prev.footerText,
          }));
        }
      } catch {
        /* keep branding */
      } finally {
        if (!cancelled) setReportAttributionHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id, isGuest]);

  /** Debounced persist of attribution fields (merge into report_template). */
  useEffect(() => {
    if (!org?.id || isGuest || !canManageTeam || !reportAttributionHydrated) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const { data } = await supabase
            .from("organisations")
            .select("report_template")
            .eq("id", org.id)
            .single();
          const existing = ((data as { report_template?: Record<string, unknown> } | null)
            ?.report_template ?? {}) as Record<string, unknown>;
          const updated = {
            ...existing,
            prepared_by: branding.preparedBy?.trim() ?? "",
            report_footer_text: branding.footerText?.trim() ?? "",
          };
          await supabase
            .from("organisations")
            .update({ report_template: updated })
            .eq("id", org.id);
        } catch (err) {
          console.warn("[Index] report attribution save", err);
        }
      })();
    }, 900);
    return () => window.clearTimeout(t);
  }, [
    branding.preparedBy,
    branding.footerText,
    org?.id,
    isGuest,
    canManageTeam,
    reportAttributionHydrated,
  ]);

  useEffect(() => {
    if (!customerDeepLink) return;

    const { customer, openUpload } = customerDeepLink;
    if (!isGuest && org && isSetupComplete()) {
      setWizardOpen(false);
    }

    const runScrollAndToast = () => {
      const hasConfigs = files.length >= 1;
      if (openUpload) {
        if (hasConfigs) {
          contextRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        toast.info(
          customer
            ? `Customer set to ${customer}. ${hasConfigs ? "Review assessment context below." : "Upload a config or use Connected Firewalls — then you can generate reports."} To email a secure entities.xml upload link, open SE Health Check from the app menu.`
            : "Upload or sync configs below. To email a secure upload link to a customer, open SE Health Check from the app menu.",
        );
      } else if (customer) {
        if (hasConfigs) {
          reportsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          toast.success(`Working as ${customer} — Generate Reports is below.`);
        } else {
          workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          toast.success(
            `Working as ${customer}. Upload a firewall export or load from Connected Firewalls — then scroll to Generate Reports.`,
          );
        }
      }
      setCustomerDeepLink(null);
    };

    const t = window.setTimeout(runScrollAndToast, 150);
    return () => window.clearTimeout(t);
  }, [customerDeepLink, files.length, isGuest, org]);

  const totalFindings = analysisOverride
    ? Object.values(analysisOverride).reduce((s, r) => s + r.findings.length, 0)
    : rawTotalFindings;
  const totalRules = analysisOverride
    ? Object.values(analysisOverride).reduce((s, r) => s + r.stats.totalRules, 0)
    : rawTotalRules;
  const totalSections = analysisOverride
    ? Object.values(analysisOverride).reduce((s, r) => s + r.stats.totalSections, 0)
    : rawTotalSections;
  const totalPopulated = analysisOverride
    ? Object.values(analysisOverride).reduce((s, r) => s + r.stats.populatedSections, 0)
    : rawTotalPopulated;
  const extractionPct =
    totalSections > 0 ? Math.round((totalPopulated / totalSections) * 100) : rawExtractionPct;
  const aggregatedPosture = rawAggregatedPosture;

  const configMetas = useMemo(
    () =>
      files.map((f) => {
        const result = analysisResults[f.label || f.fileName.replace(/\.(html|htm)$/i, "")];
        return {
          label: f.label || f.fileName.replace(/\.(html|htm)$/i, ""),
          hostname: result?.hostname || f.agentHostname,
          serialNumber: f.serialNumber,
          configHash: f.id,
          fromUpload: f.source === "upload",
        };
      }),
    [files, analysisResults],
  );

  const securityStats = useMemo(() => {
    if (Object.keys(analysisResults).length === 0) return null;
    const scores = Object.values(analysisResults).map((r) => computeRiskScore(r));
    const avgScore = Math.round(scores.reduce((s, r) => s + r.overall, 0) / scores.length);
    const grade: "A" | "B" | "C" | "D" | "F" =
      avgScore >= 90
        ? "A"
        : avgScore >= 75
          ? "B"
          : avgScore >= 60
            ? "C"
            : avgScore >= 40
              ? "D"
              : "F";
    const criticalHigh = Object.values(analysisResults).reduce(
      (sum, r) =>
        sum + r.findings.filter((f) => f.severity === "critical" || f.severity === "high").length,
      0,
    );
    const ip = aggregatedPosture;
    const wfPct = ip.webFilterableRules > 0 ? (ip.withWebFilter / ip.webFilterableRules) * 100 : 0;
    const ipsPct = ip.enabledWanRules > 0 ? (ip.withIps / ip.enabledWanRules) * 100 : 0;
    const appPct = ip.enabledWanRules > 0 ? (ip.withAppControl / ip.enabledWanRules) * 100 : 0;
    const coverage = Math.round((wfPct + ipsPct + appPct) / 3);
    return { score: avgScore, grade, criticalHigh, coverage, totalRules };
  }, [analysisResults, aggregatedPosture, totalRules]);

  useAutoSave(branding, reports, activeReportId, !isGuest);

  // Save finding snapshots when analysis completes (for regression detection)
  useEffect(() => {
    if (Object.keys(analysisResults).length === 0) return;
    for (const [label, result] of Object.entries(analysisResults)) {
      const hostname = result.hostname || label;
      const score = computeRiskScore(result).overall;
      saveFindingSnapshot(hostname, result.findings, score);
    }
  }, [analysisResults]);

  // Save score history when analysis completes (authenticated only, for trend dashboard)
  useEffect(() => {
    if (Object.keys(analysisResults).length === 0 || isGuest || !org?.id) return;
    for (const [label, result] of Object.entries(analysisResults)) {
      const hostname = result.hostname || label;
      const risk = computeRiskScore(result);
      saveScoreSnapshot(
        org.id,
        hostname,
        branding.customerName || "",
        risk.overall,
        risk.grade,
        risk.categories.map((c) => ({ label: c.label, score: c.pct })),
        result.findings.length,
      );
    }

    const entries = Object.entries(analysisResults);
    if (entries.length > 0) {
      const firstRisk = computeRiskScore(entries[0][1]);
      loadScoreHistoryForFleet(org.id, 100)
        .then((history) => {
          checkMilestones(firstRisk.overall, firstRisk.grade, history.length);
        })
        .catch(() => {});
    }
  }, [analysisResults, isGuest, org?.id, branding.customerName]);

  // Save config snapshots for version control (localStorage)
  useEffect(() => {
    if (Object.keys(analysisResults).length === 0) return;
    for (const [label, result] of Object.entries(analysisResults)) {
      const hostname = result.hostname || label;
      const file = files.find(
        (f) => (f.label || f.fileName.replace(/\.(html|htm)$/i, "")) === label,
      );
      const sections = file?.extractedData ?? {};
      const sectionKeys = Object.keys(sections);
      saveConfigSnapshot({
        hostname,
        customer_name: branding.customerName || "",
        section_keys: sectionKeys,
        section_count: result.stats.totalSections,
        rule_count: result.stats.totalRules,
        findings_count: result.findings.length,
        overall_score: computeRiskScore(result).overall,
        snapshot_hash: hashConfig(sections as Record<string, unknown>),
      });
    }
  }, [analysisResults, files, branding.customerName]);

  // Scroll to top when analysis results first appear (HTML upload or agent load)
  useEffect(() => {
    const count = Object.keys(analysisResults).length;
    if (count > 0 && prevResultCountRef.current === 0) {
      scrollPageToTop();
    }
    prevResultCountRef.current = count;
  }, [analysisResults]);

  // Restore session on mount (authenticated users only — guests get a clean slate).
  // Restores reports + branding but stays on the dashboard so the user can
  // click "View Reports" when ready.
  useEffect(() => {
    if (isGuest) return;
    const session = loadSession();
    if (session && session.reports.length > 0) {
      setBranding(session.branding);
      setReports(session.reports);
      setActiveReportId(session.activeReportId);
      setRestoredSession(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilesChange = useCallback(
    async (uploaded: UploadedFile[]) => {
      const existingParsed: ParsedFile[] = [];
      const toProcess: UploadedFile[] = [];
      for (const f of uploaded) {
        const existing = files.find((pf) => pf.id === f.id);
        if (existing) existingParsed.push({ ...existing, label: f.label });
        else toProcess.push(f);
      }

      if (toProcess.length === 0) {
        setFiles(existingParsed);
        if (reports.length > 0) {
          setReports([]);
          setActiveReportId("");
        }
        setReportsSaved(false);
        return;
      }

      setParsingProgress({ current: 0, total: toProcess.length, phase: "parsing" });
      const parsed: ParsedFile[] = [];
      for (let i = 0; i < toProcess.length; i++) {
        setParsingProgress({ current: i + 1, total: toProcess.length, phase: "parsing" });
        await new Promise((r) => setTimeout(r, 0));
        const file = toProcess[i];
        const isXml =
          file.fileName.endsWith(".xml") || file.content.trimStart().startsWith("<?xml");
        let extractedData: ExtractedSections;
        let extractionMeta: ExtractionMeta | undefined;
        try {
          if (isXml) {
            const rawConfig = parseEntitiesXml(file.content);
            extractedData = rawConfigToSections(rawConfig);
            extractionMeta = buildMetaFromSections(extractedData);
          } else {
            const result = await extractSectionsWithMeta(file.content);
            extractedData = result.sections;
            extractionMeta = result.meta;
          }
        } catch (err) {
          console.warn(`[parser] Failed to parse ${file.fileName}`, err);
          toast.error(
            `Could not parse ${file.fileName} — it may not be a valid Sophos config export`,
          );
          extractedData = {} as ExtractedSections;
        }
        parsed.push({ ...file, extractedData, extractionMeta, source: "upload" });
      }
      setParsingProgress({
        current: toProcess.length,
        total: toProcess.length,
        phase: "analysing",
      });
      await new Promise((r) => setTimeout(r, 0));
      const allParsed = [...existingParsed, ...parsed];
      setFiles(allParsed);
      setParsingProgress(null);
      if (reports.length > 0) {
        setReports([]);
        setActiveReportId("");
      }
      setReportsSaved(false);
      if (org?.id) {
        logAudit(org.id, "config.uploaded", "config", "", { count: toProcess.length });
      }
    },
    [files, reports.length, setReports, setActiveReportId, org?.id],
  );

  const handleLoadAgentAssessment = useCallback(
    (
      label: string,
      analysis: AnalysisResult,
      customerName: string,
      rawConfig?: Record<string, unknown>,
      agentMeta?: { serialNumber?: string; hostname?: string; model?: string; tenantName?: string },
    ) => {
      const extractedData = rawConfig ? rawConfigToSections(rawConfig) : ({} as ExtractedSections);
      const hasRealSections = Object.keys(extractedData).length > 0;
      const subLabel =
        [agentMeta?.model, agentMeta?.serialNumber].filter(Boolean).join(" · ") || label;
      const newFile = {
        id: label,
        fileName: subLabel,
        label,
        content: "",
        extractedData,
        extractionMeta: hasRealSections ? buildMetaFromSections(extractedData) : undefined,
        serialNumber: agentMeta?.serialNumber,
        agentHostname: agentMeta?.hostname,
        hardwareModel: agentMeta?.model,
        source: "agent" as const,
      };
      setFiles((prev) => {
        if (prev.some((f) => f.id === label)) return prev;
        return [...prev, newFile];
      });
      setAnalysisOverride((prev) => {
        if (!hasRealSections) return { ...(prev ?? {}), [label]: analysis };
        if (prev) {
          const next = { ...prev };
          delete next[label];
          return Object.keys(next).length > 0 ? next : null;
        }
        return null;
      });
      const autoCustomer = agentMeta?.tenantName || customerName;
      if (autoCustomer) {
        setBranding((prev) => (prev.customerName ? prev : { ...prev, customerName: autoCustomer }));
      }
      if (agentMeta?.tenantName) setActiveTenantName(agentMeta.tenantName);
      setReports([]);
      setActiveReportId("");
      setReportsSaved(false);
      setLoadedSavedSummary(null);
      scrollPageToTop();
    },
    [setReports, setActiveReportId],
  );

  const handleLoadDemo = useCallback(() => {
    const html = getDemoConfigHtml();
    const demoFile: UploadedFile = {
      id: "demo",
      fileName: DEMO_FILE_NAME,
      label: DEMO_LABEL,
      content: html,
    };
    handleFilesChange([demoFile]);
    toast.info("Demo config loaded — this is synthetic data, not a real customer.");
  }, [handleFilesChange]);

  // Clear analysis override when user uploads new files normally
  useEffect(() => {
    if (analysisOverride && Object.keys(rawAnalysisResults).length > 0) {
      const overrideKeys = Object.keys(analysisOverride);
      const rawKeys = Object.keys(rawAnalysisResults);
      if (rawKeys.some((k) => !overrideKeys.includes(k))) {
        setAnalysisOverride(null);
      }
    }
  }, [rawAnalysisResults, analysisOverride]);

  // Enrich files with Sophos Central live data when firewalls are linked
  const fileIds = useMemo(() => files.map((f) => f.id).join(","), [files]);

  useEffect(() => {
    setCentralEnriched(false);
  }, [fileIds]);

  useEffect(() => {
    if (!org?.id || isGuest || files.length === 0 || centralEnriched || localMode) return;
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
          try {
            alertsByTenant[tid] = await getAlerts(orgId, tid);
          } catch (err) {
            console.warn("[enrichFromCentral] getAlerts", err);
            alertsByTenant[tid] = [];
          }
        }

        // Fetch per-firewall licence data
        const fwLicenceMap: Record<
          string,
          Array<{ product: string; endDate: string; type: string }>
        > = {};
        try {
          const fwLicences = await getFirewallLicences(orgId);
          for (const fwl of fwLicences) {
            fwLicenceMap[fwl.serialNumber] = fwl.licenses.map((l) => ({
              product: l.product?.name || l.product?.code || l.type,
              endDate: l.endDate ?? (l.perpetual ? "Perpetual" : ""),
              type: l.type,
            }));
          }
        } catch (err) {
          console.warn("[enrichFromCentral] licensing API may not be available", err);
        }

        if (cancelled) return;

        const enrichments: Record<string, CentralEnrichmentType> = {};
        for (const link of links) {
          const fw = cachedFws.find((f) => f.firewallId === link.central_firewall_id);
          if (!fw) continue;
          const fwAlerts = (alertsByTenant[link.central_tenant_id] ?? []).filter(
            (a) => a.managedAgent?.id === link.central_firewall_id,
          );

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
          prev.map((f) => (enrichments[f.id] ? { ...f, centralEnrichment: enrichments[f.id] } : f)),
        );
        setCentralEnriched(true);
      } catch (err) {
        console.warn("[enrichFromCentral]", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [org?.id, isGuest, files.length, centralEnriched, localMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveReports = useCallback(
    async (includeReports: boolean) => {
      if (Object.keys(analysisResults).length === 0) return;
      setSavingReports(true);
      setSaveError("");
      try {
        const reportEntries: SavedReportEntry[] = includeReports
          ? reports
              .filter((r) => (r.markdown?.trim().length ?? 0) > 0)
              .map((r) => ({ id: r.id, label: r.label, markdown: r.markdown }))
          : [];
        let result: unknown;
        if (!isGuest && org) {
          result = await saveReportCloud(
            org.id,
            branding.customerName,
            branding.environment,
            reportEntries,
            analysisResults,
          );
          // Also save an assessment snapshot so the Multi-Tenant Dashboard populates
          try {
            await saveAssessmentCloud(
              analysisResults,
              branding.customerName,
              branding.environment,
              org.id,
            );
            trackProductEvent("assessment_saved_cloud", { orgId: org.id });
          } catch (err) {
            console.warn("[handleSaveReports] saveAssessmentCloud", err);
            toast.error("Couldn't save assessment to cloud — saved locally as backup");
          }
        } else {
          result = await saveReportLocal(
            branding.customerName,
            branding.environment,
            reportEntries,
            analysisResults,
          );
          try {
            await saveAssessmentLocal(analysisResults, branding.customerName, branding.environment);
          } catch (err) {
            console.warn("[handleSaveReports] saveAssessmentLocal", err);
          }
        }
        if (!result) {
          setSaveError(
            "Save failed — have you run the 003_saved_reports.sql migration in Supabase?",
          );
        } else {
          if (!isGuest && org && includeReports) {
            trackProductEvent("report_saved_cloud", { orgId: org.id });
          }
          setReportsSaved(true);
          setSavedReportsTrigger((n) => n + 1);
          setTimeout(() => setReportsSaved(false), 3000);
          if (org?.id) {
            logAudit(
              org.id,
              includeReports ? "report.saved" : "assessment.saved",
              "report",
              branding.customerName,
              { reportCount: reportEntries.length },
            );
          }
          addNotification(
            "success",
            includeReports ? "Reports Saved" : "Assessment Saved",
            `${branding.customerName || "Assessment"} saved successfully with ${reportEntries.length} report${reportEntries.length !== 1 ? "s" : ""}.`,
          );

          // IDs are report-executive / report-compliance (not "executive…" / "compliance…")
          const hasCompliance = reportEntries.some((r) => r.id === "report-compliance");
          const hasExecutive = reportEntries.some(
            (r) => r.id === "report-executive" || r.id === "report-executive-one-pager",
          );
          if (!hasCompliance || !hasExecutive) {
            const suggestions: string[] = [];
            if (!hasExecutive && files.length >= 2) suggestions.push("Executive Brief");
            if (!hasCompliance) suggestions.push("Compliance Report");
            if (suggestions.length > 0) {
              toast("More reports available", {
                description: `Generate a ${suggestions.join(" or ")} to complete your pack.`,
                duration: 6000,
                action: {
                  label: "Generate All",
                  onClick: () => {
                    setViewingReports(true);
                    generateAll();
                  },
                },
              });
            }
          }
        }
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Save failed");
      }
      setSavingReports(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      analysisResults,
      reports,
      isGuest,
      org,
      branding.customerName,
      branding.environment,
      files.length,
      generateAll,
    ],
  );

  const handleLoadSavedReports = useCallback(
    (args: LoadSavedReportArgs) => {
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
      scrollPageToTop();
    },
    [setReports, setActiveReportId],
  );

  const handleStartOver = useCallback(() => {
    setReports([]);
    setActiveReportId("");
    setFiles([]);
    setRestoredSession(false);
    setViewingReports(false);
    clearSession();
  }, [setReports, setActiveReportId]);

  const handleLocalModeChange = useCallback((enabled: boolean) => {
    setLocalMode(enabled);
    setLocalModeState(enabled);
  }, []);

  const fetchBackendDebug = useCallback(async () => {
    if (files.length === 0) return;
    const label = (f: ParsedFile) => f.label || f.fileName.replace(/\.(html|htm)$/i, "");
    if (activeReportId === "report-executive" && files.length >= 2) {
      const mergedSections: Record<string, ExtractedSections> = {};
      const labels = files.map((f) => {
        const l = label(f);
        mergedSections[l] = f.extractedData;
        return l;
      });
      const info = await fetchParseConfigDebug({
        sections: mergedSections as unknown as ExtractedSections,
        executive: true,
        firewallLabels: labels,
        environment: branding.environment || undefined,
        country: branding.country || undefined,
        customerName: branding.customerName || undefined,
        selectedFrameworks:
          branding.selectedFrameworks.length > 0 ? branding.selectedFrameworks : undefined,
      });
      setBackendDebugInfo(info);
      return;
    }
    if (activeReportId === "report-compliance") {
      const labels = files.map((f) => label(f));
      const mergedSections: Record<string, ExtractedSections> = {};
      files.forEach((f) => {
        mergedSections[label(f)] = f.extractedData;
      });
      const info = await fetchParseConfigDebug({
        sections:
          files.length === 1
            ? files[0].extractedData
            : (mergedSections as unknown as ExtractedSections),
        compliance: true,
        firewallLabels: labels,
        environment: branding.environment || undefined,
        country: branding.country || undefined,
        customerName: branding.customerName || undefined,
        selectedFrameworks:
          branding.selectedFrameworks.length > 0 ? branding.selectedFrameworks : undefined,
      });
      setBackendDebugInfo(info);
      return;
    }
    const file = files.find((f) => `report-${f.id}` === activeReportId) ?? files[0];
    const info = await fetchParseConfigDebug({
      sections: file.extractedData,
      firewallLabels: [label(file)],
      centralEnrichment: file.centralEnrichment,
      environment: branding.environment || undefined,
      country: branding.country || undefined,
      customerName: branding.customerName || undefined,
      selectedFrameworks:
        branding.selectedFrameworks.length > 0 ? branding.selectedFrameworks : undefined,
    });
    setBackendDebugInfo(info);
  }, [activeReportId, files, branding]);

  const extractionSummaryFiles = useMemo(
    () =>
      files
        .filter((f) => f.extractionMeta)
        .map((f) => ({
          fileName: f.label || f.fileName.replace(/\.(html|htm)$/i, ""),
          meta: f.extractionMeta!,
        })),
    [files],
  );

  const hasReports = reports.length > 0;
  const hasFiles = files.length > 0;
  const inDiffMode = diffSelection !== null;

  useEffect(() => {
    if (analysisTab === "remediation" && totalFindings === 0) setAnalysisTab("overview");
    if (analysisTab === "compare" && files.length < 2) setAnalysisTab("overview");
  }, [analysisTab, totalFindings, files.length]);

  const keyboardShortcuts = useMemo<ShortcutAction[]>(
    () => [
      {
        key: "?",
        shift: true,
        description: "Show keyboard shortcuts",
        handler: () => setShortcutsOpen((v) => !v),
      },
      {
        key: "Escape",
        description: "Go back / close modal",
        handler: () => {
          if (shortcutsOpen) {
            setShortcutsOpen(false);
            return;
          }
          if (drawerOpen) {
            setDrawerOpen(false);
            return;
          }
          if (viewingReports) setViewingReports(false);
          if (inDiffMode) setDiffSelection(null);
        },
      },
      {
        key: "s",
        ctrl: true,
        description: "Save reports",
        handler: () => {
          if (!isViewerOnly && hasReports) handleSaveReports(true);
          else if (!isViewerOnly && hasFiles && totalFindings > 0) handleSaveReports(false);
        },
      },
      {
        key: "g",
        ctrl: true,
        description: "Generate all reports",
        handler: () => {
          if (hasFiles && !isLoading && !localMode && !isViewerOnly) {
            setViewingReports(true);
            generateAll();
          }
        },
      },
      ...Array.from({ length: 9 }, (_, i) => ({
        key: String(i + 1),
        description: `Switch to report tab ${i + 1}`,
        handler: () => {
          if (viewingReports && reports[i]) setActiveReportId(reports[i].id);
        },
      })),
    ],
    [
      shortcutsOpen,
      drawerOpen,
      viewingReports,
      inDiffMode,
      hasReports,
      hasFiles,
      totalFindings,
      isLoading,
      reports,
      handleSaveReports,
      generateAll,
      setActiveReportId,
      localMode,
      isViewerOnly,
    ],
  );

  useKeyboardShortcuts(keyboardShortcuts);

  const tourCallbacks = useMemo<TourCallbacks>(
    () => ({
      openDrawer: () => setDrawerOpen(true),
      setDrawerTab: (tab: string) => setDrawerTab(tab),
      setAnalysisTab: (tab: string) => setAnalysisTab(tab),
    }),
    [],
  );

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
        localMode={localMode}
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

      <main
        id="main-content"
        className={`workspace-shell section-stack ${viewingReports ? "max-w-full" : "max-w-[1320px]"} ${hasFiles && (!viewingReports || isGuest) && !isLoading && !inDiffMode ? "pb-20" : ""}`}
      >
        {!isGuest && org?.id && (
          <>
            <CentralHealthBanner orgId={org.id} />
            {canManageTeam && <MspSetupChecklist orgId={org.id} canManage={canManageTeam} />}
            <MspAttentionSurface orgId={org.id} orgName={org.name ?? ""} />
          </>
        )}

        {/* Restored session banner */}
        {restoredSession && !viewingReports && hasReports && !isLoading && (
          <div className="no-print animate-in fade-in slide-in-from-top-2 duration-500 rounded-xl border border-brand-accent/30 bg-gradient-to-r from-brand-accent/10 via-brand-accent/[0.06] to-transparent dark:from-brand-accent/15 dark:via-brand-accent/[0.08] dark:to-transparent px-5 py-3 flex items-center gap-3 text-sm shadow-[0_0_20px_-4px] shadow-brand-accent/20 dark:shadow-brand-accent/25 backdrop-blur-sm">
            <div className="relative flex items-center justify-center">
              <div
                className="absolute h-7 w-7 rounded-full bg-brand-accent/15 animate-ping"
                style={{ animationDuration: "2.5s", animationIterationCount: "3" }}
              />
              <RotateCcw className="h-4.5 w-4.5 text-brand-accent shrink-0 relative" />
            </div>
            <span className="font-medium text-foreground">
              Previous session restored — {reports.length} report{reports.length !== 1 ? "s" : ""}{" "}
              recovered.
            </span>
            <span className="text-muted-foreground/80 text-xs tracking-wide">
              Reports are saved locally for 24 hours.
            </span>
          </div>
        )}

        {/* Loaded from saved Pre-AI assessment */}
        {loadedSavedSummary && (
          <div className="no-print rounded-xl border border-[#00F2B3]/20 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.04] dark:bg-[#00F2B3]/[0.04] px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#00F2B3]/10 dark:bg-[#00F2B3]/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-brand-accent" />
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
              <button
                onClick={() => setLoadedSavedSummary(null)}
                className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-muted/50 transition-colors"
              >
                Dismiss
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                  loadedSavedSummary.summary.overallScore >= 75
                    ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                    : loadedSavedSummary.summary.overallScore >= 50
                      ? "bg-[#F29400]/10 text-[#F29400]"
                      : "bg-[#EA0022]/10 text-[#EA0022]"
                }`}
              >
                Score: {loadedSavedSummary.summary.overallScore} (
                {loadedSavedSummary.summary.overallGrade})
              </span>
              <span className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
                {loadedSavedSummary.summary.totalFindings} findings
              </span>
              <span className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
                {loadedSavedSummary.summary.totalRules} rules
              </span>
              {loadedSavedSummary.summary.categories.map((c) => (
                <span
                  key={c.label}
                  className={`text-[10px] px-2 py-1 rounded-md ${
                    c.pct >= 80
                      ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                      : c.pct >= 50
                        ? "bg-[#F29400]/10 text-[#F29400]"
                        : "bg-[#EA0022]/10 text-[#EA0022]"
                  }`}
                >
                  {c.label}: {c.pct}%
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Upload the firewall config to run a full analysis, or generate AI reports from the
              live data.
            </p>
          </div>
        )}

        {/* Config Diff Mode */}
        {inDiffMode && (
          <Suspense
            fallback={
              <div className="text-center py-8 text-muted-foreground">Loading diff viewer…</div>
            }
          >
            <ConfigDiff
              beforeLabel={fileLabel(files[diffSelection.beforeIdx])}
              afterLabel={fileLabel(files[diffSelection.afterIdx])}
              beforeSections={files[diffSelection.beforeIdx].extractedData}
              afterSections={files[diffSelection.afterIdx].extractedData}
              beforeAnalysis={analysisResults[fileLabel(files[diffSelection.beforeIdx])]}
              afterAnalysis={analysisResults[fileLabel(files[diffSelection.afterIdx])]}
              onClose={() => setDiffSelection(null)}
            />
          </Suspense>
        )}

        {(!viewingReports || isGuest) && !isLoading && !inDiffMode && (
          <>
            <UploadSection
              files={files}
              onFilesChange={handleFilesChange}
              parsingProgress={parsingProgress}
              branding={branding}
              setBranding={setBranding}
              analysisResult={analysisResults}
              configMetas={configMetas}
              hasFiles={hasFiles}
              hasReports={hasReports}
              reports={reports}
              isGuest={isGuest}
              onShowAuth={onShowAuth}
              org={org}
              localMode={localMode}
              contextRef={contextRef}
              reportsRef={reportsRef}
              workbenchRef={workbenchRef}
              onGenerateIndividual={() => {
                setViewingReports(true);
                generateIndividual();
                if (org?.id) logAudit(org.id, "report.generated", "report", "individual");
              }}
              onGenerateExecutive={() => {
                setViewingReports(true);
                generateExecutive();
                if (org?.id) logAudit(org.id, "report.generated", "report", "executive");
              }}
              onGenerateExecutiveOnePager={() => {
                setViewingReports(true);
                generateExecutiveOnePager();
                if (org?.id) logAudit(org.id, "report.generated", "report", "executive-one-pager");
              }}
              onGenerateCompliance={() => {
                setViewingReports(true);
                generateCompliance();
                if (org?.id) logAudit(org.id, "report.generated", "report", "compliance");
              }}
              onGenerateAll={() => {
                setViewingReports(true);
                generateAll();
                if (org?.id) logAudit(org.id, "report.generated", "report", "all");
                addNotification(
                  "info",
                  "Generating Reports",
                  `Generating all reports for ${branding.customerName || "this assessment"}…`,
                );
              }}
              onOpenInsuranceReadiness={() => {
                setViewingReports(false);
                setAnalysisTab("insurance-readiness");
                window.setTimeout(
                  () => findingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  100,
                );
              }}
              setViewingReports={setViewingReports}
              onLoadAgentAssessment={handleLoadAgentAssessment}
              activeTenantName={activeTenantName}
              setCentralEnriched={setCentralEnriched}
              saveError={saveError}
              savingReports={savingReports}
              reportsSaved={reportsSaved}
              onSaveReports={handleSaveReports}
              totalFindings={totalFindings}
              isViewerOnly={isViewerOnly}
              beforeReports={
                extractionSummaryFiles.length > 0 ? (
                  <ExtractionSummary files={extractionSummaryFiles} />
                ) : undefined
              }
              onLoadDemo={handleLoadDemo}
            />
            {hasFiles && !isGuest && org?.id && (
              <div ref={qbrRef} className="grid gap-5 xl:grid-cols-2">
                <ProgressNarrative
                  orgId={org.id}
                  currentResults={analysisResults}
                  customerName={branding.customerName || "Customer"}
                />
                <QbrPackChecklist
                  fileCount={files.length}
                  hasReports={reports.some(
                    (r) => r.id === "report-executive" && (r.markdown?.trim().length ?? 0) > 0,
                  )}
                  hasCompliance={reports.some(
                    (r) => r.id === "report-compliance" && (r.markdown?.trim().length ?? 0) > 0,
                  )}
                  onGenerateExecutive={() => {
                    setViewingReports(true);
                    generateExecutive();
                    if (org?.id) logAudit(org.id, "report.generated", "report", "executive");
                  }}
                  onGenerateCompliance={() => {
                    setViewingReports(true);
                    generateCompliance();
                    if (org?.id) logAudit(org.id, "report.generated", "report", "compliance");
                  }}
                  onExportRiskRegister={() =>
                    downloadRiskRegisterCSV(analysisResults, branding.customerName)
                  }
                  onExportInteractiveHtml={() =>
                    downloadInteractiveHtml(analysisResults, {
                      customerName: branding.customerName,
                      mspName: branding.companyName,
                      logoUrl: branding.logoUrl ?? undefined,
                    })
                  }
                />
              </div>
            )}
            {hasFiles && (
              <div ref={findingsRef}>
                <AnalysisTabs
                  analysisResult={analysisResults}
                  files={files}
                  branding={branding}
                  activeTab={analysisTab}
                  setActiveTab={setAnalysisTab}
                  totalFindings={totalFindings}
                  totalRules={totalRules}
                  totalSections={totalSections}
                  totalPopulated={totalPopulated}
                  extractionPct={extractionPct}
                  aggregatedPosture={aggregatedPosture}
                  securityStats={securityStats}
                  configMetas={configMetas}
                  diffSelection={diffSelection}
                  setDiffSelection={setDiffSelection}
                  projectedScore={projectedScore}
                  setProjectedScore={setProjectedScore}
                  isGuest={isGuest}
                  localMode={localMode}
                  orgId={org?.id ?? ""}
                  onExplainFinding={(title) => {
                    setAiChatOpen(true);
                    setAiChatInitialMessage(
                      `Explain finding: ${title} and how to fix it on a Sophos XGS firewall`,
                    );
                  }}
                  hasReports={reports.some((r) => (r.markdown?.trim().length ?? 0) > 0)}
                  trendSnapshot={trendSnapshot}
                  firecomplyCustomerKey={
                    org?.name
                      ? resolveCustomerName(branding.customerName ?? "", org.name)
                      : undefined
                  }
                />
              </div>
            )}
          </>
        )}

        {/* Report view (authenticated only) */}
        {!isGuest && (viewingReports || isLoading) && (
          <>
            {/* Top bar: Back to Dashboard + actions */}
            {hasReports && !isLoading && (
              <div className="no-print flex flex-wrap items-center gap-3 mb-2">
                <Button
                  variant="outline"
                  onClick={() => setViewingReports(false)}
                  className="gap-2"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 rotate-180" />
                  Back to Dashboard
                </Button>
                <div className="flex-1" />
                {!localMode && !isViewerOnly && (
                  <div className="flex flex-wrap gap-2">
                    {files.length >= 2 && !reports.find((r) => r.id === "report-executive") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => generateExecutive()}
                        className="gap-1.5 text-xs"
                      >
                        <BarChart3 className="h-3.5 w-3.5 text-brand-accent" /> Add Executive Brief
                      </Button>
                    )}
                    {!reports.find((r) => r.id === "report-compliance") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateCompliance}
                        className="gap-1.5 text-xs"
                      >
                        <Scale className="h-3.5 w-3.5 text-brand-accent" /> Add Compliance Report
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stats bar */}
            {hasReports && !isLoading && (
              <div
                className="no-print flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-[11px]"
                data-tour="stats-bar"
              >
                <span className="font-semibold text-foreground mr-1">
                  {reports.length} report{reports.length !== 1 ? "s" : ""}
                </span>
                <span className="w-px h-3 bg-border" />
                <span className="text-muted-foreground">
                  {files.length} firewall{files.length !== 1 ? "s" : ""}
                </span>
                <span className="w-px h-3 bg-border" />
                <span className="text-muted-foreground">{totalRules} rules</span>
                {totalFindings > 0 && (
                  <>
                    <span className="w-px h-3 bg-border" />
                    {(() => {
                      const counts: Record<string, number> = {};
                      Object.values(analysisResults).forEach((r) =>
                        r.findings.forEach((f) => {
                          counts[f.severity] = (counts[f.severity] || 0) + 1;
                        }),
                      );
                      return Object.entries(counts).map(([sev, count]) => (
                        <span
                          key={sev}
                          className={`px-1.5 py-0.5 rounded font-medium ${sev === "critical" ? "bg-[#EA0022]/10 text-[#EA0022]" : sev === "high" ? "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]" : sev === "medium" ? "bg-[#F8E300]/10 text-[#b8a200] dark:text-[#F8E300]" : sev === "low" ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]" : "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]"}`}
                        >
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
                selectedFrameworks={branding.selectedFrameworks}
                backendDebugInfo={backendDebugInfo}
                onFetchBackendDebug={localMode ? undefined : fetchBackendDebug}
              />
            </Suspense>

            {/* Bottom actions */}
            {hasReports && !isLoading && (
              <div className="no-print flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setViewingReports(false)}
                  className="gap-2"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 rotate-180" />
                  Back to Dashboard
                </Button>
                {!isViewerOnly && (
                  <button
                    onClick={() => handleSaveReports(true)}
                    disabled={savingReports}
                    className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
                      reportsSaved
                        ? "bg-[#00F2B3]/10 text-[#00F2B3] dark:text-[#00F2B3]"
                        : "bg-[#2006F7] text-white hover:bg-[#10037C]"
                    }`}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {reportsSaved ? "Reports Saved!" : savingReports ? "Saving…" : "Save Reports"}
                  </button>
                )}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartOver}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Start Over
                </Button>
                {saveError && <span className="text-[10px] text-[#EA0022]">{saveError}</span>}
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky action bar — visible on dashboard when files are loaded */}
      {(!viewingReports || isGuest) && !isLoading && !inDiffMode && (
        <StickyActionBar
          hasFiles={hasFiles}
          branding={branding}
          onScrollToFindings={() => {
            if (findingsRef.current) {
              const y = findingsRef.current.getBoundingClientRect().top + window.scrollY - 70;
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }}
          onScrollToReports={() => {
            if (reportsRef.current) {
              const y = reportsRef.current.getBoundingClientRect().top + window.scrollY - 70;
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }}
          onScrollToContext={() => {
            if (contextRef.current) {
              const y = contextRef.current.getBoundingClientRect().top + window.scrollY - 70;
              window.scrollTo({ top: y, behavior: "smooth" });
            }
          }}
          onGenerateAll={() => {
            setViewingReports(true);
            generateAll();
            if (org?.id) logAudit(org.id, "report.generated", "report", "all");
            addNotification(
              "info",
              "Generating Reports",
              `Generating all reports for ${branding.customerName || "this assessment"}…`,
            );
          }}
          tourSlot={
            <GuidedTourButton
              hasFiles={hasFiles}
              hasReports={hasReports}
              isGuest={isGuest}
              tourCallbacks={tourCallbacks}
            />
          }
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />
      )}

      {/* AI Chat — floating panel, hidden in local mode */}
      {hasFiles && !localMode && (
        <ErrorBoundary fallbackTitle="AI Chat failed to load">
          <Suspense fallback={null}>
            <AIChatPanel
              analysisResults={analysisResults}
              reports={reports}
              customerName={branding.customerName}
              environment={branding.environment}
              analysisTab={analysisTab}
              open={aiChatOpen}
              onOpenChange={setAiChatOpen}
              initialMessage={aiChatInitialMessage}
              onInitialMessageSent={() => setAiChatInitialMessage(undefined)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* First-Time Setup Wizard */}
      <SetupWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        branding={branding}
        onBrandingChange={setBranding}
        orgName={org?.name}
        isGuest={isGuest}
      />

      {/* Management Drawer */}
      <ErrorBoundary fallbackTitle="Management panel failed to load">
        <ManagementDrawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setDrawerSection(undefined);
            setDrawerTab(undefined);
          }}
          isGuest={isGuest}
          orgName={org?.name}
          analysisResults={analysisResults}
          customerName={branding.customerName}
          environment={branding.environment}
          onLoadReports={handleLoadSavedReports}
          savedReportsTrigger={savedReportsTrigger}
          hasFiles={hasFiles}
          initialTab={drawerTab as "dashboard" | "reports" | "history" | "settings" | undefined}
          initialSettingsSection={drawerSection}
          onRerunSetup={() => {
            resetSetupFlag();
            setDrawerOpen(false);
            setWizardOpen(true);
          }}
          localMode={localMode}
          onLocalModeChange={handleLocalModeChange}
          onSelectTrendScore={(score, grade, date) => {
            if (score === -1) setTrendSnapshot(null);
            else setTrendSnapshot({ score, grade, date });
          }}
        />
      </ErrorBoundary>

      {/* Keyboard shortcut hint + Tours — only when sticky bar is NOT shown */}
      {!(hasFiles && (!viewingReports || isGuest) && !isLoading && !inDiffMode) && (
        <div className="fixed bottom-4 right-4 z-10 no-print flex items-center gap-2">
          <GuidedTourButton
            hasFiles={hasFiles}
            hasReports={hasReports}
            isGuest={isGuest}
            tourCallbacks={tourCallbacks}
          />
          <button
            onClick={() => setShortcutsOpen(true)}
            className="group relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.06] text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all duration-200 hover:border-white/[0.12] hover:shadow-elevated"
            style={{
              background: "linear-gradient(145deg, rgba(32,6,247,0.06), rgba(32,6,247,0.02))",
            }}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            data-tour="shortcuts-button"
          >
            <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full blur-[10px] opacity-0 transition-opacity duration-200 group-hover:opacity-25 pointer-events-none bg-brand-accent" />
            <Keyboard className="h-3 w-3 text-brand-accent" />
            Shortcuts
          </button>
        </div>
      )}

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

const Index = () => {
  const auth = useAuthProvider();
  return (
    <AuthFlow auth={auth}>
      <InnerApp />
    </AuthFlow>
  );
};

export default Index;

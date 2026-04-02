import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { RotateCcw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadedFile } from "@/components/FileUpload";
import { BrandingData } from "@/components/BrandingSetup";
import { AppHeader } from "@/components/AppHeader";
import { UploadSection } from "@/components/UploadSection";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { resolveCustomerName } from "@/lib/customer-name";
import { agentCustomerGroupingKey } from "@/lib/agent-customer-bucket";

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
import {
  useAutoSave,
  loadSession,
  saveSession,
  clearSession,
} from "@/hooks/use-session-persistence";
import type {
  ConfigComplianceScope,
  SerializableConfigComplianceScope,
} from "@/lib/config-compliance-scope";
import {
  createScopeFromBranding,
  deserializeScope,
  effectiveFrameworks,
  mergeScopeWithBrandingForEffective,
  scopeFromFirewallLink,
  seedExplicitFrameworksForLinkedScope,
  serializeScope,
} from "@/lib/config-compliance-scope";
import type { FirewallLink } from "@/components/FirewallLinkPicker";
import { brandingPatchFromComplianceGeo } from "@/lib/compliance-context-options";
import { useAuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { invalidateFleetRelatedQueries } from "@/lib/invalidate-org-queries";
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
import { fetchAssessmentSnapshotById, saveAssessmentCloud } from "@/lib/assessment-cloud";
import {
  saveAssessment as saveAssessmentLocal,
  type AssessmentSnapshot,
} from "@/lib/assessment-history";
import {
  signoffFromAssessmentSnapshot,
  type FindingsCsvReviewerSignoff,
} from "@/lib/findings-export";
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
import { AssessDocumentPreviewSection } from "@/components/assess/AssessDocumentPreviewSection";
import { AssessWorkflowStepper } from "@/components/AssessWorkflowStepper";
import { OPEN_MANAGEMENT_EVENT } from "@/components/WorkspaceCommandPalette";
import type { ReportEntry } from "@/components/DocumentPreview";

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
  const queryClient = useQueryClient();
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
  const [pendingSessionRecovery, setPendingSessionRecovery] = useState<{
    branding: BrandingData;
    reports: ReportEntry[];
    activeReportId: string;
    linkedCloudAssessmentId: string | null;
    configComplianceScopes: Record<string, SerializableConfigComplianceScope>;
  } | null>(null);
  const [configComplianceScopes, setConfigComplianceScopes] = useState<
    Record<string, ConfigComplianceScope>
  >({});

  /** Every upload gets a scope row (frameworks + web filter); backfills agent loads and legacy sessions. */
  useEffect(() => {
    if (files.length === 0) return;
    setConfigComplianceScopes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const f of files) {
        if (!next[f.id]) {
          next[f.id] = createScopeFromBranding(branding);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [files, branding]);

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
  const [linkedCloudAssessmentId, setLinkedCloudAssessmentId] = useState<string | null>(null);
  const [exportReviewerSignoff, setExportReviewerSignoff] =
    useState<FindingsCsvReviewerSignoff | null>(null);

  useEffect(() => {
    const onOpenManagement = () => {
      setDrawerOpen(true);
      setDrawerTab(undefined);
      setDrawerSection(undefined);
    };
    window.addEventListener(OPEN_MANAGEMENT_EVENT, onOpenManagement);
    return () => window.removeEventListener(OPEN_MANAGEMENT_EVENT, onOpenManagement);
  }, []);

  const webFilterModeByConfigId = useMemo(() => {
    const m: Record<string, NonNullable<ConfigComplianceScope["webFilterComplianceMode"]>> = {};
    for (const f of files) {
      const mode = configComplianceScopes[f.id]?.webFilterComplianceMode;
      if (mode !== undefined) m[f.id] = mode;
    }
    return m;
  }, [files, configComplianceScopes]);

  const aggregatedSelectedFrameworks = useMemo(() => {
    if (files.length === 0) return branding.selectedFrameworks;
    const seen = new Set<string>();
    for (const f of files) {
      const scope = configComplianceScopes[f.id];
      if (!scope) continue;
      const fws =
        scope.explicitSelectedFrameworks ??
        effectiveFrameworks(mergeScopeWithBrandingForEffective(branding, scope));
      for (const fw of fws) seen.add(fw);
    }
    if (seen.size === 0) return branding.selectedFrameworks;
    return [...seen];
  }, [files, configComplianceScopes, branding]);

  const firewallAnalysisOpts = useMemo(
    () => ({
      dpiExemptZones,
      dpiExemptNetworks,
      webFilterComplianceMode: branding.webFilterComplianceMode,
      webFilterModeByConfigId,
      webFilterExemptRuleNames: branding.webFilterExemptRuleNames,
    }),
    [
      dpiExemptZones,
      dpiExemptNetworks,
      branding.webFilterComplianceMode,
      webFilterModeByConfigId,
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
  } = useReportGeneration(files, branding, analysisResults, configComplianceScopes);

  const serializedConfigScopesForSession = useMemo(() => {
    const o: Record<string, SerializableConfigComplianceScope> = {};
    for (const [k, v] of Object.entries(configComplianceScopes)) {
      o[k] = serializeScope(v);
    }
    return o;
  }, [configComplianceScopes]);

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
    const fleetContext = searchParams.get("fleetContext")?.trim();
    if (!customer && !openUpload && !fleetContext) return;

    let cancelled = false;

    void (async () => {
      if (fleetContext && org?.id && !isGuest) {
        try {
          const { data: cw } = await supabase
            .from("central_firewalls")
            .select(
              "compliance_country, compliance_state, central_tenant_id, compliance_environment",
            )
            .eq("org_id", org.id)
            .eq("id", fleetContext)
            .maybeSingle();

          if (cancelled) return;

          type CentralComp = {
            compliance_country?: string | null;
            compliance_state?: string | null;
            central_tenant_id?: string | null;
            compliance_environment?: string | null;
          };

          const applyBrandingPatch = (patch: {
            country?: string;
            state?: string;
            environment?: string;
          }) => {
            setBranding((prev) => ({
              ...prev,
              ...(patch.country ? { country: patch.country } : {}),
              ...(patch.state ? { state: patch.state } : {}),
              ...(patch.environment ? { environment: patch.environment } : {}),
            }));
          };

          if (cw && typeof cw === "object") {
            const row = cw as CentralComp;
            const country = (row.compliance_country ?? "").trim();
            const state = (row.compliance_state ?? "").trim();
            const tid = (row.central_tenant_id ?? "").trim();
            let environment = "";
            let tenantCountry = "";
            if (tid) {
              const { data: ten } = await supabase
                .from("central_tenants")
                .select("compliance_environment, compliance_country")
                .eq("org_id", org.id)
                .eq("central_tenant_id", tid)
                .maybeSingle();
              if (!cancelled && ten && typeof ten === "object") {
                const t = ten as {
                  compliance_environment?: string | null;
                  compliance_country?: string | null;
                };
                environment = (t.compliance_environment ?? "").trim();
                tenantCountry = (t.compliance_country ?? "").trim();
              }
            }
            if (!environment) {
              environment = (row.compliance_environment ?? "").trim();
            }
            const brandingCountry = country || tenantCountry;
            applyBrandingPatch({
              ...(brandingCountry ? { country: brandingCountry } : {}),
              ...(state ? { state } : {}),
              ...(environment ? { environment } : {}),
            });
          } else {
            const { data: ag } = await supabase
              .from("agents")
              .select(
                "compliance_country, compliance_state, compliance_environment, assigned_customer_name, tenant_name, customer_name, name, firewall_host",
              )
              .eq("org_id", org.id)
              .eq("id", fleetContext)
              .maybeSingle();
            if (cancelled || !ag || typeof ag !== "object") {
              /* no row */
            } else {
              const a = ag as Record<string, string | null | undefined>;
              const country = (a.compliance_country ?? "").trim();
              const state = (a.compliance_state ?? "").trim();
              const bucketKey = agentCustomerGroupingKey({
                assigned_customer_name: a.assigned_customer_name,
                tenant_name: a.tenant_name,
              });
              let environment = "";
              let bucketCountry = "";
              const { data: bucketRow } = await supabase
                .from("agent_customer_compliance_environment")
                .select("compliance_environment, compliance_country")
                .eq("org_id", org.id)
                .eq("customer_bucket_key", bucketKey)
                .maybeSingle();
              if (!cancelled && bucketRow && typeof bucketRow === "object") {
                const br = bucketRow as {
                  compliance_environment?: string | null;
                  compliance_country?: string | null;
                };
                environment = (br.compliance_environment ?? "").trim();
                bucketCountry = (br.compliance_country ?? "").trim();
              }
              if (!environment) {
                environment = (a.compliance_environment ?? "").trim();
              }
              const brandingCountryAgent = country || bucketCountry;
              applyBrandingPatch({
                ...(brandingCountryAgent ? { country: brandingCountryAgent } : {}),
                ...(state ? { state } : {}),
                ...(environment ? { environment } : {}),
              });
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (cancelled) return;

      if (customer) {
        setBranding((prev) =>
          prev.customerName === customer ? prev : { ...prev, customerName: customer },
        );
      }

      const next = new URLSearchParams(searchParams);
      next.delete("customer");
      next.delete("openUpload");
      next.delete("fleetContext");
      if (
        searchParams.has("customer") ||
        searchParams.has("openUpload") ||
        searchParams.has("fleetContext")
      ) {
        setSearchParams(next, { replace: true });
      }

      setCustomerDeepLink({
        customer: customer || undefined,
        openUpload,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, org?.id, isGuest]);

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
      trackProductEvent("manage_deeplink_blocked_viewer", {
        section: sec,
        panel: parsed.panel,
      });
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

  useAutoSave(
    branding,
    reports,
    activeReportId,
    linkedCloudAssessmentId,
    !isGuest,
    serializedConfigScopesForSession,
  );

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

  // Offer saved session recovery (auth only): keep disk data until the user taps Resume.
  // Avoids showing report counts, branding, Context step complete, or linked assessment until then.
  useEffect(() => {
    if (isGuest) return;
    const session = loadSession();
    if (session && session.reports.length > 0) {
      setPendingSessionRecovery({
        branding: session.branding,
        reports: session.reports,
        activeReportId: session.activeReportId,
        linkedCloudAssessmentId: session.linkedCloudAssessmentId ?? null,
        configComplianceScopes: session.configComplianceScopes ?? {},
      });
    }
  }, [isGuest]);

  const handleFirewallScopeChange = useCallback(
    (configId: string, link: FirewallLink | null) => {
      const builtPreview = link ? scopeFromFirewallLink(link, []) : null;

      setConfigComplianceScopes((prev) => {
        const next = { ...prev };
        if (!link) {
          const had = next[configId];
          if (had) {
            next[configId] = { ...had, tenantCustomerDisplayName: undefined };
          }
          return next;
        }
        const built = scopeFromFirewallLink(link, []);
        if (!built) {
          delete next[configId];
          return next;
        }
        const seed = seedExplicitFrameworksForLinkedScope(branding, built);
        next[configId] = {
          ...built,
          additionalFrameworks: [],
          explicitSelectedFrameworks: [...seed],
          webFilterComplianceMode: branding.webFilterComplianceMode ?? "strict",
        };
        return next;
      });

      if (!link || !builtPreview) return;

      const tenantLabel = link.tenantCustomerDisplayName?.trim() ?? "";
      const hasGeoFromLink = !!(builtPreview.environment?.trim() || builtPreview.country?.trim());

      setBranding((b) => {
        let next = { ...b };
        if (tenantLabel && (files.length <= 1 || !b.customerName?.trim())) {
          next = { ...next, customerName: tenantLabel };
        }
        const globalGeoEmpty = !b.environment?.trim() && !b.country?.trim();
        const shouldApplyGeo = hasGeoFromLink && (files.length <= 1 || globalGeoEmpty);
        if (!shouldApplyGeo) return next;

        const patch = brandingPatchFromComplianceGeo(
          builtPreview.environment,
          builtPreview.country,
          builtPreview.state,
          { existingState: b.state },
        );
        return {
          ...next,
          environment: patch.environment || next.environment,
          country: patch.country || next.country,
          state: patch.state,
          selectedFrameworks: patch.selectedFrameworks,
        };
      });
    },
    [branding, files.length],
  );

  const handleConfigCompliancePatch = useCallback(
    (configId: string, patch: Partial<ConfigComplianceScope>) => {
      setConfigComplianceScopes((prev) => {
        const existing = prev[configId];
        if (!existing) return prev;
        return { ...prev, [configId]: { ...existing, ...patch } };
      });
    },
    [],
  );

  const handleFilesChange = useCallback(
    async (uploaded: UploadedFile[]) => {
      const nextIds = new Set(uploaded.map((u) => u.id));
      setConfigComplianceScopes((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (!nextIds.has(k)) delete next[k];
        }
        return next;
      });
      if (org?.id && !isGuest) {
        const removed = files.filter((pf) => !nextIds.has(pf.id));
        if (removed.length > 0) {
          await Promise.all(
            removed.map((pf) =>
              supabase
                .from("firewall_config_links")
                .delete()
                .eq("org_id", org.id)
                .eq("config_hash", pf.id),
            ),
          );
          void invalidateFleetRelatedQueries(queryClient, org.id);
        }
      }

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
      setConfigComplianceScopes((prev) => {
        const next = { ...prev };
        for (const f of allParsed) {
          if (!next[f.id]) {
            next[f.id] = createScopeFromBranding(branding);
          }
        }
        return next;
      });
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
    [files, reports.length, setReports, setActiveReportId, org?.id, isGuest, queryClient, branding],
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
            const assessSnap = await saveAssessmentCloud(
              analysisResults,
              branding.customerName,
              branding.environment,
              org.id,
            );
            if (assessSnap) {
              setLinkedCloudAssessmentId(assessSnap.id);
              setExportReviewerSignoff(signoffFromAssessmentSnapshot(assessSnap));
            }
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

  const handleResumePendingSession = useCallback(() => {
    if (!pendingSessionRecovery) return;
    const {
      branding: b,
      reports: r,
      activeReportId: rid,
      linkedCloudAssessmentId,
      configComplianceScopes: persistedScopes,
    } = pendingSessionRecovery;
    const scopes: Record<string, ConfigComplianceScope> = {};
    for (const [k, v] of Object.entries(persistedScopes ?? {})) {
      scopes[k] = deserializeScope(v);
    }
    setConfigComplianceScopes(scopes);
    setBranding(b);
    setReports(r);
    setActiveReportId(rid);
    setPendingSessionRecovery(null);
    toast.success(`Restored ${r.length} saved report${r.length !== 1 ? "s" : ""}.`);

    if (linkedCloudAssessmentId && org?.id) {
      const ac = new AbortController();
      void (async () => {
        try {
          const snap = await fetchAssessmentSnapshotById(linkedCloudAssessmentId, ac.signal);
          if (snap) {
            setLinkedCloudAssessmentId(snap.id);
            setExportReviewerSignoff(signoffFromAssessmentSnapshot(snap));
          } else {
            setLinkedCloudAssessmentId(null);
            setExportReviewerSignoff(null);
            saveSession(b, r, rid, null, persistedScopes);
          }
        } catch {
          setLinkedCloudAssessmentId(null);
          setExportReviewerSignoff(null);
          saveSession(b, r, rid, null, persistedScopes);
        }
      })();
    }
  }, [pendingSessionRecovery, org?.id, setReports, setActiveReportId]);

  const handleDiscardPendingSession = useCallback(() => {
    setPendingSessionRecovery(null);
    setLinkedCloudAssessmentId(null);
    setExportReviewerSignoff(null);
    clearSession();
  }, []);

  const handleStartOver = useCallback(() => {
    setReports([]);
    setActiveReportId("");
    setFiles([]);
    setConfigComplianceScopes({});
    setPendingSessionRecovery(null);
    setViewingReports(false);
    setLinkedCloudAssessmentId(null);
    setExportReviewerSignoff(null);
    clearSession();
  }, [setReports, setActiveReportId]);

  const handleLocalModeChange = useCallback((enabled: boolean) => {
    setLocalMode(enabled);
    setLocalModeState(enabled);
    if (enabled) {
      setLinkedCloudAssessmentId(null);
      setExportReviewerSignoff(null);
    }
  }, []);

  const handleCloudAssessmentSaved = useCallback((snap: AssessmentSnapshot) => {
    setLinkedCloudAssessmentId(snap.id);
    setExportReviewerSignoff(signoffFromAssessmentSnapshot(snap));
  }, []);

  const handleLinkedAssessmentSignoffChange = useCallback(
    (signoff: FindingsCsvReviewerSignoff | null) => {
      setExportReviewerSignoff(signoff);
    },
    [],
  );

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
  const hasAgentOnlyConfigs = hasFiles && files.every((f) => f.source === "agent");
  const workflowHasContext = useMemo(() => {
    if (hasAgentOnlyConfigs) {
      return Boolean(
        branding.customerName?.trim() || branding.environment?.trim() || branding.country?.trim(),
      );
    }
    return Boolean(branding.customerName?.trim());
  }, [hasAgentOnlyConfigs, branding.customerName, branding.environment, branding.country]);
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
        className={`workspace-shell section-stack ${viewingReports ? "max-w-full" : "max-w-[1320px]"} ${!inDiffMode ? "pb-20" : ""}`}
      >
        {!inDiffMode && (
          <AssessWorkflowStepper
            hasFiles={hasFiles}
            hasContext={workflowHasContext}
            hasAnalysis={totalFindings > 0}
            viewingReports={viewingReports}
            className="mb-3"
          />
        )}
        {!isGuest && org?.id && (
          <>
            <CentralHealthBanner orgId={org.id} />
            {canManageTeam && <MspSetupChecklist orgId={org.id} canManage={canManageTeam} />}
            <MspAttentionSurface orgId={org.id} orgName={org.name ?? ""} />
          </>
        )}

        {/* Saved session — resume or start fresh (no header/report chrome until Resume) */}
        {pendingSessionRecovery && !viewingReports && !isLoading && (
          <div className="no-print rounded-xl border border-brand-accent/30 bg-gradient-to-r from-brand-accent/10 via-brand-accent/[0.06] to-transparent dark:from-brand-accent/15 dark:via-brand-accent/[0.08] dark:to-transparent px-5 py-3 flex flex-wrap items-center gap-3 text-sm shadow-[0_0_20px_-4px] shadow-brand-accent/20 dark:shadow-brand-accent/25 backdrop-blur-sm">
            <RotateCcw className="h-4 w-4 text-brand-accent shrink-0" aria-hidden />
            <div className="flex-1 min-w-[200px] space-y-0.5">
              <p className="font-medium text-foreground">Saved session available</p>
              <p className="text-xs text-muted-foreground">
                {pendingSessionRecovery.reports.length} report
                {pendingSessionRecovery.reports.length !== 1 ? "s" : ""} from the last 24 hours.
                Resume to continue, or start fresh.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button size="sm" onClick={handleResumePendingSession}>
                Resume session
              </Button>
              <Button size="sm" variant="outline" onClick={handleDiscardPendingSession}>
                Start fresh
              </Button>
            </div>
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
              configComplianceScopes={configComplianceScopes}
              onFirewallScopeChange={handleFirewallScopeChange}
              onConfigCompliancePatch={handleConfigCompliancePatch}
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
                  exportReviewerSignoff={exportReviewerSignoff}
                  aggregatedSelectedFrameworks={aggregatedSelectedFrameworks}
                />
              </div>
            )}
          </>
        )}

        {/* Report view (authenticated only) */}
        {!isGuest && (viewingReports || isLoading) && (
          <AssessDocumentPreviewSection
            hasReports={hasReports}
            isLoading={isLoading}
            viewingReports={viewingReports}
            onBackToDashboard={() => setViewingReports(false)}
            filesLength={files.length}
            reports={reports}
            findExecutiveReport={Boolean(reports.find((r) => r.id === "report-executive"))}
            findComplianceReport={Boolean(reports.find((r) => r.id === "report-compliance"))}
            onGenerateExecutive={() => generateExecutive()}
            onGenerateCompliance={generateCompliance}
            localMode={localMode}
            isViewerOnly={isViewerOnly}
            totalRules={totalRules}
            analysisResults={analysisResults}
            activeReportId={activeReportId}
            onActiveReportChange={setActiveReportId}
            loadingReportIds={loadingReportIds}
            failedReportIds={failedReportIds}
            onRetryReport={handleRetry}
            branding={branding}
            backendDebugInfo={backendDebugInfo}
            onFetchBackendDebug={localMode ? undefined : fetchBackendDebug}
            savingReports={savingReports}
            reportsSaved={reportsSaved}
            onSaveReports={handleSaveReports}
            onStartOver={handleStartOver}
            saveError={saveError}
            onRetrySave={() => handleSaveReports(true)}
          />
        )}
      </main>

      {/* Sticky bottom bar: Tours + Shortcuts on the left always (except diff mode); full actions when analysis is ready */}
      {!inDiffMode && (
        <StickyActionBar
          variant={hasFiles && !isLoading && (!viewingReports || isGuest) ? "full" : "reports"}
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
      <ErrorBoundary
        fallbackTitle="Management panel failed to load"
        resetKeys={[drawerOpen]}
        onError={() => setDrawerOpen(false)}
      >
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
          linkedCloudAssessmentId={linkedCloudAssessmentId}
          onLinkedAssessmentSignoffChange={handleLinkedAssessmentSignoffChange}
          onCloudAssessmentSaved={handleCloudAssessmentSaved}
        />
      </ErrorBoundary>

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

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  Lock,
  PanelRight,
  Upload,
  Wifi,
  Link2,
  Copy,
  XCircle,
  UserCheck,
  Send,
  CalendarClock,
  RotateCcw,
  Search,
  FileSpreadsheet,
  Shield,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { analyseConfig } from "@/lib/analyse-config";
import type { ExtractedSections } from "@/lib/extract-sections";
import { extractSections } from "@/lib/extract-sections";
import {
  computeSophosBPScore,
  detectBpLicenceTierFromCentral,
  type LicenceSelection,
  type SophosBPScore,
} from "@/lib/sophos-licence";
import { evaluateBaseline, BASELINE_TEMPLATES } from "@/lib/policy-baselines";
import { rawConfigToSections } from "@/lib/raw-config-to-sections";
import { parseEntitiesXml } from "@/lib/parse-entities-xml";
import { FileUpload, type UploadedFile } from "@/components/FileUpload";
import { HealthCheckDashboard } from "@/components/HealthCheckDashboard2";
import { SEScoreTrendChart } from "@/components/SEScoreTrendChart";
import { FirmwareEolWarnings } from "@/components/FirmwareEolWarnings";
import { TeamDashboard } from "@/components/TeamDashboard";

const SophosBestPractice = lazy(() =>
  import("@/components/SophosBestPractice2").then((m) => ({ default: m.SophosBestPractice })),
);
import { DpiExclusionBar } from "@/components/DpiExclusionBar2";
import { SeHeartbeatScopeBar } from "@/components/SeHeartbeatScopeBar2";
import {
  SeThreatResponseAckBar,
  SeDnsProtectionAckBar,
} from "@/components/SeThreatResponseAckBar2";
import { WebFilterRuleExclusionBar } from "@/components/WebFilterRuleExclusionBar2";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import { SEHealthCheckHistory } from "@/components/SEHealthCheckHistory2";
import { SeHealthCheckManagementDrawer } from "@/components/SeHealthCheckManagementDrawer2";
import type { ParsedFile } from "@/hooks/use-report-generation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSEAuthProvider, useSEAuth, SEAuthProvider } from "@/hooks/use-se-auth";
import { SEAuthGate } from "@/components/SEAuthGate";
import { getSupabasePublicEdgeAuth, supabase } from "@/integrations/supabase/client";
import { readJwtPayloadClaim } from "@/lib/jwt-payload";
import { getFirewallDisplayName } from "@/lib/sophos-central";
import {
  buildGuestCentralHaGroups,
  findGuestHaGroupBySelectValue,
  guestHaGroupSelectValue,
  type GuestFirewallRow,
  type GuestHaGroup,
} from "@/lib/guest-central-ha-groups";
import {
  buildSeCentralHaLabels,
  buildSeHeartbeatExclusionSet,
  buildSeThreatResponseAckSet,
  loadSeHealthCheckBpOverrides,
  SE_HEALTH_CHECK_BP_OVERRIDES_KEY,
  seCentralAutoForLabel,
} from "@/lib/se-health-check-bp-v2";
import {
  loadSeHealthCheckPreparedBy,
  SE_HEALTH_CHECK_PREPARED_BY_KEY,
} from "@/lib/se-health-check-preferences-v2";
import {
  buildSeHealthCheckSnapshotV1,
  parseSeHealthCheckSnapshotFromSummaryJson,
  snapshotFilesToParsedFiles,
  type SeHealthCheckSnapshotV1,
} from "@/lib/se-health-check-snapshot-v2";
import { ActiveTeamProvider, useActiveTeam } from "@/hooks/use-active-team";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { startHealthCheckTour, startHealthCheckResultsTour } from "@/lib/guided-tours";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type {
  ActiveStep,
  EphemeralCentralCreds,
  GuestFirewallLicenseApiRow,
  GuestTenantRow,
} from "./health-check/types";
import {
  useConfigUpload,
  type ConfigUploadCentralApiPayload,
} from "./health-check/use-config-upload";
import {
  buildHealthCheckReportParams,
  validateRequiredFields,
} from "./health-check/build-report-params";
import {
  CENTRAL_MATCH_NONE,
  mapGuestFirewallLicencesToBpRows,
  guestFirewallMatchValueForFile,
  callGuestCentral,
} from "./health-check/guest-central-api";
import { CompleteProfileGate } from "./health-check/CompleteProfileGate";
import { useHealthCheckSharing } from "./health-check/use-health-check-sharing";
import { buildAutoSeNotes } from "./health-check/build-auto-se-notes";

const SOPHOS_BP_TEMPLATE =
  BASELINE_TEMPLATES.find((t) => t.id === "sophos-best-practice") ?? BASELINE_TEMPLATES[0];

function HealthCheckInner() {
  const seAuth = useSEAuth();
  const { activeTeam, activeTeamId, teams } = useActiveTeam();

  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [activeStep, setActiveStep] = useState<ActiveStep>("landing");
  const [centralCreds, setCentralCreds] = useState<EphemeralCentralCreds>({
    clientId: "",
    clientSecret: "",
    tenantId: "",
  });
  const [centralValidated, setCentralValidated] = useState(false);
  /** True when a saved check is open without live Central — keeps BP Central auto-checks aligned with the save. */
  const [replayCentralLinked, setReplayCentralLinked] = useState(false);
  const [centralBusy, setCentralBusy] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<GuestTenantRow[]>([]);
  const [firewallOptions, setFirewallOptions] = useState<GuestFirewallRow[]>([]);
  const [licence, setLicence] = useState<LicenceSelection>({ tier: "xstream", modules: [] });
  const [dpiExemptZones, setDpiExemptZones] = useState<string[]>([]);
  const [dpiExemptNetworks, setDpiExemptNetworks] = useState<string[]>([]);
  const [webFilterComplianceMode, setWebFilterComplianceMode] =
    useState<WebFilterComplianceMode>("strict");
  const [webFilterExemptRuleNames, setWebFilterExemptRuleNames] = useState<string[]>([]);
  const [seMdrThreatFeedsAck, setSeMdrThreatFeedsAck] = useState(false);
  const [seNdrEssentialsAck, setSeNdrEssentialsAck] = useState(false);
  const [seDnsProtectionAck, setSeDnsProtectionAck] = useState(false);
  const [seExcludeSecurityHeartbeat, setSeExcludeSecurityHeartbeat] = useState(false);
  const [guestFirewallLicenseItems, setGuestFirewallLicenseItems] = useState<
    GuestFirewallLicenseApiRow[]
  >([]);
  const [bpOverrideRevision, setBpOverrideRevision] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  /** When non-null, HA BP auto-pass labels come from a reopened save (no live Central groups). */
  const [restoredHaLabels, setRestoredHaLabels] = useState<Set<string> | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [preparedFor, setPreparedFor] = useState("");
  const [seNotesManual, setSeNotesManual] = useState("");
  const [findingNotes, setFindingNotes] = useState<Record<string, string>>({});
  const [seManagementOpen, setSeManagementOpen] = useState(false);

  const effectivePreparedBy = useMemo(() => {
    const name =
      seAuth.seProfile?.healthCheckPreparedBy?.trim() ||
      seAuth.seProfile?.displayName?.trim() ||
      seAuth.seProfile?.email?.trim() ||
      "Sales Engineer";
    return activeTeam ? `${name} — ${activeTeam.name}` : name;
  }, [seAuth.seProfile, activeTeam]);

  const exportFieldsReady = !!(customerName.trim() && customerEmail.trim() && preparedFor.trim());

  /** One-time: copy legacy localStorage "Prepared by" into `se_profiles.health_check_prepared_by`. */
  useEffect(() => {
    const p = seAuth.seProfile;
    if (!p) return;
    const legacy = loadSeHealthCheckPreparedBy().trim();
    if (!legacy) return;
    if (p.healthCheckPreparedBy?.trim()) {
      try {
        localStorage.removeItem(SE_HEALTH_CHECK_PREPARED_BY_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      const { error } = await supabase
        .from("se_profiles")
        .update({ health_check_prepared_by: legacy } as Record<string, unknown>)
        .eq("id", p.id);
      if (cancelled || error) return;
      try {
        localStorage.removeItem(SE_HEALTH_CHECK_PREPARED_BY_KEY);
      } catch {
        /* ignore */
      }
      await seAuth.reloadSeProfile();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seAuth.seProfile, seAuth.reloadSeProfile]);

  const centralLinkedForAnalysis = centralValidated || replayCentralLinked;

  /** HA grouping aligned with MSP `FirewallLinker` (same hostname → one row, primary from cluster). */
  const guestFirewallGroups = useMemo(
    () => buildGuestCentralHaGroups(firewallOptions),
    [firewallOptions],
  );

  /** Licensing API rows for uploads linked by serial → same tier detection as MSP SophosBestPractice. */
  const seCentralHaLabels = useMemo(() => {
    if (restoredHaLabels) return restoredHaLabels;
    return buildSeCentralHaLabels(files, guestFirewallGroups);
  }, [restoredHaLabels, files, guestFirewallGroups]);

  const seThreatResponseAck = useMemo(
    () => buildSeThreatResponseAckSet(seMdrThreatFeedsAck, seNdrEssentialsAck, seDnsProtectionAck),
    [seMdrThreatFeedsAck, seNdrEssentialsAck, seDnsProtectionAck],
  );

  const seExcludedBpChecks = useMemo(
    () => buildSeHeartbeatExclusionSet(seExcludeSecurityHeartbeat),
    [seExcludeSecurityHeartbeat],
  );

  const centralBpLicenceFlat = useMemo(() => {
    const serials = new Set(
      files.map((f) => f.serialNumber?.trim().toLowerCase()).filter((s): s is string => Boolean(s)),
    );
    const rows =
      serials.size > 0
        ? guestFirewallLicenseItems.filter((r) =>
            serials.has((r.serialNumber ?? "").trim().toLowerCase()),
          )
        : [];
    return mapGuestFirewallLicencesToBpRows(rows);
  }, [files, guestFirewallLicenseItems]);

  const detectedTierFromCentralLicences = useMemo(
    () =>
      detectBpLicenceTierFromCentral(centralBpLicenceFlat.length > 0 ? centralBpLicenceFlat : null),
    [centralBpLicenceFlat],
  );

  const licenceLockedByCentral = detectedTierFromCentralLicences !== null;

  useEffect(() => {
    if (!detectedTierFromCentralLicences) return;
    setLicence((prev) => ({
      tier: detectedTierFromCentralLicences,
      modules: detectedTierFromCentralLicences === "individual" ? prev.modules : [],
    }));
  }, [detectedTierFromCentralLicences]);

  useEffect(() => {
    if (
      !centralValidated ||
      !centralCreds.tenantId?.trim() ||
      !centralCreds.clientId.trim() ||
      !centralCreds.clientSecret.trim()
    ) {
      if (!centralFromUploadRef.current) setGuestFirewallLicenseItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await callGuestCentral<{ items: GuestFirewallLicenseApiRow[] }>({
          mode: "guest_health_firewall_licenses",
          clientId: centralCreds.clientId,
          clientSecret: centralCreds.clientSecret,
          tenantId: centralCreds.tenantId,
        });
        if (!cancelled) setGuestFirewallLicenseItems(res.items ?? []);
      } catch {
        if (!cancelled) setGuestFirewallLicenseItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centralValidated, centralCreds.tenantId, centralCreds.clientId, centralCreds.clientSecret]);

  const baselineResults = useMemo(() => {
    const out: Record<string, ReturnType<typeof evaluateBaseline>> = {};
    for (const [label, ar] of Object.entries(analysisResults)) {
      out[label] = evaluateBaseline(SOPHOS_BP_TEMPLATE, ar);
    }
    return out;
  }, [analysisResults]);

  const autoSeNotes = useMemo(
    () =>
      buildAutoSeNotes({
        analysisResults,
        licence,
        centralLinkedForAnalysis,
        seCentralHaLabels,
        seThreatResponseAck,
        seExcludedBpChecks,
        dpiExemptZones,
        dpiExemptNetworks,
        webFilterExemptRuleNames,
        webFilterComplianceMode,
        seMdrThreatFeedsAck,
        seNdrEssentialsAck,
        seDnsProtectionAck,
        seExcludeSecurityHeartbeat,
      }),
    [
      analysisResults,
      licence,
      centralLinkedForAnalysis,
      seCentralHaLabels,
      seThreatResponseAck,
      seExcludedBpChecks,
      dpiExemptZones,
      dpiExemptNetworks,
      webFilterExemptRuleNames,
      webFilterComplianceMode,
      seMdrThreatFeedsAck,
      seNdrEssentialsAck,
      seDnsProtectionAck,
      seExcludeSecurityHeartbeat,
    ],
  );

  const seNotes = useMemo(() => {
    const parts = [autoSeNotes, seNotesManual.trim()].filter(Boolean);
    return parts.join("\n\n");
  }, [autoSeNotes, seNotesManual]);

  useEffect(() => {
    if (files.length === 0) {
      setActiveStep("landing");
      return;
    }
    const next: Record<string, AnalysisResult> = {};
    for (const f of files) {
      const label = f.label || f.fileName.replace(/\.(html|htm|xml)$/i, "");
      next[label] = analyseConfig(f.extractedData, {
        centralLinked: centralLinkedForAnalysis,
        dpiExemptZones,
        dpiExemptNetworks,
        webFilterComplianceMode,
        webFilterExemptRuleNames,
      });
    }
    setAnalysisResults(next);
  }, [
    files,
    centralLinkedForAnalysis,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
  ]);

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
        return;
      }

      setActiveStep("analyzing");
      const parsed: ParsedFile[] = [];
      for (const file of toProcess) {
        await new Promise((r) => setTimeout(r, 0));
        const isXml =
          file.fileName.endsWith(".xml") || file.content.trimStart().startsWith("<?xml");
        let extractedData: ExtractedSections;
        try {
          if (isXml) {
            const rawConfig = parseEntitiesXml(file.content);
            extractedData = rawConfigToSections(rawConfig);
          } else {
            extractedData = await extractSections(file.content);
          }
        } catch (err) {
          console.warn(`[health-check] parse failed ${file.fileName}`, err);
          toast.error(
            `Could not parse ${file.fileName} — use a valid Sophos HTML or entities XML export`,
          );
          extractedData = {} as ExtractedSections;
        }
        parsed.push({ ...file, extractedData, source: "upload" });
      }

      const merged = [...existingParsed, ...parsed];
      setFiles(merged);
      const hasContent = merged.some((f) => Object.keys(f.extractedData ?? {}).length > 0);
      if (hasContent) setActiveStep("results");
      else {
        setActiveStep("landing");
        toast.message("No configuration sections were extracted — check the file format.");
      }
    },
    [files],
  );

  const uploadedForPicker: UploadedFile[] = useMemo(
    () =>
      files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        label: f.label,
        content: f.content,
        serialNumber: f.serialNumber,
        agentHostname: f.agentHostname,
        hardwareModel: f.hardwareModel,
        source: f.source,
      })),
    [files],
  );

  const onLoadConfigFromUpload = useCallback(
    async (
      uploaded: UploadedFile,
      requestCustomerName: string | null | undefined,
      requestCustomerEmail: string | null | undefined,
      requestContactName: string | null | undefined,
      centralPayload: ConfigUploadCentralApiPayload | null | undefined,
    ) => {
      await handleFilesChange([...uploadedForPicker, uploaded]);
      if (requestCustomerName && !customerName.trim()) {
        setCustomerName(requestCustomerName);
      }
      if (requestCustomerEmail && !customerEmail.trim()) {
        setCustomerEmail(requestCustomerEmail);
      }
      if (requestContactName && !preparedFor.trim()) {
        setPreparedFor(requestContactName);
      }
      toast.success(`Config loaded: ${uploaded.fileName}`);

      try {
        if (centralPayload?.central_connected && centralPayload.central_data) {
          centralFromUploadRef.current = true;
          setCentralValidated(true);
          setReplayCentralLinked(false);
          const cd = centralPayload.central_data;
          if (cd.licenses && Array.isArray(cd.licenses)) {
            setGuestFirewallLicenseItems(cd.licenses as GuestFirewallLicenseApiRow[]);
          }
          if (cd.firewalls && Array.isArray(cd.firewalls)) {
            setFirewallOptions(cd.firewalls as GuestFirewallRow[]);
          }
          if (cd.tenants && Array.isArray(cd.tenants)) {
            setTenantOptions(cd.tenants as GuestTenantRow[]);
            if ((cd.tenants as GuestTenantRow[]).length > 0) {
              setCentralCreds((c) => ({ ...c, tenantId: (cd.tenants as GuestTenantRow[])[0].id }));
            }
          }
          const fwCount = Array.isArray(cd.firewalls) ? (cd.firewalls as unknown[]).length : 0;
          const linkedName = centralPayload.linked_firewall_name;
          const parts = [`Central data loaded (${fwCount} firewall${fwCount !== 1 ? "s" : ""})`];
          if (linkedName) parts.push(`linked to ${linkedName}`);
          toast.success(parts.join(" — "));

          const linkedFwId = centralPayload.linked_firewall_id;
          if (linkedFwId && Array.isArray(cd.firewalls)) {
            const fwList = cd.firewalls as GuestFirewallRow[];
            const linkedFw = fwList.find((fw) => fw.id === linkedFwId);
            if (linkedFw?.serialNumber) {
              const sn = linkedFw.serialNumber;
              const label = (linkedFw.hostname || linkedFw.name || "").trim();
              setFiles((prev) =>
                prev.map((f) => ({
                  ...f,
                  serialNumber: sn,
                  ...(label ? { label } : {}),
                })),
              );
            }
          }
        }
      } catch {
        /* Central data is optional enrichment */
      }
    },
    [handleFilesChange, uploadedForPicker, customerName, customerEmail, preparedFor],
  );

  const {
    configUploadDialogOpen,
    setConfigUploadDialogOpen,
    configUploadCustomerName,
    setConfigUploadCustomerName,
    configUploadContactName,
    setConfigUploadContactName,
    configUploadCustomerEmail,
    setConfigUploadCustomerEmail,
    configUploadDays,
    setConfigUploadDays,
    configUploadCreating,
    configUploadToken,
    setConfigUploadToken,
    configUploadUrl,
    setConfigUploadUrl,
    configUploadEmailSent,
    setConfigUploadEmailSent,
    configUploadStatus,
    setConfigUploadStatus,
    configUploadResending,
    configUploadLoading,
    configUploadRequests,
    configUploadRequestsOpen,
    setConfigUploadRequestsOpen,
    configUploadListLoading,
    resendingUploadToken,
    handleCreateConfigUploadRequest,
    handleResendConfigUploadEmail,
    handleResendUploadEmail,
    handleLoadConfigFromUpload,
    handleRevokeConfigUpload,
    handleClaimConfigUpload,
  } = useConfigUpload({
    seProfile: seAuth.seProfile,
    activeTeamId,
    onLoadConfig: onLoadConfigFromUpload,
  });

  const [savedCheckId, setSavedCheckId] = useState<string | null>(null);

  const buildSharedHtml = useCallback(async () => {
    const labels = files
      .map((f) => f.label || f.fileName.replace(/\.(html|htm|xml)$/i, ""))
      .filter((l) => analysisResults[l]);
    if (labels.length === 0) throw new Error("No analysed configurations.");

    const manualOverrides = loadSeHealthCheckBpOverrides();
    const bpByLabel: Record<string, SophosBPScore> = {};
    for (const label of labels) {
      const ar = analysisResults[label];
      if (ar) {
        const centralAuto = seCentralAutoForLabel(
          centralLinkedForAnalysis,
          label,
          seCentralHaLabels,
        );
        bpByLabel[label] = computeSophosBPScore(
          ar,
          licence,
          manualOverrides,
          centralAuto,
          seThreatResponseAck,
          seExcludedBpChecks,
        );
      }
    }

    const reportParams = {
      labels,
      files,
      analysisResults,
      baselineResults,
      bpByLabel,
      licence,
      customerName,
      preparedFor: preparedFor.trim() || customerName.trim() || undefined,
      preparedBy: effectivePreparedBy,
      dpiExemptZones,
      dpiExemptNetworks,
      webFilterComplianceMode,
      webFilterExemptRuleNames,
      seAckMdrThreatFeeds: seMdrThreatFeedsAck,
      seAckNdrEssentials: seNdrEssentialsAck,
      seAckDnsProtection: seDnsProtectionAck,
      seExcludeSecurityHeartbeat,
      centralValidated: centralLinkedForAnalysis,
      generatedAt: new Date(),
      appVersion:
        typeof import.meta.env.VITE_APP_VERSION === "string"
          ? import.meta.env.VITE_APP_VERSION
          : undefined,
      seNotes: seNotes.trim() || undefined,
    };

    const { buildSeHealthCheckBrowserHtmlDocument } =
      await import("@/lib/se-health-check-browser-html-v2");
    return buildSeHealthCheckBrowserHtmlDocument(reportParams);
  }, [
    files,
    analysisResults,
    baselineResults,
    licence,
    customerName,
    preparedFor,
    effectivePreparedBy,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludeSecurityHeartbeat,
    centralLinkedForAnalysis,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    seNotes,
  ]);

  const {
    shareDialogOpen,
    setShareDialogOpen,
    shareToken,
    setShareToken,
    shareExpiry,
    setShareExpiry,
    sharing,
    shareDays,
    setShareDays,
    followupAt,
    setFollowupAt,
    settingFollowup,
    recheckSearchOpen,
    setRecheckSearchOpen,
    recheckQuery,
    setRecheckQuery,
    recheckResults,
    setRecheckResults,
    recheckSearching,
    handleRecheckSearch,
    handleRecheckSelect,
    handleSetFollowup,
    handleShareHealthCheck,
    handleRevokeShare,
    shareUrl,
  } = useHealthCheckSharing({
    seProfile: seAuth.seProfile,
    savedCheckId,
    buildSharedHtml,
    onRecheckSelected: (result) => {
      setConfigUploadCustomerName(result.customer_name);
      setConfigUploadCustomerEmail(result.customer_email ?? "");
      setConfigUploadDialogOpen(true);
    },
  });

  const connectCentral = useCallback(async () => {
    setCentralBusy(true);
    try {
      await callGuestCentral({
        mode: "guest_health_ping",
        clientId: centralCreds.clientId,
        clientSecret: centralCreds.clientSecret,
      });
      setCentralValidated(true);
      setReplayCentralLinked(false);
      setRestoredHaLabels(null);

      const tenantsRes = await callGuestCentral<{ items: GuestTenantRow[] }>({
        mode: "guest_health_tenants",
        clientId: centralCreds.clientId,
        clientSecret: centralCreds.clientSecret,
      });
      const tenants = tenantsRes.items ?? [];
      setTenantOptions(tenants);

      if (tenants.length > 0) {
        const tenantId = tenants[0].id;
        setCentralCreds((c) => ({ ...c, tenantId }));
        const fwRes = await callGuestCentral<{ items: GuestFirewallRow[] }>({
          mode: "guest_health_firewalls",
          clientId: centralCreds.clientId,
          clientSecret: centralCreds.clientSecret,
          tenantId,
        });
        const items = fwRes.items ?? [];
        setFirewallOptions(items);
        const groups = buildGuestCentralHaGroups(items);
        const haNote =
          groups.length < items.length ? ` (${groups.length} link targets, HA merged)` : "";
        toast.success(
          `Connected — found ${items.length} device(s) from Central${haNote} across ${tenants.length} tenant(s).`,
        );
      } else {
        toast.success("Credentials validated but no tenants found.");
      }
    } catch (e) {
      setCentralValidated(false);
      toast.error(e instanceof Error ? e.message : "Could not connect to Sophos Central");
    } finally {
      setCentralBusy(false);
    }
  }, [centralCreds.clientId, centralCreds.clientSecret]);

  const linkUploadToCentral = useCallback(
    (fileId: string, optionValue: string) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== fileId) return f;
          if (optionValue === CENTRAL_MATCH_NONE) {
            return { ...f, serialNumber: undefined };
          }
          const g = findGuestHaGroupBySelectValue(guestFirewallGroups, optionValue);
          if (!g) return f;
          const fw = g.primary;
          const newLabel = (fw.hostname || fw.name || "").trim();
          return {
            ...f,
            serialNumber: fw.serialNumber,
            label: newLabel || f.label,
          };
        }),
      );
    },
    [guestFirewallGroups],
  );

  const centralUploadMatcher = useMemo(() => {
    if (!centralValidated || guestFirewallGroups.length === 0 || files.length === 0) return null;
    return (
      <div
        className="rounded-lg border border-dashed border-brand-accent/25 dark:border-[#00EDFF]/20 bg-muted/15 p-3 space-y-3"
        data-tour="hc-central-match"
      >
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">
            Link each upload to a Central firewall.
          </span>{" "}
          HA pairs with the same hostname are grouped like the MSP dashboard. Entities XML usually
          has no serial — pick the row so tabs and saved checks use the right name. If you choose an{" "}
          <span className="text-foreground font-medium">HA</span> row, the{" "}
          <span className="text-foreground font-medium">Resilience › High Availability</span>{" "}
          best-practice check can be satisfied from Central when the export has no HA section.
        </p>
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="space-y-1">
              <Label
                className="text-[10px] text-muted-foreground font-normal truncate block"
                title={f.fileName}
              >
                {f.fileName}
              </Label>
              <Select
                value={guestFirewallMatchValueForFile(f, guestFirewallGroups)}
                onValueChange={(v) => linkUploadToCentral(f.id, v)}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg font-normal">
                  <SelectValue placeholder="Select Central firewall…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CENTRAL_MATCH_NONE}>Not linked</SelectItem>
                  {guestFirewallGroups.map((g) => {
                    const all = [g.primary, ...g.peers];
                    const serials = all
                      .map((x) => x.serialNumber)
                      .filter(Boolean)
                      .join(" / ");
                    const line = [getFirewallDisplayName(g.primary), serials || undefined]
                      .filter(Boolean)
                      .join(" — ");
                    return (
                      <SelectItem
                        key={guestHaGroupSelectValue(g)}
                        value={guestHaGroupSelectValue(g)}
                      >
                        <span className="flex items-center gap-2 flex-wrap">
                          <span>{line}</span>
                          {g.isHA && (
                            <Badge
                              variant="secondary"
                              className="text-[8px] h-5 px-1.5 font-bold bg-[#5A00FF]/15 text-[#5A00FF] dark:text-[#B529F7] border-0"
                            >
                              HA{g.peers.length > 0 ? ` (${1 + g.peers.length} nodes)` : ""}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    );
  }, [centralValidated, guestFirewallGroups, files, linkUploadToCentral]);

  const resetAll = useCallback(() => {
    setFiles([]);
    setAnalysisResults({});
    setActiveStep("landing");
    setCentralValidated(false);
    setTenantOptions([]);
    setFirewallOptions([]);
    setGuestFirewallLicenseItems([]);
    setCentralCreds({ clientId: "", clientSecret: "", tenantId: "" });
    centralFromUploadRef.current = false;
    setDpiExemptZones([]);
    setDpiExemptNetworks([]);
    setWebFilterComplianceMode("strict");
    setWebFilterExemptRuleNames([]);
    setSeMdrThreatFeedsAck(false);
    setSeNdrEssentialsAck(false);
    setSeExcludeSecurityHeartbeat(false);
    setReplayCentralLinked(false);
    setRestoredHaLabels(null);
    setCustomerName("");
    setLicence({ tier: "xstream", modules: [] });
  }, []);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);
  const [centralApiHelpOpen, setCentralApiHelpOpen] = useState(false);

  const centralFromUploadRef = useRef(false);

  useEffect(() => {
    const syncHash = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash === "#central-api-help") {
        setCentralApiHelpOpen(true);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const key = "firecomply-hc-tour-seen";
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    const timer = setTimeout(() => startHealthCheckTour(), 800);
    return () => clearTimeout(timer);
  }, []);

  const saveHealthCheck = useCallback(async () => {
    if (!seAuth.seProfile) return;
    const entries = Object.entries(analysisResults);
    if (entries.length === 0) return;

    setSavingCheck(true);
    try {
      const allFindings = entries.flatMap(([, ar]) => ar.findings ?? []);
      const manualOverrides = loadSeHealthCheckBpOverrides();
      const scores = entries.map(([label, ar]) => {
        const centralAuto = seCentralAutoForLabel(
          centralLinkedForAnalysis,
          label,
          seCentralHaLabels,
        );
        const bp = computeSophosBPScore(
          ar,
          licence,
          manualOverrides,
          centralAuto,
          seThreatResponseAck,
          seExcludedBpChecks,
        );
        return { label, score: bp.overall, grade: bp.grade };
      });
      const avgScore = Math.round(scores.reduce((s, e) => s + e.score, 0) / scores.length);
      const avgGrade: string =
        avgScore >= 90
          ? "A"
          : avgScore >= 75
            ? "B"
            : avgScore >= 60
              ? "C"
              : avgScore >= 40
                ? "D"
                : "F";

      const snapshot = buildSeHealthCheckSnapshotV1({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        preparedFor: preparedFor.trim() || undefined,
        files,
        licence,
        dpiExemptZones,
        dpiExemptNetworks,
        webFilterComplianceMode,
        webFilterExemptRuleNames,
        seMdrThreatFeedsAck,
        seNdrEssentialsAck,
        seDnsProtectionAck,
        seExcludeSecurityHeartbeat,
        replayCentralLinked: centralLinkedForAnalysis,
        seCentralHaLabels,
        manualBpOverrideIds: [...manualOverrides],
        findingNotes: Object.keys(findingNotes).length > 0 ? findingNotes : undefined,
      });

      const serialNumbers = files
        .map((f) => f.serialNumber)
        .filter(Boolean)
        .sort() as string[];

      const payload = {
        se_user_id: seAuth.seProfile.id,
        customer_name: customerName.trim() || null,
        overall_score: avgScore,
        overall_grade: avgGrade,
        findings_count: allFindings.length,
        firewall_count: files.length,
        team_id: activeTeamId ?? null,
        serial_numbers: serialNumbers,
        summary_json: {
          scores,
          topFindings: allFindings.slice(0, 10).map((f) => f.title ?? f.id),
          snapshot,
        },
      } as Record<string, unknown>;

      const STALE_MS = 7 * 24 * 60 * 60 * 1000;

      if (savedCheckId) {
        const { error } = await supabase
          .from("se_health_checks")
          .update({ ...payload, checked_at: new Date().toISOString() })
          .eq("id", savedCheckId);
        if (error) throw error;
        setHistoryRefreshKey((k) => k + 1);
        toast.success("Health check updated.");
      } else {
        let matchId: string | null = null;

        if (customerName.trim()) {
          const { data: candidates } = await supabase
            .from("se_health_checks")
            .select("id, checked_at, serial_numbers")
            .eq("se_user_id", seAuth.seProfile.id)
            .eq("customer_name", customerName.trim())
            .order("checked_at", { ascending: false })
            .limit(20);

          if (candidates?.length) {
            const match = candidates.find((row) => {
              const age = Date.now() - new Date(row.checked_at as string).getTime();
              if (age > STALE_MS) return false;
              const savedSerials = ((row.serial_numbers as string[]) ?? []).slice().sort();
              return JSON.stringify(savedSerials) === JSON.stringify(serialNumbers);
            });
            matchId = match?.id as string | null;
          }
        }

        if (matchId) {
          const { error } = await supabase
            .from("se_health_checks")
            .update({ ...payload, checked_at: new Date().toISOString() })
            .eq("id", matchId);
          if (error) throw error;
          setSavedCheckId(matchId);
          setHistoryRefreshKey((k) => k + 1);
          toast.success("Health check updated.");
        } else {
          const { data: insertedRow, error } = await supabase
            .from("se_health_checks")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          if (insertedRow) setSavedCheckId((insertedRow as { id: string }).id);
          setShareToken(null);
          setShareExpiry(null);
          setHistoryRefreshKey((k) => k + 1);
          toast.success("Health check saved.");
        }
      }
    } catch (err: unknown) {
      console.error("[health-check] save failed", err);
      const e = err as Record<string, unknown>;
      const msg = e?.message || e?.error || (typeof err === "string" ? err : JSON.stringify(err));
      toast.error("Could not save health check — " + msg);
    } finally {
      setSavingCheck(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    seAuth.seProfile,
    analysisResults,
    licence,
    customerName,
    customerEmail,
    preparedFor,
    files,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludeSecurityHeartbeat,
    bpOverrideRevision,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    centralLinkedForAnalysis,
    activeTeamId,
    savedCheckId,
  ]);

  const exportSummaryJson = useCallback(() => {
    const missing: string[] = [];
    if (!customerName.trim()) missing.push("Customer Name");
    if (!customerEmail.trim()) missing.push("Customer Email");
    if (!preparedFor.trim()) missing.push("Prepared For");
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    void saveHealthCheck();
    const manualOverrides = loadSeHealthCheckBpOverrides();
    const bp: Record<string, SophosBPScore> = {};
    for (const [label, ar] of Object.entries(analysisResults)) {
      const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
      bp[label] = computeSophosBPScore(
        ar,
        licence,
        manualOverrides,
        centralAuto,
        seThreatResponseAck,
        seExcludedBpChecks,
      );
    }
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            licence,
            centralValidated: centralLinkedForAnalysis,
            seAckMdrThreatFeeds: seMdrThreatFeedsAck,
            seAckNdrEssentials: seNdrEssentialsAck,
            seAckDnsProtection: seDnsProtectionAck,
            seExcludeSecurityHeartbeat,
            analysisResults,
            bestPracticeScores: bp,
            baseline: baselineResults,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sophos-firewall-health-check-summary.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [
    analysisResults,
    baselineResults,
    licence,
    seCentralHaLabels,
    seThreatResponseAck,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludedBpChecks,
    seExcludeSecurityHeartbeat,
    centralLinkedForAnalysis,
    customerName,
    customerEmail,
    preparedFor,
    saveHealthCheck,
  ]);

  const exportFindingsCsv = useCallback(() => {
    const missing: string[] = [];
    if (!customerName.trim()) missing.push("Customer Name");
    if (!customerEmail.trim()) missing.push("Customer Email");
    if (!preparedFor.trim()) missing.push("Prepared For");
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    void saveHealthCheck();

    const manualOverrides = loadSeHealthCheckBpOverrides();
    const csvRows: string[][] = [
      ["Finding", "Category", "Severity", "Status", "Recommendation", "SE Note"],
    ];

    for (const [label, ar] of Object.entries(analysisResults)) {
      const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
      const bp = computeSophosBPScore(
        ar,
        licence,
        manualOverrides,
        centralAuto,
        seThreatResponseAck,
        seExcludedBpChecks,
      );
      for (const r of bp.results) {
        csvRows.push([
          r.check.title,
          r.check.category,
          r.status === "fail"
            ? "Fail"
            : r.status === "pass"
              ? "Pass"
              : r.status === "warn"
                ? "Warning"
                : "N/A",
          r.manualOverride
            ? "Manual Pass"
            : r.status === "fail"
              ? "Fail"
              : r.status === "pass"
                ? "Pass"
                : r.status === "warn"
                  ? "Warning"
                  : "N/A",
          r.check.recommendation ?? "",
          findingNotes[r.check.id] ?? "",
        ]);
      }

      for (const f of ar.findings ?? []) {
        csvRows.push([f.title, f.section, f.severity, f.severity, f.remediation ?? "", ""]);
      }
    }

    const csvContent = csvRows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sophos-health-check-findings-${customerName.trim().replace(/\s+/g, "-").toLowerCase() || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Findings CSV downloaded.");
  }, [
    analysisResults,
    licence,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    centralLinkedForAnalysis,
    customerName,
    customerEmail,
    preparedFor,
    saveHealthCheck,
    findingNotes,
  ]);

  const handleDownloadHealthCheckPdf = useCallback(async () => {
    const missing = validateRequiredFields({ customerName, customerEmail, preparedFor });
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    void saveHealthCheck();
    const { reportParams, branding, labels } = buildHealthCheckReportParams({
      files,
      analysisResults,
      baselineResults,
      licence,
      customerName,
      preparedFor,
      preparedBy: effectivePreparedBy,
      dpiExemptZones,
      dpiExemptNetworks,
      webFilterComplianceMode,
      webFilterExemptRuleNames,
      seAckMdrThreatFeeds: seMdrThreatFeedsAck,
      seAckNdrEssentials: seNdrEssentialsAck,
      seAckDnsProtection: seDnsProtectionAck,
      seExcludeSecurityHeartbeat,
      centralValidated: centralLinkedForAnalysis,
      seCentralHaLabels,
      seThreatResponseAck,
      seExcludedBpChecks,
      seNotes,
    });
    if (labels.length === 0) {
      toast.error("No analysed configurations to include in the report.");
      return;
    }
    setPdfBusy(true);
    try {
      const { runHealthCheckPdfDownload } = await import("@/lib/health-check-pdf-download-v2");
      const pdfFilename = await runHealthCheckPdfDownload({
        reportParams,
        branding,
        filenameCustomerPart: customerName,
      });
      toast.success(`Downloaded ${pdfFilename}`);
    } catch (e) {
      console.warn("[health-check] pdf download failed", e);
      toast.error(e instanceof Error ? e.message : "Could not generate PDF — try again.");
    } finally {
      setPdfBusy(false);
    }
  }, [
    files,
    analysisResults,
    baselineResults,
    licence,
    customerName,
    preparedFor,
    effectivePreparedBy,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludeSecurityHeartbeat,
    centralLinkedForAnalysis,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    seNotes,
    customerEmail,
    saveHealthCheck,
  ]);

  const handleDownloadHealthCheckHtml = useCallback(async () => {
    const missing = validateRequiredFields({ customerName, customerEmail, preparedFor });
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    void saveHealthCheck();
    const { reportParams, branding, labels } = buildHealthCheckReportParams({
      files,
      analysisResults,
      baselineResults,
      licence,
      customerName,
      preparedFor,
      preparedBy: effectivePreparedBy,
      dpiExemptZones,
      dpiExemptNetworks,
      webFilterComplianceMode,
      webFilterExemptRuleNames,
      seAckMdrThreatFeeds: seMdrThreatFeedsAck,
      seAckNdrEssentials: seNdrEssentialsAck,
      seAckDnsProtection: seDnsProtectionAck,
      seExcludeSecurityHeartbeat,
      centralValidated: centralLinkedForAnalysis,
      seCentralHaLabels,
      seThreatResponseAck,
      seExcludedBpChecks,
      seNotes,
    });
    if (labels.length === 0) {
      toast.error("No analysed configurations to include in the report.");
      return;
    }
    try {
      const { runHealthCheckHtmlDownload } = await import("@/lib/health-check-pdf-download-v2");
      const htmlFilename = await runHealthCheckHtmlDownload({
        reportParams,
        branding,
        filenameCustomerPart: customerName,
      });
      toast.success(`Downloaded ${htmlFilename}`);
    } catch (e) {
      console.warn("[health-check] html download failed", e);
      toast.error(e instanceof Error ? e.message : "Could not generate HTML — try again.");
    }
  }, [
    files,
    analysisResults,
    baselineResults,
    licence,
    customerName,
    preparedFor,
    effectivePreparedBy,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludeSecurityHeartbeat,
    centralLinkedForAnalysis,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    seNotes,
    customerEmail,
    saveHealthCheck,
  ]);

  const handleDownloadHealthCheckZip = useCallback(async () => {
    const missing = validateRequiredFields({ customerName, customerEmail, preparedFor });
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    void saveHealthCheck();
    const { reportParams, branding, labels } = buildHealthCheckReportParams({
      files,
      analysisResults,
      baselineResults,
      licence,
      customerName,
      preparedFor,
      preparedBy: effectivePreparedBy,
      dpiExemptZones,
      dpiExemptNetworks,
      webFilterComplianceMode,
      webFilterExemptRuleNames,
      seAckMdrThreatFeeds: seMdrThreatFeedsAck,
      seAckNdrEssentials: seNdrEssentialsAck,
      seAckDnsProtection: seDnsProtectionAck,
      seExcludeSecurityHeartbeat,
      centralValidated: centralLinkedForAnalysis,
      seCentralHaLabels,
      seThreatResponseAck,
      seExcludedBpChecks,
      seNotes,
    });
    if (labels.length === 0) {
      toast.error("No analysed configurations to include in the report.");
      return;
    }
    setPdfBusy(true);
    try {
      const { runHealthCheckZipDownload } = await import("@/lib/health-check-pdf-download-v2");
      const zipFilename = await runHealthCheckZipDownload({
        reportParams,
        branding,
        filenameCustomerPart: customerName,
      });
      toast.success(`Downloaded ${zipFilename}`);
    } catch (e) {
      console.warn("[health-check] zip download failed", e);
      toast.error(e instanceof Error ? e.message : "Could not generate ZIP — try again.");
    } finally {
      setPdfBusy(false);
    }
  }, [
    files,
    analysisResults,
    baselineResults,
    licence,
    customerName,
    preparedFor,
    effectivePreparedBy,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludeSecurityHeartbeat,
    centralLinkedForAnalysis,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    seNotes,
    customerEmail,
    saveHealthCheck,
  ]);

  const handleSendReportToCustomer = useCallback(async () => {
    const missing = validateRequiredFields({ customerName, customerEmail, preparedFor });
    if (missing.length) {
      toast.error(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    void saveHealthCheck();
    if (!files.length || Object.keys(analysisResults).length === 0) {
      toast.error("Run a health check before sending.");
      return;
    }
    setSendingReport(true);
    try {
      const { buildSeHealthCheckPdfBlob } = await import("@/lib/se-health-check-pdfmake-v2");
      const { buildSeHealthCheckBrowserHtmlDocument } =
        await import("@/lib/se-health-check-browser-html-v2");
      const { sanitizePdfFilenamePart } = await import("@/lib/pdf-utils");

      const { reportParams } = buildHealthCheckReportParams({
        files,
        analysisResults,
        baselineResults,
        licence,
        customerName,
        preparedFor,
        preparedBy: effectivePreparedBy,
        dpiExemptZones,
        dpiExemptNetworks,
        webFilterComplianceMode,
        webFilterExemptRuleNames,
        seAckMdrThreatFeeds: seMdrThreatFeedsAck,
        seAckNdrEssentials: seNdrEssentialsAck,
        seAckDnsProtection: seDnsProtectionAck,
        seExcludeSecurityHeartbeat,
        centralValidated: centralLinkedForAnalysis,
        seCentralHaLabels,
        seThreatResponseAck,
        seExcludedBpChecks,
        seNotes,
      });

      const [pdfBlob, html] = await Promise.all([
        buildSeHealthCheckPdfBlob(reportParams),
        Promise.resolve(buildSeHealthCheckBrowserHtmlDocument(reportParams)),
      ]);

      const pdfBuf = await pdfBlob.arrayBuffer();
      const pdfBytes = new Uint8Array(pdfBuf);
      let pdfBinary = "";
      for (let i = 0; i < pdfBytes.length; i += 8192) {
        pdfBinary += String.fromCharCode(...pdfBytes.subarray(i, i + 8192));
      }
      const pdfBase64 = btoa(pdfBinary);
      const htmlBase64 = btoa(unescape(encodeURIComponent(html)));

      const part = sanitizePdfFilenamePart(customerName);
      const date = new Date().toISOString().slice(0, 10);
      const filenameBase = `Sophos-Firewall-Health-Check-${part}-${date}`;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/send-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          customer_email: customerEmail.trim(),
          customer_name: customerName.trim() || undefined,
          prepared_for: preparedFor.trim() || undefined,
          prepared_by: effectivePreparedBy,
          se_title: seAuth.seProfile?.seTitle || undefined,
          pdf_base64: pdfBase64,
          html_base64: htmlBase64,
          filename_base: filenameBase,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Send failed");
      }
      toast.success(`Report sent to ${customerEmail.trim()}`);
    } catch (e) {
      console.warn("[health-check] send report failed", e);
      toast.error(e instanceof Error ? e.message : "Could not send report.");
    } finally {
      setSendingReport(false);
    }
  }, [
    files,
    analysisResults,
    baselineResults,
    licence,
    customerName,
    customerEmail,
    preparedFor,
    effectivePreparedBy,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludeSecurityHeartbeat,
    centralLinkedForAnalysis,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    seNotes,
    saveHealthCheck,
    seAuth.seProfile,
  ]);

  const restoreFromSavedSnapshot = useCallback(
    (snapshot: SeHealthCheckSnapshotV1, meta?: { checkId: string; followupAt?: string | null }) => {
      try {
        localStorage.setItem(
          SE_HEALTH_CHECK_BP_OVERRIDES_KEY,
          JSON.stringify(snapshot.manualBpOverrideIds),
        );
      } catch {
        /* ignore */
      }
      setCustomerName(snapshot.customerName);
      setCustomerEmail(snapshot.customerEmail ?? "");
      setPreparedFor(snapshot.preparedFor ?? "");
      setLicence(snapshot.licence);
      setDpiExemptZones(snapshot.dpiExemptZones);
      setDpiExemptNetworks(snapshot.dpiExemptNetworks);
      setWebFilterComplianceMode(snapshot.webFilterComplianceMode);
      setWebFilterExemptRuleNames(snapshot.webFilterExemptRuleNames);
      setSeMdrThreatFeedsAck(snapshot.seMdrThreatFeedsAck);
      setSeNdrEssentialsAck(snapshot.seNdrEssentialsAck);
      setSeExcludeSecurityHeartbeat(snapshot.seExcludeSecurityHeartbeat);
      setReplayCentralLinked(snapshot.replayCentralLinked);
      setRestoredHaLabels(new Set(snapshot.seCentralHaLabels));
      setCentralValidated(false);
      setFiles(snapshotFilesToParsedFiles(snapshot.files));
      setActiveStep("results");
      setBpOverrideRevision((n) => n + 1);
      setFindingNotes(snapshot.findingNotes ?? {});
      if (meta?.checkId) {
        setSavedCheckId(meta.checkId);
        setFollowupAt(meta.followupAt ?? null);
      }
      toast.success("Opened saved health check.");
    },
    [],
  );

  const hasParsedConfigs = files.some((f) => Object.keys(f.extractedData ?? {}).length > 0);

  return (
    <div
      data-tour="health-check"
      className="min-h-screen flex flex-col bg-background text-foreground"
    >
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-accent/10 dark:bg-brand-accent/15 flex items-center justify-center shrink-0">
            <Shield className="h-6 w-6 text-brand-accent" />
          </div>
          <div className="mr-auto shrink-0">
            <h1 className="text-base sm:text-lg font-display font-bold tracking-tight">
              Sophos Firewall Health Check
            </h1>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              Sales Engineer quick check — Sophos best practices (not compliance frameworks)
            </p>
          </div>
          {seAuth.seProfile && teams.length > 0 && <TeamSwitcher />}
          {seAuth.seProfile && (
            <span className="text-xs text-muted-foreground hidden lg:inline shrink-0">
              {seAuth.seProfile.email}
            </span>
          )}
          {seAuth.seProfile && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg gap-1.5 shrink-0"
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Tours</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => startHealthCheckTour()}>
                    <Upload className="h-3.5 w-3.5 mr-2 shrink-0" /> Getting Started
                  </DropdownMenuItem>
                  {activeStep === "results" && (
                    <DropdownMenuItem onClick={() => startHealthCheckResultsTour()}>
                      <FileText className="h-3.5 w-3.5 mr-2 shrink-0" /> Results & Export
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg gap-1.5 shrink-0"
                data-tour="hc-management"
                onClick={() => setSeManagementOpen(true)}
              >
                <PanelRight className="h-4 w-4" />
                <span className="hidden sm:inline">Management</span>
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg shrink-0"
            onClick={seAuth.signOut}
          >
            Sign out
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg gap-1.5 shrink-0" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">FireComply app</span>
            </Link>
          </Button>
        </div>
      </header>

      <main id="main-content" className="flex-1 mx-auto max-w-5xl w-full px-4 py-8 space-y-8">
        {(activeStep === "landing" || activeStep === "analyzing") && (
          <section className="space-y-6" aria-label="Data sources">
            {activeStep === "analyzing" && (
              <div
                className="rounded-xl border border-brand-accent/30 bg-[#2006F7]/[0.04] dark:bg-brand-accent/[0.08] p-4 text-center space-y-1"
                role="status"
                aria-live="polite"
              >
                <p className="font-semibold text-brand-accent">Analysing configuration…</p>
                <p className="text-sm text-muted-foreground">
                  Extracting sections and running deterministic checks.
                </p>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <Card
                data-tour="hc-upload"
                className="rounded-xl border border-brand-accent/30 bg-card md:col-span-1 shadow-sm"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4 text-brand-accent" />
                      HTML config upload
                    </CardTitle>
                    <Badge className="bg-[#00F2B3]/15 text-[#00F2B3] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3] border-0">
                      Active
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Export HTML (or entities XML) from the firewall and drop it here.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload files={uploadedForPicker} onFilesChange={handleFilesChange} />
                  <div className="mt-3 flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={() => setConfigUploadDialogOpen(true)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Request Config Upload from Customer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      data-tour="hc-upload-requests"
                      onClick={() => setConfigUploadRequestsOpen(true)}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Requests
                      {configUploadRequests.filter((r) => r.status === "uploaded").length > 0 && (
                        <span className="ml-auto text-[10px] font-semibold text-[#00F2B3]">
                          {configUploadRequests.filter((r) => r.status === "uploaded").length} ready
                        </span>
                      )}
                      {configUploadRequests.filter((r) => r.status === "pending").length > 0 &&
                        configUploadRequests.filter((r) => r.status === "uploaded").length ===
                          0 && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {configUploadRequests.filter((r) => r.status === "pending").length}{" "}
                            pending
                          </span>
                        )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs"
                      onClick={() => {
                        setRecheckQuery("");
                        setRecheckResults([]);
                        setRecheckSearchOpen(true);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Request Re-Check
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card
                data-tour="hc-central"
                className="rounded-xl border border-border bg-card md:col-span-1 shadow-sm"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-brand-accent" />
                      Sophos Central API
                    </CardTitle>
                    <Badge className="bg-[#00F2B3]/15 text-[#00F2B3] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3] border-0">
                      Active
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Enter the customer&apos;s API credentials to discover their firewalls. Used for
                    this session only — never stored. Step-by-step setup:{" "}
                    <a
                      href="#central-api-help"
                      className="text-brand-accent font-medium underline underline-offset-2"
                    >
                      Help: Central API
                    </a>{" "}
                    at the bottom of the page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    className="rounded-lg font-mono text-xs h-9"
                    placeholder="Client ID"
                    autoComplete="off"
                    value={centralCreds.clientId}
                    onChange={(e) => {
                      setCentralValidated(false);
                      setCentralCreds((c) => ({ ...c, clientId: e.target.value }));
                    }}
                  />
                  <Input
                    className="rounded-lg font-mono text-xs h-9"
                    placeholder="Client Secret"
                    type="password"
                    autoComplete="off"
                    value={centralCreds.clientSecret}
                    onChange={(e) => {
                      setCentralValidated(false);
                      setCentralCreds((c) => ({ ...c, clientSecret: e.target.value }));
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-lg w-full bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background dark:hover:bg-[#00EDFF]/90"
                    disabled={
                      centralBusy ||
                      !centralCreds.clientId.trim() ||
                      !centralCreds.clientSecret.trim()
                    }
                    onClick={connectCentral}
                  >
                    {centralBusy ? "Connecting…" : "Connect & Discover Firewalls"}
                  </Button>
                  {centralValidated && (
                    <p className="text-[11px] flex items-center gap-1 text-[#00F2B3] dark:text-[#00F2B3]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Connected (session only — credentials not stored)
                    </p>
                  )}
                  {guestFirewallGroups.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/20 p-2 max-h-32 overflow-y-auto text-[11px] space-y-1">
                      {guestFirewallGroups.map((g) => {
                        const all = [g.primary, ...g.peers];
                        const serials = all
                          .map((x) => x.serialNumber)
                          .filter(Boolean)
                          .join(" / ");
                        return (
                          <div
                            key={guestHaGroupSelectValue(g)}
                            className="flex justify-between gap-2 items-center"
                          >
                            <span className="font-medium truncate flex items-center gap-1.5 min-w-0">
                              {getFirewallDisplayName(g.primary)}
                              {g.isHA && (
                                <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-[#5A00FF]/15 text-[#5A00FF] dark:text-[#B529F7] shrink-0">
                                  HA
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground font-mono shrink-0 text-right">
                              {serials || "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {centralUploadMatcher}
                </CardContent>
              </Card>

              <Card
                data-tour="hc-proxy"
                className="rounded-xl border border-dashed border-border bg-muted/10 md:col-span-1 opacity-80"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      API proxy
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      Coming Soon
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Managed proxy for customer Central access — <strong>not available yet</strong>.
                    Use <strong>Sophos Central API</strong> in the middle column; credential steps
                    are in{" "}
                    <a
                      href="#central-api-help"
                      className="text-brand-accent underline underline-offset-2 font-medium"
                    >
                      Help: Central API
                    </a>{" "}
                    below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground cursor-not-allowed opacity-70"
                    aria-label="API proxy (coming soon)"
                  >
                    <Lock className="h-6 w-6 mx-auto mb-2 opacity-50" aria-hidden />
                    Locked — API proxy coming soon
                  </button>
                </CardContent>
              </Card>
            </div>

            {hasParsedConfigs && (
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  type="button"
                  className="rounded-xl bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
                  onClick={() => setActiveStep("results")}
                >
                  View health check results
                </Button>
              </div>
            )}
          </section>
        )}

        {activeStep === "results" && hasParsedConfigs && (
          <section className="space-y-6" aria-label="Health check results">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-brand-accent" />
                  Results
                </h2>
                <p className="text-sm text-muted-foreground">
                  {files.length} firewall file{files.length === 1 ? "" : "s"} analysed
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div
                  className="flex rounded-lg border border-border overflow-hidden"
                  data-tour="hc-licence-toggle"
                  title={
                    licenceLockedByCentral
                      ? "Licence tier is auto-detected from Sophos Central (matched firewall serial)."
                      : "Licence tier for Sophos best practice scoring (same as Sophos Licence Selection below)."
                  }
                >
                  {(["standard", "xstream"] as const).map((tier) => (
                    <Button
                      key={tier}
                      type="button"
                      variant={licence.tier === tier ? "default" : "ghost"}
                      size="sm"
                      className="rounded-none px-3 text-xs capitalize"
                      disabled={licenceLockedByCentral}
                      onClick={() => setLicence({ tier, modules: [] })}
                    >
                      {tier}
                    </Button>
                  ))}
                </div>
                {licenceLockedByCentral && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-[#00F2B3] dark:text-[#00F2B3] whitespace-nowrap">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden />
                    From Central
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setActiveStep("landing")}
                >
                  Add configurations
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-lg"
                  onClick={resetAll}
                >
                  New check
                </Button>
              </div>
            </div>

            <div
              className="rounded-xl border border-border bg-card px-4 py-3 space-y-3"
              data-tour="hc-customer-details"
            >
              <div className="space-y-1">
                <Label
                  htmlFor="hc-customer-top"
                  className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Customer name
                </Label>
                <Input
                  id="hc-customer-top"
                  className="rounded-lg text-sm h-10"
                  placeholder="Organisation or site (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="hc-customer-email-top"
                  className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Customer email
                </Label>
                <Input
                  id="hc-customer-email-top"
                  type="email"
                  className="rounded-lg text-sm h-10"
                  placeholder="customer@example.com (optional)"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="hc-prepared-for"
                  className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Prepared for
                </Label>
                <Input
                  id="hc-prepared-for"
                  className="rounded-lg text-sm h-10"
                  placeholder="Stakeholder name or team (optional)"
                  value={preparedFor}
                  onChange={(e) => setPreparedFor(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Shown on the report cover, PDF, HTML, and saved health checks.
              </p>
            </div>

            {replayCentralLinked && !centralValidated && (
              <p className="rounded-lg border border-brand-accent/20 bg-brand-accent/5 dark:bg-[#00EDFF]/10 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Opened from saved history.</span>{" "}
                Best-practice scoring uses the saved Central-linked state. Connect to Sophos Central
                again if you need live discovery or licensing API data.
              </p>
            )}

            {!centralValidated && (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                  <Wifi className="h-4 w-4 text-brand-accent" />
                  Sophos Central
                </div>
                <Input
                  className="rounded-lg font-mono text-xs h-9 flex-1 min-w-[140px]"
                  placeholder="Client ID"
                  autoComplete="off"
                  value={centralCreds.clientId}
                  onChange={(e) => setCentralCreds((c) => ({ ...c, clientId: e.target.value }))}
                />
                <Input
                  className="rounded-lg font-mono text-xs h-9 flex-1 min-w-[140px]"
                  placeholder="Client Secret"
                  type="password"
                  autoComplete="off"
                  value={centralCreds.clientSecret}
                  onChange={(e) => setCentralCreds((c) => ({ ...c, clientSecret: e.target.value }))}
                />
                <Button
                  type="button"
                  size="sm"
                  className="rounded-lg shrink-0 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background dark:hover:bg-[#00EDFF]/90"
                  disabled={
                    centralBusy ||
                    !centralCreds.clientId.trim() ||
                    !centralCreds.clientSecret.trim()
                  }
                  onClick={connectCentral}
                >
                  {centralBusy ? "Connecting…" : "Connect"}
                </Button>
              </div>
            )}
            {centralValidated && (
              <p className="text-[11px] flex items-center gap-1 text-[#00F2B3] dark:text-[#00F2B3]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sophos Central connected — {firewallOptions.length} device(s) from Central
                {guestFirewallGroups.length < firewallOptions.length
                  ? ` — ${guestFirewallGroups.length} link targets (HA merged by hostname)`
                  : ""}
              </p>
            )}
            {centralUploadMatcher}

            <SeHeartbeatScopeBar
              excludeHeartbeatCheck={seExcludeSecurityHeartbeat}
              onExcludeChange={setSeExcludeSecurityHeartbeat}
            />

            <SeThreatResponseAckBar
              mdrAcknowledged={seMdrThreatFeedsAck}
              ndrAcknowledged={seNdrEssentialsAck}
              onMdrChange={setSeMdrThreatFeedsAck}
              onNdrChange={setSeNdrEssentialsAck}
            />

            <SeDnsProtectionAckBar
              acknowledged={seDnsProtectionAck}
              onChange={setSeDnsProtectionAck}
            />

            {(() => {
              const allZones = [
                ...new Set(
                  Object.values(analysisResults).flatMap(
                    (r) => r.inspectionPosture.allWanSourceZones,
                  ),
                ),
              ];
              const allNets = [
                ...new Set(
                  Object.values(analysisResults).flatMap(
                    (r) => r.inspectionPosture.allWanSourceNetworks,
                  ),
                ),
              ];
              const missingWf = [
                ...new Set(
                  Object.values(analysisResults).flatMap(
                    (r) => r.inspectionPosture.wanMissingWebFilterRuleNames,
                  ),
                ),
              ];
              const hasWanWebRules = Object.values(analysisResults).some(
                (r) => r.inspectionPosture.wanWebServiceRuleNames.length > 0,
              );
              if (
                allZones.length === 0 &&
                allNets.length === 0 &&
                missingWf.length === 0 &&
                !hasWanWebRules
              ) {
                return null;
              }
              return (
                <div className="space-y-3">
                  {(allZones.length > 0 || allNets.length > 0) && (
                    <DpiExclusionBar
                      detectedZones={allZones}
                      excludedZones={dpiExemptZones}
                      onZonesChange={setDpiExemptZones}
                      detectedNetworks={allNets}
                      excludedNetworks={dpiExemptNetworks}
                      onNetworksChange={setDpiExemptNetworks}
                    />
                  )}
                  {hasWanWebRules && (
                    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
                      <Label
                        htmlFor="hc-web-filter-compliance"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Web filter compliance
                      </Label>
                      <Select
                        value={webFilterComplianceMode}
                        onValueChange={(v) =>
                          setWebFilterComplianceMode(v as WebFilterComplianceMode)
                        }
                      >
                        <SelectTrigger
                          id="hc-web-filter-compliance"
                          className="max-w-xs rounded-lg h-9 text-sm"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strict">Strict</SelectItem>
                          <SelectItem value="informational">Informational</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Strict surfaces WAN web-filter gaps as stronger findings; Informational
                        lowers severity for scoped reviews.
                      </p>
                    </div>
                  )}
                  {missingWf.length > 0 && (
                    <WebFilterRuleExclusionBar
                      candidateRuleNames={missingWf}
                      exemptRuleNames={webFilterExemptRuleNames}
                      onChange={setWebFilterExemptRuleNames}
                    />
                  )}
                </div>
              );
            })()}

            <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                SE Engineer Notes
              </Label>
              <Textarea
                readOnly
                className="rounded-lg text-sm min-h-[120px] resize-y bg-muted/30 font-mono text-xs leading-relaxed"
                value={autoSeNotes}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="hc-se-notes-manual"
                  className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  Additional notes
                </Label>
                <Textarea
                  id="hc-se-notes-manual"
                  className="rounded-lg text-sm min-h-[60px] resize-y"
                  placeholder="Add any additional observations or recommendations (optional)"
                  value={seNotesManual}
                  onChange={(e) => setSeNotesManual(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Auto-generated from licence, BP score, findings, and exclusions. Updates when you
                change settings. Both sections are included in PDF and HTML reports.
              </p>
            </div>

            <div
              className="rounded-xl border border-border bg-card px-4 py-4 space-y-3"
              data-tour="hc-export"
            >
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Save &amp; export
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-lg bg-[#00F2B3] hover:bg-[#00F2B3]/90 text-white gap-1.5 w-fit"
                  disabled={savingCheck}
                  onClick={saveHealthCheck}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {savingCheck ? "Saving…" : "Save health check"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg gap-1.5 w-fit"
                  disabled={!savedCheckId || sharing}
                  onClick={() => setShareDialogOpen(true)}
                >
                  <Link2 className="h-4 w-4" />
                  {shareToken ? "Shared" : "Share report"}
                </Button>
              </div>
              {!exportFieldsReady && (
                <p className="text-xs text-amber-500">
                  Fill in Customer Name, Customer Email, and Prepared For to enable exports.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="rounded-lg gap-1.5 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
                  disabled={pdfBusy || !exportFieldsReady}
                  onClick={() => void handleDownloadHealthCheckZip()}
                >
                  {pdfBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {pdfBusy ? "Generating…" : "Download PDF + HTML"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5"
                  disabled={pdfBusy || !exportFieldsReady}
                  onClick={() => void handleDownloadHealthCheckPdf()}
                >
                  {pdfBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  PDF only
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5"
                  disabled={pdfBusy || !exportFieldsReady}
                  onClick={() => void handleDownloadHealthCheckHtml()}
                >
                  <FileText className="h-4 w-4" />
                  HTML only
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5"
                  disabled={!exportFieldsReady}
                  onClick={exportSummaryJson}
                >
                  <Download className="h-4 w-4" />
                  Summary JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5"
                  disabled={!exportFieldsReady}
                  onClick={exportFindingsCsv}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Findings CSV
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-lg gap-1.5 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
                  disabled={sendingReport || pdfBusy || !files.length || !exportFieldsReady}
                  onClick={() => void handleSendReportToCustomer()}
                >
                  {sendingReport ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sendingReport
                    ? "Sending…"
                    : customerEmail.trim()
                      ? `Send to ${customerEmail.trim()}`
                      : "Send to customer"}
                </Button>
              </div>

              {savedCheckId && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    Follow-up reminder
                  </p>
                  {followupAt ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {new Date(followupAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-muted-foreground"
                        disabled={settingFollowup}
                        onClick={() => void handleSetFollowup(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1"
                        disabled={settingFollowup}
                        onClick={() => void handleSetFollowup(3)}
                      >
                        3 months
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1"
                        disabled={settingFollowup}
                        onClick={() => void handleSetFollowup(6)}
                      >
                        6 months
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Share health check report</DialogTitle>
                  <DialogDescription>
                    Create a public link that anyone can use to view this health check report.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {!shareToken ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Link expires after</Label>
                        <Select
                          value={String(shareDays)}
                          onValueChange={(v) => setShareDays(Number(v))}
                        >
                          <SelectTrigger className="h-9 text-sm rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        className="w-full rounded-lg bg-[#00F2B3] hover:bg-[#00F2B3]/90 text-white gap-1.5"
                        disabled={sharing}
                        onClick={() => void handleShareHealthCheck()}
                      >
                        {sharing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        {sharing ? "Generating…" : "Create share link"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Share link</Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={shareUrl ?? ""}
                            className="text-xs font-mono h-9 rounded-lg"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 rounded-lg shrink-0"
                            onClick={() => {
                              if (shareUrl) {
                                void navigator.clipboard.writeText(shareUrl);
                                toast.success("Link copied to clipboard.");
                              }
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {shareExpiry && (
                        <p className="text-[11px] text-muted-foreground">
                          Expires{" "}
                          {new Date(shareExpiry).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-lg gap-1.5"
                          onClick={() => void handleRevokeShare()}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Revoke link
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Suspense
              fallback={
                <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  Loading Sophos best practice…
                </div>
              }
            >
              <div data-tour="hc-bp-results">
                <SophosBestPractice
                  analysisResults={analysisResults}
                  centralLicences={centralBpLicenceFlat}
                  overridesStorageKey={SE_HEALTH_CHECK_BP_OVERRIDES_KEY}
                  centralEnrichmentActive={centralLinkedForAnalysis}
                  onManualOverridesChange={() => setBpOverrideRevision((n) => n + 1)}
                  licence={licence}
                  onLicenceChange={setLicence}
                  centralHaConfirmedLabels={seCentralHaLabels}
                  seThreatResponseAck={seThreatResponseAck}
                  seExcludedBpChecks={seExcludedBpChecks}
                  findingNotes={findingNotes}
                  onFindingNoteChange={(checkId, note) =>
                    setFindingNotes((prev) => {
                      const next = { ...prev };
                      if (note) next[checkId] = note;
                      else delete next[checkId];
                      return next;
                    })
                  }
                />
              </div>
            </Suspense>

            <HealthCheckDashboard
              files={files}
              analysisResults={analysisResults}
              licence={licence}
              baselineResults={baselineResults}
              hideSophosBpCard
              seCentralSession={centralLinkedForAnalysis}
              seCentralHaLabels={seCentralHaLabels}
              bpOverrideRevision={bpOverrideRevision}
              seThreatResponseAck={seThreatResponseAck}
              seExcludedBpChecks={seExcludedBpChecks}
            />
          </section>
        )}

        {firewallOptions.length > 0 && <FirmwareEolWarnings firewalls={firewallOptions} />}

        {seAuth.seProfile && files.length > 0 && files.some((f) => f.serialNumber) && (
          <div data-tour="hc-score-trend">
            <SEScoreTrendChart
              serialNumbers={files.map((f) => f.serialNumber).filter(Boolean) as string[]}
              seProfileId={seAuth.seProfile.id}
              activeTeamId={activeTeamId}
            />
          </div>
        )}

        {seAuth.seProfile && (
          <div data-tour="hc-history">
            <SEHealthCheckHistory
              seProfileId={seAuth.seProfile.id}
              refreshTrigger={historyRefreshKey}
              preparedBy={effectivePreparedBy}
              onRestoreSnapshot={restoreFromSavedSnapshot}
              activeTeamId={activeTeamId}
              teams={teams}
            />
          </div>
        )}

        {seAuth.seProfile && activeTeamId && (
          <div data-tour="hc-team-dashboard">
            <TeamDashboard activeTeamId={activeTeamId} seProfileId={seAuth.seProfile.id} />
          </div>
        )}

        <Collapsible
          id="central-api-help"
          open={centralApiHelpOpen}
          onOpenChange={setCentralApiHelpOpen}
          className="rounded-xl border border-border bg-card shadow-sm scroll-mt-28"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 rounded-t-xl transition-colors [&[data-state=open]]:rounded-b-none">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <HelpCircle className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
              Help: Sophos Central API (optional)
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                centralApiHelpOpen && "rotate-180",
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-0 space-y-4 text-sm text-muted-foreground border-t border-border/80">
              <p className="pt-3 text-foreground/90">
                To run a fuller{" "}
                <strong className="text-foreground">Sophos Firewall Health Check</strong>, you can
                optionally connect to the customer&apos;s{" "}
                <strong className="text-foreground">Sophos Central</strong> tenant. That lets this
                tool list discovered firewalls for context alongside your uploaded HTML/XML exports.
                API credentials are <strong className="text-foreground">not stored</strong> — they
                stay in your browser for this session only and are used solely to call Central for
                discovery during this check.
              </p>
              <div>
                <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-2">
                  Create read-only API credentials (customer Central admin)
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Sign in to the customer&apos;s Sophos Central account.</li>
                  <li>
                    Go to <strong className="text-foreground">Global Settings</strong> →{" "}
                    <strong className="text-foreground">API Credentials Management</strong>.
                  </li>
                  <li>
                    Select <strong className="text-foreground">Add Credential</strong> and enter a
                    clear name and summary (e.g. &quot;SE health check — read only&quot;).
                  </li>
                  <li>
                    Choose the{" "}
                    <strong className="text-foreground">Service Principal Read Only</strong> role.
                  </li>
                  <li>
                    Click <strong className="text-foreground">Add</strong> to create the credential
                    and note the <strong className="text-foreground">Client ID</strong> and{" "}
                    <strong className="text-foreground">Client Secret</strong>.
                  </li>
                  <li>
                    Paste them into the{" "}
                    <strong className="text-foreground">Sophos Central API</strong> fields on this
                    page, then use{" "}
                    <strong className="text-foreground">Connect &amp; Discover Firewalls</strong>{" "}
                    (start screen) or <strong className="text-foreground">Connect</strong> (results
                    view).
                  </li>
                  <li>
                    After uploading configuration files, use{" "}
                    <strong className="text-foreground">
                      Link each upload to a Central firewall
                    </strong>{" "}
                    (entities XML often has no serial in the export — manual match is required).
                  </li>
                </ol>
              </div>
              <p>
                After you finish the health check, we recommend{" "}
                <strong className="text-foreground">removing the API credential</strong> in Sophos
                Central: open{" "}
                <strong className="text-foreground">API Credentials Management</strong>, find the
                credential, and use <strong className="text-foreground">Delete</strong>.
              </p>
              <p className="flex flex-wrap items-center gap-1.5">
                <span>Further reading:</span>
                <a
                  href="https://developer.sophos.com/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-accent font-medium hover:underline underline-offset-2"
                >
                  Sophos API getting started
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                <span className="text-muted-foreground">
                  (Central admin UI steps are under Global Settings.)
                </span>
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </main>

      <footer className="border-t border-border mt-auto py-6 text-center text-xs text-muted-foreground space-y-2">
        <p>Powered by Sophos FireComply</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-brand-accent hover:underline underline-offset-2"
        >
          <ExternalLink className="h-3 w-3" />
          Return to main app
        </Link>
      </footer>

      <SeHealthCheckManagementDrawer
        open={seManagementOpen}
        onClose={() => setSeManagementOpen(false)}
      />

      {/* Config Upload Request Dialog */}
      <Dialog open={configUploadDialogOpen} onOpenChange={setConfigUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {configUploadToken ? "Upload Link Created" : "Request Config Upload"}
            </DialogTitle>
            <DialogDescription>
              {configUploadToken
                ? "Share this link with your customer to receive their firewall configuration."
                : "Generate a secure link for your customer to upload their entities.xml file."}
            </DialogDescription>
          </DialogHeader>

          {!configUploadToken ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cu-customer-name">Customer name</Label>
                <Input
                  id="cu-customer-name"
                  placeholder="e.g. Acme Corp"
                  value={configUploadCustomerName}
                  onChange={(e) => setConfigUploadCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cu-contact-name">Contact name</Label>
                <Input
                  id="cu-contact-name"
                  placeholder="e.g. John Smith"
                  value={configUploadContactName}
                  onChange={(e) => setConfigUploadContactName(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  The person receiving the email — used in the greeting.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cu-customer-email">Customer email</Label>
                <Input
                  id="cu-customer-email"
                  type="email"
                  placeholder="customer@example.com"
                  value={configUploadCustomerEmail}
                  onChange={(e) => setConfigUploadCustomerEmail(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  If provided, the upload link will be emailed automatically.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Link expires in</Label>
                <Select
                  value={String(configUploadDays)}
                  onValueChange={(v) => setConfigUploadDays(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="w-full gap-2"
                disabled={configUploadCreating}
                onClick={handleCreateConfigUploadRequest}
              >
                {configUploadCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : configUploadCustomerEmail.trim() ? (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Send Upload Request
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Create Upload Link
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {configUploadEmailSent && (
                <div className="rounded-lg bg-[#00F2B3]/10 border border-[#00F2B3]/30 p-3 text-sm text-[#00F2B3] flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Email sent to {configUploadCustomerEmail}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Upload link</Label>
                <div className="flex items-center gap-2">
                  <Input value={configUploadUrl ?? ""} readOnly className="text-xs font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      if (configUploadUrl) {
                        navigator.clipboard.writeText(configUploadUrl);
                        toast.success("Link copied to clipboard");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={configUploadStatus === "uploaded" ? "default" : "secondary"}
                  className={cn(configUploadStatus === "uploaded" && "bg-[#00F2B3] text-white")}
                >
                  {configUploadStatus === "uploaded" ? "Config Uploaded" : "Waiting for customer…"}
                </Badge>
              </div>

              <div className="flex gap-2">
                {configUploadStatus === "uploaded" && (
                  <Button
                    type="button"
                    className="flex-1 gap-2 bg-[#00F2B3] hover:bg-[#00F2B3]/90"
                    disabled={configUploadLoading}
                    onClick={() =>
                      configUploadToken && handleLoadConfigFromUpload(configUploadToken)
                    }
                  >
                    {configUploadLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Load Config
                  </Button>
                )}
                {configUploadCustomerEmail.trim() && configUploadStatus === "pending" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={configUploadResending}
                    onClick={handleResendConfigUploadEmail}
                  >
                    {configUploadResending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    Resend Email
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => configUploadToken && handleRevokeConfigUpload(configUploadToken)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Revoke
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setConfigUploadToken(null);
                  setConfigUploadUrl(null);
                  setConfigUploadStatus(null);
                  setConfigUploadEmailSent(false);
                  setConfigUploadCustomerName("");
                  setConfigUploadCustomerEmail("");
                }}
              >
                Create another upload link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* My Upload Requests Dialog */}
      <Dialog open={configUploadRequestsOpen} onOpenChange={setConfigUploadRequestsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {activeTeam ? `${activeTeam.name} Upload Requests` : "My Upload Requests"}
            </DialogTitle>
            <DialogDescription>
              {activeTeam
                ? "Team config upload requests — yours and your teammates'."
                : "Manage config upload requests you've sent to customers."}
            </DialogDescription>
          </DialogHeader>

          {configUploadListLoading && configUploadRequests.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : configUploadRequests.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No upload requests yet.
            </p>
          ) : (
            <div className="space-y-3">
              {configUploadRequests.map((req) => {
                const isExpired = new Date(req.expires_at) <= new Date();
                const statusLabel = isExpired
                  ? "Expired"
                  : req.status === "uploaded"
                    ? "Config Ready"
                    : req.status === "downloaded"
                      ? "Downloaded"
                      : "Pending";
                const statusColor = isExpired
                  ? "text-muted-foreground"
                  : req.status === "uploaded"
                    ? "text-[#00F2B3]"
                    : req.status === "downloaded"
                      ? "text-blue-500"
                      : "text-amber-500";
                const isTeammate =
                  activeTeam && req.se_user_id && req.se_user_id !== seAuth.seProfile?.id;
                return (
                  <div
                    key={req.id}
                    className={cn(
                      "rounded-lg border p-3 space-y-2",
                      isTeammate && "border-brand-accent/30 dark:border-[#00EDFF]/20",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {req.customer_name || "Unnamed"}
                        </span>
                        <span className={cn("text-xs font-medium", statusColor)}>
                          {statusLabel}
                        </span>
                        {req.central_connected_at && (
                          <Badge
                            variant="outline"
                            className="text-[9px] border-blue-500/30 text-blue-500 gap-1"
                          >
                            <Wifi className="h-2.5 w-2.5" />
                            Central
                          </Badge>
                        )}
                        {isTeammate && (
                          <Badge variant="secondary" className="text-[9px]">
                            Teammate
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    {req.customer_email && (
                      <p className="text-xs text-muted-foreground">{req.customer_email}</p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {req.status === "uploaded" && !isExpired && (
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs gap-1.5 bg-[#00F2B3] hover:bg-[#00F2B3]/90"
                          disabled={configUploadLoading}
                          onClick={() => handleLoadConfigFromUpload(req.token)}
                        >
                          {configUploadLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          Load Config
                        </Button>
                      )}
                      {req.status === "downloaded" && !isExpired && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          disabled={configUploadLoading}
                          onClick={() => handleLoadConfigFromUpload(req.token)}
                        >
                          {configUploadLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          Re-download
                        </Button>
                      )}
                      {isTeammate && !isExpired && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => handleClaimConfigUpload(req.token)}
                        >
                          <UserCheck className="h-3 w-3" />
                          Claim
                        </Button>
                      )}
                      {!isExpired && req.status === "pending" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => {
                            const url = `${window.location.origin}/upload/${req.token}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link copied");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                          Copy Link
                        </Button>
                      )}
                      {!isExpired && req.status === "pending" && req.customer_email && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          disabled={resendingUploadToken === req.token}
                          onClick={() => handleResendUploadEmail(req.token)}
                        >
                          {resendingUploadToken === req.token ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Resend Email
                        </Button>
                      )}
                      {!isExpired && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => handleRevokeConfigUpload(req.token)}
                        >
                          <XCircle className="h-3 w-3" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Re-check search dialog */}
      <Dialog open={recheckSearchOpen} onOpenChange={setRecheckSearchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Request Re-Check
            </DialogTitle>
            <DialogDescription>
              Search for a previous customer to pre-fill a new upload request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 rounded-lg"
                placeholder="Search by customer name…"
                value={recheckQuery}
                onChange={(e) => handleRecheckSearch(e.target.value)}
                autoFocus
              />
            </div>
            {recheckSearching && (
              <div className="text-center py-3">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
            {!recheckSearching && recheckResults.length === 0 && recheckQuery.trim().length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                No matching customers found.
              </p>
            )}
            {recheckResults.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {recheckResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted/40 transition-colors text-left"
                    onClick={() => handleRecheckSelect(r)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Last checked:{" "}
                        {new Date(r.checked_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {r.overall_grade && ` — Grade ${r.overall_grade}`}
                        {r.overall_score != null && ` (${r.overall_score}%)`}
                      </p>
                      {r.serialNumbers.length > 0 && (
                        <p className="text-[9px] font-mono text-muted-foreground truncate">
                          {r.serialNumbers.join(", ")}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={`${r.overall_grade === "A" ? "bg-[#00F2B3]/15 text-[#00F2B3]" : r.overall_grade === "F" ? "bg-[#EA0022]/15 text-[#EA0022]" : "bg-muted text-muted-foreground"} border-0 text-[9px] shrink-0`}
                    >
                      {r.overall_grade ?? "—"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function HealthCheck() {
  const seAuth = useSEAuthProvider();

  if (seAuth.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <span
          className="h-9 w-9 rounded-full border-2 border-[#001A47]/20 border-t-[#2006F7] dark:border-white/25 dark:border-t-[#00F2B3] animate-spin"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Loading SE Health Check…</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            If nothing appears after a few seconds, refresh the page or check your connection.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs text-brand-accent hover:underline"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  if (!seAuth.isAuthenticated) {
    const sophosSession = !!seAuth.user?.email && /@sophos\.com$/i.test(seAuth.user.email.trim());
    if (seAuth.user && sophosSession && !seAuth.seProfile) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
          <Card className="max-w-lg w-full border-[#F29400]/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-[#F29400] shrink-0" aria-hidden />
                Couldn&apos;t load your SE profile
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                You&apos;re signed in as{" "}
                <span className="font-medium text-foreground">{seAuth.user.email}</span>, but this
                app couldn&apos;t read or create your row in{" "}
                <code className="text-xs bg-muted px-1 rounded">se_profiles</code>. That usually
                means database permissions (RLS), a missing migration, or a network issue — not your
                password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask your admin to verify{" "}
                <code className="text-xs bg-muted px-1 rounded">se_profiles</code> and Supabase
                policies, then try again.
              </p>
              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={() => void seAuth.signOut()}
              >
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return <SEAuthGate onSignIn={seAuth.signIn} onSignUp={seAuth.signUp} />;
  }

  if (seAuth.seProfile && !seAuth.seProfile.profileCompleted) {
    return <CompleteProfileGate seAuth={seAuth} />;
  }

  return (
    <SEAuthProvider value={seAuth}>
      <ActiveTeamProvider seProfileId={seAuth.seProfile?.id ?? null}>
        <HealthCheckInner />
      </ActiveTeamProvider>
    </SEAuthProvider>
  );
}

// CompleteProfileGate extracted to ./health-check/CompleteProfileGate.tsx

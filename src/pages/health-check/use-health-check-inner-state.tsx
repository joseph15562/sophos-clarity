import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseWithAbort } from "@/lib/supabase-with-abort";
import { useSearchParams } from "react-router-dom";
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
import type { UploadedFile } from "@/components/FileUpload";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import type { ParsedFile } from "@/hooks/use-report-generation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trackProductEvent } from "@/lib/product-telemetry";
import { useSEAuth } from "@/hooks/use-se-auth";
import { supabase } from "@/integrations/supabase/client";
import { warnOptionalError } from "@/lib/client-error-feedback";
import { getFirewallDisplayName } from "@/lib/sophos-central";
import {
  buildGuestCentralHaGroups,
  findGuestHaGroupBySelectValue,
  guestHaGroupSelectValue,
  type GuestFirewallRow,
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
  snapshotFilesToParsedFiles,
  type SeHealthCheckSnapshotV1,
} from "@/lib/se-health-check-snapshot-v2";
import { ALL_FRAMEWORK_NAMES, controlIdsForFindingExport } from "@/lib/compliance-map";
import { validateFindingExportMetadata } from "@/lib/report-export-validation";
import { useActiveTeam } from "@/hooks/use-active-team";
import { startHealthCheckTour } from "@/lib/guided-tours";

import type {
  ActiveStep,
  EphemeralCentralCreds,
  GuestFirewallLicenseApiRow,
  GuestTenantRow,
} from "./types";
import { useConfigUpload, type ConfigUploadCentralApiPayload } from "./use-config-upload";
import { buildHealthCheckReportParams, validateRequiredFields } from "./build-report-params";
import {
  CENTRAL_MATCH_NONE,
  mapGuestFirewallLicencesToBpRows,
  guestFirewallMatchValueForFile,
  callGuestCentral,
} from "./guest-central-api";
import { useHealthCheckSharing } from "./use-health-check-sharing";
import { buildAutoSeNotes } from "./build-auto-se-notes";
import { useCentralApiHelpHash } from "./use-central-api-help-hash";
import { useHealthCheckUrlParams } from "./use-health-check-url-params";

const SOPHOS_BP_TEMPLATE =
  BASELINE_TEMPLATES.find((t) => t.id === "sophos-best-practice") ?? BASELINE_TEMPLATES[0];

export function useHealthCheckInnerState() {
  const seAuth = useSEAuth();
  const { activeTeam, activeTeamId, teams } = useActiveTeam();
  const sendReportAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => sendReportAbortRef.current?.abort(), []);

  const guestCentralChainAbortRef = useRef<AbortController | null>(null);
  const guestCentralConnectGenRef = useRef(0);
  useEffect(() => () => guestCentralChainAbortRef.current?.abort(), []);

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
  const [reviewerSignOff, setReviewerSignOff] = useState<{
    signedBy: string;
    signedAt: string;
  } | null>(null);
  const [reviewerSignOffDraft, setReviewerSignOffDraft] = useState("");
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
      } catch (e) {
        warnOptionalError("health-check.preparedByMigration.remove", e);
      }
      return;
    }
    const ac = new AbortController();
    void (async () => {
      const { error } = await supabaseWithAbort(
        supabase.from("se_profiles").update({ health_check_prepared_by: legacy }).eq("id", p.id),
        ac.signal,
      );
      if (error) return;
      try {
        localStorage.removeItem(SE_HEALTH_CHECK_PREPARED_BY_KEY);
      } catch (e) {
        warnOptionalError("health-check.preparedByMigration.removeAfterSync", e);
      }
      if (!ac.signal.aborted) await seAuth.reloadSeProfile();
    })();
    return () => ac.abort();
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
    const ac = new AbortController();
    (async () => {
      try {
        const res = await callGuestCentral<{ items: GuestFirewallLicenseApiRow[] }>(
          {
            mode: "guest_health_firewall_licenses",
            clientId: centralCreds.clientId,
            clientSecret: centralCreds.clientSecret,
            tenantId: centralCreds.tenantId,
          },
          { signal: ac.signal },
        );
        if (!ac.signal.aborted) setGuestFirewallLicenseItems(res.items ?? []);
      } catch {
        if (!ac.signal.aborted) setGuestFirewallLicenseItems([]);
      }
    })();
    return () => ac.abort();
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
          const isXmlHint = isXml
            ? "Export entities.xml from your Sophos firewall (System → Backup & firmware → Export) and upload that file, not a partial or renamed copy."
            : "Use a full HTML export from your Sophos firewall admin console, or an entities.xml configuration export.";
          toast.error("This file does not look like a Sophos firewall export", {
            description: `${file.fileName}: ${isXmlHint} Then try uploading again.`,
          });
          trackProductEvent("health_check_config_parse_failed", {
            fileName: file.fileName,
            treatedAsXml: isXml,
          });
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

  const [searchParams, setSearchParams] = useSearchParams();

  useHealthCheckUrlParams(searchParams, setSearchParams, {
    setCustomerName,
    setPreparedFor,
    setConfigUploadCustomerName,
    setConfigUploadDialogOpen,
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
    guestCentralChainAbortRef.current?.abort();
    const gen = (guestCentralConnectGenRef.current += 1);
    const ac = new AbortController();
    guestCentralChainAbortRef.current = ac;
    const signal = ac.signal;
    setCentralBusy(true);
    try {
      await callGuestCentral(
        {
          mode: "guest_health_ping",
          clientId: centralCreds.clientId,
          clientSecret: centralCreds.clientSecret,
        },
        { signal },
      );
      setCentralValidated(true);
      setReplayCentralLinked(false);
      setRestoredHaLabels(null);

      const tenantsRes = await callGuestCentral<{ items: GuestTenantRow[] }>(
        {
          mode: "guest_health_tenants",
          clientId: centralCreds.clientId,
          clientSecret: centralCreds.clientSecret,
        },
        { signal },
      );
      const tenants = tenantsRes.items ?? [];
      setTenantOptions(tenants);

      if (tenants.length > 0) {
        const tenantId = tenants[0].id;
        setCentralCreds((c) => ({ ...c, tenantId }));
        const fwRes = await callGuestCentral<{ items: GuestFirewallRow[] }>(
          {
            mode: "guest_health_firewalls",
            clientId: centralCreds.clientId,
            clientSecret: centralCreds.clientSecret,
            tenantId,
          },
          { signal },
        );
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
      const aborted =
        signal.aborted ||
        (e instanceof DOMException && e.name === "AbortError") ||
        (e instanceof Error && e.name === "AbortError");
      if (aborted) return;
      setCentralValidated(false);
      toast.error(e instanceof Error ? e.message : "Could not connect to Sophos Central");
    } finally {
      if (gen === guestCentralConnectGenRef.current) setCentralBusy(false);
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
    setReviewerSignOff(null);
    setReviewerSignOffDraft("");
  }, []);

  const applyReviewerSignOff = useCallback(() => {
    const n = reviewerSignOffDraft.trim();
    if (!n) {
      toast.error("Enter reviewer name");
      return;
    }
    setReviewerSignOff({ signedBy: n, signedAt: new Date().toISOString() });
    toast.success("Reviewer sign-off recorded for CSV exports.");
  }, [reviewerSignOffDraft]);

  const clearReviewerSignOff = useCallback(() => {
    setReviewerSignOff(null);
  }, []);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [sendingReportToSe, setSendingReportToSe] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);
  const [purgingCustomer, setPurgingCustomer] = useState(false);
  const [purgingAll, setPurgingAll] = useState(false);

  const purgeByCustomer = useCallback(
    async (purgeCustomerName: string) => {
      if (!seAuth.seProfile) return;
      setPurgingCustomer(true);
      try {
        const { error, count } = await supabase
          .from("se_health_checks")
          .delete({ count: "exact" })
          .eq("se_user_id", seAuth.seProfile.id)
          .eq("customer_name", purgeCustomerName);
        if (error) throw error;
        toast.success(`Deleted ${count ?? 0} health check(s) for "${purgeCustomerName}".`);
        setHistoryRefreshKey((k) => k + 1);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Purge failed.");
      } finally {
        setPurgingCustomer(false);
      }
    },
    [seAuth.seProfile],
  );

  const purgeAllMyData = useCallback(async () => {
    if (!seAuth.seProfile) return;
    setPurgingAll(true);
    try {
      const { error, count } = await supabase
        .from("se_health_checks")
        .delete({ count: "exact" })
        .eq("se_user_id", seAuth.seProfile.id);
      if (error) throw error;
      try {
        localStorage.removeItem("se-health-check-bp-manual-overrides");
        localStorage.removeItem("firecomply-hc-tour-seen");
      } catch {
        /* localStorage may be unavailable */
      }
      resetAll();
      toast.success(`Deleted ${count ?? 0} health check(s) and cleared local data.`);
      setHistoryRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purge failed.");
    } finally {
      setPurgingAll(false);
    }
  }, [seAuth.seProfile, resetAll]);

  const [centralApiHelpOpen, setCentralApiHelpOpen] = useCentralApiHelpHash();

  const centralFromUploadRef = useRef(false);

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
        reviewerSignOff,
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
            .insert(payload as never)
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
      ["Finding", "Category", "Severity", "Status", "Recommendation", "SE Note", "Control IDs"],
    ];
    const exportValidationNotes: string[] = [];

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
          "",
        ]);
      }

      for (const f of ar.findings ?? []) {
        const controlIds = controlIdsForFindingExport(f.title, ALL_FRAMEWORK_NAMES);
        for (const issue of validateFindingExportMetadata({
          severity: f.severity,
          controlIds,
        })) {
          exportValidationNotes.push(`${label}: ${f.title} — ${issue.message}`);
        }
        csvRows.push([
          f.title,
          f.section,
          f.severity,
          f.severity,
          f.remediation ?? "",
          "",
          controlIds,
        ]);
      }
    }

    if (reviewerSignOff) {
      csvRows.push([]);
      csvRows.push([
        "Reviewer sign-off",
        reviewerSignOff.signedBy,
        reviewerSignOff.signedAt,
        "",
        "",
        "",
        "",
      ]);
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
    if (exportValidationNotes.length > 0) {
      toast.message("CSV exported — validation hints", {
        description: exportValidationNotes.slice(0, 3).join(" · "),
      });
    } else {
      toast.success("Findings CSV downloaded.");
    }
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
    reviewerSignOff,
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
      sendReportAbortRef.current?.abort();
      sendReportAbortRef.current = new AbortController();
      const sendSignal = sendReportAbortRef.current.signal;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/send-report`, {
        method: "POST",
        signal: sendSignal,
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
      if (e instanceof DOMException && e.name === "AbortError") return;
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

  const handleSendReportToSE = useCallback(async () => {
    const seEmail = seAuth.seProfile?.email?.trim();
    if (!seEmail) {
      toast.error("SE email not available.");
      return;
    }
    if (!files.length || Object.keys(analysisResults).length === 0) {
      toast.error("Run a health check before sending.");
      return;
    }
    setSendingReportToSe(true);
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

      const part = sanitizePdfFilenamePart(customerName || "Health-Check");
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
          customer_email: seEmail,
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
      toast.success(`Report sent to ${seEmail}`);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.warn("[health-check] send report to SE failed", e);
      toast.error(e instanceof Error ? e.message : "Could not send report.");
    } finally {
      setSendingReportToSe(false);
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
    seAuth.seProfile,
  ]);

  const restoreFromSavedSnapshot = useCallback(
    (snapshot: SeHealthCheckSnapshotV1, meta?: { checkId: string; followupAt?: string | null }) => {
      try {
        localStorage.setItem(
          SE_HEALTH_CHECK_BP_OVERRIDES_KEY,
          JSON.stringify(snapshot.manualBpOverrideIds),
        );
      } catch (e) {
        warnOptionalError("health-check.restoreSnapshot.bpOverrides", e);
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
      setReviewerSignOff(snapshot.reviewerSignOff ?? null);
      if (meta?.checkId) {
        setSavedCheckId(meta.checkId);
        setFollowupAt(meta.followupAt ?? null);
      }
      toast.success("Opened saved health check.");
    },
    [],
  );

  const hasParsedConfigs = files.some((f) => Object.keys(f.extractedData ?? {}).length > 0);

  return {
    seAuth,
    activeTeam,
    activeTeamId,
    teams,
    files,
    setFiles,
    analysisResults,
    setAnalysisResults,
    activeStep,
    setActiveStep,
    centralCreds,
    setCentralCreds,
    centralValidated,
    setCentralValidated,
    replayCentralLinked,
    setReplayCentralLinked,
    centralBusy,
    setCentralBusy,
    tenantOptions,
    setTenantOptions,
    firewallOptions,
    setFirewallOptions,
    licence,
    setLicence,
    dpiExemptZones,
    setDpiExemptZones,
    dpiExemptNetworks,
    setDpiExemptNetworks,
    webFilterComplianceMode,
    setWebFilterComplianceMode,
    webFilterExemptRuleNames,
    setWebFilterExemptRuleNames,
    seMdrThreatFeedsAck,
    setSeMdrThreatFeedsAck,
    seNdrEssentialsAck,
    setSeNdrEssentialsAck,
    seDnsProtectionAck,
    setSeDnsProtectionAck,
    seExcludeSecurityHeartbeat,
    setSeExcludeSecurityHeartbeat,
    guestFirewallLicenseItems,
    setGuestFirewallLicenseItems,
    bpOverrideRevision,
    setBpOverrideRevision,
    historyRefreshKey,
    setHistoryRefreshKey,
    restoredHaLabels,
    setRestoredHaLabels,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    preparedFor,
    setPreparedFor,
    seNotesManual,
    setSeNotesManual,
    findingNotes,
    setFindingNotes,
    reviewerSignOff,
    reviewerSignOffDraft,
    setReviewerSignOffDraft,
    applyReviewerSignOff,
    clearReviewerSignOff,
    seManagementOpen,
    setSeManagementOpen,
    effectivePreparedBy,
    exportFieldsReady,
    centralLinkedForAnalysis,
    guestFirewallGroups,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    centralBpLicenceFlat,
    detectedTierFromCentralLicences,
    licenceLockedByCentral,
    baselineResults,
    autoSeNotes,
    seNotes,
    handleFilesChange,
    uploadedForPicker,
    onLoadConfigFromUpload,
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
    searchParams,
    setSearchParams,
    savedCheckId,
    setSavedCheckId,
    buildSharedHtml,
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
    connectCentral,
    linkUploadToCentral,
    centralUploadMatcher,
    resetAll,
    centralFromUploadRef,
    pdfBusy,
    setPdfBusy,
    sendingReport,
    setSendingReport,
    sendingReportToSe,
    handleSendReportToSE,
    savingCheck,
    setSavingCheck,
    centralApiHelpOpen,
    setCentralApiHelpOpen,
    saveHealthCheck,
    exportSummaryJson,
    exportFindingsCsv,
    handleDownloadHealthCheckPdf,
    handleDownloadHealthCheckHtml,
    handleDownloadHealthCheckZip,
    handleSendReportToCustomer,
    restoreFromSavedSnapshot,
    hasParsedConfigs,
    purgingCustomer,
    purgingAll,
    purgeByCustomer,
    purgeAllMyData,
  };
}

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
  Shield,
  Upload,
  Wifi,
  Link2,
  Copy,
  XCircle,
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
import { HealthCheckDashboard } from "@/components/HealthCheckDashboard";

const SophosBestPractice = lazy(() =>
  import("@/components/SophosBestPractice").then((m) => ({ default: m.SophosBestPractice })),
);
import { DpiExclusionBar } from "@/components/DpiExclusionBar";
import { SeHeartbeatScopeBar } from "@/components/SeHeartbeatScopeBar";
import { SeThreatResponseAckBar, SeDnsProtectionAckBar } from "@/components/SeThreatResponseAckBar";
import { WebFilterRuleExclusionBar } from "@/components/WebFilterRuleExclusionBar";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import { SEHealthCheckHistory } from "@/components/SEHealthCheckHistory";
import { SeHealthCheckManagementDrawer } from "@/components/SeHealthCheckManagementDrawer";
import type { BrandingData } from "@/components/BrandingSetup";
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
} from "@/lib/se-health-check-bp";
import { loadSeHealthCheckPreparedBy, SE_HEALTH_CHECK_PREPARED_BY_KEY } from "@/lib/se-health-check-preferences";
import {
  buildSeHealthCheckSnapshotV1,
  parseSeHealthCheckSnapshotFromSummaryJson,
  snapshotFilesToParsedFiles,
  type SeHealthCheckSnapshotV1,
} from "@/lib/se-health-check-snapshot";

type ActiveStep = "landing" | "analyzing" | "results";

type EphemeralCentralCreds = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
};

type GuestTenantRow = { id: string; name: string; apiHost?: string };

/** Sophos Licensing API row (guest_health_firewall_licenses / firewall-licenses). */
type GuestFirewallLicenseApiRow = {
  serialNumber?: string;
  licenses?: Array<{
    licenseIdentifier?: string;
    product?: { code?: string; name?: string };
    endDate?: string;
    type?: string;
  }>;
};

function mapGuestFirewallLicencesToBpRows(
  rows: GuestFirewallLicenseApiRow[],
): Array<{ product: string; endDate: string; type: string }> {
  const out: Array<{ product: string; endDate: string; type: string }> = [];
  for (const row of rows) {
    for (const lic of row.licenses ?? []) {
      const product = lic.product?.name ?? lic.product?.code ?? lic.licenseIdentifier ?? "";
      out.push({
        product,
        endDate: typeof lic.endDate === "string" ? lic.endDate : "",
        type: typeof lic.type === "string" ? lic.type : "",
      });
    }
  }
  return out;
}

const CENTRAL_MATCH_NONE = "__none__";

/** Match file serial to any node in an HA group (same as MSP serial search across HA). */
function guestFirewallMatchValueForFile(file: ParsedFile, groups: GuestHaGroup[]): string {
  const sn = file.serialNumber?.trim();
  if (!sn) return CENTRAL_MATCH_NONE;
  for (const g of groups) {
    const all = [g.primary, ...g.peers];
    if (all.some((fw) => (fw.serialNumber || "").trim().toLowerCase() === sn.toLowerCase())) {
      return guestHaGroupSelectValue(g);
    }
  }
  return CENTRAL_MATCH_NONE;
}

async function callGuestCentral<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const resolved = getSupabasePublicEdgeAuth();
  // #region agent log
  fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
    body: JSON.stringify({
      sessionId: "360061",
      runId: "post-fix",
      hypothesisId: "H2",
      location: "HealthCheck.tsx:callGuestCentral:pre",
      message: "guest central auth: raw env vs resolved client",
      data: {
        mode: (body as { mode?: string }).mode,
        rawUrlLen: rawUrl.length,
        rawKeyLen: rawKey.length,
        resolvedUrlLen: resolved.url.length,
        resolvedKeyLen: resolved.anonKey.length,
        urlsDiffer: rawUrl !== resolved.url,
        keysDiffer: rawKey !== resolved.anonKey,
        bearerWouldBeEmpty: rawKey.length === 0,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const url = `${resolved.url.replace(/\/$/, "")}/functions/v1/sophos-central`;
  const key = resolved.anonKey.trim();
  const jwtRole = readJwtPayloadClaim(key, "role");
  if (jwtRole === "service_role") {
    // #region agent log
    fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
      body: JSON.stringify({
        sessionId: "360061",
        runId: "post-fix",
        hypothesisId: "H6",
        location: "HealthCheck.tsx:callGuestCentral:wrong-key-type",
        message: "VITE key is service_role JWT; Edge expects anon",
        data: { mode: (body as { mode?: string }).mode },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    throw new Error(
      "Wrong Supabase key: use the anon (publishable) key in VITE_SUPABASE_PUBLISHABLE_KEY, not the service_role secret.",
    );
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // #region agent log
    fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
      body: JSON.stringify({
        sessionId: "360061",
        runId: "post-fix",
        hypothesisId: "H-CORS",
        location: "HealthCheck.tsx:callGuestCentral:fetch-threw",
        message: "fetch network/CORS failure",
        data: {
          mode: (body as { mode?: string }).mode,
          errName: err instanceof Error ? err.name : "unknown",
          errMsg: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120),
          pageOrigin: typeof window !== "undefined" ? window.location.origin : "",
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    throw err;
  }
  const data = (await res.json()) as { error?: string } & T;
  // #region agent log
  fetch("http://127.0.0.1:7279/ingest/a33c19e5-9dd2-4af3-bd97-167e5af829e3", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "360061" },
    body: JSON.stringify({
      sessionId: "360061",
      runId: "post-fix",
      hypothesisId: "H2",
      location: "HealthCheck.tsx:callGuestCentral:response",
      message: "guest central response",
      data: {
        mode: (body as { mode?: string }).mode,
        status: res.status,
        errorShape: typeof data.error,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!res.ok || data.error) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

const SOPHOS_BP_TEMPLATE = BASELINE_TEMPLATES.find((t) => t.id === "sophos-best-practice") ?? BASELINE_TEMPLATES[0];

function HealthCheckInner() {
  const seAuth = useSEAuth();

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
  const [webFilterComplianceMode, setWebFilterComplianceMode] = useState<WebFilterComplianceMode>("strict");
  const [webFilterExemptRuleNames, setWebFilterExemptRuleNames] = useState<string[]>([]);
  const [seMdrThreatFeedsAck, setSeMdrThreatFeedsAck] = useState(false);
  const [seNdrEssentialsAck, setSeNdrEssentialsAck] = useState(false);
  const [seDnsProtectionAck, setSeDnsProtectionAck] = useState(false);
  const [seExcludeSecurityHeartbeat, setSeExcludeSecurityHeartbeat] = useState(false);
  const [guestFirewallLicenseItems, setGuestFirewallLicenseItems] = useState<GuestFirewallLicenseApiRow[]>([]);
  const [bpOverrideRevision, setBpOverrideRevision] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  /** When non-null, HA BP auto-pass labels come from a reopened save (no live Central groups). */
  const [restoredHaLabels, setRestoredHaLabels] = useState<Set<string> | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [preparedFor, setPreparedFor] = useState("");
  const [seNotesManual, setSeNotesManual] = useState("");
  const [seManagementOpen, setSeManagementOpen] = useState(false);

  const effectivePreparedBy = useMemo(
    () =>
      seAuth.seProfile?.healthCheckPreparedBy?.trim() ||
      seAuth.seProfile?.displayName?.trim() ||
      seAuth.seProfile?.email?.trim() ||
      "Sales Engineer",
    [seAuth.seProfile],
  );

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
        ? guestFirewallLicenseItems.filter((r) => serials.has((r.serialNumber ?? "").trim().toLowerCase()))
        : [];
    return mapGuestFirewallLicencesToBpRows(rows);
  }, [files, guestFirewallLicenseItems]);

  const detectedTierFromCentralLicences = useMemo(
    () => detectBpLicenceTierFromCentral(centralBpLicenceFlat.length > 0 ? centralBpLicenceFlat : null),
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
      setGuestFirewallLicenseItems([]);
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

  const autoSeNotes = useMemo(() => {
    const labels = Object.keys(analysisResults);
    if (labels.length === 0) return "";

    const manualOverrides = loadSeHealthCheckBpOverrides();
    const paras: string[] = [];

    const tierLabel = licence.tier === "xstream" ? "Xstream Protection" : licence.tier === "standard" ? "Standard Protection" : "individual module selection";
    const multi = labels.length > 1;

    paras.push(`I reviewed the configuration export${multi ? `s for ${labels.length} firewalls` : ""} as part of this health check. The ${multi ? "environment is" : "appliance is"} licenced with Sophos Firewall ${tierLabel}.`);

    for (const label of labels) {
      const ar = analysisResults[label];
      if (!ar) continue;
      const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
      const bp = computeSophosBPScore(ar, licence, manualOverrides, centralAuto, seThreatResponseAck, seExcludedBpChecks);

      if (multi) paras.push(`Regarding ${label}:`);

      const gradeCommentary =
        bp.grade === "A" ? "which reflects a well-hardened configuration" :
        bp.grade === "B" ? "which is solid but has room for improvement" :
        bp.grade === "C" ? "indicating several areas that would benefit from attention" :
        bp.grade === "D" ? "which highlights significant gaps that should be addressed" :
        "which indicates the configuration needs substantial work to meet Sophos recommendations";

      paras.push(`Overall the appliance scored ${bp.overall}% against Sophos best practices, earning a Grade ${bp.grade} — ${gradeCommentary}. Out of ${bp.total} applicable checks, ${bp.passed} passed and ${bp.failed} did not meet the recommended standard.${bp.warnings > 0 ? ` I wasn't able to fully verify ${bp.warnings} item${bp.warnings > 1 ? "s" : ""} from the export alone, so ${bp.warnings > 1 ? "those" : "that"} should be double-checked on the live console.` : ""}`);

      const failedChecks = bp.results.filter((r) => r.status === "fail" && r.applicable);
      if (failedChecks.length > 0) {
        const names = failedChecks.map((fc) => fc.check.title);
        if (names.length <= 3) {
          paras.push(`The key areas to focus on are ${names.join(" and ")}. I'd recommend tackling these as a priority during any hardening work.`);
        } else {
          paras.push(`The main gaps I spotted were around ${names.slice(0, 3).join(", ")}, plus ${names.length - 3} other${names.length - 3 > 1 ? "s" : ""} detailed in the full report. I'd suggest working through the failed checks in the Best Practice section — most of them are straightforward to resolve.`);
        }
      }

      const sevCounts: Record<string, number> = {};
      for (const f of ar.findings) {
        sevCounts[f.severity] = (sevCounts[f.severity] ?? 0) + 1;
      }

      const critCount = sevCounts["critical"] ?? 0;
      const highCount = sevCounts["high"] ?? 0;
      const medCount = sevCounts["medium"] ?? 0;
      const totalFindings = ar.findings.length;

      if (totalFindings > 0) {
        const urgentCount = critCount + highCount;
        if (urgentCount > 0) {
          let findingSummary = `Looking at the detailed findings, I found ${totalFindings} items worth flagging.`;
          if (critCount > 0 && highCount > 0) {
            findingSummary += ` ${critCount} of these are critical and ${highCount} are high severity — these really should be looked at soon.`;
          } else if (critCount > 0) {
            findingSummary += ` ${critCount} of these are critical and need immediate attention.`;
          } else {
            findingSummary += ` ${highCount} are high severity and worth prioritising.`;
          }
          if (medCount > 0) findingSummary += ` There are also ${medCount} medium-severity items that are worth reviewing when time allows.`;
          paras.push(findingSummary);
        } else if (totalFindings > 0) {
          paras.push(`I found ${totalFindings} findings, but nothing critical or high severity which is good news. ${medCount > 0 ? `There are ${medCount} medium items worth a look, but overall the configuration is in decent shape.` : "The configuration looks well maintained."}`);
        }
      }

      const critical = ar.findings.filter((f) => f.severity === "critical");
      const high = ar.findings.filter((f) => f.severity === "high");
      const topFindings = [...critical, ...high].slice(0, 4);
      if (topFindings.length > 0) {
        const items = topFindings.map((f) => f.title);
        if (items.length === 1) {
          paras.push(`The top priority is "${items[0]}" — I'd get that sorted first.`);
        } else {
          paras.push(`If I were to pick the most important things to fix first, I'd start with ${items.slice(0, -1).map((i) => `"${i}"`).join(", ")} and "${items[items.length - 1]}".`);
        }
      }
    }

    const scopeNotes: string[] = [];
    if (dpiExemptZones.length > 0) scopeNotes.push(`I've excluded the ${dpiExemptZones.join(", ")} zone${dpiExemptZones.length > 1 ? "s" : ""} from DPI coverage checks since deploying the signing certificate there isn't practical`);
    if (dpiExemptNetworks.length > 0) scopeNotes.push(`the ${dpiExemptNetworks.join(", ")} network${dpiExemptNetworks.length > 1 ? "s are" : " is"} also exempt from DPI checks`);
    if (webFilterExemptRuleNames.length > 0) {
      const ruleList = webFilterExemptRuleNames.slice(0, 3).join(", ");
      scopeNotes.push(`${webFilterExemptRuleNames.length} rule${webFilterExemptRuleNames.length > 1 ? "s" : ""} (${ruleList}${webFilterExemptRuleNames.length > 3 ? ` and ${webFilterExemptRuleNames.length - 3} more` : ""}) ${webFilterExemptRuleNames.length > 1 ? "have" : "has"} been scoped out of web filter compliance`);
    }
    if (webFilterComplianceMode !== "strict") scopeNotes.push(`I've set web filter compliance to informational mode for this review rather than strict`);

    const ackItems: string[] = [];
    if (seMdrThreatFeedsAck) ackItems.push("MDR threat feeds");
    if (seNdrEssentialsAck) ackItems.push("NDR Essentials");
    if (seDnsProtectionAck) ackItems.push("DNS Protection");
    if (ackItems.length > 0) scopeNotes.push(`I've confirmed on the appliance that ${ackItems.join(", ")} ${ackItems.length > 1 ? "are" : "is"} active even though it doesn't show in the export`);
    if (seExcludeSecurityHeartbeat) scopeNotes.push(`I've excluded the Security Heartbeat check since there are no Sophos-managed endpoints in this environment`);

    if (scopeNotes.length > 0) {
      paras.push(`A few notes on scoping: ${scopeNotes.join(". Also, ")}.`);
    }

    return paras.join("\n\n");
  }, [
    analysisResults, licence, centralLinkedForAnalysis, seCentralHaLabels,
    seThreatResponseAck, seExcludedBpChecks, bpOverrideRevision,
    dpiExemptZones, dpiExemptNetworks, webFilterExemptRuleNames,
    webFilterComplianceMode, seMdrThreatFeedsAck, seNdrEssentialsAck,
    seDnsProtectionAck, seExcludeSecurityHeartbeat,
  ]);

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
  }, [files, centralLinkedForAnalysis, dpiExemptZones, dpiExemptNetworks, webFilterComplianceMode, webFilterExemptRuleNames]);

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
        const isXml = file.fileName.endsWith(".xml") || file.content.trimStart().startsWith("<?xml");
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
          toast.error(`Could not parse ${file.fileName} — use a valid Sophos HTML or entities XML export`);
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

  const connectCentral = useCallback(async () => {
    setCentralBusy(true);
    try {
      await callGuestCentral({ mode: "guest_health_ping", clientId: centralCreds.clientId, clientSecret: centralCreds.clientSecret });
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
        const haNote = groups.length < items.length ? ` (${groups.length} link targets, HA merged)` : "";
        toast.success(`Connected — found ${items.length} device(s) from Central${haNote} across ${tenants.length} tenant(s).`);
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
        className="rounded-lg border border-dashed border-[#2006F7]/25 dark:border-[#00EDFF]/20 bg-muted/15 p-3 space-y-3"
        data-tour="hc-central-match"
      >
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Link each upload to a Central firewall.</span> HA pairs with the
          same hostname are grouped like the MSP dashboard. Entities XML usually has no serial — pick the row so tabs and
          saved checks use the right name. If you choose an <span className="text-foreground font-medium">HA</span> row,
          the <span className="text-foreground font-medium">Resilience › High Availability</span> best-practice check
          can be satisfied from Central when the export has no HA section.
        </p>
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground font-normal truncate block" title={f.fileName}>
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
                    const serials = all.map((x) => x.serialNumber).filter(Boolean).join(" / ");
                    const line = [getFirewallDisplayName(g.primary), serials || undefined].filter(Boolean).join(" — ");
                    return (
                      <SelectItem key={guestHaGroupSelectValue(g)} value={guestHaGroupSelectValue(g)}>
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

  const exportSummaryJson = useCallback(() => {
    const manualOverrides = loadSeHealthCheckBpOverrides();
    const bp: Record<string, SophosBPScore> = {};
    for (const [label, ar] of Object.entries(analysisResults)) {
      const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
      bp[label] = computeSophosBPScore(ar, licence, manualOverrides, centralAuto, seThreatResponseAck, seExcludedBpChecks);
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
    bpOverrideRevision,
    seCentralHaLabels,
    seThreatResponseAck,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludedBpChecks,
    seExcludeSecurityHeartbeat,
    centralLinkedForAnalysis,
  ]);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);
  const [centralApiHelpOpen, setCentralApiHelpOpen] = useState(false);

  // Config upload request state
  const [configUploadDialogOpen, setConfigUploadDialogOpen] = useState(false);
  const [configUploadCustomerName, setConfigUploadCustomerName] = useState("");
  const [configUploadCustomerEmail, setConfigUploadCustomerEmail] = useState("");
  const [configUploadDays, setConfigUploadDays] = useState(7);
  const [configUploadCreating, setConfigUploadCreating] = useState(false);
  const [configUploadToken, setConfigUploadToken] = useState<string | null>(null);
  const [configUploadUrl, setConfigUploadUrl] = useState<string | null>(null);
  const [configUploadEmailSent, setConfigUploadEmailSent] = useState(false);
  const [configUploadStatus, setConfigUploadStatus] = useState<string | null>(null);
  const [configUploadResending, setConfigUploadResending] = useState(false);
  const [configUploadLoading, setConfigUploadLoading] = useState(false);
  const [configUploadRequests, setConfigUploadRequests] = useState<Array<{
    id: string; token: string; customer_name: string | null; customer_email: string | null;
    status: string; expires_at: string; email_sent: boolean; uploaded_at: string | null;
    downloaded_at: string | null; created_at: string;
  }>>([]);
  const [configUploadRequestsOpen, setConfigUploadRequestsOpen] = useState(false);
  const [configUploadListLoading, setConfigUploadListLoading] = useState(false);
  const configUploadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const saveHealthCheck = useCallback(async () => {
    if (!seAuth.seProfile) return;
    const entries = Object.entries(analysisResults);
    if (entries.length === 0) return;

    setSavingCheck(true);
    try {
      const allFindings = entries.flatMap(([, ar]) => ar.findings ?? []);
      const manualOverrides = loadSeHealthCheckBpOverrides();
      const scores = entries.map(([label, ar]) => {
        const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
        const bp = computeSophosBPScore(ar, licence, manualOverrides, centralAuto, seThreatResponseAck, seExcludedBpChecks);
        return { label, score: bp.overall, grade: bp.grade };
      });
      const avgScore = Math.round(scores.reduce((s, e) => s + e.score, 0) / scores.length);
      const avgGrade: string =
        avgScore >= 90 ? "A" : avgScore >= 75 ? "B" : avgScore >= 60 ? "C" : avgScore >= 40 ? "D" : "F";

      const snapshot = buildSeHealthCheckSnapshotV1({
        customerName: customerName.trim(),
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
      });

      const { error } = await supabase
        .from("se_health_checks")
        .insert({
          se_user_id: seAuth.seProfile.id,
          customer_name: customerName.trim() || null,
          overall_score: avgScore,
          overall_grade: avgGrade,
          findings_count: allFindings.length,
          firewall_count: files.length,
          summary_json: {
            scores,
            topFindings: allFindings.slice(0, 10).map((f) => f.title ?? f.id),
            snapshot,
          },
        } as Record<string, unknown>);

      if (error) throw error;
      setHistoryRefreshKey((k) => k + 1);
      toast.success("Health check saved to your history.");
    } catch (err) {
      console.warn("[health-check] save failed", err);
      toast.error("Could not save health check — " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSavingCheck(false);
    }
  }, [
    seAuth.seProfile,
    analysisResults,
    licence,
    customerName,
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
  ]);

  // ── Config upload request handlers ──

  const fetchConfigUploadRequests = useCallback(async () => {
    if (!seAuth.seProfile) return;
    setConfigUploadListLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload-requests`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        setConfigUploadRequests(json.data ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setConfigUploadListLoading(false);
    }
  }, [seAuth.seProfile]);

  const handleCreateConfigUploadRequest = useCallback(async () => {
    if (!seAuth.seProfile) return;
    setConfigUploadCreating(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload-request`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: configUploadCustomerName.trim() || undefined,
          customer_email: configUploadCustomerEmail.trim() || undefined,
          expires_in_days: configUploadDays,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create upload request");

      setConfigUploadToken(json.token);
      setConfigUploadUrl(json.url);
      setConfigUploadEmailSent(json.email_sent);
      setConfigUploadStatus("pending");

      if (json.email_sent) {
        toast.success(`Upload link sent to ${configUploadCustomerEmail.trim()}`);
      } else if (configUploadCustomerEmail.trim()) {
        toast.warning("Upload link created but email could not be sent — share the link manually.");
      } else {
        toast.success("Upload link created — copy and share it with the customer.");
      }

      void fetchConfigUploadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create upload request.");
    } finally {
      setConfigUploadCreating(false);
    }
  }, [seAuth.seProfile, configUploadCustomerName, configUploadCustomerEmail, configUploadDays, fetchConfigUploadRequests]);

  const handleResendConfigUploadEmail = useCallback(async () => {
    if (!configUploadToken) return;
    setConfigUploadResending(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${configUploadToken}/resend`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
        },
      });
      const json = await res.json();
      if (json.email_sent) {
        toast.success("Email resent to customer.");
      } else {
        toast.error(json.error || "Could not resend email.");
      }
    } catch {
      toast.error("Could not resend email.");
    } finally {
      setConfigUploadResending(false);
    }
  }, [configUploadToken]);

  const handleLoadConfigFromUpload = useCallback(async (token: string) => {
    setConfigUploadLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${token}/download`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Download failed");
      }
      const json = await res.json();
      const fileName = json.file_name || "entities.xml";
      const uploaded: UploadedFile = {
        id: crypto.randomUUID(),
        fileName,
        content: json.config_xml,
        label: fileName.replace(/\.(xml|html|htm)$/i, ""),
      };
      await handleFilesChange([...uploadedForPicker, uploaded]);
      toast.success(`Config loaded: ${fileName}`);
      setConfigUploadDialogOpen(false);
      setConfigUploadRequestsOpen(false);
      void fetchConfigUploadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load config.");
    } finally {
      setConfigUploadLoading(false);
    }
  }, [handleFilesChange, uploadedForPicker, fetchConfigUploadRequests]);

  const handleRevokeConfigUpload = useCallback(async (token: string) => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${token}`;
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(url, {
        method: "DELETE",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session?.access_token}`,
        },
      });
      toast.success("Upload request revoked.");
      if (configUploadToken === token) {
        setConfigUploadToken(null);
        setConfigUploadUrl(null);
        setConfigUploadStatus(null);
      }
      void fetchConfigUploadRequests();
    } catch {
      toast.error("Could not revoke upload request.");
    }
  }, [configUploadToken, fetchConfigUploadRequests]);

  // Poll for upload status when a request is pending
  useEffect(() => {
    if (!configUploadToken || configUploadStatus !== "pending") {
      if (configUploadPollRef.current) clearInterval(configUploadPollRef.current);
      return;
    }
    const poll = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/config-upload/${configUploadToken}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        if (res.ok) {
          const json = await res.json();
          if (json.status === "uploaded") {
            setConfigUploadStatus("uploaded");
            toast.success("Customer has uploaded their configuration!");
            void fetchConfigUploadRequests();
          }
        }
      } catch { /* silent */ }
    };
    configUploadPollRef.current = setInterval(poll, 10_000);
    return () => { if (configUploadPollRef.current) clearInterval(configUploadPollRef.current); };
  }, [configUploadToken, configUploadStatus, fetchConfigUploadRequests]);

  // Fetch upload requests on mount when SE is authenticated
  useEffect(() => {
    if (seAuth.seProfile) void fetchConfigUploadRequests();
  }, [seAuth.seProfile, fetchConfigUploadRequests]);

  const handleDownloadHealthCheckPdf = useCallback(async () => {
    const labels = files
      .map((f) => f.label || f.fileName.replace(/\.(html|htm|xml)$/i, ""))
      .filter((l) => analysisResults[l]);
    if (labels.length === 0) {
      toast.error("No analysed configurations to include in the report.");
      return;
    }
    const manualOverrides = loadSeHealthCheckBpOverrides();
    const bpByLabel: Record<string, SophosBPScore> = {};
    for (const label of labels) {
      const ar = analysisResults[label];
      if (ar) {
        const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
        bpByLabel[label] = computeSophosBPScore(ar, licence, manualOverrides, centralAuto, seThreatResponseAck, seExcludedBpChecks);
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
        typeof import.meta.env.VITE_APP_VERSION === "string" ? import.meta.env.VITE_APP_VERSION : undefined,
      seNotes: seNotes.trim() || undefined,
    };
    const branding: BrandingData = {
      companyName: "Sophos FireComply",
      customerName: customerName.trim(),
      logoUrl: null,
      environment: "",
      country: "",
      selectedFrameworks: [],
      preparedBy: effectivePreparedBy,
      confidential: true,
    };
    setPdfBusy(true);
    try {
      const { runHealthCheckPdfDownload } = await import("@/lib/health-check-pdf-download");
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
    bpOverrideRevision,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    seNotes,
  ]);

  const handleDownloadHealthCheckHtml = useCallback(async () => {
    const labels = files
      .map((f) => f.label || f.fileName.replace(/\.(html|htm|xml)$/i, ""))
      .filter((l) => analysisResults[l]);
    if (labels.length === 0) {
      toast.error("No analysed configurations to include in the report.");
      return;
    }
    const manualOverrides = loadSeHealthCheckBpOverrides();
    const bpByLabel: Record<string, SophosBPScore> = {};
    for (const label of labels) {
      const ar = analysisResults[label];
      if (ar) {
        const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
        bpByLabel[label] = computeSophosBPScore(ar, licence, manualOverrides, centralAuto, seThreatResponseAck, seExcludedBpChecks);
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
        typeof import.meta.env.VITE_APP_VERSION === "string" ? import.meta.env.VITE_APP_VERSION : undefined,
      seNotes: seNotes.trim() || undefined,
    };
    const branding: BrandingData = {
      companyName: "Sophos FireComply",
      customerName: customerName.trim(),
      logoUrl: null,
      environment: "",
      country: "",
      selectedFrameworks: [],
      preparedBy: effectivePreparedBy,
      confidential: true,
    };
    try {
      const { runHealthCheckHtmlDownload } = await import("@/lib/health-check-pdf-download");
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
  ]);

  const handleDownloadHealthCheckZip = useCallback(async () => {
    const labels = files
      .map((f) => f.label || f.fileName.replace(/\.(html|htm|xml)$/i, ""))
      .filter((l) => analysisResults[l]);
    if (labels.length === 0) {
      toast.error("No analysed configurations to include in the report.");
      return;
    }
    const manualOverrides = loadSeHealthCheckBpOverrides();
    const bpByLabel: Record<string, SophosBPScore> = {};
    for (const label of labels) {
      const ar = analysisResults[label];
      if (ar) {
        const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
        bpByLabel[label] = computeSophosBPScore(ar, licence, manualOverrides, centralAuto, seThreatResponseAck, seExcludedBpChecks);
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
        typeof import.meta.env.VITE_APP_VERSION === "string" ? import.meta.env.VITE_APP_VERSION : undefined,
      seNotes: seNotes.trim() || undefined,
    };
    const branding: BrandingData = {
      companyName: "Sophos FireComply",
      customerName: customerName.trim(),
      logoUrl: null,
      environment: "",
      country: "",
      selectedFrameworks: [],
      preparedBy: effectivePreparedBy,
      confidential: true,
    };
    setPdfBusy(true);
    try {
      const { runHealthCheckZipDownload } = await import("@/lib/health-check-pdf-download");
      const zipFilename = await runHealthCheckZipDownload({ reportParams, branding, filenameCustomerPart: customerName });
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
    bpOverrideRevision,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    seNotes,
  ]);

  const restoreFromSavedSnapshot = useCallback(
    (snapshot: SeHealthCheckSnapshotV1) => {
      try {
        localStorage.setItem(SE_HEALTH_CHECK_BP_OVERRIDES_KEY, JSON.stringify(snapshot.manualBpOverrideIds));
      } catch {
        /* ignore */
      }
      setCustomerName(snapshot.customerName);
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
        <div className="mx-auto max-w-5xl px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#2006F7]/10 dark:bg-[#2006F7]/15 flex items-center justify-center shrink-0">
              <img src="/icons/sophos-shield.svg" alt="" className="h-7 w-7 sophos-icon" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-display font-bold tracking-tight flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#2006F7] dark:text-[#00EDFF] sm:hidden" aria-hidden />
                Sophos Firewall Health Check
              </h1>
              <p className="text-xs text-muted-foreground">
                Sales Engineer quick check — Sophos best practices (not compliance frameworks)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {seAuth.seProfile && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {seAuth.seProfile.email}
              </span>
            )}
            {seAuth.seProfile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg gap-2 w-fit"
                onClick={() => setSeManagementOpen(true)}
              >
                <PanelRight className="h-4 w-4" />
                Management
              </Button>
            )}
            <Button variant="outline" size="sm" className="rounded-lg gap-2 w-fit" onClick={seAuth.signOut}>
              Sign out
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg gap-2 w-fit" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                FireComply app
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 mx-auto max-w-5xl w-full px-4 py-8 space-y-8">
        {(activeStep === "landing" || activeStep === "analyzing") && (
          <section className="space-y-6" aria-label="Data sources">
            {activeStep === "analyzing" && (
              <div
                className="rounded-xl border border-[#2006F7]/30 bg-[#2006F7]/[0.04] dark:bg-[#2006F7]/[0.08] p-4 text-center space-y-1"
                role="status"
                aria-live="polite"
              >
                <p className="font-semibold text-[#2006F7] dark:text-[#00EDFF]">Analysing configuration…</p>
                <p className="text-sm text-muted-foreground">Extracting sections and running deterministic checks.</p>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <Card data-tour="hc-upload" className="rounded-xl border border-[#2006F7]/30 bg-card md:col-span-1 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
                      HTML config upload
                    </CardTitle>
                    <Badge className="bg-[#00995a]/15 text-[#00995a] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3] border-0">
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
                    {configUploadRequests.filter((r) => r.status === "uploaded").length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs border-[#00995a]/30 text-[#00995a] hover:bg-[#00995a]/5"
                        onClick={() => setConfigUploadRequestsOpen(true)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {configUploadRequests.filter((r) => r.status === "uploaded").length} config{configUploadRequests.filter((r) => r.status === "uploaded").length !== 1 ? "s" : ""} ready to load
                      </Button>
                    )}
                    {configUploadRequests.filter((r) => r.status === "pending").length > 0 && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        {configUploadRequests.filter((r) => r.status === "pending").length} pending upload{configUploadRequests.filter((r) => r.status === "pending").length !== 1 ? "s" : ""}{" "}
                        <button type="button" className="underline hover:text-foreground" onClick={() => setConfigUploadRequestsOpen(true)}>View all</button>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card data-tour="hc-central" className="rounded-xl border border-border bg-card md:col-span-1 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
                      Sophos Central API
                    </CardTitle>
                    <Badge className="bg-[#00995a]/15 text-[#00995a] dark:bg-[#00F2B3]/10 dark:text-[#00F2B3] border-0">
                      Active
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Enter the customer&apos;s API credentials to discover their firewalls. Used for this session only —
                    never stored. Step-by-step setup:{" "}
                    <a
                      href="#central-api-help"
                      className="text-[#2006F7] dark:text-[#00EDFF] font-medium underline underline-offset-2"
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
                    disabled={centralBusy || !centralCreds.clientId.trim() || !centralCreds.clientSecret.trim()}
                    onClick={connectCentral}
                  >
                    {centralBusy ? "Connecting…" : "Connect & Discover Firewalls"}
                  </Button>
                  {centralValidated && (
                    <p className="text-[11px] flex items-center gap-1 text-[#00995a] dark:text-[#00F2B3]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Connected (session only — credentials not stored)
                    </p>
                  )}
                  {guestFirewallGroups.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/20 p-2 max-h-32 overflow-y-auto text-[11px] space-y-1">
                      {guestFirewallGroups.map((g) => {
                        const all = [g.primary, ...g.peers];
                        const serials = all.map((x) => x.serialNumber).filter(Boolean).join(" / ");
                        return (
                          <div key={guestHaGroupSelectValue(g)} className="flex justify-between gap-2 items-center">
                            <span className="font-medium truncate flex items-center gap-1.5 min-w-0">
                              {getFirewallDisplayName(g.primary)}
                              {g.isHA && (
                                <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-[#5A00FF]/15 text-[#5A00FF] dark:text-[#B529F7] shrink-0">
                                  HA
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground font-mono shrink-0 text-right">{serials || "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {centralUploadMatcher}
                </CardContent>
              </Card>

              <Card data-tour="hc-proxy" className="rounded-xl border border-dashed border-border bg-muted/10 md:col-span-1 opacity-80">
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
                    Managed proxy for customer Central access — <strong>not available yet</strong>. Use{" "}
                    <strong>Sophos Central API</strong> in the middle column; credential steps are in{" "}
                    <a
                      href="#central-api-help"
                      className="text-[#2006F7] dark:text-[#00EDFF] underline underline-offset-2 font-medium"
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
                  <FileText className="h-5 w-5 text-[#2006F7] dark:text-[#00EDFF]" />
                  Results
                </h2>
                <p className="text-sm text-muted-foreground">
                  {files.length} firewall file{files.length === 1 ? "" : "s"} analysed
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div
                  className="flex rounded-lg border border-border overflow-hidden"
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
                  <span className="flex items-center gap-1 text-[10px] font-medium text-[#00995a] dark:text-[#00F2B3] whitespace-nowrap">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden />
                    From Central
                  </span>
                )}
                <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setActiveStep("landing")}>
                  Add configurations
                </Button>
                <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={resetAll}>
                  New check
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
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
              <p className="rounded-lg border border-[#2006F7]/20 bg-[#2006F7]/5 dark:bg-[#00EDFF]/10 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Opened from saved history.</span> Best-practice scoring uses the
                saved Central-linked state. Connect to Sophos Central again if you need live discovery or licensing API data.
              </p>
            )}

            {!centralValidated && (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                  <Wifi className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
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
                  disabled={centralBusy || !centralCreds.clientId.trim() || !centralCreds.clientSecret.trim()}
                  onClick={connectCentral}
                >
                  {centralBusy ? "Connecting…" : "Connect"}
                </Button>
              </div>
            )}
            {centralValidated && (
              <p className="text-[11px] flex items-center gap-1 text-[#00995a] dark:text-[#00F2B3]">
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
              const allZones = [...new Set(Object.values(analysisResults).flatMap((r) => r.inspectionPosture.allWanSourceZones))];
              const allNets = [...new Set(Object.values(analysisResults).flatMap((r) => r.inspectionPosture.allWanSourceNetworks))];
              const missingWf = [
                ...new Set(Object.values(analysisResults).flatMap((r) => r.inspectionPosture.wanMissingWebFilterRuleNames)),
              ];
              const hasWanWebRules = Object.values(analysisResults).some(
                (r) => r.inspectionPosture.wanWebServiceRuleNames.length > 0,
              );
              if (allZones.length === 0 && allNets.length === 0 && missingWf.length === 0 && !hasWanWebRules) {
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
                      <Label htmlFor="hc-web-filter-compliance" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Web filter compliance
                      </Label>
                      <Select
                        value={webFilterComplianceMode}
                        onValueChange={(v) => setWebFilterComplianceMode(v as WebFilterComplianceMode)}
                      >
                        <SelectTrigger id="hc-web-filter-compliance" className="max-w-xs rounded-lg h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strict">Strict</SelectItem>
                          <SelectItem value="informational">Informational</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Strict surfaces WAN web-filter gaps as stronger findings; Informational lowers severity for scoped reviews.
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
              <Label
                className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
              >
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
                Auto-generated from licence, BP score, findings, and exclusions. Updates when you change settings. Both sections are included in PDF and HTML reports.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Save &amp; export</p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-lg bg-[#00995a] hover:bg-[#00995a]/90 text-white gap-1.5 w-fit"
                  disabled={savingCheck}
                  onClick={saveHealthCheck}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {savingCheck ? "Saving…" : "Save health check"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="rounded-lg gap-1.5 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
                  disabled={pdfBusy}
                  onClick={() => void handleDownloadHealthCheckZip()}
                >
                  {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {pdfBusy ? "Generating…" : "Download PDF + HTML"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5"
                  disabled={pdfBusy}
                  onClick={() => void handleDownloadHealthCheckPdf()}
                >
                  {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  PDF only
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5"
                  disabled={pdfBusy}
                  onClick={() => void handleDownloadHealthCheckHtml()}
                >
                  <FileText className="h-4 w-4" />
                  HTML only
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={exportSummaryJson}>
                  <Download className="h-4 w-4" />
                  Summary JSON
                </Button>
              </div>
            </div>

            <Suspense
              fallback={
                <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  Loading Sophos best practice…
                </div>
              }
            >
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
              />
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

        {seAuth.seProfile && (
          <SEHealthCheckHistory
            seProfileId={seAuth.seProfile.id}
            refreshTrigger={historyRefreshKey}
            preparedBy={effectivePreparedBy}
            onRestoreSnapshot={restoreFromSavedSnapshot}
          />
        )}

        <Collapsible
          id="central-api-help"
          open={centralApiHelpOpen}
          onOpenChange={setCentralApiHelpOpen}
          className="rounded-xl border border-border bg-card shadow-sm scroll-mt-28"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 rounded-t-xl transition-colors [&[data-state=open]]:rounded-b-none">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <HelpCircle className="h-4 w-4 shrink-0 text-[#2006F7] dark:text-[#00EDFF]" aria-hidden />
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
                To run a fuller <strong className="text-foreground">Sophos Firewall Health Check</strong>, you can
                optionally connect to the customer&apos;s <strong className="text-foreground">Sophos Central</strong>{" "}
                tenant. That lets this tool list discovered firewalls for context alongside your uploaded HTML/XML
                exports. API credentials are <strong className="text-foreground">not stored</strong> — they stay in your
                browser for this session only and are used solely to call Central for discovery during this check.
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
                    Select <strong className="text-foreground">Add Credential</strong> and enter a clear name and
                    summary (e.g. &quot;SE health check — read only&quot;).
                  </li>
                  <li>
                    Choose the <strong className="text-foreground">Service Principal Read Only</strong> role.
                  </li>
                  <li>
                    Click <strong className="text-foreground">Add</strong> to create the credential and note the{" "}
                    <strong className="text-foreground">Client ID</strong> and{" "}
                    <strong className="text-foreground">Client Secret</strong>.
                  </li>
                  <li>
                    Paste them into the <strong className="text-foreground">Sophos Central API</strong> fields on this
                    page, then use <strong className="text-foreground">Connect &amp; Discover Firewalls</strong> (start
                    screen) or <strong className="text-foreground">Connect</strong> (results view).
                  </li>
                  <li>
                    After uploading configuration files, use <strong className="text-foreground">Link each upload to a
                    Central firewall</strong> (entities XML often has no serial in the export — manual match is required).
                  </li>
                </ol>
              </div>
              <p>
                After you finish the health check, we recommend{" "}
                <strong className="text-foreground">removing the API credential</strong> in Sophos Central: open{" "}
                <strong className="text-foreground">API Credentials Management</strong>, find the credential, and use{" "}
                <strong className="text-foreground">Delete</strong>.
              </p>
              <p className="flex flex-wrap items-center gap-1.5">
                <span>Further reading:</span>
                <a
                  href="https://developer.sophos.com/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#2006F7] dark:text-[#00EDFF] font-medium hover:underline underline-offset-2"
                >
                  Sophos API getting started
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                <span className="text-muted-foreground">(Central admin UI steps are under Global Settings.)</span>
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </main>

      <footer className="border-t border-border mt-auto py-6 text-center text-xs text-muted-foreground space-y-2">
        <p>Powered by Sophos FireComply</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[#2006F7] dark:text-[#00EDFF] hover:underline underline-offset-2"
        >
          <ExternalLink className="h-3 w-3" />
          Return to main app
        </Link>
      </footer>

      <SeHealthCheckManagementDrawer open={seManagementOpen} onClose={() => setSeManagementOpen(false)} />

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
                <Label htmlFor="cu-customer-email">Customer email (optional)</Label>
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
                <Select value={String(configUploadDays)} onValueChange={(v) => setConfigUploadDays(parseInt(v))}>
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
                <div className="rounded-lg bg-[#00995a]/10 border border-[#00995a]/30 p-3 text-sm text-[#00995a] flex items-center gap-2">
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
                <Badge variant={configUploadStatus === "uploaded" ? "default" : "secondary"} className={cn(
                  configUploadStatus === "uploaded" && "bg-[#00995a] text-white",
                )}>
                  {configUploadStatus === "uploaded" ? "Config Uploaded" : "Waiting for customer…"}
                </Badge>
              </div>

              <div className="flex gap-2">
                {configUploadStatus === "uploaded" && (
                  <Button
                    type="button"
                    className="flex-1 gap-2 bg-[#00995a] hover:bg-[#00995a]/90"
                    disabled={configUploadLoading}
                    onClick={() => configUploadToken && handleLoadConfigFromUpload(configUploadToken)}
                  >
                    {configUploadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
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
                    {configUploadResending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
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
              My Upload Requests
            </DialogTitle>
            <DialogDescription>
              Manage config upload requests you&apos;ve sent to customers.
            </DialogDescription>
          </DialogHeader>

          {configUploadListLoading && configUploadRequests.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : configUploadRequests.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No upload requests yet.</p>
          ) : (
            <div className="space-y-3">
              {configUploadRequests.map((req) => {
                const isExpired = new Date(req.expires_at) <= new Date();
                const statusLabel = isExpired ? "Expired" : req.status === "uploaded" ? "Config Ready" : req.status === "downloaded" ? "Downloaded" : "Pending";
                const statusColor = isExpired ? "text-muted-foreground" : req.status === "uploaded" ? "text-[#00995a]" : req.status === "downloaded" ? "text-blue-500" : "text-amber-500";
                return (
                  <div key={req.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{req.customer_name || "Unnamed"}</span>
                        <span className={cn("text-xs font-medium", statusColor)}>{statusLabel}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
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
                          className="h-7 text-xs gap-1.5 bg-[#00995a] hover:bg-[#00995a]/90"
                          disabled={configUploadLoading}
                          onClick={() => handleLoadConfigFromUpload(req.token)}
                        >
                          {configUploadLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
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
                          {configUploadLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                          Re-download
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
        </div>
      </div>
    );
  }

  if (!seAuth.isAuthenticated) {
    const sophosSession =
      !!seAuth.user?.email && /@sophos\.com$/i.test(seAuth.user.email.trim());
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
                <span className="font-medium text-foreground">{seAuth.user.email}</span>, but this app couldn&apos;t
                read or create your row in <code className="text-xs bg-muted px-1 rounded">se_profiles</code>. That
                usually means database permissions (RLS), a missing migration, or a network issue — not your password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask your admin to verify <code className="text-xs bg-muted px-1 rounded">se_profiles</code> and Supabase
                policies, then try again.
              </p>
              <Button type="button" variant="default" className="w-full" onClick={() => void seAuth.signOut()}>
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return <SEAuthGate onSignIn={seAuth.signIn} onSignUp={seAuth.signUp} />;
  }

  return (
    <SEAuthProvider value={seAuth}>
      <HealthCheckInner />
    </SEAuthProvider>
  );
}

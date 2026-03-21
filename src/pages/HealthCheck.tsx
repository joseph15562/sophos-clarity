import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  Lock,
  Shield,
  Upload,
  Wifi,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { analyseConfig } from "@/lib/analyse-config";
import type { ExtractedSections } from "@/lib/extract-sections";
import { extractSections } from "@/lib/extract-sections";
import { computeSophosBPScore, type LicenceSelection, type SophosBPScore } from "@/lib/sophos-licence";
import { evaluateBaseline, BASELINE_TEMPLATES } from "@/lib/policy-baselines";
import { rawConfigToSections } from "@/lib/raw-config-to-sections";
import { parseEntitiesXml } from "@/lib/parse-entities-xml";
import { FileUpload, type UploadedFile } from "@/components/FileUpload";
import { HealthCheckDashboard } from "@/components/HealthCheckDashboard";
import { DpiExclusionBar } from "@/components/DpiExclusionBar";
import { WebFilterRuleExclusionBar } from "@/components/WebFilterRuleExclusionBar";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import { SEHealthCheckHistory } from "@/components/SEHealthCheckHistory";
import type { BrandingData } from "@/components/BrandingSetup";
import type { ParsedFile } from "@/hooks/use-report-generation";
import { buildPdfHtml } from "@/lib/report-export";
import { htmlDocumentStringToPdfBlob, sanitizePdfFilenamePart } from "@/lib/html-document-to-pdf-blob";
import { buildSEHealthCheckReportHtml } from "@/lib/se-health-check-report-html";
import { saveAs } from "file-saver";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSEAuthProvider, useSEAuth, SEAuthProvider } from "@/hooks/use-se-auth";
import { SEAuthGate } from "@/components/SEAuthGate";
import { supabase } from "@/integrations/supabase/client";

type ActiveStep = "landing" | "analyzing" | "results";

type EphemeralCentralCreds = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
};

type GuestTenantRow = { id: string; name: string; apiHost?: string };
type GuestFirewallRow = { id?: string; hostname?: string; name?: string; serialNumber?: string };

const CENTRAL_MATCH_NONE = "__none__";

/** Stable Select value for a Central firewall row (serial preferred). */
function centralFwSelectValue(fw: GuestFirewallRow, index: number): string {
  const s = fw.serialNumber?.trim();
  if (s) return `sn:${s}`;
  if (fw.id?.trim()) return `id:${fw.id}`;
  return `idx:${index}`;
}

function findGuestFirewallBySelectValue(options: GuestFirewallRow[], value: string): GuestFirewallRow | undefined {
  if (!value || value === CENTRAL_MATCH_NONE) return undefined;
  return options.find((fw, i) => centralFwSelectValue(fw, i) === value);
}

/** Current Select value for linking a ParsedFile to Central (by stored serial if any). */
function guestFirewallMatchValueForFile(file: ParsedFile, options: GuestFirewallRow[]): string {
  const sn = file.serialNumber?.trim();
  if (!sn) return CENTRAL_MATCH_NONE;
  const idx = options.findIndex((fw) => (fw.serialNumber || "").trim().toLowerCase() === sn.toLowerCase());
  if (idx < 0) return CENTRAL_MATCH_NONE;
  return centralFwSelectValue(options[idx], idx);
}

async function callGuestCentral<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sophos-central`;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string } & T;
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
  const [centralBusy, setCentralBusy] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<GuestTenantRow[]>([]);
  const [firewallOptions, setFirewallOptions] = useState<GuestFirewallRow[]>([]);
  const [licence, setLicence] = useState<LicenceSelection>({ tier: "xstream", modules: [] });
  const [dpiExemptZones, setDpiExemptZones] = useState<string[]>([]);
  const [dpiExemptNetworks, setDpiExemptNetworks] = useState<string[]>([]);
  const [webFilterComplianceMode, setWebFilterComplianceMode] = useState<WebFilterComplianceMode>("strict");
  const [webFilterExemptRuleNames, setWebFilterExemptRuleNames] = useState<string[]>([]);

  const baselineResults = useMemo(() => {
    const out: Record<string, ReturnType<typeof evaluateBaseline>> = {};
    for (const [label, ar] of Object.entries(analysisResults)) {
      out[label] = evaluateBaseline(SOPHOS_BP_TEMPLATE, ar);
    }
    return out;
  }, [analysisResults]);

  useEffect(() => {
    if (files.length === 0) {
      setActiveStep("landing");
      return;
    }
    const next: Record<string, AnalysisResult> = {};
    for (const f of files) {
      const label = f.label || f.fileName.replace(/\.(html|htm|xml)$/i, "");
      next[label] = analyseConfig(f.extractedData, {
        centralLinked: centralValidated,
        dpiExemptZones,
        dpiExemptNetworks,
        webFilterComplianceMode,
        webFilterExemptRuleNames,
      });
    }
    setAnalysisResults(next);
  }, [files, centralValidated, dpiExemptZones, dpiExemptNetworks, webFilterComplianceMode, webFilterExemptRuleNames]);

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
        setFirewallOptions(fwRes.items ?? []);
        toast.success(`Connected — found ${(fwRes.items ?? []).length} firewall(s) across ${tenants.length} tenant(s).`);
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
          const fw = findGuestFirewallBySelectValue(firewallOptions, optionValue);
          if (!fw) return f;
          const newLabel = (fw.hostname || fw.name || "").trim();
          return {
            ...f,
            serialNumber: fw.serialNumber,
            label: newLabel || f.label,
          };
        }),
      );
    },
    [firewallOptions],
  );

  const centralUploadMatcher = useMemo(() => {
    if (!centralValidated || firewallOptions.length === 0 || files.length === 0) return null;
    return (
      <div
        className="rounded-lg border border-dashed border-[#2006F7]/25 dark:border-[#00EDFF]/20 bg-muted/15 p-3 space-y-3"
        data-tour="hc-central-match"
      >
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Link each upload to a Central firewall.</span> Entities XML
          usually has no serial in the file — pick the device so tabs and saved checks use the right name.
        </p>
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="space-y-1">
              <Label className="text-[10px] text-muted-foreground font-normal truncate block" title={f.fileName}>
                {f.fileName}
              </Label>
              <Select
                value={guestFirewallMatchValueForFile(f, firewallOptions)}
                onValueChange={(v) => linkUploadToCentral(f.id, v)}
              >
                <SelectTrigger className="h-8 text-xs rounded-lg font-normal">
                  <SelectValue placeholder="Select Central firewall…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CENTRAL_MATCH_NONE}>Not linked</SelectItem>
                  {firewallOptions.map((fw, i) => (
                    <SelectItem key={centralFwSelectValue(fw, i)} value={centralFwSelectValue(fw, i)}>
                      {[fw.hostname || fw.name || "Firewall", fw.serialNumber].filter(Boolean).join(" — ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    );
  }, [centralValidated, firewallOptions, files, linkUploadToCentral]);

  const resetAll = useCallback(() => {
    setFiles([]);
    setAnalysisResults({});
    setActiveStep("landing");
    setCentralValidated(false);
    setTenantOptions([]);
    setFirewallOptions([]);
    setCentralCreds({ clientId: "", clientSecret: "", tenantId: "" });
    setDpiExemptZones([]);
    setDpiExemptNetworks([]);
    setWebFilterComplianceMode("strict");
    setWebFilterExemptRuleNames([]);
  }, []);

  const exportSummaryJson = useCallback(() => {
    const bp: Record<string, SophosBPScore> = {};
    for (const [label, ar] of Object.entries(analysisResults)) {
      bp[label] = computeSophosBPScore(ar, licence);
    }
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            licence,
            centralValidated,
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
  }, [analysisResults, baselineResults, centralValidated, licence]);

  const [customerName, setCustomerName] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);
  const [centralApiHelpOpen, setCentralApiHelpOpen] = useState(false);

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
      const scores = entries.map(([label, ar]) => {
        const bp = computeSophosBPScore(ar, licence);
        return { label, score: bp.overall, grade: bp.grade };
      });
      const avgScore = Math.round(scores.reduce((s, e) => s + e.score, 0) / scores.length);
      const grades = ["A", "B", "C", "D", "F"];
      const avgGrade = grades[Math.min(Math.floor((100 - avgScore) / 20), 4)];

      const { error } = await supabase
        .from("se_health_checks")
        .insert({
          se_user_id: seAuth.seProfile.id,
          customer_name: customerName.trim() || null,
          overall_score: avgScore,
          overall_grade: avgGrade,
          findings_count: allFindings.length,
          firewall_count: files.length,
          summary_json: { scores, topFindings: allFindings.slice(0, 10).map((f) => f.title ?? f.id) },
        } as Record<string, unknown>);

      if (error) throw error;
      toast.success("Health check saved to your history.");
    } catch (err) {
      console.warn("[health-check] save failed", err);
      toast.error("Could not save health check — " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSavingCheck(false);
    }
  }, [seAuth.seProfile, analysisResults, licence, customerName, files.length]);

  const handleDownloadHealthCheckPdf = useCallback(async () => {
    const labels = files
      .map((f) => f.label || f.fileName.replace(/\.(html|htm|xml)$/i, ""))
      .filter((l) => analysisResults[l]);
    if (labels.length === 0) {
      toast.error("No analysed configurations to include in the report.");
      return;
    }
    const bpByLabel: Record<string, SophosBPScore> = {};
    for (const label of labels) {
      const ar = analysisResults[label];
      if (ar) bpByLabel[label] = computeSophosBPScore(ar, licence);
    }
    const preparedBy =
      seAuth.seProfile?.displayName?.trim() ||
      seAuth.seProfile?.email?.trim() ||
      "Sales Engineer";
    const inner = buildSEHealthCheckReportHtml({
      labels,
      files,
      analysisResults,
      baselineResults,
      bpByLabel,
      licence,
      customerName,
      preparedBy,
      dpiExemptZones,
      dpiExemptNetworks,
      webFilterComplianceMode,
      webFilterExemptRuleNames,
      centralValidated,
      generatedAt: new Date(),
      appVersion:
        typeof import.meta.env.VITE_APP_VERSION === "string" ? import.meta.env.VITE_APP_VERSION : undefined,
    });
    const branding: BrandingData = {
      companyName: "Sophos FireComply",
      customerName: customerName.trim(),
      logoUrl: null,
      environment: "",
      country: "",
      selectedFrameworks: [],
      preparedBy: seAuth.seProfile?.displayName?.trim() || seAuth.seProfile?.email?.trim() || "",
      confidential: true,
    };
    const html = buildPdfHtml(inner, "Sophos Firewall Health Check", branding, {
      theme: "light",
      omitInteractiveChrome: true,
    });
    setPdfBusy(true);
    try {
      const blob = await htmlDocumentStringToPdfBlob(html);
      const part = sanitizePdfFilenamePart(customerName);
      const date = new Date().toISOString().slice(0, 10);
      saveAs(blob, `Sophos-Firewall-Health-Check-${part}-${date}.pdf`);
      toast.success("PDF downloaded.");
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
    seAuth.seProfile,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterComplianceMode,
    webFilterExemptRuleNames,
    centralValidated,
  ]);

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
                  {firewallOptions.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/20 p-2 max-h-32 overflow-y-auto text-[11px] space-y-1">
                      {firewallOptions.map((fw, i) => (
                        <div key={fw.id ?? String(i)} className="flex justify-between gap-2">
                          <span className="font-medium truncate">{fw.hostname || fw.name || "Firewall"}</span>
                          <span className="text-muted-foreground font-mono shrink-0">{fw.serialNumber}</span>
                        </div>
                      ))}
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
              <div className="flex flex-wrap gap-2">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(["standard", "xstream"] as const).map((tier) => (
                    <Button
                      key={tier}
                      type="button"
                      variant={licence.tier === tier ? "default" : "ghost"}
                      size="sm"
                      className="rounded-none px-3 text-xs capitalize"
                      onClick={() => setLicence({ tier, modules: [] })}
                    >
                      {tier}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="rounded-lg gap-1.5 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
                  disabled={pdfBusy}
                  onClick={() => void handleDownloadHealthCheckPdf()}
                >
                  {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {pdfBusy ? "Generating PDF…" : "Download PDF"}
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={exportSummaryJson}>
                  <Download className="h-4 w-4" />
                  Summary JSON
                </Button>
                <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setActiveStep("landing")}>
                  Add configurations
                </Button>
                <Button type="button" variant="secondary" size="sm" className="rounded-lg" onClick={resetAll}>
                  New check
                </Button>
              </div>
            </div>

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
                Sophos Central connected — {firewallOptions.length} firewall(s) discovered
              </p>
            )}
            {centralUploadMatcher}

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px] max-w-xs space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Customer name (optional)
                </label>
                <Input
                  className="rounded-lg text-sm h-9"
                  placeholder="Acme Corp"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="rounded-lg bg-[#00995a] hover:bg-[#00995a]/90 text-white gap-1.5"
                disabled={savingCheck}
                onClick={saveHealthCheck}
              >
                <CheckCircle2 className="h-4 w-4" />
                {savingCheck ? "Saving…" : "Save health check"}
              </Button>
            </div>

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

            <HealthCheckDashboard
              files={files}
              analysisResults={analysisResults}
              licence={licence}
              baselineResults={baselineResults}
            />
          </section>
        )}

        {seAuth.seProfile && (
          <SEHealthCheckHistory seProfileId={seAuth.seProfile.id} />
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
    </div>
  );
}

export default function HealthCheck() {
  const seAuth = useSEAuthProvider();

  if (seAuth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="animate-spin h-6 w-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full" />
      </div>
    );
  }

  if (!seAuth.isAuthenticated) {
    return <SEAuthGate onSignIn={seAuth.signIn} onSignUp={seAuth.signUp} />;
  }

  return (
    <SEAuthProvider value={seAuth}>
      <HealthCheckInner />
    </SEAuthProvider>
  );
}

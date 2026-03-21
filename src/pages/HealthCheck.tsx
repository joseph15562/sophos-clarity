import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
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
import { SEHealthCheckHistory } from "@/components/SEHealthCheckHistory";
import type { ParsedFile } from "@/hooks/use-report-generation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
      next[label] = analyseConfig(f.extractedData, { centralLinked: centralValidated });
    }
    setAnalysisResults(next);
  }, [files, centralValidated]);

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

  const validateCentral = useCallback(async () => {
    setCentralBusy(true);
    try {
      await callGuestCentral({ mode: "guest_health_ping", clientId: centralCreds.clientId, clientSecret: centralCreds.clientSecret });
      setCentralValidated(true);
      toast.success("Sophos Central API credentials validated.");
    } catch (e) {
      setCentralValidated(false);
      toast.error(e instanceof Error ? e.message : "Could not validate Central credentials");
    } finally {
      setCentralBusy(false);
    }
  }, [centralCreds.clientId, centralCreds.clientSecret]);

  const discoverTenants = useCallback(async () => {
    setCentralBusy(true);
    try {
      const res = await callGuestCentral<{ items: GuestTenantRow[] }>({
        mode: "guest_health_tenants",
        clientId: centralCreds.clientId,
        clientSecret: centralCreds.clientSecret,
      });
      setTenantOptions(res.items ?? []);
      if ((res.items ?? []).length === 1) {
        setCentralCreds((c) => ({ ...c, tenantId: res.items[0].id }));
      }
      toast.success(`Found ${(res.items ?? []).length} tenant(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not list tenants");
    } finally {
      setCentralBusy(false);
    }
  }, [centralCreds.clientId, centralCreds.clientSecret]);

  const listFirewalls = useCallback(async () => {
    if (!centralCreds.tenantId.trim()) {
      toast.error("Enter a tenant ID first.");
      return;
    }
    setCentralBusy(true);
    try {
      const res = await callGuestCentral<{ items: GuestFirewallRow[] }>({
        mode: "guest_health_firewalls",
        clientId: centralCreds.clientId,
        clientSecret: centralCreds.clientSecret,
        tenantId: centralCreds.tenantId.trim(),
      });
      setFirewallOptions(res.items ?? []);
      toast.success(`Found ${(res.items ?? []).length} firewall(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not list firewalls");
    } finally {
      setCentralBusy(false);
    }
  }, [centralCreds.clientId, centralCreds.clientSecret, centralCreds.tenantId]);

  const resetAll = useCallback(() => {
    setFiles([]);
    setAnalysisResults({});
    setActiveStep("landing");
    setCentralValidated(false);
    setTenantOptions([]);
    setFirewallOptions([]);
    setCentralCreds({ clientId: "", clientSecret: "", tenantId: "" });
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
  const [savingCheck, setSavingCheck] = useState(false);

  const saveHealthCheck = useCallback(async () => {
    if (!seAuth.seProfile) return;
    const entries = Object.entries(analysisResults);
    if (entries.length === 0) return;

    setSavingCheck(true);
    try {
      const allFindings = entries.flatMap(([, ar]) => ar.findings ?? []);
      const scores = entries.map(([label, ar]) => {
        const bp = computeSophosBPScore(ar, licence);
        return { label, score: bp.overallScore, grade: bp.overallGrade };
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
                    Validate OAuth access and list tenants/firewalls. Central does not expose full HTML config via API — upload the device export using the first card.
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
                    placeholder="Client secret"
                    type="password"
                    autoComplete="off"
                    value={centralCreds.clientSecret}
                    onChange={(e) => {
                      setCentralValidated(false);
                      setCentralCreds((c) => ({ ...c, clientSecret: e.target.value }));
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-lg bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background dark:hover:bg-[#00EDFF]/90"
                      disabled={centralBusy || !centralCreds.clientId.trim() || !centralCreds.clientSecret.trim()}
                      onClick={validateCentral}
                    >
                      Validate credentials
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-lg"
                      disabled={centralBusy || !centralCreds.clientId.trim() || !centralCreds.clientSecret.trim()}
                      onClick={discoverTenants}
                    >
                      Discover tenants
                    </Button>
                  </div>
                  {tenantOptions.length > 0 && (
                    <label className="block text-[11px] text-muted-foreground space-y-1">
                      <span>Tenant</span>
                      <select
                        className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs"
                        value={centralCreds.tenantId}
                        onChange={(e) => setCentralCreds((c) => ({ ...c, tenantId: e.target.value }))}
                      >
                        <option value="">Select tenant…</option>
                        {tenantOptions.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name || t.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Input
                    className="rounded-lg font-mono text-xs h-9"
                    placeholder="Tenant ID (UUID)"
                    value={centralCreds.tenantId}
                    onChange={(e) => setCentralCreds((c) => ({ ...c, tenantId: e.target.value }))}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-lg w-full"
                    disabled={centralBusy || !centralCreds.tenantId.trim() || !centralCreds.clientSecret.trim()}
                    onClick={listFirewalls}
                  >
                    List firewalls for tenant
                  </Button>
                  {centralValidated && (
                    <p className="text-[11px] flex items-center gap-1 text-[#00995a] dark:text-[#00F2B3]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      API credentials validated (session only — not stored)
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
                  <CardDescription className="text-xs">Managed proxy for customer Central access.</CardDescription>
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

import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Lock,
  Upload,
  Wifi,
  Copy,
  XCircle,
  UserCheck,
  Send,
  CalendarClock,
  RotateCcw,
  Search,
  FileSpreadsheet,
} from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { HealthCheckDashboard } from "@/components/HealthCheckDashboard2";
import { SEScoreTrendChart } from "@/components/SEScoreTrendChart";
import { FirmwareEolWarnings } from "@/components/FirmwareEolWarnings";
import { TeamDashboard } from "@/components/TeamDashboard";
import { DpiExclusionBar } from "@/components/DpiExclusionBar2";
import { SeHeartbeatScopeBar } from "@/components/SeHeartbeatScopeBar2";
import {
  SeThreatResponseAckBar,
  SeDnsProtectionAckBar,
} from "@/components/SeThreatResponseAckBar2";
import { WebFilterRuleExclusionBar } from "@/components/WebFilterRuleExclusionBar2";
import { SEHealthCheckHistory } from "@/components/SEHealthCheckHistory2";
import { SeHealthCheckManagementDrawer } from "@/components/SeHealthCheckManagementDrawer2";
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
import { useHealthCheckInnerModel } from "./health-check-inner-context";
import { HealthCheckInnerHeader } from "./HealthCheckInnerHeader";
import { HealthCheckCentralApiHelp } from "./HealthCheckCentralApiHelp";
import { EmptyState } from "@/components/EmptyState";
import { guestHaGroupSelectValue } from "@/lib/guest-central-ha-groups";
import { getFirewallDisplayName } from "@/lib/sophos-central";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import { SE_HEALTH_CHECK_BP_OVERRIDES_KEY } from "@/lib/se-health-check-bp-v2";

const SophosBestPractice = lazy(() =>
  import("@/components/SophosBestPractice2").then((m) => ({ default: m.SophosBestPractice })),
);

export function HealthCheckInnerLayout() {
  const {
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
  } = useHealthCheckInnerModel();

  return (
    <div
      data-tour="health-check"
      data-testid="se-health-check-root"
      className="min-h-screen flex flex-col bg-background text-foreground"
    >
      <HealthCheckInnerHeader
        seProfile={seAuth.seProfile}
        teamsLength={teams.length}
        activeStep={activeStep}
        onOpenManagement={() => setSeManagementOpen(true)}
        onSignOut={seAuth.signOut}
      />

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
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Reviewer name (CSV sign-off)"
                    className="h-8 max-w-[200px] text-xs"
                    value={reviewerSignOffDraft}
                    onChange={(e) => setReviewerSignOffDraft(e.target.value)}
                    disabled={!exportFieldsReady}
                    aria-label="Reviewer name for CSV sign-off"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!exportFieldsReady}
                    onClick={applyReviewerSignOff}
                  >
                    Record sign-off
                  </Button>
                  {reviewerSignOff && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={clearReviewerSignOff}
                    >
                      Clear
                    </Button>
                  )}
                </div>
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

        <HealthCheckCentralApiHelp open={centralApiHelpOpen} onOpenChange={setCentralApiHelpOpen} />
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
            <EmptyState
              className="py-6"
              title="No upload requests yet"
              description="Create a secure link from the SE Health Check flow to let customers upload entities.xml."
            />
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

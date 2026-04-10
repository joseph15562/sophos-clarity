import { lazy, Suspense } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Link2,
  Loader2,
  Lock,
  Copy,
  XCircle,
  Send,
  CalendarClock,
  FileSpreadsheet,
  Wifi,
} from "lucide-react";
import { HealthCheckDashboard } from "@/components/HealthCheckDashboard2";
import { DpiExclusionBar } from "@/components/DpiExclusionBar2";
import { SeHeartbeatScopeBar } from "@/components/SeHeartbeatScopeBar2";
import {
  SeThreatResponseAckBar,
  SeDnsProtectionAckBar,
} from "@/components/SeThreatResponseAckBar2";
import { WebFilterRuleExclusionBar } from "@/components/WebFilterRuleExclusionBar2";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useHealthCheckInnerModel, type HealthCheckInnerModel } from "./health-check-inner-context";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";
import { SE_HEALTH_CHECK_BP_OVERRIDES_KEY } from "@/lib/se-health-check-bp-v2";

const SophosBestPractice = lazy(() =>
  import("@/components/SophosBestPractice2").then((m) => ({ default: m.SophosBestPractice })),
);

function HealthCheckResultsSectionBody(model: HealthCheckInnerModel) {
  return (
    <section className="space-y-6" aria-label="Health check results">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-accent" />
            Results
          </h2>
          <p className="text-sm text-muted-foreground">
            {model.files.length} firewall file{model.files.length === 1 ? "" : "s"} analysed
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div
            className="flex rounded-lg border border-border overflow-hidden"
            data-tour="hc-licence-toggle"
            title={
              model.licenceLockedByCentral
                ? "Licence tier is auto-detected from Sophos Central (matched firewall serial)."
                : "Licence tier for Sophos best practice scoring (same as Sophos Licence Selection below)."
            }
          >
            {(["standard", "xstream"] as const).map((tier) => (
              <Button
                key={tier}
                type="button"
                variant={model.licence.tier === tier ? "default" : "ghost"}
                size="sm"
                className="rounded-none px-3 text-xs capitalize"
                disabled={model.licenceLockedByCentral}
                onClick={() => model.setLicence({ tier, modules: [] })}
              >
                {tier}
              </Button>
            ))}
          </div>
          {model.licenceLockedByCentral && (
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
            onClick={() => model.setActiveStep("landing")}
          >
            Add configurations
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-lg"
            onClick={model.resetAll}
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
            value={model.customerName}
            onChange={(e) => model.setCustomerName(e.target.value)}
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
            value={model.customerEmail}
            onChange={(e) => model.setCustomerEmail(e.target.value)}
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
            value={model.preparedFor}
            onChange={(e) => model.setPreparedFor(e.target.value)}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Shown on the report cover, PDF, HTML, and saved health checks.
        </p>
      </div>

      {model.replayCentralLinked && !model.centralValidated && (
        <p className="rounded-lg border border-brand-accent/20 bg-brand-accent/5 dark:bg-[#00EDFF]/10 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Opened from saved history.</span>{" "}
          Best-practice scoring uses the saved Central-linked state. Connect to Sophos Central again
          if you need live discovery or licensing API data.
        </p>
      )}

      {!model.centralValidated && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Wifi className="h-4 w-4 text-brand-accent" />
            Sophos Central
          </div>
          <Input
            className="rounded-lg font-mono text-xs h-9 flex-1 min-w-[140px]"
            placeholder="Client ID"
            autoComplete="off"
            value={model.centralCreds.clientId}
            onChange={(e) => model.setCentralCreds((c) => ({ ...c, clientId: e.target.value }))}
          />
          <Input
            className="rounded-lg font-mono text-xs h-9 flex-1 min-w-[140px]"
            placeholder="Client Secret"
            type="password"
            autoComplete="off"
            value={model.centralCreds.clientSecret}
            onChange={(e) => model.setCentralCreds((c) => ({ ...c, clientSecret: e.target.value }))}
          />
          <Button
            type="button"
            size="sm"
            className="rounded-lg shrink-0 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background dark:hover:bg-[#00EDFF]/90"
            disabled={
              model.centralBusy ||
              !model.centralCreds.clientId.trim() ||
              !model.centralCreds.clientSecret.trim()
            }
            onClick={model.connectCentral}
          >
            {model.centralBusy ? "Connecting…" : "Connect"}
          </Button>
        </div>
      )}
      {model.centralValidated && (
        <p className="text-[11px] flex items-center gap-1 text-[#00F2B3] dark:text-[#00F2B3]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sophos Central connected — {model.firewallOptions.length} device(s) from Central
          {model.guestFirewallGroups.length < model.firewallOptions.length
            ? ` — ${model.guestFirewallGroups.length} link targets (HA merged by hostname)`
            : ""}
        </p>
      )}
      {model.centralUploadMatcher}

      <SeHeartbeatScopeBar
        excludeHeartbeatCheck={model.seExcludeSecurityHeartbeat}
        onExcludeChange={model.setSeExcludeSecurityHeartbeat}
      />

      <SeThreatResponseAckBar
        mdrAcknowledged={model.seMdrThreatFeedsAck}
        ndrAcknowledged={model.seNdrEssentialsAck}
        onMdrChange={model.setSeMdrThreatFeedsAck}
        onNdrChange={model.setSeNdrEssentialsAck}
      />

      <SeDnsProtectionAckBar
        acknowledged={model.seDnsProtectionAck}
        onChange={model.setSeDnsProtectionAck}
      />

      {(() => {
        const allZones = [
          ...new Set(
            Object.values(model.analysisResults).flatMap(
              (r) => r.inspectionPosture.allWanSourceZones,
            ),
          ),
        ];
        const allNets = [
          ...new Set(
            Object.values(model.analysisResults).flatMap(
              (r) => r.inspectionPosture.allWanSourceNetworks,
            ),
          ),
        ];
        const missingWf = [
          ...new Set(
            Object.values(model.analysisResults).flatMap(
              (r) => r.inspectionPosture.wanMissingWebFilterRuleNames,
            ),
          ),
        ];
        const hasWanWebRules = Object.values(model.analysisResults).some(
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
                excludedZones={model.dpiExemptZones}
                onZonesChange={model.setDpiExemptZones}
                detectedNetworks={allNets}
                excludedNetworks={model.dpiExemptNetworks}
                onNetworksChange={model.setDpiExemptNetworks}
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
                  value={model.webFilterComplianceMode}
                  onValueChange={(v) =>
                    model.setWebFilterComplianceMode(v as WebFilterComplianceMode)
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
                  Strict surfaces WAN web-filter gaps as stronger findings; Informational lowers
                  severity for scoped reviews.
                </p>
              </div>
            )}
            {missingWf.length > 0 && (
              <WebFilterRuleExclusionBar
                candidateRuleNames={missingWf}
                exemptRuleNames={model.webFilterExemptRuleNames}
                onChange={model.setWebFilterExemptRuleNames}
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
          value={model.autoSeNotes}
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
            value={model.seNotesManual}
            onChange={(e) => model.setSeNotesManual(e.target.value)}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Auto-generated from licence, BP score, findings, and exclusions. Updates when you change
          settings. Both sections are included in PDF and HTML reports.
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
            disabled={model.savingCheck}
            onClick={model.saveHealthCheck}
          >
            <CheckCircle2 className="h-4 w-4" />
            {model.savingCheck ? "Saving…" : "Save health check"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-lg gap-1.5 w-fit"
            disabled={!model.savedCheckId || model.sharing}
            onClick={() => model.setShareDialogOpen(true)}
          >
            <Link2 className="h-4 w-4" />
            {model.shareToken ? "Shared" : "Share report"}
          </Button>
        </div>
        {!model.exportFieldsReady && (
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
            disabled={model.pdfBusy || !model.exportFieldsReady}
            onClick={() => void model.handleDownloadHealthCheckZip()}
          >
            {model.pdfBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {model.pdfBusy ? "Generating…" : "Download PDF + HTML"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg gap-1.5"
            disabled={model.pdfBusy || !model.exportFieldsReady}
            onClick={() => void model.handleDownloadHealthCheckPdf()}
          >
            {model.pdfBusy ? (
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
            disabled={model.pdfBusy || !model.exportFieldsReady}
            onClick={() => void model.handleDownloadHealthCheckHtml()}
          >
            <FileText className="h-4 w-4" />
            HTML only
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg gap-1.5"
            disabled={!model.exportFieldsReady}
            onClick={model.exportSummaryJson}
          >
            <Download className="h-4 w-4" />
            Summary JSON
          </Button>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Input
              placeholder="Reviewer name (CSV sign-off)"
              className="h-8 max-w-[200px] text-xs"
              value={model.reviewerSignOffDraft}
              onChange={(e) => model.setReviewerSignOffDraft(e.target.value)}
              disabled={!model.exportFieldsReady}
              aria-label="Reviewer name for CSV sign-off"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              disabled={!model.exportFieldsReady}
              onClick={model.applyReviewerSignOff}
            >
              Record sign-off
            </Button>
            {model.reviewerSignOff && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={model.clearReviewerSignOff}
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
            disabled={!model.exportFieldsReady}
            onClick={model.exportFindingsCsv}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Findings CSV
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-lg gap-1.5 bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
            disabled={
              model.sendingReport ||
              model.pdfBusy ||
              !model.files.length ||
              !model.exportFieldsReady
            }
            onClick={() => void model.handleSendReportToCustomer()}
          >
            {model.sendingReport ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {model.sendingReport
              ? "Sending…"
              : model.customerEmail.trim()
                ? `Send to ${model.customerEmail.trim()}`
                : "Send to customer"}
          </Button>
          {model.seAuth.seProfile?.email && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-lg gap-1.5 w-fit"
              disabled={
                model.sendingReportToSe ||
                model.pdfBusy ||
                !model.files.length ||
                !Object.keys(model.analysisResults).length
              }
              onClick={() => void model.handleSendReportToSE()}
            >
              {model.sendingReportToSe ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {model.sendingReportToSe ? "Sending…" : `Send to ${model.seAuth.seProfile.email}`}
            </Button>
          )}
        </div>

        {model.savedCheckId && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Follow-up reminder
            </p>
            {model.followupAt ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {new Date(model.followupAt).toLocaleDateString("en-GB", {
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
                  disabled={model.settingFollowup}
                  onClick={() => void model.handleSetFollowup(null)}
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
                  disabled={model.settingFollowup}
                  onClick={() => void model.handleSetFollowup(3)}
                >
                  3 months
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1"
                  disabled={model.settingFollowup}
                  onClick={() => void model.handleSetFollowup(6)}
                >
                  6 months
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={model.shareDialogOpen} onOpenChange={model.setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share health check report</DialogTitle>
            <DialogDescription>
              Create a public link that anyone can use to view this health check report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!model.shareToken ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link expires after</Label>
                  <Select
                    value={String(model.shareDays)}
                    onValueChange={(v) => model.setShareDays(Number(v))}
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
                  disabled={model.sharing}
                  onClick={() => void model.handleShareHealthCheck()}
                >
                  {model.sharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  {model.sharing ? "Generating…" : "Create share link"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Share link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={model.shareUrl ?? ""}
                      className="text-xs font-mono h-9 rounded-lg"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 rounded-lg shrink-0"
                      onClick={() => {
                        if (model.shareUrl) {
                          void navigator.clipboard.writeText(model.shareUrl);
                          toast.success("Link copied to clipboard.");
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {model.shareExpiry && (
                  <p className="text-[11px] text-muted-foreground">
                    Expires{" "}
                    {new Date(model.shareExpiry).toLocaleDateString("en-GB", {
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
                    onClick={() => void model.handleRevokeShare()}
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
            analysisResults={model.analysisResults}
            centralLicences={model.centralBpLicenceFlat}
            overridesStorageKey={SE_HEALTH_CHECK_BP_OVERRIDES_KEY}
            centralEnrichmentActive={model.centralLinkedForAnalysis}
            onManualOverridesChange={() => model.setBpOverrideRevision((n) => n + 1)}
            licence={model.licence}
            onLicenceChange={model.setLicence}
            centralHaConfirmedLabels={model.seCentralHaLabels}
            seThreatResponseAck={model.seThreatResponseAck}
            seExcludedBpChecks={model.seExcludedBpChecks}
            findingNotes={model.findingNotes}
            onFindingNoteChange={(checkId, note) =>
              model.setFindingNotes((prev) => {
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
        files={model.files}
        analysisResults={model.analysisResults}
        licence={model.licence}
        baselineResults={model.baselineResults}
        hideSophosBpCard
        seCentralSession={model.centralLinkedForAnalysis}
        seCentralHaLabels={model.seCentralHaLabels}
        bpOverrideRevision={model.bpOverrideRevision}
        seThreatResponseAck={model.seThreatResponseAck}
        seExcludedBpChecks={model.seExcludedBpChecks}
      />
    </section>
  );
}

/** Results step: customer fields, exclusions, export/share, BP + dashboard (see REVIEW architecture slice). */
export function HealthCheckResultsSection() {
  return <HealthCheckResultsSectionBody {...useHealthCheckInnerModel()} />;
}

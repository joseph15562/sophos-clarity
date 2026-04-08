import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Upload,
  Wifi,
  Copy,
  XCircle,
  RotateCcw,
  Search,
  UserCheck,
  Send,
} from "lucide-react";
import { SEScoreTrendChart } from "@/components/SEScoreTrendChart";
import { FirmwareEolWarnings } from "@/components/FirmwareEolWarnings";
import { TeamDashboard } from "@/components/TeamDashboard";
import { SEHealthCheckHistory } from "@/components/SEHealthCheckHistory2";
import { SeHealthCheckManagementDrawer } from "@/components/SeHealthCheckManagementDrawer2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { HealthCheckResultsSection } from "./HealthCheckResultsSection";
import { HealthCheckLandingSection } from "./HealthCheckLandingSection";

export function HealthCheckInnerLayout() {
  const {
    seAuth,
    activeTeam,
    activeTeamId,
    teams,
    files,
    activeStep,
    historyRefreshKey,
    effectivePreparedBy,
    restoreFromSavedSnapshot,
    seManagementOpen,
    setSeManagementOpen,
    firewallOptions,
    centralApiHelpOpen,
    setCentralApiHelpOpen,
    hasParsedConfigs,
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
    recheckSearchOpen,
    setRecheckSearchOpen,
    recheckQuery,
    recheckResults,
    recheckSearching,
    handleRecheckSearch,
    handleRecheckSelect,
    purgingCustomer,
    purgingAll,
    purgeByCustomer,
    purgeAllMyData,
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
        {(activeStep === "landing" || activeStep === "analyzing") && <HealthCheckLandingSection />}

        {activeStep === "results" && hasParsedConfigs && <HealthCheckResultsSection />}

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
        purgingCustomer={purgingCustomer}
        purgingAll={purgingAll}
        onPurgeByCustomer={purgeByCustomer}
        onPurgeAllMyData={purgeAllMyData}
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

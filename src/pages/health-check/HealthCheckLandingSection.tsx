import { CheckCircle2, Link2, Lock, RotateCcw, Upload, Wifi } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { guestHaGroupSelectValue } from "@/lib/guest-central-ha-groups";
import { getFirewallDisplayName } from "@/lib/sophos-central";
import { useHealthCheckInnerModel, type HealthCheckInnerModel } from "./health-check-inner-context";

function HealthCheckLandingSectionBody(model: HealthCheckInnerModel) {
  if (model.activeStep !== "landing" && model.activeStep !== "analyzing") return null;

  return (
    <section className="space-y-6" aria-label="Data sources">
      {model.activeStep === "analyzing" && (
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
            <FileUpload files={model.uploadedForPicker} onFilesChange={model.handleFilesChange} />
            <div className="mt-3 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={() => model.setConfigUploadDialogOpen(true)}
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
                onClick={() => model.setConfigUploadRequestsOpen(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Requests
                {model.configUploadRequests.filter((r) => r.status === "uploaded").length > 0 && (
                  <span className="ml-auto text-[10px] font-semibold text-[#00F2B3]">
                    {model.configUploadRequests.filter((r) => r.status === "uploaded").length} ready
                  </span>
                )}
                {model.configUploadRequests.filter((r) => r.status === "pending").length > 0 &&
                  model.configUploadRequests.filter((r) => r.status === "uploaded").length ===
                    0 && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {model.configUploadRequests.filter((r) => r.status === "pending").length}{" "}
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
                  model.setRecheckQuery("");
                  model.setRecheckResults([]);
                  model.setRecheckSearchOpen(true);
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
              Enter the customer&apos;s API credentials to discover their firewalls. Used for this
              session only — never stored. Step-by-step setup:{" "}
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
              value={model.centralCreds.clientId}
              onChange={(e) => {
                model.setCentralValidated(false);
                model.setCentralCreds((c) => ({ ...c, clientId: e.target.value }));
              }}
            />
            <Input
              className="rounded-lg font-mono text-xs h-9"
              placeholder="Client Secret"
              type="password"
              autoComplete="off"
              value={model.centralCreds.clientSecret}
              onChange={(e) => {
                model.setCentralValidated(false);
                model.setCentralCreds((c) => ({ ...c, clientSecret: e.target.value }));
              }}
            />
            <Button
              type="button"
              size="sm"
              className="rounded-lg w-full bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background dark:hover:bg-[#00EDFF]/90"
              disabled={
                model.centralBusy ||
                !model.centralCreds.clientId.trim() ||
                !model.centralCreds.clientSecret.trim()
              }
              onClick={model.connectCentral}
            >
              {model.centralBusy ? "Connecting…" : "Connect & Discover Firewalls"}
            </Button>
            {model.centralValidated && (
              <p className="text-[11px] flex items-center gap-1 text-[#00F2B3] dark:text-[#00F2B3]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected (session only — credentials not stored)
              </p>
            )}
            {model.guestFirewallGroups.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/20 p-2 max-h-32 overflow-y-auto text-[11px] space-y-1">
                {model.guestFirewallGroups.map((g) => {
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
            {model.centralUploadMatcher}
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
              Managed proxy for customer Central access — <strong>not available yet</strong>. Use{" "}
              <strong>Sophos Central API</strong> in the middle column; credential steps are in{" "}
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

      {model.hasParsedConfigs && (
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            type="button"
            className="rounded-xl bg-[#2006F7] hover:bg-[#2006F7]/90 text-white dark:bg-[#00EDFF] dark:text-background"
            onClick={() => model.setActiveStep("results")}
          >
            View health check results
          </Button>
        </div>
      )}
    </section>
  );
}

/** Landing / analysing step: uploads, Central session, proxy placeholder (see `HealthCheckResultsSection`). */
export function HealthCheckLandingSection() {
  return <HealthCheckLandingSectionBody {...useHealthCheckInnerModel()} />;
}

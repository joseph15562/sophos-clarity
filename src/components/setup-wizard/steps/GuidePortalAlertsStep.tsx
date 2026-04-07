import { Bell, Calendar, Globe, Webhook } from "lucide-react";
import {
  FeatureButton,
  FeatureOverlay,
  MockAlertPanel,
  MockClientPortalPanel,
  MockScheduledReports,
  MockWebhookPanel,
} from "../wizard-ui";

type Props = {
  activeOverlay: string | null;
  setActiveOverlay: (id: string | null) => void;
};

export function GuidePortalAlertsStep({ activeOverlay, setActiveOverlay }: Props) {
  return (
    <div className="space-y-5 relative">
      {activeOverlay === "client-portal" && (
        <FeatureOverlay
          title="Client Portal"
          subtitle="Branded assessment portal for your customers"
          onClose={() => setActiveOverlay(null)}
        >
          <MockClientPortalPanel />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Create branded, read-only
              portals for your customers. Each client gets their own secure view showing risk
              scores, reports, compliance status, and assessment history — with your MSP branding
              and logo.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "alerts" && (
        <FeatureOverlay
          title="Alerts & Notifications"
          subtitle="Email and webhook notifications"
          onClose={() => setActiveOverlay(null)}
        >
          <MockAlertPanel />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Configure alert rules to
              get notified when critical events happen — new critical findings, agents going
              offline, configuration drift, or licence expiry. Send alerts via email, webhook
              (Slack, Teams, etc.), or both.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "scheduled-reports" && (
        <FeatureOverlay
          title="Scheduled Reports"
          subtitle="Automated report delivery to customers"
          onClose={() => setActiveOverlay(null)}
        >
          <MockScheduledReports />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Schedule automatic report
              delivery — compliance, executive, or full suite — on a weekly, monthly, or quarterly
              basis. Reports are generated and emailed directly to your customers with your MSP
              branding.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "webhooks" && (
        <FeatureOverlay
          title="Webhook Integrations"
          subtitle="POST data to your PSA, RMM, or ticketing system"
          onClose={() => setActiveOverlay(null)}
        >
          <MockWebhookPanel />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Configure webhook endpoints
              to receive JSON payloads when key events happen — assessments complete, critical
              findings detected, reports saved, or agents go offline. Integrate with Slack, Teams,
              ConnectWise, Datto, or any system that accepts webhooks.
            </p>
          </div>
        </FeatureOverlay>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Portal, Alerts & Integrations
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Share results with customers through{" "}
          <strong className="text-foreground">branded portals</strong>, automate{" "}
          <strong className="text-foreground">scheduled reports</strong>, stay informed with{" "}
          <strong className="text-foreground">real-time alerts</strong>, and connect to your{" "}
          <strong className="text-foreground">existing tools via webhooks</strong>. Click each to
          learn more.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <FeatureButton
          icon={<Globe className="h-4 w-4" />}
          title="Client Portal"
          desc="Branded read-only portal for customers with scores and reports"
          color="text-[#005BC8]"
          onClick={() => setActiveOverlay("client-portal")}
        />
        <FeatureButton
          icon={<Bell className="h-4 w-4" />}
          title="Alerts"
          desc="Email and webhook alerts for critical findings and drift"
          color="text-[#F29400]"
          onClick={() => setActiveOverlay("alerts")}
        />
        <FeatureButton
          icon={<Calendar className="h-4 w-4" />}
          title="Scheduled Reports"
          desc="Auto-email compliance reports on a weekly, monthly, or quarterly basis"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("scheduled-reports")}
        />
        <FeatureButton
          icon={<Webhook className="h-4 w-4" />}
          title="Webhooks"
          desc="POST assessment data to your PSA, RMM, or ticketing system"
          color="text-[#6B5BFF]"
          onClick={() => setActiveOverlay("webhooks")}
        />
      </div>

      <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> Configure all of these from Settings.
          Client portals and scheduled reports are especially useful for MSPs who want to give
          customers ongoing visibility into their security posture.
        </p>
      </div>
    </div>
  );
}

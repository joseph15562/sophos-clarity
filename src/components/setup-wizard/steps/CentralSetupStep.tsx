import { lazy, Suspense } from "react";
import { MockTenantDashboard, SetupPreviewFrame, Skeleton } from "../wizard-ui";

const CentralIntegration = lazy(() =>
  import("@/components/CentralIntegration").then((m) => ({ default: m.CentralIntegration })),
);

export function CentralSetupStep() {
  return (
    <div className="space-y-5">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] items-start">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
            Live estate enrichment
          </div>
          <h3 className="text-xl font-display font-black tracking-tight text-foreground mt-2">
            Connect Sophos Central
          </h3>
          <p className="text-sm font-medium text-foreground/80 dark:text-white/75 leading-relaxed">
            Link your Sophos Central Partner or Tenant account to enrich reports with live firewall
            data, licence info, and alerts. You can skip this and connect later from Management →
            Central.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            On Assess, a status card shows connection health; use <strong>Check again</strong> or{" "}
            <strong>Open Central settings</strong> if verification fails.
          </p>
          <SetupPreviewFrame
            title="Managed estate visibility"
            subtitle="Linking Sophos Central adds live tenancy, device, and enrichment context to your compliance workflow."
          >
            <MockTenantDashboard />
          </SetupPreviewFrame>
        </div>
        <div className="rounded-2xl border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(32,6,247,0.04),rgba(0,242,179,0.03))] dark:bg-[linear-gradient(135deg,rgba(32,6,247,0.10),rgba(0,242,179,0.04))] shadow-card">
          <Suspense fallback={<Skeleton />}>
            <CentralIntegration />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

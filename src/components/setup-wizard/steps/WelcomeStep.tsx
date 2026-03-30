import { Building2, Globe, ListChecks, Shield, Sparkles } from "lucide-react";
import { MockGauge, MockInspectionPosture, MockSeverityBar, SetupPreviewFrame } from "../wizard-ui";

export function WelcomeStep({ orgName }: { orgName?: string }) {
  return (
    <div className="space-y-5 py-2 max-w-2xl mx-auto">
      <div className="text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#2006F7] to-[#00EDFF] flex items-center justify-center shadow-lg shadow-[#2006F7]/20">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-accent">
          First-time setup
        </div>
        <h2 className="text-2xl font-display font-black text-foreground tracking-tight leading-tight">
          Welcome to Sophos FireComply
          {orgName ? <span className="text-brand-accent">, {orgName}</span> : null}
        </h2>
        <p className="text-sm font-medium text-foreground/75 dark:text-white/70 max-w-md mx-auto leading-relaxed">
          Get your workspace ready in about 3 minutes. We&apos;ll configure branding, connect Sophos
          Central, and prepare you to assess, report, and remediate.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl border border-border bg-card/70 p-2.5 text-center">
          <Building2 className="h-5 w-5 text-[#2006F7] dark:text-[#6B5BFF] mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-foreground leading-tight">Branding</p>
          <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">Company & Central</p>
        </div>
        <div className="rounded-xl border border-border bg-card/70 p-2.5 text-center">
          <Shield className="h-5 w-5 text-[#00F2B3] mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-foreground leading-tight">Analysis</p>
          <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">Posture & reports</p>
        </div>
        <div className="rounded-xl border border-border bg-card/70 p-2.5 text-center">
          <ListChecks className="h-5 w-5 text-[#F29400] mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-foreground leading-tight">Remediation</p>
          <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
            Priorities & roadmap
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/70 p-2.5 text-center">
          <Globe className="h-5 w-5 text-[#005BC8] dark:text-[#00EDFF] mx-auto mb-1" />
          <p className="text-[11px] font-semibold text-foreground leading-tight">Delivery</p>
          <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">Portal & alerts</p>
        </div>
      </div>

      <SetupPreviewFrame
        title="What you'll configure"
        subtitle="Security posture scoring, compliance mapping, and customer-ready reporting from a single config export."
      >
        <div className="grid gap-3 grid-cols-[110px_1fr] items-start">
          <div className="flex justify-center">
            <MockGauge score={82} grade="B" color="#00F2B3" />
          </div>
          <div className="space-y-2">
            <MockSeverityBar />
            <div className="rounded-lg border border-border bg-muted/20 p-2">
              <MockInspectionPosture />
            </div>
          </div>
        </div>
      </SetupPreviewFrame>
    </div>
  );
}

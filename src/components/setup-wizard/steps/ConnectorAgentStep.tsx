import { Download, Key, Plug, RefreshCw } from "lucide-react";
import { GuideStep } from "../wizard-ui";

export function ConnectorAgentStep() {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          FireComply Connector Agent
        </h3>
        <p className="text-[11px] text-muted-foreground">
          The Connector Agent is a lightweight desktop app that sits on your customer&apos;s network
          and automatically pulls firewall configs, runs security assessments, and submits results
          back to FireComply — on a schedule, with no manual exports needed.
        </p>
      </div>

      <div className="space-y-3">
        <GuideStep
          number={1}
          title="Register an agent"
          description="Open the Management Panel > Connector Agents > Register Agent. Enter the firewall details and schedule. An API key is generated for you."
          icon={<Key className="h-4 w-4" />}
          color="text-[#2006F7]"
        />
        <GuideStep
          number={2}
          title="Download & install"
          description="Download the FireComply Connector for Windows, macOS, or Linux. Install it on a machine that can reach the firewall's admin interface."
          icon={<Download className="h-4 w-4" />}
          color="text-[#005BC8]"
        />
        <GuideStep
          number={3}
          title="Set up the agent"
          description="Paste your API key into the setup wizard, add the firewall's IP/hostname and API credentials, choose a schedule, and start monitoring."
          icon={<Plug className="h-4 w-4" />}
          color="text-[#6B5BFF]"
        />
        <GuideStep
          number={4}
          title="Automated assessments"
          description="The agent pulls configs via the Sophos XML API, runs the same deterministic analysis, and submits scores, findings, and drift detection to your dashboard."
          icon={<RefreshCw className="h-4 w-4" />}
          color="text-[#00F2B3]"
        />
      </div>

      <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-3 space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          What you&apos;ll see in the dashboard
        </p>
        <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center gap-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#00F2B3]" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-foreground">HQ Primary Agent</p>
            <p className="text-[9px] text-muted-foreground">Acme Corp · 192.168.1.1:4444</p>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#009CFB]/10 text-[#009CFB] font-semibold">
            v22.0
          </span>
          <span className="text-[10px] font-bold text-[#00F2B3]">82/B</span>
          <span className="text-[9px] text-muted-foreground">2h ago</span>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center gap-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F29400]" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-foreground">Branch Office Agent</p>
            <p className="text-[9px] text-muted-foreground">Acme Corp · 10.0.0.1:4444</p>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F29400]/10 text-[#F29400] font-semibold">
            v21.0
          </span>
          <span className="text-[10px] font-bold text-[#F29400]">58/D</span>
          <span className="text-[9px] text-muted-foreground">6h ago</span>
        </div>
      </div>

      <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Optional:</strong> The agent is completely optional.
          You can always upload firewall configs manually instead. The agent just automates the
          process for ongoing monitoring.
        </p>
      </div>
    </div>
  );
}

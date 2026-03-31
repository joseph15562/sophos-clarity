import { TrendingUp, Map, ClipboardList } from "lucide-react";
import {
  FeatureOverlay,
  FeatureButton,
  MockRemediationProgress,
  MockRemediationRoadmap,
  MockPlaybooks,
} from "../wizard-ui";

type Props = {
  activeOverlay: string | null;
  setActiveOverlay: (id: string | null) => void;
};

export function GuideRemediationStep({ activeOverlay, setActiveOverlay }: Props) {
  return (
    <div className="space-y-5 relative">
      {activeOverlay === "remediation-progress" && (
        <FeatureOverlay
          title="Remediation Progress"
          subtitle="Track fix progress across all findings"
          onClose={() => setActiveOverlay(null)}
        >
          <MockRemediationProgress />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Track remediation status
              for every finding — mark items as fixed, in progress, or accepted risk. Progress bars
              show completion by severity so you can focus on what matters most.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "remediation-roadmap" && (
        <FeatureOverlay
          title="Remediation Roadmap"
          subtitle="Prioritised timeline with effort estimates"
          onClose={() => setActiveOverlay(null)}
        >
          <MockRemediationRoadmap />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Generates a prioritised
              remediation timeline based on finding severity and estimated effort. Critical issues
              first, then high, then medium — with suggested timelines for each phase.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "playbooks" && (
        <FeatureOverlay
          title="Remediation Playbooks"
          subtitle="Step-by-step guides for each finding"
          onClose={() => setActiveOverlay(null)}
        >
          <MockPlaybooks />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Each finding has a
              step-by-step playbook with exact navigation paths, CLI commands, and verification
              steps for the Sophos Firewall admin console. Follow along to fix issues quickly and
              correctly.
            </p>
          </div>
        </FeatureOverlay>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Remediation
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Plan, prioritise, and track the work needed to{" "}
          <strong className="text-foreground">fix security findings</strong> — from individual
          playbooks to full remediation roadmaps. Click each to preview.
        </p>
      </div>

      <div className="space-y-2.5">
        <FeatureButton
          icon={<TrendingUp className="h-4 w-4" />}
          title="Progress Tracking"
          desc="Track fix progress across all findings with completion metrics by severity"
          color="text-[#00F2B3]"
          onClick={() => setActiveOverlay("remediation-progress")}
        />
        <FeatureButton
          icon={<Map className="h-4 w-4" />}
          title="Remediation Roadmap"
          desc="Prioritised timeline of recommended fixes with effort estimates"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("remediation-roadmap")}
        />
        <FeatureButton
          icon={<ClipboardList className="h-4 w-4" />}
          title="Playbooks"
          desc="Step-by-step remediation guides with exact navigation paths and commands"
          color="text-[#6B5BFF]"
          onClick={() => setActiveOverlay("playbooks")}
        />
      </div>

      <div className="rounded-lg bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 border border-[#00F2B3]/15 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> The Remediation tab appears when
          findings are detected. Use it to demonstrate ongoing security improvements to your
          customers.
        </p>
      </div>
    </div>
  );
}

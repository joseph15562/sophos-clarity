import { Wrench, Layers, Trash2, Scale } from "lucide-react";
import {
  FeatureOverlay,
  FeatureButton,
  MockRuleOptimiser,
  MockPolicyComplexity,
  MockUnusedObjects,
} from "../wizard-ui";

type Props = {
  activeOverlay: string | null;
  setActiveOverlay: (id: string | null) => void;
};

export function GuideOptimisationStep({ activeOverlay, setActiveOverlay }: Props) {
  return (
    <div className="space-y-5 relative">
      {activeOverlay === "rule-optimiser" && (
        <FeatureOverlay
          title="Rule Optimiser"
          subtitle="Identify redundant, shadowed, and overlapping rules"
          onClose={() => setActiveOverlay(null)}
        >
          <MockRuleOptimiser />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> FireComply analyses every
              rule against every other rule to find shadows (a broader rule makes a narrower one
              unreachable), redundancies (identical match criteria), and consolidation opportunities
              (adjacent rules that can merge).
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "policy-complexity" && (
        <FeatureOverlay
          title="Policy Complexity"
          subtitle="Measure and reduce policy complexity"
          onClose={() => setActiveOverlay(null)}
        >
          <MockPolicyComplexity />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Analyses rule count,
              average conditions per rule, object group nesting depth, and zone-pair distribution to
              produce a complexity score. Lower complexity means easier auditing and fewer
              misconfigurations.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "unused-objects" && (
        <FeatureOverlay
          title="Unused Objects"
          subtitle="Find orphaned hosts, services, and groups"
          onClose={() => setActiveOverlay(null)}
        >
          <MockUnusedObjects />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Scans all network objects,
              service definitions, and groups in the config and cross-references them against every
              rule. Objects not referenced by any active rule are flagged for cleanup.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "consistency-checker" && (
        <FeatureOverlay
          title="Consistency Checker"
          subtitle="Cross-firewall rule consistency analysis"
          onClose={() => setActiveOverlay(null)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded border border-border/50 bg-card p-2">
                <p className="text-lg font-bold text-[#00F2B3]">87%</p>
                <p className="text-[8px] text-muted-foreground">Consistency Score</p>
              </div>
              <div className="rounded border border-border/50 bg-card p-2">
                <p className="text-lg font-bold text-[#F29400]">4</p>
                <p className="text-[8px] text-muted-foreground">Inconsistencies</p>
              </div>
            </div>
            {[
              {
                rule: "IPS Policy",
                fw1: "GeneralPolicy",
                fw2: "None",
                status: "mismatch",
              },
              { rule: "Web Filtering", fw1: "Enabled", fw2: "Enabled", status: "match" },
              {
                rule: "Admin HTTPS",
                fw1: "Disabled",
                fw2: "Enabled",
                status: "mismatch",
              },
              { rule: "SSL Inspection", fw1: "38%", fw2: "42%", status: "match" },
            ].map((r) => (
              <div
                key={r.rule}
                className="flex items-center gap-2 rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-2.5 text-[9px]"
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${r.status === "match" ? "bg-[#00F2B3]" : "bg-[#EA0022]"}`}
                />
                <span className="font-medium text-foreground flex-1">{r.rule}</span>
                <span className="text-muted-foreground">FW1: {r.fw1}</span>
                <span className="text-muted-foreground">FW2: {r.fw2}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> When multiple firewall
              configs are loaded, FireComply compares security feature settings, rule structures,
              and policy configurations across devices to identify inconsistencies that could
              indicate gaps in your security posture.
            </p>
          </div>
        </FeatureOverlay>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Optimisation
        </h3>
        <p className="text-[11px] text-muted-foreground">
          FireComply analyses your firewall rules for{" "}
          <strong className="text-foreground">redundancy, complexity, and hygiene</strong> — helping
          you clean up and streamline your policy. Click each to preview.
        </p>
      </div>

      <div className="space-y-2.5">
        <FeatureButton
          icon={<Wrench className="h-4 w-4" />}
          title="Rule Optimiser"
          desc="Identifies redundant, shadowed, and overlapping rules that can be consolidated"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("rule-optimiser")}
        />
        <FeatureButton
          icon={<Layers className="h-4 w-4" />}
          title="Policy Complexity"
          desc="Measures rule complexity and suggests simplification opportunities"
          color="text-[#6B5BFF]"
          onClick={() => setActiveOverlay("policy-complexity")}
        />
        <FeatureButton
          icon={<Trash2 className="h-4 w-4" />}
          title="Unused Objects"
          desc="Finds hosts, services, and groups no longer referenced by any rule"
          color="text-[#F29400]"
          onClick={() => setActiveOverlay("unused-objects")}
        />
        <FeatureButton
          icon={<Scale className="h-4 w-4" />}
          title="Consistency Checker"
          desc="Cross-firewall rule consistency analysis when multiple configs are loaded"
          color="text-[#00F2B3]"
          onClick={() => setActiveOverlay("consistency-checker")}
        />
      </div>

      <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> The Optimisation tab appears
          automatically after uploading a config. Upload multiple configs to enable cross-firewall
          consistency checking.
        </p>
      </div>
    </div>
  );
}

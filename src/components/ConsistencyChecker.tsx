import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { checkConsistency, type ConsistencyGap } from "@/lib/consistency-check";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

const SEV_STYLE: Record<string, { badge: string; bar: string }> = {
  critical: { badge: "bg-[#EA0022]/10 text-[#EA0022]", bar: "bg-[#EA0022]" },
  high: { badge: "bg-[#F29400]/10 text-[#c47800] dark:text-[#F29400]", bar: "bg-[#F29400]" },
  medium: {
    badge: "bg-[#ca8a04]/12 text-[#78350f] dark:bg-[#F8E300]/10 dark:text-[#F8E300]",
    bar: "bg-[#ca8a04] dark:bg-[#F8E300]",
  },
  info: { badge: "bg-[#009CFB]/10 text-[#0077cc] dark:text-[#009CFB]", bar: "bg-[#009CFB]" },
};

export function ConsistencyChecker({ analysisResults }: Props) {
  const [open, setOpen] = useState(false);

  const gaps = useMemo(() => checkConsistency(analysisResults), [analysisResults]);

  if (Object.keys(analysisResults).length < 2 || gaps.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="h-8 w-8 rounded-lg bg-[#F29400]/10 flex items-center justify-center shrink-0">
          <span className="text-lg">⚖️</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
            Multi-Firewall Consistency
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {gaps.length} policy discrepanc{gaps.length !== 1 ? "ies" : "y"} across{" "}
            {Object.keys(analysisResults).length} firewalls
          </p>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▼" : "▶"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border space-y-3 pt-3">
          {gaps.map((gap, i) => (
            <GapCard key={i} gap={gap} />
          ))}
        </div>
      )}
    </section>
  );
}

function GapCard({ gap }: { gap: ConsistencyGap }) {
  const style = SEV_STYLE[gap.severity] ?? SEV_STYLE.info;

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style.badge}`}>
          {gap.severity}
        </span>
        <span className="text-xs font-semibold text-foreground">{gap.metric}</span>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {gap.category}
        </span>
      </div>

      <div className="space-y-1">
        {gap.firewalls.map((fw) => (
          <div key={fw.label} className="flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground font-medium w-24 truncate shrink-0">
              {fw.label}
            </span>
            <span className="text-foreground">{fw.value}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
        {gap.recommendation}
      </p>
    </div>
  );
}

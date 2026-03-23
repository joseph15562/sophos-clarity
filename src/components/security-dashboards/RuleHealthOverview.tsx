import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";

export function RuleHealthOverview({ analysisResults }: { analysisResults: Record<string, AnalysisResult> }) {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const firewallLabels = useMemo(() => Object.keys(analysisResults), [analysisResults]);
  const isMulti = firewallLabels.length > 1;

  const stats = useMemo(() => {
    let totalRules = 0, disabledRules = 0, wanRules = 0, natRules = 0;
    let hosts = 0, interfaces = 0;
    for (const ar of Object.values(analysisResults)) {
      totalRules += ar.stats.totalRules;
      natRules += ar.stats.totalNatRules;
      hosts += ar.stats.totalHosts;
      interfaces += ar.stats.interfaces;
      disabledRules += ar.inspectionPosture.totalDisabledRules;
      wanRules += ar.inspectionPosture.totalWanRules;
    }
    return { totalRules, disabledRules, wanRules, natRules, hosts, interfaces };
  }, [analysisResults]);

  const perFirewall = useMemo(() => {
    return Object.entries(analysisResults).map(([label, ar]) => ({
      label,
      totalRules: ar.stats.totalRules,
      wanRules: ar.inspectionPosture.totalWanRules,
      disabledRules: ar.inspectionPosture.totalDisabledRules,
      natRules: ar.stats.totalNatRules,
      hosts: ar.stats.totalHosts,
      interfaces: ar.stats.interfaces,
    }));
  }, [analysisResults]);

  type CardKey = "totalRules" | "wanRules" | "disabledRules" | "natRules" | "hosts" | "interfaces";

  const cards: { key: CardKey; label: string; value: number; color: string; tooltip: string }[] = [
    { key: "totalRules", label: "Total Rules", value: stats.totalRules, color: "#2006F7", tooltip: "Total firewall rules across all configs" },
    { key: "wanRules", label: "WAN Rules", value: stats.wanRules, color: "#EA0022", tooltip: "Rules with WAN source/destination zones — the internet-facing attack surface" },
    { key: "disabledRules", label: "Disabled", value: stats.disabledRules, color: stats.disabledRules > 0 ? "#F29400" : "#00F2B3", tooltip: stats.disabledRules > 0 ? "Disabled rules add no security value and may indicate abandoned policy" : "No disabled rules — clean configuration" },
    { key: "natRules", label: "NAT Rules", value: stats.natRules, color: "#5A00FF", tooltip: "Network Address Translation rules — port forwarding and masquerading" },
    { key: "hosts", label: "Hosts", value: stats.hosts, color: "#009CFB", tooltip: "IP hosts/networks defined in the firewall configuration" },
    { key: "interfaces", label: "Interfaces", value: stats.interfaces, color: "#00F2B3", tooltip: "Physical and virtual network interfaces configured" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Configuration Health</h3>
      <div className="grid grid-cols-6 gap-1.5">
        {cards.map((c) => {
          const isActive = activeCard === c.key;
          return (
            <div key={c.key} className="relative group">
              <button
                onClick={() => isMulti && setActiveCard(isActive ? null : c.key)}
                className={`w-full rounded-lg border px-2 py-2.5 text-center transition-all ${
                  isActive
                    ? "border-border bg-muted/40 ring-1 ring-offset-1 ring-offset-card"
                    : "border-border bg-muted/20 hover:bg-muted/30"
                } ${isMulti ? "cursor-pointer" : "cursor-default"}`}
                style={isActive ? { ["--tw-ring-color" as string]: c.color + "60" } : undefined}
              >
                <span className="text-lg font-extrabold tabular-nums block" style={{ color: c.color }}>{c.value}</span>
                <span className="text-[7px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{c.label}</span>
              </button>
              {/* Hover tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 w-48">
                <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-[10px] text-muted-foreground leading-relaxed">
                  {c.tooltip}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-firewall breakdown when card is clicked */}
      {activeCard && isMulti && (
        <div className="mt-3 rounded-lg border border-border bg-muted/10 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/20">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Firewall</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {cards.find((c) => c.key === activeCard)?.label}
            </span>
          </div>
          {perFirewall.map((fw) => {
            const val = fw[activeCard];
            const maxVal = Math.max(...perFirewall.map((f) => f[activeCard]), 1);
            const pct = (val / maxVal) * 100;
            const cardColor = cards.find((c) => c.key === activeCard)?.color ?? "#2006F7";
            return (
              <div key={fw.label} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5 border-b last:border-b-0 border-border/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-foreground font-medium truncate">{fw.label}</span>
                  <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cardColor }} />
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: cardColor }}>{val}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

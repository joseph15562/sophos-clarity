import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { BRAND, SEVERITY_COLORS } from "@/lib/design-tokens";

export function RuleHealthOverview({
  analysisResults,
}: {
  analysisResults: Record<string, AnalysisResult>;
}) {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const firewallLabels = useMemo(() => Object.keys(analysisResults), [analysisResults]);
  const isMulti = firewallLabels.length > 1;

  const stats = useMemo(() => {
    let totalRules = 0,
      disabledRules = 0,
      wanRules = 0,
      natRules = 0;
    let hosts = 0,
      interfaces = 0;
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
    {
      key: "totalRules",
      label: "Total Rules",
      value: stats.totalRules,
      color: BRAND.blue,
      tooltip: "Total firewall rules across all configs",
    },
    {
      key: "wanRules",
      label: "WAN Rules",
      value: stats.wanRules,
      color: SEVERITY_COLORS.critical,
      tooltip: "Rules with WAN source/destination zones — the internet-facing attack surface",
    },
    {
      key: "disabledRules",
      label: "Disabled",
      value: stats.disabledRules,
      color: stats.disabledRules > 0 ? SEVERITY_COLORS.high : SEVERITY_COLORS.low,
      tooltip:
        stats.disabledRules > 0
          ? "Disabled rules add no security value and may indicate abandoned policy"
          : "No disabled rules — clean configuration",
    },
    {
      key: "natRules",
      label: "NAT Rules",
      value: stats.natRules,
      color: "#5A00FF",
      tooltip: "Network Address Translation rules — port forwarding and masquerading",
    },
    {
      key: "hosts",
      label: "Hosts",
      value: stats.hosts,
      color: SEVERITY_COLORS.info,
      tooltip: "IP hosts/networks defined in the firewall configuration",
    },
    {
      key: "interfaces",
      label: "Interfaces",
      value: stats.interfaces,
      color: SEVERITY_COLORS.low,
      tooltip: "Physical and virtual network interfaces configured",
    },
  ];

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 sm:p-7 shadow-card">
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-5">
        Configuration Health
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {cards.map((c) => {
          const isActive = activeCard === c.key;
          return (
            <div key={c.key} className="relative group">
              <button
                onClick={() => isMulti && setActiveCard(isActive ? null : c.key)}
                className={`w-full rounded-xl border px-3 py-3.5 text-center transition-all ${
                  isActive
                    ? "border-border/50 bg-muted/40 ring-1 ring-offset-2 ring-offset-card shadow-sm"
                    : "border-border/40 bg-muted/15 hover:bg-muted/30 hover:border-border/60"
                } ${isMulti ? "cursor-pointer" : "cursor-default"}`}
                style={isActive ? { ["--tw-ring-color" as string]: c.color + "60" } : undefined}
              >
                <span
                  className="text-2xl font-display font-bold tabular-nums block"
                  style={{ color: c.color }}
                >
                  {c.value}
                </span>
                <span className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground/70 font-semibold leading-tight mt-1 block">
                  {c.label}
                </span>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 w-52">
                <div className="bg-popover border border-border/60 rounded-xl shadow-elevated p-3 text-[11px] text-muted-foreground leading-relaxed">
                  {c.tooltip}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-firewall breakdown when card is clicked */}
      {activeCard && isMulti && (
        <div className="mt-4 rounded-xl border border-border/40 bg-muted/5 dark:bg-muted/5 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/15 dark:bg-muted/10">
            <span className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">
              Firewall
            </span>
            <span className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.12em]">
              {cards.find((c) => c.key === activeCard)?.label}
            </span>
          </div>
          {perFirewall.map((fw) => {
            const val = fw[activeCard];
            const maxVal = Math.max(...perFirewall.map((f) => f[activeCard]), 1);
            const pct = (val / maxVal) * 100;
            const cardColor = cards.find((c) => c.key === activeCard)?.color ?? BRAND.blue;
            return (
              <div
                key={fw.label}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-border/30 hover:bg-muted/15 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] font-display font-medium text-foreground truncate">
                    {fw.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/30 dark:bg-muted/20 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: cardColor }}
                    />
                  </div>
                </div>
                <span
                  className="text-sm font-display font-bold tabular-nums"
                  style={{ color: cardColor }}
                >
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

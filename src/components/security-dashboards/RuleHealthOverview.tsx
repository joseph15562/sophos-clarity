import { useMemo, useState } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { BRAND, SEVERITY_COLORS } from "@/lib/design-tokens";

export function RuleHealthOverview({
  analysisResults,
}: {
  analysisResults: Record<string, AnalysisResult>;
}) {
  type CardKey = "totalRules" | "wanRules" | "disabledRules" | "natRules" | "hosts" | "interfaces";

  const [activeCard, setActiveCard] = useState<CardKey | null>(null);

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
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card transition-all duration-200 hover:shadow-elevated"
      style={{ background: "linear-gradient(145deg, rgba(0,191,255,0.04), transparent)" }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(0,191,255,0.12), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-5">
        Configuration Health
      </h3>
      <div
        className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 overflow-visible"
        style={{ padding: "4px" }}
      >
        {cards.map((c) => {
          const isActive = activeCard === c.key;
          return (
            <div key={c.key} className="relative group overflow-visible">
              <button
                onClick={() => isMulti && setActiveCard(isActive ? null : c.key)}
                className={`relative w-full rounded-xl border px-3 py-3.5 text-center transition-all duration-200 backdrop-blur-sm overflow-hidden ${
                  isActive
                    ? "scale-[1.06] shadow-elevated"
                    : "hover:scale-[1.06] hover:shadow-elevated hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
                } ${isMulti ? "cursor-pointer" : "cursor-default"}`}
                style={{
                  borderColor: isActive ? `${c.color}40` : "rgba(255,255,255,0.07)",
                  background: isActive
                    ? `linear-gradient(145deg, ${c.color}22, ${c.color}0c)`
                    : `linear-gradient(145deg, ${c.color}12, ${c.color}06)`,
                  boxShadow: isActive
                    ? `0 0 20px ${c.color}20, inset 0 1px 0 rgba(255,255,255,0.08)`
                    : `inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15)`,
                }}
              >
                {/* Colour reflection glow */}
                <div
                  className="absolute -top-3 -right-3 h-10 w-10 rounded-full blur-[14px] pointer-events-none transition-opacity duration-200 group-hover:opacity-60"
                  style={{ backgroundColor: c.color, opacity: 0.3 }}
                />
                {/* Top shimmer */}
                <div
                  className="absolute inset-x-0 top-0 h-px pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${c.color}30, transparent)`,
                  }}
                />
                {/* Bottom edge highlight */}
                <div
                  className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)`,
                  }}
                />
                <span
                  className="relative text-3xl font-display font-black tabular-nums block"
                  style={{ color: c.color, filter: `drop-shadow(0 0 6px ${c.color}40)` }}
                >
                  {c.value}
                </span>
                <span className="relative text-[8px] uppercase tracking-[0.14em] text-foreground/50 font-bold leading-tight mt-1.5 block">
                  {c.label}
                </span>
              </button>
              {/* Glass tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 w-52">
                <div
                  className="rounded-xl p-3 text-[11px] text-foreground/90 leading-relaxed"
                  style={{
                    background: "linear-gradient(145deg, rgba(14,18,34,0.95), rgba(10,14,28,0.98))",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  {c.tooltip}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeCard && isMulti && (
        <div
          className="mt-4 rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div
            className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2.5 border-b border-slate-900/[0.10] dark:border-white/[0.06]"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
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
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-slate-900/[0.08] dark:border-white/[0.04] hover:bg-slate-950/[0.04] dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[11px] font-display font-medium text-foreground truncate">
                    {fw.label}
                  </span>
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
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

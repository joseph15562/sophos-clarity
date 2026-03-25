import { useMemo, useState } from "react";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import { type Severity, SEVERITY_COLORS, SEVERITY_ORDER } from "@/lib/design-tokens";

const SEV_ORDER = (Object.keys(SEVERITY_ORDER) as Severity[]).sort(
  (a, b) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b],
);

type ViewMode = "all" | "per-firewall";

export function SeverityBreakdown({
  analysisResults,
}: {
  analysisResults: Record<string, AnalysisResult>;
}) {
  const [activeSev, setActiveSev] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  const { data, allFindings, perFirewallData } = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const findings: (Finding & { firewall: string })[] = [];
    const byFirewall: Record<string, Record<string, number>> = {};

    for (const [label, ar] of Object.entries(analysisResults)) {
      const fwCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const f of ar.findings) {
        counts[f.severity] = (counts[f.severity] || 0) + 1;
        fwCounts[f.severity] = (fwCounts[f.severity] || 0) + 1;
        findings.push({ ...f, firewall: label });
      }
      byFirewall[label] = fwCounts;
    }

    const ordered = SEV_ORDER.map((sev) => ({
      key: sev,
      name: sev.charAt(0).toUpperCase() + sev.slice(1),
      value: counts[sev] || 0,
      color: SEVERITY_COLORS[sev],
    })).filter((d) => d.value > 0);

    const perFw = Object.entries(byFirewall).map(([fw, fwCounts]) => ({
      firewall: fw,
      data: SEV_ORDER.map((sev) => ({
        key: sev,
        name: sev.charAt(0).toUpperCase() + sev.slice(1),
        value: fwCounts[sev] || 0,
        color: SEVERITY_COLORS[sev],
      })).filter((d) => d.value > 0),
    }));

    return { data: ordered, allFindings: findings, perFirewallData: perFw };
  }, [analysisResults]);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const filteredFindings = activeSev ? allFindings.filter((f) => f.severity === activeSev) : null;

  const handleSevClick = (sev: string) => {
    setActiveSev(activeSev === sev ? null : sev);
    setExpandedFinding(null);
  };

  const multipleFirewalls = Object.keys(analysisResults).length > 1;
  const displayPerFw = viewMode === "per-firewall" ? perFirewallData : [];

  return (
    <div
      className="relative rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 space-y-4 shadow-card transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(234,0,34,0.04), rgba(242,148,0,0.02), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(234,0,34,0.15), rgba(242,148,0,0.08), transparent)",
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-display font-bold tracking-tight text-foreground">
          Finding Severity
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/70">{total} total findings</span>
          {multipleFirewalls && (
            <div
              className="flex rounded-xl p-0.5 gap-0.5"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setViewMode("all");
                  setActiveSev(null);
                }}
                className="px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all duration-200 cursor-pointer"
                style={
                  viewMode === "all"
                    ? {
                        background:
                          "linear-gradient(145deg, rgba(56,136,255,0.14), rgba(0,191,255,0.06))",
                        color: "rgba(255,255,255,0.9)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.2)",
                      }
                    : { color: "rgba(255,255,255,0.4)" }
                }
              >
                All Firewalls
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("per-firewall");
                  setActiveSev(null);
                }}
                className="px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all duration-200 cursor-pointer"
                style={
                  viewMode === "per-firewall"
                    ? {
                        background:
                          "linear-gradient(145deg, rgba(56,136,255,0.14), rgba(0,191,255,0.06))",
                        color: "rgba(255,255,255,0.9)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.2)",
                      }
                    : { color: "rgba(255,255,255,0.4)" }
                }
              >
                Per Firewall
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode === "all" && (
        <>
          {/* Stacked severity bar — clickable + hoverable (All Firewalls) */}
          <div className="relative h-12">
            <div
              className="absolute bottom-0 left-0 right-0 flex h-5 rounded-full border border-slate-900/[0.10] dark:border-white/[0.06]"
              style={{
                clipPath: "inset(0 round 9999px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              {data.map((d) => {
                const isDimmed = activeSev !== null && activeSev !== d.key;
                return (
                  <div
                    key={d.key}
                    className="h-full transition-opacity duration-200"
                    style={{
                      width: `${(d.value / total) * 100}%`,
                      backgroundColor: d.color,
                      opacity: isDimmed ? 0.25 : 1,
                    }}
                  />
                );
              })}
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex h-5">
              {data.map((d, idx) => {
                const isActive = activeSev === d.key;
                const isDimmed = activeSev !== null && !isActive;
                const pct = Math.round((d.value / total) * 100);
                const isFirst = idx === 0;
                const isLast = idx === data.length - 1;
                return (
                  <button
                    key={d.key}
                    onClick={() => handleSevClick(d.key)}
                    className="relative h-full group/seg cursor-pointer"
                    style={{ width: `${(d.value / total) * 100}%`, opacity: isDimmed ? 0.25 : 1 }}
                  >
                    {isActive && (
                      <div className="absolute inset-0 ring-2 ring-white/50 rounded-sm z-10" />
                    )}
                    <div
                      className={`absolute left-0 right-0 bottom-0 opacity-0 group-hover/seg:opacity-100 transition-all duration-200 ${isFirst ? "rounded-l-full" : ""} ${isLast ? "rounded-r-full" : ""}`}
                      style={{
                        backgroundColor: d.color,
                        height: "28px",
                        filter: "brightness(1.15)",
                        borderRadius: isFirst && isLast ? "9999px" : undefined,
                      }}
                    />
                    <div className="opacity-0 group-hover/seg:opacity-100 absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none transition-opacity duration-150">
                      <div
                        className="rounded-xl px-3 py-2 whitespace-nowrap"
                        style={{
                          background:
                            "linear-gradient(145deg, rgba(14,18,34,0.95), rgba(10,14,28,0.98))",
                          border: "1px solid rgba(255,255,255,0.1)",
                          boxShadow:
                            "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                          backdropFilter: "blur(16px)",
                        }}
                      >
                        <p className="text-[11px] font-bold" style={{ color: d.color }}>
                          {d.value} {d.name}
                        </p>
                        <p className="text-[9px] text-foreground/50">{pct}% of all findings</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity count cards */}
          <div
            className={`grid gap-2 ${data.length <= 3 ? "grid-cols-3" : data.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}
          >
            {data.map((d) => {
              const isActive = activeSev === d.key;
              const isDimmed = activeSev !== null && !isActive;
              return (
                <button
                  key={d.key}
                  onClick={() => handleSevClick(d.key)}
                  className={`relative text-center rounded-xl border py-3 px-1 transition-all duration-200 overflow-hidden backdrop-blur-sm cursor-pointer ${
                    isActive
                      ? "scale-[1.06] shadow-elevated"
                      : isDimmed
                        ? "opacity-30"
                        : "hover:scale-[1.06] hover:shadow-elevated hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
                  }`}
                  style={{
                    borderColor: isActive ? `${d.color}40` : "rgba(255,255,255,0.07)",
                    background: isActive
                      ? `linear-gradient(145deg, ${d.color}22, ${d.color}0c)`
                      : `linear-gradient(145deg, ${d.color}12, ${d.color}06)`,
                    boxShadow: isActive
                      ? `0 0 20px ${d.color}20, inset 0 1px 0 rgba(255,255,255,0.08)`
                      : `inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15)`,
                  }}
                >
                  <div
                    className="absolute -top-3 -right-3 h-10 w-10 rounded-full blur-[14px] pointer-events-none"
                    style={{ backgroundColor: d.color, opacity: isActive ? 0.4 : 0.25 }}
                  />
                  <div
                    className="absolute inset-x-0 top-0 h-px pointer-events-none"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${d.color}30, transparent)`,
                    }}
                  />
                  <span
                    className="relative text-2xl font-display font-black tabular-nums block"
                    style={{ color: d.color, filter: `drop-shadow(0 0 6px ${d.color}40)` }}
                  >
                    {d.value}
                  </span>
                  <span className="relative text-[9px] text-foreground/50 uppercase tracking-wider font-bold">
                    {d.name}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {viewMode === "per-firewall" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {displayPerFw.map(({ firewall, data: fwData }) => {
            const fwTotal = fwData.reduce((s, d) => s + d.value, 0);
            if (fwTotal === 0) return null;
            return (
              <div
                key={firewall}
                className="rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] backdrop-blur-sm p-4 space-y-2.5 transition-all duration-200 hover:border-slate-900/[0.14] dark:hover:border-white/[0.1] hover:shadow-elevated"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                  {firewall}
                </p>
                <div className="relative h-8">
                  <div
                    className="absolute bottom-0 left-0 right-0 flex h-4 rounded-full overflow-hidden"
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
                  >
                    {fwData.map((d) => (
                      <div
                        key={d.key}
                        className="h-full transition-opacity"
                        style={{ width: `${(d.value / fwTotal) * 100}%`, backgroundColor: d.color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {fwData.map((d) => (
                    <span
                      key={d.key}
                      className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold"
                      style={{ backgroundColor: d.color + "20", color: d.color }}
                    >
                      {d.name}: {d.value}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "all" && filteredFindings && filteredFindings.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-900/[0.10] dark:border-white/[0.06]">
          <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider mb-2">
            {filteredFindings.length} {activeSev} finding{filteredFindings.length !== 1 ? "s" : ""}
          </p>
          <div className="max-h-52 overflow-y-auto space-y-1.5">
            {filteredFindings.map((f, i) => {
              const uid = `sev-${f.id}-${f.firewall}-${i}`;
              const isOpen = expandedFinding === uid;
              return (
                <div
                  key={uid}
                  className="rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <button
                    onClick={() => setExpandedFinding(isOpen ? null : uid)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-all duration-200 cursor-pointer"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: SEVERITY_COLORS[f.severity as Severity],
                        boxShadow: `0 0 6px ${SEVERITY_COLORS[f.severity as Severity]}50`,
                      }}
                    />
                    <span className="text-[11px] font-semibold text-foreground/85 flex-1 truncate">
                      {f.title}
                    </span>
                    {multipleFirewalls && (
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.45)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {f.firewall}
                      </span>
                    )}
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.45)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {f.section}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3 pt-2.5 border-t border-slate-900/[0.10] dark:border-white/[0.06] space-y-2">
                      <p className="text-[10px] text-foreground/50 leading-relaxed">{f.detail}</p>
                      {f.remediation && (
                        <p className="text-[10px] leading-relaxed">
                          <span className="font-bold text-[#F29400]">Recommendation:</span>{" "}
                          <span className="text-foreground/80">{f.remediation}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

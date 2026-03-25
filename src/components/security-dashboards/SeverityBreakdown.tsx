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
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Finding Severity
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{total} total findings</span>
          {multipleFirewalls && (
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setViewMode("all");
                  setActiveSev(null);
                }}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  viewMode === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Firewalls
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("per-firewall");
                  setActiveSev(null);
                }}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  viewMode === "per-firewall"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
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
              className="absolute bottom-0 left-0 right-0 flex h-5 rounded-full"
              style={{ clipPath: "inset(0 round 9999px)" }}
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
                      <div className="rounded-lg border border-border bg-popover shadow-elevated px-3 py-2 whitespace-nowrap">
                        <p className="text-[11px] font-bold" style={{ color: d.color }}>
                          {d.value} {d.name}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{pct}% of all findings</p>
                      </div>
                      <div className="w-2 h-2 rotate-45 border-b border-r border-border bg-popover mx-auto -mt-1" />
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
              const pct = Math.round((d.value / total) * 100);
              return (
                <button
                  key={d.key}
                  onClick={() => handleSevClick(d.key)}
                  className={`relative text-center rounded-lg border py-2.5 px-1 transition-all group/card ${
                    isActive
                      ? "ring-1 bg-foreground/5 scale-105"
                      : isDimmed
                        ? "border-border bg-muted/10 opacity-40"
                        : "border-border bg-muted/20 hover:bg-muted/30 hover:scale-105 hover:shadow-elevated"
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: d.color + "60",
                          ["--tw-ring-color" as string]: d.color + "30",
                        }
                      : {}
                  }
                >
                  <span
                    className="text-xl font-extrabold tabular-nums block"
                    style={{ color: d.color }}
                  >
                    {d.value}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {d.name}
                  </span>
                  <div className="opacity-0 group-hover/card:opacity-100 absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none transition-opacity duration-150">
                    <div className="rounded-md border border-border bg-popover shadow-elevated px-2.5 py-1.5 whitespace-nowrap text-left">
                      <p className="text-[10px] font-bold" style={{ color: d.color }}>
                        {d.value} {d.name.toLowerCase()} finding{d.value !== 1 ? "s" : ""}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {pct}% of total · Click to filter
                      </p>
                    </div>
                    <div className="w-2 h-2 rotate-45 border-b border-r border-border bg-popover mx-auto -mt-1" />
                  </div>
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
                className="rounded-lg border border-border bg-muted/10 p-3 space-y-2"
              >
                <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                  {firewall}
                </p>
                <div className="relative h-8">
                  <div className="absolute bottom-0 left-0 right-0 flex h-4 rounded-full overflow-hidden">
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
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: d.color + "30", color: d.color }}
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
        <div className="space-y-1 pt-1 border-t border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {filteredFindings.length} {activeSev} finding{filteredFindings.length !== 1 ? "s" : ""}
          </p>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {filteredFindings.map((f, i) => {
              const uid = `sev-${f.id}-${f.firewall}-${i}`;
              const isOpen = expandedFinding === uid;
              return (
                <div
                  key={uid}
                  className="rounded-lg border border-border bg-muted/10 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFinding(isOpen ? null : uid)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: SEVERITY_COLORS[f.severity as Severity] }}
                    />
                    <span className="text-[11px] font-medium text-foreground flex-1 truncate">
                      {f.title}
                    </span>
                    {multipleFirewalls && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {f.firewall}
                      </span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {f.section}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2.5 pt-2 border-t border-border/50 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {f.detail}
                      </p>
                      {f.remediation && (
                        <p className="text-[10px] leading-relaxed">
                          <span className="font-semibold text-[#F29400]">Recommendation:</span>{" "}
                          <span className="text-foreground">{f.remediation}</span>
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

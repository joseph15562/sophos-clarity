import { useMemo, useState } from "react";
import type { ExtractedSections } from "@/lib/extract-sections";
import {
  extractAttackSurface,
  extractExternalIps,
  type ExposedService,
} from "@/lib/attack-surface";
import { GeoAttackMap } from "@/components/GeoAttackMap";

interface Props {
  files: Array<{ label: string; fileName: string; extractedData: ExtractedSections }>;
}

const RISK_COLORS: Record<string, { bg: string; border: string; text: string; fill: string }> = {
  critical: {
    bg: "bg-[#EA0022]/10",
    border: "border-[#EA0022]/40",
    text: "text-[#EA0022]",
    fill: "#EA0022",
  },
  high: {
    bg: "bg-[#DB2777]/10",
    border: "border-[#DB2777]/40",
    text: "text-[#b91c72] dark:text-[#F472B6]",
    fill: "#DB2777",
  },
  medium: {
    bg: "bg-[#F29400]/12",
    border: "border-[#F29400]/35",
    text: "text-[#c47800] dark:text-[#F29400]",
    fill: "#F29400",
  },
  low: {
    bg: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10",
    border: "border-[#008F69]/35 dark:border-[#00F2B3]/30",
    text: "text-[#007A5A] dark:text-[#00F2B3]",
    fill: "#00F2B3",
  },
};

function exposureKey(s: ExposedService): string {
  return `${s.destination}|${s.service}|${s.port}`;
}

export function AttackSurfaceMap({ files }: Props) {
  const [open, setOpen] = useState(false);

  const { allServices, newExposureCount, externalIps } = useMemo(() => {
    const result: Array<ExposedService & { firewall: string; isNew?: boolean }> = [];
    const servicesByFile: ExposedService[][] = [];

    for (const f of files) {
      const label = f.label || f.fileName.replace(/\.(html|htm)$/i, "");
      const services = extractAttackSurface(f.extractedData);
      servicesByFile.push(services);
      for (const s of services) {
        result.push({ ...s, firewall: label });
      }
    }

    let newExposureCount = 0;
    if (files.length >= 2) {
      const newestServices = servicesByFile[servicesByFile.length - 1];
      const olderKeys = new Set<string>();
      for (let i = 0; i < servicesByFile.length - 1; i++) {
        for (const s of servicesByFile[i]) {
          olderKeys.add(exposureKey(s));
        }
      }
      const newestLabel =
        files[files.length - 1].label ||
        files[files.length - 1].fileName.replace(/\.(html|htm)$/i, "");
      for (const s of newestServices) {
        if (!olderKeys.has(exposureKey(s))) {
          newExposureCount++;
          const idx = result.findIndex(
            (r) => r.firewall === newestLabel && exposureKey(r) === exposureKey(s),
          );
          if (idx >= 0) result[idx].isNew = true;
        }
      }
    }

    const externalIps = Array.from(
      new Set(files.flatMap((f) => extractExternalIps(f.extractedData))),
    );

    return {
      allServices: result.sort((a, b) => riskOrder(a.risk) - riskOrder(b.risk)),
      newExposureCount,
      externalIps,
    };
  }, [files]);

  if (allServices.length === 0) return null;

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const s of allServices) counts[s.risk]++;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card shadow-card"
      data-tour="attack-surface"
      style={{
        backgroundImage: "linear-gradient(145deg, rgba(234,0,34,0.04), rgba(242,148,0,0.02))",
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full blur-[32px] opacity-10 bg-[#EA0022]" />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, rgba(234,0,34,0.18), rgba(242,148,0,0.14), transparent)",
        }}
      />

      <button
        onClick={() => setOpen(!open)}
        className="relative w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-900/[0.12] dark:border-white/[0.08]"
          style={{ backgroundColor: "rgba(234,0,34,0.10)" }}
        >
          <span className="text-lg">🎯</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-display font-bold tracking-tight text-foreground">
            Attack Surface Map
          </h3>
          <p className="text-[10px] text-muted-foreground/80">
            {allServices.length} inbound service{allServices.length !== 1 ? "s" : ""} exposed via
            DNAT/port forwarding
          </p>
        </div>
        <div className="flex items-center gap-1.5 mr-2">
          {counts.critical > 0 && (
            <span className="text-[10px] font-bold text-[#EA0022] bg-[#EA0022]/10 border border-[#EA0022]/20 px-1.5 py-0.5 rounded-md">
              {counts.critical}C
            </span>
          )}
          {counts.high > 0 && (
            <span className="text-[10px] font-bold text-[#c47800] dark:text-[#F29400] bg-[#F29400]/10 border border-[#F29400]/20 px-1.5 py-0.5 rounded-md">
              {counts.high}H
            </span>
          )}
          {counts.medium > 0 && (
            <span className="text-[10px] font-bold text-[#78350f] dark:text-[#F8E300] bg-[#ca8a04]/12 dark:bg-[#F8E300]/10 border border-[#ca8a04]/20 dark:border-[#F8E300]/20 px-1.5 py-0.5 rounded-md">
              {counts.medium}M
            </span>
          )}
          {counts.low > 0 && (
            <span className="text-[10px] font-bold text-[#007A5A] dark:text-[#00F2B3] bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 border border-[#008F69]/20 dark:border-[#00F2B3]/20 px-1.5 py-0.5 rounded-md">
              {counts.low}L
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▼" : "▶"}</span>
      </button>

      {open && (
        <div className="relative px-5 pb-5 border-t border-slate-900/[0.10] dark:border-white/[0.06]">
          {newExposureCount > 0 && (
            <div className="mt-4 mb-2 px-3 py-2 rounded-xl bg-[#EA0022]/10 border border-[#EA0022]/25 text-[#EA0022] text-sm font-bold">
              {newExposureCount} new exposure{newExposureCount !== 1 ? "s" : ""} detected since
              previous config
            </div>
          )}
          {/* Visual map */}
          <div className="py-4">
            <div className="flex items-center gap-4 flex-wrap justify-center">
              {/* Internet */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center border border-slate-900/[0.10] dark:border-white/[0.08]">
                  <span className="text-xl">🌐</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">Internet</span>
              </div>

              {/* Arrow */}
              <div className="flex items-center">
                <div className="h-[2px] w-8 bg-border" />
                <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-border" />
              </div>

              {/* Firewall */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-14 w-14 rounded-xl bg-brand-accent/10 dark:bg-[#00EDFF]/10 flex items-center justify-center border border-brand-accent/25 dark:border-[#00EDFF]/20">
                  <span className="text-xl">🛡️</span>
                </div>
                <span className="text-[10px] text-brand-accent font-medium">Firewall</span>
              </div>

              {/* Arrow */}
              <div className="flex items-center">
                <div className="h-[2px] w-8 bg-border" />
                <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-border" />
              </div>

              {/* Exposed services grid */}
              <div className="flex flex-wrap gap-2 max-w-md">
                {allServices.map((s, i) => {
                  const c = RISK_COLORS[s.risk];
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border-2 ${c.border} ${c.bg} px-3 py-2 text-center min-w-[80px] max-w-[140px]`}
                      title={`${s.ruleName}: ${s.service} → ${s.destination}`}
                    >
                      <p className={`text-[10px] font-bold ${c.text} truncate`}>
                        {s.ruleName.length > 20 ? s.ruleName.slice(0, 20) + "…" : s.ruleName}
                      </p>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {s.service !== "Any" && s.service !== "Unknown" ? s.service : s.destination}
                      </p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {s.hasIps && (
                          <span className="text-[8px] bg-[#00F2B3]/20 text-[#007A5A] dark:text-[#00F2B3] px-1 rounded">
                            IPS
                          </span>
                        )}
                        {s.hasWebFilter && (
                          <span className="text-[8px] bg-brand-accent/20 text-brand-accent px-1 rounded">
                            WF
                          </span>
                        )}
                        {!s.hasIps && !s.hasWebFilter && (
                          <span className="text-[8px] bg-[#EA0022]/20 text-[#EA0022] px-1 rounded">
                            Unprotected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Geo-IP & CVE section */}
          {externalIps.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <h4 className="text-xs font-display font-semibold tracking-tight text-foreground mb-3 flex items-center gap-2">
                <span className="text-brand-accent">🌍</span>
                Geo-IP & CVE Correlation
              </h4>
              <GeoAttackMap
                externalIps={externalIps}
                exposedServices={allServices.map((s) => ({ service: s.service, port: s.port }))}
              />
            </div>
          )}

          {/* Table detail */}
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider">
                    Risk
                  </th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider">
                    Rule
                  </th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider">
                    Service
                  </th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider">
                    IPS
                  </th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider">
                    WF
                  </th>
                  {files.length > 1 && (
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider">
                      Firewall
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allServices.map((s, i) => {
                  const c = RISK_COLORS[s.risk];
                  const svc = s as ExposedService & { firewall: string; isNew?: boolean };
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-1.5 px-2">
                        <span className={`font-bold uppercase ${c.text}`}>{s.risk}</span>
                      </td>
                      <td className="py-1.5 px-2 font-medium text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {s.ruleName}
                          {svc.isNew && (
                            <span className="text-[8px] font-bold bg-[#EA0022] text-white px-1.5 py-0.5 rounded">
                              NEW
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground">{s.service}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{s.destination}</td>
                      <td className="py-1.5 px-2">
                        {s.hasIps ? "✓" : <span className="text-[#EA0022]">✗</span>}
                      </td>
                      <td className="py-1.5 px-2">
                        {s.hasWebFilter ? "✓" : <span className="text-[#EA0022]">✗</span>}
                      </td>
                      {files.length > 1 && (
                        <td className="py-1.5 px-2 text-muted-foreground">
                          {(s as ExposedService & { firewall: string }).firewall}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function riskOrder(risk: string): number {
  return risk === "critical" ? 0 : risk === "high" ? 1 : risk === "medium" ? 2 : 3;
}

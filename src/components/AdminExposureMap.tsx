"use client";

import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";

type ExtractedSection = {
  tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
  text: string;
  details: unknown[];
};

interface AdminExposureMapProps {
  analysisResults: Record<string, AnalysisResult>;
  files: Array<{
    extractedData: Record<string, ExtractedSection>;
  }>;
}

const SENSITIVE_SERVICES = /https|ssh|admin|webadmin|gui|snmp|api|telnet|ping/i;
const UNTRUSTED_ZONES = /wan|any|dmz|guest|untrust|external|public/i;

function findSection(
  sections: Record<string, ExtractedSection>,
  pattern: RegExp
): ExtractedSection | null {
  for (const key of Object.keys(sections)) {
    if (pattern.test(key)) return sections[key];
  }
  return null;
}

interface ZoneServiceState {
  zone: string;
  services: Record<string, "enabled" | "disabled" | "risky">;
}

function parseLocalServiceAcl(
  files: Array<{ extractedData: Record<string, ExtractedSection> }>
): ZoneServiceState[] {
  const zoneMap = new Map<string, Record<string, "enabled" | "disabled" | "risky">>();
  const allServices = new Set<string>();

  for (const file of files) {
    const sections = file.extractedData;
    if (!sections) continue;

    const acl = findSection(
      sections,
      /local.*service.*acl|LocalServiceACL|device.*access|admin.*service/i
    );
    if (!acl?.tables) continue;

    for (const table of acl.tables) {
      for (const row of table.rows) {
        const service =
          row["Service"] ??
          row["ServiceType"] ??
          row["Name"] ??
          row["Service Name"] ??
          Object.values(row)[0] ??
          "";
        if (!SENSITIVE_SERVICES.test(service)) continue;

        const serviceNorm = service.replace(/\s+/g, " ").trim() || "Unknown";
        allServices.add(serviceNorm);

        for (const [key, val] of Object.entries(row)) {
          if (
            key === "Service" ||
            key === "ServiceType" ||
            key === "Name" ||
            key === "Service Name"
          )
            continue;
          const v = (val ?? "")
            .toLowerCase()
            .trim();
          const enabled =
            v === "enable" ||
            v === "enabled" ||
            v === "on" ||
            v === "yes" ||
            v === "allow" ||
            v === "✓" ||
            v.includes("✓");

          const zoneNorm = key.trim();
          if (!zoneNorm) continue;

          const existing = zoneMap.get(zoneNorm) ?? {};
          const isUntrusted = UNTRUSTED_ZONES.test(zoneNorm);
          existing[serviceNorm] = enabled
            ? isUntrusted
              ? "risky"
              : "enabled"
            : "disabled";
          zoneMap.set(zoneNorm, existing);
        }
      }
    }
  }

  const zones = Array.from(zoneMap.keys()).sort((a, b) => {
    const aWan = UNTRUSTED_ZONES.test(a);
    const bWan = UNTRUSTED_ZONES.test(b);
    if (aWan && !bWan) return 1;
    if (!aWan && bWan) return -1;
    return a.localeCompare(b);
  });

  const services = Array.from(allServices).sort();

  return zones.map((zone) => {
    const svc = zoneMap.get(zone) ?? {};
    const servicesRecord: Record<string, "enabled" | "disabled" | "risky"> =
      {};
    for (const s of services) {
      servicesRecord[s] = svc[s] ?? "disabled";
    }
    return { zone, services: servicesRecord };
  });
}

export function AdminExposureMap({
  analysisResults: _analysisResults,
  files,
}: AdminExposureMapProps) {
  const { rows, services, warningCount, hasData } = useMemo(() => {
    const parsed = parseLocalServiceAcl(files);
    const services = Array.from(
      new Set(parsed.flatMap((r) => Object.keys(r.services)))
    ).filter(Boolean).sort();
    const rows = parsed;
    let warningCount = 0;
    for (const row of rows) {
      for (const v of Object.values(row.services)) {
        if (v === "risky") warningCount++;
      }
    }
    return {
      rows,
      services,
      warningCount,
      hasData: rows.length > 0 && services.length > 0,
    };
  }, [files]);

  if (!hasData) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Admin Access Exposure
        </h3>
        <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border p-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <p className="font-medium">Local Service ACL data not available</p>
            <p>Admin service exposure will appear here when the configuration includes Local Service ACL settings (HTTPS, SSH, Ping access per zone).</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Admin Access Exposure
        </h3>
        {warningCount > 0 && (
          <span className="text-xs font-medium text-[#EA0022]">
            {warningCount} service{warningCount !== 1 ? "s" : ""} exposed to
            untrusted zones
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-1.5 pr-3 font-medium text-foreground border-b border-border">
                Zone
              </th>
              {services.map((s) => (
                <th
                  key={s}
                  className="text-left py-1.5 px-1 font-medium text-muted-foreground border-b border-border whitespace-nowrap"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isWan = UNTRUSTED_ZONES.test(row.zone);
              const hasRisky = Object.values(row.services).some(
                (v) => v === "risky"
              );
              return (
                <tr
                  key={row.zone}
                  className={
                    isWan && hasRisky
                      ? "bg-[#EA0022]/10"
                      : ""
                  }
                >
                  <td
                    className={`py-1.5 pr-3 font-medium border-b border-border/50 ${
                      isWan && hasRisky ? "text-[#EA0022]" : "text-foreground"
                    }`}
                  >
                    {row.zone}
                  </td>
                  {services.map((s) => {
                    const state = row.services[s] ?? "disabled";
                    const bg =
                      state === "enabled"
                        ? "bg-[#00995a]/30"
                        : state === "risky"
                          ? "bg-[#EA0022]/30"
                          : "bg-muted/30";
                    return (
                      <td
                        key={s}
                        className={`py-1 px-1 border-b border-border/30 ${bg}`}
                        title={`${row.zone} / ${s}: ${
                          state === "enabled"
                            ? "enabled (internal)"
                            : state === "risky"
                              ? "exposed (risky)"
                              : "disabled"
                        }`}
                      >
                        {state === "enabled" ? "✓" : state === "risky" ? "!" : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

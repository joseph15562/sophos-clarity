import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

type CellStatus = "green" | "amber" | "red";

function statusClass(status: CellStatus): string {
  switch (status) {
    case "green":
      return "bg-[#00F2B3]/20 text-[#00F2B3]";
    case "amber":
      return "bg-[#F29400]/20 text-[#F29400]";
    case "red":
      return "bg-[#EA0022]/20 text-[#EA0022]";
  }
}

function pctStatus(pct: number): CellStatus {
  if (pct > 75) return "green";
  if (pct > 25) return "amber";
  return "red";
}

export function CoverageMatrix({ analysisResults }: Props) {
  const { rows, columns } = useMemo(() => {
    const firewalls = Object.keys(analysisResults);
    const cols = ["Web Filter", "IPS", "App Control", "SSL/TLS", "ATP", "Logging"] as const;

    const rows = firewalls.map((label) => {
      const ar = analysisResults[label];
      const ip = ar.inspectionPosture;

      // Web Filter: withWebFilter / webFilterableRules
      const wfPct =
        ip.webFilterableRules > 0
          ? Math.round((ip.withWebFilter / ip.webFilterableRules) * 100)
          : ip.webFilterableRules === 0
            ? 100
            : 0;

      // IPS: withIps / enabledWanRules
      const ipsPct =
        ip.enabledWanRules > 0
          ? Math.round((ip.withIps / ip.enabledWanRules) * 100)
          : ip.enabledWanRules === 0
            ? 100
            : 0;

      // App Control: withAppControl / enabledWanRules
      const appPct =
        ip.enabledWanRules > 0
          ? Math.round((ip.withAppControl / ip.enabledWanRules) * 100)
          : ip.enabledWanRules === 0
            ? 100
            : 0;

      // SSL/TLS: withSslInspection > 0 and dpiEngineEnabled
      const sslOk = ip.withSslInspection > 0 && ip.dpiEngineEnabled;

      // ATP: from atpStatus?.enabled
      const atpOk = ar.atpStatus?.enabled ?? false;

      // Logging: check if logging findings exist for that firewall
      const loggingFindings = ar.findings.filter((f) =>
        f.title.toLowerCase().includes("logging disabled"),
      );
      const loggingDisabledCount =
        loggingFindings.length > 0
          ? parseInt(loggingFindings[0].title.match(/\d+/)?.[0] ?? "0")
          : 0;
      const loggingPct =
        ar.stats.totalRules > 0
          ? Math.round(((ar.stats.totalRules - loggingDisabledCount) / ar.stats.totalRules) * 100)
          : 100;

      return {
        label,
        cells: {
          "Web Filter": {
            status: pctStatus(wfPct),
            display: ip.webFilterableRules > 0 ? `${wfPct}%` : "✓",
          },
          IPS: { status: pctStatus(ipsPct), display: ip.enabledWanRules > 0 ? `${ipsPct}%` : "✓" },
          "App Control": {
            status: pctStatus(appPct),
            display: ip.enabledWanRules > 0 ? `${appPct}%` : "✓",
          },
          "SSL/TLS": {
            status: sslOk ? "green" : "red",
            display: sslOk ? "✓" : "✗",
          },
          ATP: {
            status: atpOk ? "green" : "red",
            display: atpOk ? "✓" : "✗",
          },
          Logging: {
            status: pctStatus(loggingPct),
            display: loggingFindings.length === 0 ? "✓" : `${loggingPct}%`,
          },
        },
      };
    });

    return { rows, columns: cols };
  }, [analysisResults]);

  if (rows.length === 0) return null;

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(56,136,255,0.05), rgba(0,191,255,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(56,136,255,0.2), rgba(0,191,255,0.1), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-5">
        Security Feature Coverage Matrix
      </h3>
      <div
        className="overflow-x-auto rounded-xl backdrop-blur-sm"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <table className="w-full min-w-[480px]">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <th className="text-[10px] uppercase tracking-wider text-foreground/45 text-left py-3 pr-4 font-bold">
                Firewall
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-[10px] uppercase tracking-wider text-foreground/45 text-center py-3 px-2 font-bold"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="text-xs py-3 pr-4 font-semibold text-foreground/90 truncate max-w-[140px]">
                  {row.label}
                </td>
                {columns.map((col) => {
                  const cell = row.cells[col];
                  return (
                    <td
                      key={col}
                      className={`text-xs font-bold py-2.5 px-2 text-center rounded-lg backdrop-blur-sm ${statusClass(cell.status as CellStatus)}`}
                      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {cell.display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
    const cols = [
      "Web Filter",
      "IPS",
      "App Control",
      "SSL/TLS",
      "ATP",
      "Logging",
    ] as const;

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
        f.title.toLowerCase().includes("logging disabled")
      );
      const loggingDisabledCount =
        loggingFindings.length > 0
          ? parseInt(loggingFindings[0].title.match(/\d+/)?.[0] ?? "0")
          : 0;
      const loggingPct =
        ar.stats.totalRules > 0
          ? Math.round(
              ((ar.stats.totalRules - loggingDisabledCount) / ar.stats.totalRules) *
                100
            )
          : 100;

      return {
        label,
        cells: {
          "Web Filter": { status: pctStatus(wfPct), display: ip.webFilterableRules > 0 ? `${wfPct}%` : "✓" },
          IPS: { status: pctStatus(ipsPct), display: ip.enabledWanRules > 0 ? `${ipsPct}%` : "✓" },
          "App Control": { status: pctStatus(appPct), display: ip.enabledWanRules > 0 ? `${appPct}%` : "✓" },
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
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Security Feature Coverage Matrix
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr>
              <th className="text-[9px] uppercase tracking-wider text-muted-foreground text-left py-2 pr-3 font-medium">
                Firewall
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-[9px] uppercase tracking-wider text-muted-foreground text-center py-2 px-1 font-medium"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border/50">
                <td className="text-[10px] py-1.5 pr-3 font-medium text-foreground truncate max-w-[120px]">
                  {row.label}
                </td>
                {columns.map((col) => {
                  const cell = row.cells[col];
                  return (
                    <td
                      key={col}
                      className={`text-[10px] py-1.5 px-1.5 text-center rounded ${statusClass(cell.status)}`}
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

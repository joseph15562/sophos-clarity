import { useMemo, useState } from "react";

type ExtractedSection = {
  tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
  text: string;
  details: Array<{ title: string; fields: Record<string, string> }>;
};

interface Props {
  files: Array<{
    label: string;
    extractedData: Record<string, ExtractedSection>;
  }>;
}

const COLORS = [
  "#2006F7",
  "#5A00FF",
  "#009CFB",
  "#00F2B3",
  "#F29400",
  "#EA0022",
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
];

function isFirewallRulesSection(key: string): boolean {
  const k = key.toLowerCase();
  return (
    /firewall\s*rules?/.test(k) ||
    (k.includes("firewall") && k.includes("rule"))
  );
}

function getServiceColumn(row: Record<string, string>): string {
  return (
    row["Service"] ??
    row["Services"] ??
    row["Services/Ports"] ??
    row["service"] ??
    row["Services Used"] ??
    ""
  ).trim();
}

function splitServices(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProtocolDistribution({ files }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { data, total, maxCount } = useMemo(() => {
    const counts = new Map<string, number>();

    for (const file of files) {
      const extracted = file.extractedData;
      if (!extracted) continue;

      for (const key of Object.keys(extracted)) {
        if (!isFirewallRulesSection(key)) continue;

        const section = extracted[key];
        if (!section?.tables) continue;

        for (const table of section.tables) {
          for (const row of table.rows) {
            const svcRaw = getServiceColumn(row);
            const services = splitServices(svcRaw);
            if (services.length === 0 && svcRaw) {
              const s = svcRaw.toLowerCase();
              const name = s === "any" ? "Any" : svcRaw;
              counts.set(name, (counts.get(name) ?? 0) + 1);
            } else {
              for (const s of services) {
                const name = s.toLowerCase() === "any" ? "Any" : s;
                counts.set(name, (counts.get(name) ?? 0) + 1);
              }
            }
          }
        }
      }
    }

    const sorted = Array.from(counts.entries())
      .map(([name, value], idx) => ({
        name,
        value,
        color: COLORS[idx % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    const total = sorted.reduce((sum, d) => sum + d.value, 0);
    const maxCount = sorted.length > 0 ? sorted[0].value : 0;

    return { data: sorted, total, maxCount };
  }, [files]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Protocol Distribution
        </h3>
        <p className="text-sm text-muted-foreground">No firewall rules found</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Protocol Distribution
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {data.length} protocol{data.length !== 1 ? "s" : ""} · {total} rules
        </span>
      </div>

      <div className="space-y-1.5" style={{ maxHeight: 280, overflowY: "auto" }}>
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          const barWidth = maxCount > 0 ? (d.value / maxCount) * 100 : 0;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={d.name}
              className="group flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/30 cursor-default"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-[11px] font-medium text-foreground w-24 truncate shrink-0">
                {d.name}
              </span>
              <div className="flex-1 h-4 rounded-sm bg-muted/20 overflow-hidden relative">
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: d.color,
                    opacity: isHovered ? 0.9 : 0.6,
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-7 text-right shrink-0 tabular-nums">
                {d.value}
              </span>
              <span className="text-[9px] text-muted-foreground/60 w-9 text-right shrink-0 tabular-nums">
                {pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

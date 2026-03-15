import { useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

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

const SOPHOS_COLORS = [
  "#2006F7",
  "#5A00FF",
  "#009CFB",
  "#00995a",
  "#F29400",
  "#EA0022",
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
  )
    .trim();
}

function splitServices(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProtocolDistribution({ files }: Props) {
  const { data, total } = useMemo(() => {
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
              // Single value, no delimiter
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

    const treemapData = Array.from(counts.entries())
      .map(([name, value], idx) => ({
        name,
        value,
        color: SOPHOS_COLORS[idx % SOPHOS_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    const total = treemapData.reduce((sum, d) => sum + d.value, 0);

    return { data: treemapData, total };
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
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Protocol Distribution
      </h3>
      <div style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="value"
            stroke="hsl(var(--border))"
            content={({ x, y, width, height, name, value, color }) => {
              if (name === "root" || width < 30 || height < 20) return null;
              return (
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={color}
                    fillOpacity={0.7}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={x + width / 2}
                    y={y + height / 2 - 6}
                    textAnchor="middle"
                    fill="hsl(var(--card))"
                    fontSize={10}
                    fontWeight={600}
                  >
                    {name}
                  </text>
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 6}
                    textAnchor="middle"
                    fill="hsl(var(--card))"
                    fontSize={9}
                    fillOpacity={0.9}
                  >
                    {value}
                  </text>
                </g>
              );
            }}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const pct =
                  total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <div className="rounded-md border border-border bg-card px-2 py-1.5 text-xs shadow-md">
                    <span className="font-medium">{d.name}</span>: {d.value}{" "}
                    ({pct}%)
                  </div>
                );
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

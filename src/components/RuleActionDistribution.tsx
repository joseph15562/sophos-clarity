import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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

const COLORS = {
  Accept: "#00F2B3",
  Drop: "#EA0022",
  Reject: "#F29400",
  Other: "#6B7280",
} as const;

function isFirewallRulesSection(key: string): boolean {
  const k = key.toLowerCase();
  return /firewall\s*rules?/.test(k) || (k.includes("firewall") && k.includes("rule"));
}

function getActionValue(row: Record<string, string>): string {
  return (
    row["Action"] ??
    row["Rule Action"] ??
    row["Policy"] ??
    row["action"] ??
    ""
  )
    .toLowerCase()
    .trim();
}

function classifyAction(raw: string): "Accept" | "Drop" | "Reject" | "Other" {
  if (!raw) return "Other";
  if (raw.includes("allow") || raw.includes("accept") || raw.includes("permit")) return "Accept";
  if (raw.includes("drop") || raw.includes("deny")) return "Drop";
  if (raw.includes("reject")) return "Reject";
  return "Other";
}

export function RuleActionDistribution({ files }: Props) {
  const { data, total } = useMemo(() => {
    const counts = { Accept: 0, Drop: 0, Reject: 0, Other: 0 };

    for (const file of files) {
      const extracted = file.extractedData;
      if (!extracted) continue;

      for (const key of Object.keys(extracted)) {
        if (!isFirewallRulesSection(key)) continue;

        const section = extracted[key];
        if (!section?.tables) continue;

        for (const table of section.tables) {
          for (const row of table.rows) {
            const action = classifyAction(getActionValue(row));
            counts[action]++;
          }
        }
      }
    }

    const data = [
      { name: "Accept", value: counts.Accept, color: COLORS.Accept },
      { name: "Drop", value: counts.Drop, color: COLORS.Drop },
      { name: "Reject", value: counts.Reject, color: COLORS.Reject },
      { name: "Other", value: counts.Other, color: COLORS.Other },
    ].filter((d) => d.value > 0);

    const total = counts.Accept + counts.Drop + counts.Reject + counts.Other;
    return { data, total };
  }, [files]);

  if (total === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Rule Action Distribution</h3>
        <p className="text-sm text-muted-foreground">No firewall rules found</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Rule Action Distribution</h3>
      <div className="relative" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                return (
                  <div className="rounded-md border border-border/70 bg-card px-2 py-1.5 text-xs shadow-elevated">
                    {d.name}: {d.value} ({pct}%)
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="text-center">
            <span className="text-2xl font-bold text-foreground tabular-nums">{total}</span>
            <span className="block text-xs text-muted-foreground">rules</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-bold tabular-nums text-foreground">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

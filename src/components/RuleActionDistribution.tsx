import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
  return (row["Action"] ?? row["Rule Action"] ?? row["Policy"] ?? row["action"] ?? "")
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
      <div
        className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 shadow-card backdrop-blur-sm"
        style={{
          background:
            "linear-gradient(145deg, rgba(0,242,179,0.05), rgba(32,6,247,0.03), transparent)",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,242,179,0.2), rgba(32,6,247,0.1), transparent)",
          }}
        />
        <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-3">
          Rule Action Distribution
        </h3>
        <p className="text-sm text-foreground/45">No firewall rules found</p>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(0,242,179,0.05), rgba(32,6,247,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,242,179,0.2), rgba(32,6,247,0.1), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-5">
        Rule Action Distribution
      </h3>
      <div
        className="relative rounded-xl mx-auto max-w-md"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="relative" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={72}
                outerRadius={118}
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
                    <div
                      className="rounded-xl px-3 py-2 text-xs font-medium"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(14,18,34,0.95), rgba(10,14,28,0.98))",
                        border: "1px solid rgba(255,255,255,0.1)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        backdropFilter: "blur(16px)",
                      }}
                    >
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
              <span
                className="text-3xl font-black text-foreground tabular-nums"
                style={{ textShadow: "0 0 20px rgba(0,242,179,0.15)" }}
              >
                {total}
              </span>
              <span className="block text-sm text-foreground/45 font-semibold mt-0.5">rules</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}40` }}
            />
            <span className="text-foreground/50 font-medium">{d.name}</span>
            <span className="font-black tabular-nums text-foreground">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

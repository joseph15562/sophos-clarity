import { useMemo } from "react";

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

function isFirewallRulesSection(key: string): boolean {
  const k = key.toLowerCase();
  return /firewall\s*rules?/.test(k) || (k.includes("firewall") && k.includes("rule"));
}

function getServiceValue(row: Record<string, string>): string {
  return (
    row["Service"] ??
    row["Services"] ??
    row["Services/Ports"] ??
    row["service"] ??
    row["services"] ??
    ""
  ).trim();
}

export function ServiceUsage({ files }: Props) {
  const topServices = useMemo(() => {
    const counts = new Map<string, number>();

    for (const file of files) {
      const data = file.extractedData;
      if (!data) continue;

      for (const key of Object.keys(data)) {
        if (!isFirewallRulesSection(key)) continue;

        const section = data[key];
        if (!section?.tables) continue;

        for (const table of section.tables) {
          for (const row of table.rows) {
            const raw = getServiceValue(row);
            if (!raw) continue;

            const services = raw
              .split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean);
            for (const svc of services) {
              const name = svc || "Any";
              counts.set(name, (counts.get(name) ?? 0) + 1);
            }
          }
        }
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }, [files]);

  const maxCount = topServices.length > 0 ? Math.max(...topServices.map((s) => s.count)) : 0;

  if (topServices.length === 0) {
    return (
      <div className="rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] backdrop-blur-sm p-5">
        <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-3">
          Service Usage
        </h3>
        <p className="text-sm text-foreground/45">No firewall rules found</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-4">
        Service Usage
      </h3>
      <div
        className="space-y-4 rounded-xl p-4 backdrop-blur-sm flex flex-col flex-1 min-h-[240px]"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {topServices.map(({ name, count }) => (
          <div key={name} className="flex items-center gap-4">
            <span
              className="text-sm font-medium text-foreground/90 w-36 shrink-0 truncate"
              title={name}
            >
              {name}
            </span>
            <div
              className="flex-1 h-3 rounded-full overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: maxCount > 0 ? `${(count / maxCount) * 100}%` : 0,
                  background: "linear-gradient(90deg, #2006F7, #009CFB)",
                  boxShadow: "0 0 10px rgba(32,6,247,0.35)",
                }}
              />
            </div>
            <span className="text-sm font-black tabular-nums w-9 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

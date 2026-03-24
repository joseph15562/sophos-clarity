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

            const services = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
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
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Service Usage</h3>
        <p className="text-sm text-muted-foreground">No firewall rules found</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Service Usage</h3>
      <div className="space-y-2.5">
        {topServices.map(({ name, count }) => (
          <div key={name} className="flex items-center gap-3">
            <span className="text-xs text-foreground w-32 shrink-0 truncate" title={name}>
              {name}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2006F7] transition-all duration-500"
                style={{ width: maxCount > 0 ? `${(count / maxCount) * 100}%` : 0 }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums w-8 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

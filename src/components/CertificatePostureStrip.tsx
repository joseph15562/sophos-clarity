import type { AnalysisResult } from "@/lib/analyse-config";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

function bucketForTitle(title: string): "30" | "90" | "other" {
  if (/within\s+30\s+days/i.test(title)) return "30";
  if (/within\s+90\s+days/i.test(title)) return "90";
  return "other";
}

/** Surfaces certificate findings with 30 / 90 / other expiry-style grouping (roadmap D2). */
export function CertificatePostureStrip({ analysisResults }: Props) {
  type Row = { firewall: string; title: string; severity: string; bucket: "30" | "90" | "other" };
  const rows: Row[] = [];
  for (const [fw, ar] of Object.entries(analysisResults)) {
    for (const f of ar.findings) {
      const sec = `${f.section} ${f.title}`;
      if (!/certificate/i.test(sec)) continue;
      rows.push({
        firewall: fw,
        title: f.title,
        severity: f.severity,
        bucket: bucketForTitle(f.title),
      });
    }
  }
  if (rows.length === 0) return null;

  const g30 = rows.filter((r) => r.bucket === "30");
  const g90 = rows.filter((r) => r.bucket === "90");
  const go = rows.filter((r) => r.bucket === "other");

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-4 shadow-card space-y-3">
      <h4 className="text-xs font-display font-semibold text-foreground">Certificate posture</h4>
      <p className="text-[10px] text-muted-foreground">
        Grouped by export wording (30-day vs 90-day vs other certificate issues). Thresholds come
        from deterministic analysis in Certificate Management.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            { label: "≤30 days", items: g30, tone: "text-[#EA0022]" },
            { label: "31–90 days", items: g90, tone: "text-[#F29400]" },
            { label: "Other cert issues", items: go, tone: "text-muted-foreground" },
          ] as const
        ).map((col) => (
          <div
            key={col.label}
            className="rounded-lg border border-border/40 bg-muted/20 p-3 min-h-[72px]"
          >
            <p className={`text-[10px] font-bold uppercase tracking-wide ${col.tone}`}>
              {col.label}
            </p>
            <p className="text-lg font-extrabold tabular-nums text-foreground mt-1">
              {col.items.length}
            </p>
            {col.items.length > 0 && (
              <ul className="mt-2 space-y-1 max-h-28 overflow-y-auto text-[9px] text-muted-foreground">
                {col.items.slice(0, 6).map((r, ri) => (
                  <li
                    key={`${col.label}-${r.firewall}-${r.title}-${ri}`}
                    className="truncate"
                    title={`${r.firewall}: ${r.title}`}
                  >
                    <span className="text-foreground/80">{r.firewall}</span> — {r.title}
                  </li>
                ))}
                {col.items.length > 6 && (
                  <li className="text-muted-foreground/70">+{col.items.length - 6} more</li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

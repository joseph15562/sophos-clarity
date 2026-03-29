import { useEffect, useState } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Row = Tables<"regulatory_updates">;

/** Latest regulatory digest rows (populated by regulatory-scanner Edge Function). */
export function RegulatoryDigestSettings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("regulatory_updates")
        .select("id, source, title, summary, link, framework, published_at, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading digest…
      </div>
    );
  }

  if (err) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Regulatory digest could not be loaded ({err}). Ensure the{" "}
        <code className="text-[10px]">regulatory_updates</code> table exists and RLS allows your
        role.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p>
          No digest entries yet. The <code className="text-[10px]">regulatory-scanner</code> Edge
          Function runs <strong className="text-foreground/80">daily (~06:00 UTC)</strong> via
          pg_cron once your project migration and database custom settings are applied. The
          Compliance tab <strong className="text-foreground/80">Regulatory Tracker</strong> shows
          the same pool of headlines.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Latest items stored for your organisation (read-only). Sources and links are for awareness —
        not legal advice.
      </p>
      <ul className="space-y-2.5 max-h-[320px] overflow-y-auto">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-border/50 bg-background/40 px-3 py-2.5 text-xs"
          >
            <div className="flex items-start gap-2">
              <Newspaper className="h-3.5 w-3.5 text-brand-accent shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-foreground leading-snug">{r.title}</p>
                <p className="text-muted-foreground leading-relaxed line-clamp-3">{r.summary}</p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>{r.source}</span>
                  {r.framework ? <span>· {r.framework}</span> : null}
                  {r.published_at ? (
                    <span>· {new Date(r.published_at).toLocaleDateString()}</span>
                  ) : null}
                </div>
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-medium text-brand-accent hover:underline inline-block"
                >
                  Open source
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

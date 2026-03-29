import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** X4 — in-app changelog (curate releases here). */
export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/50">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Home</Link>
          </Button>
          <ScrollText className="h-5 w-5 text-brand-accent" />
          <h1 className="text-base font-semibold">What&apos;s new</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">2026-03</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              MSP attention surface on Assess, workspace settings links from Fleet and Insights.
            </li>
            <li>
              Central connection health banner, full-screen activity log, org-saved Prepared By.
            </li>
            <li>First-run setup checklist for admins.</li>
            <li>
              Regulatory Tracker (Compliance): RSS sources refreshed; headlines ingest automatically
              every day (~06:00 UTC) via the <code className="text-xs">regulatory-scanner</code>{" "}
              Edge Function and pg_cron. The manual Scan Feeds control was removed in favour of that
              schedule; the widget shows last ingest time when live rows exist.
            </li>
            <li>
              Workspace settings → Regulatory digest and Data governance: copy updated for the daily
              scanner and where headlines appear.
            </li>
          </ul>
          <div className="space-y-2 pt-2 border-t border-border/50">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Fixes</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Risk summary cards: Overall Score (and trend vs. previous run) show again on Assess.
              </li>
              <li>
                Workspace panel deep links (e.g. from API &amp; Integrations) open the right
                Settings section, expand it, and scroll it into view.
              </li>
              <li>
                API &amp; Integrations: API documentation opens in a dialog on the API page; the
                Assess link still opens the same reference in workspace settings.
              </li>
              <li>
                Regulatory scanner: replaced retired RSS URLs that returned 404 so feeds can load
                again; scan API responses include per-feed status (HTTP code, parse count, errors)
                for support and debugging.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

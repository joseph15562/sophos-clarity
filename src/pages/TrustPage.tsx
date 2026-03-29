import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * G3.3 — Trust centre baseline: subprocessors, retention pointers, legal placeholders.
 * Replace highlighted copy with counsel-approved text before procurement.
 */
export default function TrustPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/50">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Home</Link>
          </Button>
          <Shield className="h-5 w-5 text-brand-accent" />
          <h1 className="text-base font-semibold">Trust</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sophos FireComply helps partners assess Sophos firewall posture from configuration
            exports and optional Sophos Central metadata. Hosting, authentication, and long-lived
            data are processed in line with your workspace configuration and the documents linked
            below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Subprocessors (baseline)</h2>
          <p className="text-xs text-muted-foreground">
            Confirm regions and DPAs with your legal team. This table is a starting inventory, not a
            signed agreement.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Typical data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="px-3 py-2">Supabase</td>
                  <td className="px-3 py-2">Postgres, Auth, Edge Functions, Storage</td>
                  <td className="px-3 py-2">Account, org, assessments, audit metadata</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Hosting / CDN</td>
                  <td className="px-3 py-2">Static app delivery (e.g. Vercel)</td>
                  <td className="px-3 py-2">Minimal request telemetry</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">AI providers (optional)</td>
                  <td className="px-3 py-2">Narrative / report assistance when enabled</td>
                  <td className="px-3 py-2">Prompts derived from assessment context</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Email / notifications</td>
                  <td className="px-3 py-2">Transactional mail when configured</td>
                  <td className="px-3 py-2">Recipient addresses, message content</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">Retention and lifecycle</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Submission retention is configured per organisation (see{" "}
              <strong className="text-foreground font-medium">Data governance</strong> in workspace
              settings). Automated cleanup jobs remove expired submissions per policy.
            </li>
            <li>
              Product privacy overview:{" "}
              <span className="font-mono text-xs text-foreground/90">docs/DATA-PRIVACY.md</span> in
              the application repository (or your fork).
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight">Legal &amp; questionnaires</h2>
          <p className="text-sm text-muted-foreground">
            Use this page as a skeleton for security reviews. Attach your SOC2/ISO mappings,
            subprocessors list, and data-flow diagrams as your compliance program matures.
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Replace stub copy with legal-reviewed content before customer-facing procurement.
          </p>
        </section>
      </main>
    </div>
  );
}

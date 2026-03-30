import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** In-app “What’s new” page (curate releases here). */
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
        <p className="text-xs text-muted-foreground">
          Technical changelog: <code className="text-xs">CHANGELOG.md</code> at the repository root
          (Keep a Changelog).
        </p>
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">2026-03</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              CI Playwright can run the signed-in workspace journey{" "}
              <strong className="text-foreground">without</strong> storing test passwords:
              loopback-only auth bypass when the bundle is built with{" "}
              <code className="text-xs">VITE_E2E_AUTH_BYPASS</code> (see{" "}
              <code className="text-xs">.env.example</code>). Optional{" "}
              <code className="text-xs">E2E_USER_*</code> secrets still exercise real sign-in.
              Viewport checks (375 / 768 / 1024) cover home and What&apos;s new.
            </li>
            <li>
              Team invites: <strong className="text-foreground">Invite Staff</strong> loads pending
              invites and members via TanStack Query; customer search debounces for smoother typing.{" "}
              <strong className="text-foreground">Customer Management</strong> loads the customer
              directory via TanStack Query; the management drawer PSA summary and data-governance
              retention line use Query too. More surfaces use the shared{" "}
              <strong className="text-foreground">empty state</strong> pattern (fleet, SE history,
              assessments, drift, customers, connectors, config history, audit log, notifications,
              portfolio trend chart, SE upload-requests dialog).
            </li>
            <li>
              Integrators: OpenAPI and API Hub document{" "}
              <strong className="text-foreground">guest config upload</strong> (
              <code className="text-xs">api-public/config-upload/…</code>) and SE{" "}
              <code className="text-xs">/api/config-upload-request</code>, plus{" "}
              <code className="text-xs">portal-data</code> and{" "}
              <code className="text-xs">parse-config</code> Edge URLs; unexpected{" "}
              <code className="text-xs">parse-config</code> errors log{" "}
              <code className="text-xs">parse_config_unhandled</code>. Observability doc lists how
              to grep <code className="text-xs">logJson</code> event names.
            </li>
            <li>
              Ops / performance: <code className="text-xs">docs/PERF-EXPLAIN.md</code>,{" "}
              <code className="text-xs">docs/SCALE-TRIGGERS.md</code> (when to invest in
              Redis/queues/Gemini throttling), a minimal{" "}
              <code className="text-xs">scripts/k6/smoke.js</code> harness (
              <code className="text-xs">BASE_URL</code>), and a{" "}
              <code className="text-xs">supabase/seed.sql</code> stub for future local fixtures.
            </li>
            <li>
              Edge API: stricter validation on agent registration, connector heartbeat/submit, admin
              MFA reset, MFA recovery, assessment list paging, health-check team/follow-up patches,
              SE teams (create/rename/invite/transfer admin), passkey verify, and ConnectWise Cloud
              credentials; partial OpenAPI sketch in repo docs for integrators.
            </li>
            <li>
              API Hub / integrators: in-app API docs and{" "}
              <code className="text-xs">openapi.yaml</code> now cover Autotask PSA and ConnectWise
              Manage (mappings, credentials, tickets); public{" "}
              <code className="text-xs">api-public</code> shared-report and shared-health-check GET
              paths are documented for embeds. Self-hosted runbook links an edge{" "}
              <code className="text-xs">logJson</code> catalog and saved-search examples for drains.
            </li>
            <li>
              SE Health Check: config upload request list loads via TanStack Query (cancellable
              fetch); main page shell slimmed for easier maintenance — including extracted{" "}
              <strong className="text-foreground">Central API help</strong> panel component.
              Optional Sentry browser reporting when{" "}
              <code className="text-xs">VITE_SENTRY_DSN</code> is set.
            </li>
            <li>
              Setup wizard: <strong className="text-foreground">Branding</strong> step moved to its
              own component under <code className="text-xs">setup-wizard/steps/</code> (alongside
              Welcome) to keep the orchestrator smaller.
            </li>
            <li>
              Self-hosted / ops: <code className="text-xs">docs/observability.md</code> now includes
              per-function <code className="text-xs">logJson</code> catalogs for{" "}
              <code className="text-xs">api-public</code> and{" "}
              <code className="text-xs">api-agent</code>, plus a{" "}
              <strong className="text-foreground">latency / p95</strong> dashboard table. Tier 3
              DX/perf items are listed timeboxed in{" "}
              <code className="text-xs">docs/plans/tier-3-dx-backlog.md</code>.
            </li>
            <li>
              Report Centre: clearer empty state when there are no saved reports, with a shortcut
              back to the workspace. Portal settings tenant list uses the same TanStack Query
              pattern as other portal data (bootstrap key + refresh after save).
            </li>
            <li>
              Quality: signed-in Playwright journey (when{" "}
              <code className="text-xs">E2E_USER_EMAIL</code> /{" "}
              <code className="text-xs">E2E_USER_PASSWORD</code> are set) — workspace fixture
              upload, Executive one-pager, <strong className="text-foreground">Word</strong>{" "}
              download, and PDF export path (print preview <code className="text-xs">print()</code>{" "}
              stubbed for automation). Saved reports library in the management drawer uses TanStack
              Query for list/delete refresh. Portal viewers and scheduled-report settings use the
              shared empty-state pattern. <code className="text-xs">api-public</code> and{" "}
              <code className="text-xs">api-agent</code> emit structured{" "}
              <code className="text-xs">logJson</code> events for drains. Tier-2 test plan:{" "}
              <code className="text-xs">T9.3a</code>.
            </li>
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
            <li>
              <strong className="text-foreground">ConnectWise Cloud Services:</strong> PSA &amp; API
              automation → ConnectWise Cloud — store encrypted API user ID and subscription key
              (same encryption key as Sophos Central), verify OAuth client-credentials token on
              save, test token, and load Partner Cloud <code className="text-xs">GET /whoami</code>{" "}
              profile from the Edge API (credentials never returned to the browser).
            </li>
            <li>
              <strong className="text-foreground">ConnectWise Manage (tickets):</strong> Manage REST
              credentials under PSA settings; admins create idempotent service tickets from{" "}
              <strong className="text-foreground">Findings — bulk actions</strong> (one finding
              selected) with server-side dedupe and audit (
              <code className="text-xs">psa_ticket_idempotency</code>).
            </li>
            <li>
              <strong className="text-foreground">PSA customer mapping:</strong> under ConnectWise
              Manage settings, map each FireComply customer name (same label as the Customers page)
              to a Manage company ID; tickets from findings pre-fill the ID or can use the mapping
              server-side when the field is left empty. Combobox pickers and Manage company list
              (REST) reduce typos.
            </li>
            <li>
              <strong className="text-foreground">Autotask PSA (Datto):</strong> second PSA under
              the same settings drawer — zone URL, API user, encrypted secret and integration code,
              ticket picklist defaults; customer ↔ Autotask company mapping with company query;
              idempotent tickets from findings when Autotask is linked (
              <code className="text-xs">autotask_psa_credentials</code>,{" "}
              <code className="text-xs">provider = autotask</code> on shared mapping / idempotency
              tables).
            </li>
            <li>
              <strong className="text-foreground">Org service API keys:</strong> workspace settings
              list, create, and revoke keys; Edge validates{" "}
              <code className="text-xs">X-FireComply-Service-Key</code> / Bearer (non-JWT) on{" "}
              <code className="text-xs">/api/service-key/ping</code> and scoped routes such as{" "}
              <code className="text-xs">GET /api/firewalls</code> with{" "}
              <code className="text-xs">api:read</code>, and{" "}
              <code className="text-xs">GET /api/assessments</code> (list + detail) with{" "}
              <code className="text-xs">api:read:assessments</code>. Issue/revoke via{" "}
              <code className="text-xs">POST /api/service-key/issue</code> and{" "}
              <code className="text-xs">/api/service-key/revoke</code> (secret shown once).
            </li>
            <li>
              Agent connector: package version from submissions is shown in Fleet views for support
              and upgrade tracking.
            </li>
            <li>
              New routes: <strong className="text-foreground">Trust</strong> (
              <code className="text-xs">/trust</code>
              ), <strong className="text-foreground">Audit log</strong> (
              <code className="text-xs">/audit</code>), and this{" "}
              <strong className="text-foreground">Changelog</strong> (
              <code className="text-xs">/changelog</code>).
            </li>
            <li>
              Product telemetry: lightweight client events for key flows (e.g. Central connect) to
              support funnel and adoption reporting.
            </li>
            <li>
              Documentation: self-hosted runbook (
              <code className="text-xs">docs/SELF-HOSTED.md</code>
              ), supported SFOS versions matrix (in-repo and linked from upload empty states), and
              refreshed roadmap / execution plan notes under{" "}
              <code className="text-xs">docs/plans/</code>.
            </li>
            <li>
              API Hub, customer management, playbook library, and portfolio insights: navigation and
              copy aligned with workspace settings and MSP workflows.
            </li>
            <li>
              <strong className="text-foreground">Firewall Licence Monitor:</strong> HA A-P rows cap
              displayed serials at two (primary + peer from Central cluster or licence heuristic).
              When <strong className="text-foreground">Xstream</strong> is active on a device,
              expired <strong className="text-foreground">FullGuard</strong> and expired{" "}
              <strong className="text-foreground">trial</strong> lines for bundled modules (e.g.
              Network/Web/Zero-Day/Email) no longer drive an{" "}
              <strong className="text-foreground">EXPIRED</strong> header — Central often keeps
              legacy rows next to Xstream.
            </li>
            <li>
              <strong className="text-foreground">Config History:</strong> the saved customer label
              uses your FireComply org name when Sophos Central returned the{" "}
              <code className="text-xs">(This tenant)</code> placeholder; tooltip notes the value
              comes from report branding at snapshot time (not a separate MSP account).
            </li>
            <li>
              <strong className="text-foreground">PSA &amp; API automation</strong> (workspace
              settings) and <strong className="text-foreground">API &amp; Integrations</strong>:
              ConnectWise Cloud, ConnectWise Manage, Autotask PSA, and scoped service keys use the
              same <strong className="text-foreground">Connect / Configure → dialog</strong> pattern
              as Slack and Microsoft Teams — no inline dropdown; API Hub lists each as its own card
              with live connected state.
            </li>
            <li>
              <strong className="text-foreground">Scoped service keys:</strong> clearer in-app
              messages when key list or issue/revoke calls fail at the network layer (instead of a
              bare &quot;Failed to fetch&quot;).
            </li>
            <li>
              <strong className="text-foreground">Fleet (list view):</strong> Sophos Central
              customer groups start <strong className="text-foreground">collapsed</strong> — open a
              row to see its firewalls (reduces scroll on large estates).
            </li>
            <li>
              <strong className="text-foreground">Scoped service keys UI:</strong> the long usage /
              ping-URL blurb is under{" "}
              <strong className="text-foreground">Using service keys &amp; ping URL</strong>,
              collapsed by default (API Hub panel and workspace PSA settings).
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
              <li>
                <strong className="text-foreground">API &amp; Integrations:</strong> Connect /
                Configure panels use a{" "}
                <strong className="text-foreground">portal to document.body</strong>, higher
                z-index, and body scroll lock so the backdrop sits above the page and no longer
                clips or stacks oddly with the hero area.
              </li>
              <li>
                <strong className="text-foreground">Edge Function CORS</strong> (
                <code className="text-xs">_shared/cors.ts</code>, used by the{" "}
                <code className="text-xs">api</code> function): browser{" "}
                <code className="text-xs">Origin</code> on HTTP loopback (
                <code className="text-xs">127.0.0.1</code>, <code className="text-xs">::1</code>,
                any port) is mirrored for local dev — avoids CORS failures when the app URL uses
                numeric loopback instead of <code className="text-xs">localhost</code>. Redeploy the{" "}
                <code className="text-xs">api</code> function after updating.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

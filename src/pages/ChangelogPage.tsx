import { ScrollText } from "lucide-react";
import { useAuthProvider, AuthProvider } from "@/hooks/use-auth";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { WorkspaceSubpageHeader } from "@/components/WorkspaceSubpageHeader";

/** In-app “What’s new” page (curate releases here). */
function ChangelogPageInner() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkspaceSubpageHeader title="What's new" titleIcon={<ScrollText />} container="docs" />
      <WorkspacePrimaryNav />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <p className="text-xs text-muted-foreground">
          Technical changelog: <code className="text-xs">CHANGELOG.md</code> at the repository root
          (Keep a Changelog).
        </p>
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">2026-04</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Compliance heatmap — multi-firewall</strong>: the
              heatmap, posture ring, coverage bars, gap analysis, evidence collection, and control
              map now show the <strong className="text-foreground">union</strong> of all per-config
              compliance frameworks and merge findings from every uploaded firewall instead of only
              the first.
            </li>
            <li>
              <strong className="text-foreground">Demo &amp; agent polish</strong>: Central link
              loading no longer logs 406 when a config has no saved firewall link; report generation
              skips empty config sections instead of hammering the API; fleet overview tolerates
              snapshots missing risk score details.
            </li>
            <li>
              <strong className="text-foreground">Demo mode</strong>: a{" "}
              <strong className="text-foreground">Demo mode</strong> button on the login page signs
              you into a fully populated workspace with 10 customers across 7 countries (UK, DE, FR,
              SE, US, JP, AU), 51 firewalls (including HA pairs), a realistic Sophos Central
              connection, sample assessments and reports, and client portals — no credentials
              needed.
            </li>
            <li>
              <strong className="text-foreground">Sophos Central link</strong>: the per-upload{" "}
              <strong className="text-foreground">Link to Sophos Central</strong> control is{" "}
              <strong className="text-foreground">full width</strong> with a calm outline + brand
              tint (no heavy gradient or glow). When expanded, the picker keeps comfortable padding,
              taller inputs, and readable firewall rows.
            </li>
            <li>
              <strong className="text-foreground">Assessment Context</strong>:{" "}
              <strong className="text-foreground">Report identity</strong> and{" "}
              <strong className="text-foreground">Customer name</strong> share one card (single
              column). <strong className="text-foreground">Environment</strong> and{" "}
              <strong className="text-foreground">country</strong> are no longer edited on this
              screen — set them per upload under{" "}
              <strong className="text-foreground">Compliance (this firewall)</strong>, or they come
              from a Central link / Fleet-backed defaults.
            </li>
            <li>
              <strong className="text-foreground">Customer Context — auto fill</strong>: choosing a
              customer from your org directory (when signed in) fills{" "}
              <strong className="text-foreground">environment</strong>,{" "}
              <strong className="text-foreground">country</strong>, and default{" "}
              <strong className="text-foreground">compliance frameworks</strong> from Fleet when
              available — including after the directory loads if you landed via{" "}
              <strong className="text-foreground">?customer=</strong>. Central firewall links do the
              same when global context was still empty (single file, or first link while global geo
              is unset with multiple files), matching the scope chips on the upload row.
            </li>
            <li>
              <strong className="text-foreground">Compliance per firewall</strong>: every upload row
              has <strong className="text-foreground">Compliance (this firewall)</strong> — web
              filter tone (strict vs informational) and the full framework checklist. New uploads
              copy defaults from session branding; a{" "}
              <strong className="text-foreground">Central link</strong> still sets country and
              sector on that row. Unlinking removes the tenant label but keeps that row&apos;s
              compliance choices. The old global Compliance alignment block is removed so there is a
              single place to tune each device. When a file is not Central-linked, or the link did
              not supply both sector and country, a highlighted{" "}
              <strong className="text-foreground">Scope for this export</strong> block appears in
              that row so you set geography next to frameworks; fully linked devices keep compact
              chips above and hide the duplicate geo fields.
            </li>
            <li>
              <strong className="text-foreground">Mixed regions in one session</strong>: if uploads
              use different country or sector (for example UK Education and Canada Education), an
              amber note in Assessment Context clarifies that the session customer label is not
              enough on its own; each row&apos;s compliance panel and link chips are what apply per
              firewall for frameworks and findings.
            </li>
            <li>
              <strong className="text-foreground">New assessment flow</strong>: saved local sessions
              offer Resume session or Start fresh instead of auto-restoring reports, branding, and
              the header report count. For manual config uploads, the Context step stays incomplete
              until you enter a customer; agent-sourced configs can still advance from tenant
              context alone.
            </li>
            <li>
              <strong className="text-foreground">Compliance heatmap</strong>: hovering a cell opens
              a tooltip above it (framework, control, evidence, status) using a portaled layer so it
              is not clipped by the card.
            </li>
            <li>
              <strong className="text-foreground">Fleet Command load errors</strong>: if the fleet
              API fails while you are signed into an organisation, the page no longer shows the
              guest sample fleet (placeholder customer names). You get a clear error and{" "}
              <strong className="text-foreground">Try again</strong> instead — often fixed by
              applying pending Supabase migrations.
            </li>
            <li>
              <strong className="text-foreground">Fleet compliance context</strong>: each customer
              row (Sophos tenant or agent bucket) has{" "}
              <strong className="text-foreground">Customer defaults</strong> — default country and
              sector — with <strong className="text-foreground">Save customer</strong>. Expand a
              firewall to set <strong className="text-foreground">country</strong> (and US state)
              for that site only; the panel shows{" "}
              <strong className="text-foreground">Selected</strong>,{" "}
              <strong className="text-foreground">Not selected</strong> (with customer default), or
              prompts to set defaults. Row chips use effective country. Grid view uses the same
              customer grouping. Migration{" "}
              <code className="text-xs">customer_compliance_country</code> adds default country
              columns.
            </li>
            <li>
              <strong className="text-foreground">Light mode polish</strong>: dashboard hover
              popovers (configuration stats, feature coverage, charts, compliance heatmap, priority
              matrix) use the same readable surface as other popovers instead of dark glass with
              theme text; report/QBR/deterministic-finding shells paint their top accent as part of
              the rounded background so corners stay consistent. Customer Management, Trust, and
              What&apos;s new use the same navy banner strip as Report Centre (white title, cyan
              title icon, muted Home crumb) in light and dark mode.
            </li>
            <li>
              <strong className="text-foreground">Readability</strong>: medium severity and grade C
              use dark amber on light backgrounds (charts, badges, posture scorecard) instead of
              neon yellow; dark mode keeps brighter yellow where it helps. Compliance heatmap hover
              popovers render outside the clipped card; heatmap cells gain spacing so rounded
              corners read clearly; the heatmap header accent follows the card radius.
            </li>
            <li>
              <strong className="text-foreground">Central linking</strong>: auto-linking a file to a
              Sophos Central firewall by serial no longer re-saves the link on every UI refresh — a
              stable callback and one-time persist guard prevent accidental repeat database writes
              (which could overwhelm small Supabase plans). Manual HTML/XML uploads no longer
              auto-match or auto-link Central by serial or hostname — only configs pulled via the{" "}
              <strong className="text-foreground">connected agents</strong> path do. Central links
              are keyed per uploaded config row (not by file contents), so removing a file clears
              its link and re-adding the same export starts unlinked. When you link (or reload with
              an existing link), the green link row shows that firewall&apos;s fleet{" "}
              <strong className="text-foreground">sector</strong> and{" "}
              <strong className="text-foreground">country</strong> (same rules as Fleet Command),
              and <strong className="text-foreground">Customer Context</strong> picks up customer
              name (Sophos tenant), environment type, country, US state when applicable, and default
              frameworks aligned to that scope. The Central firewall picker shows each row&apos;s{" "}
              <strong className="text-foreground">sector</strong> and{" "}
              <strong className="text-foreground">country</strong> (and US state when applicable)
              before you select.
            </li>
            <li>
              <strong className="text-foreground">Per-config compliance scope</strong>: with
              multiple firewall exports in one session, each file keeps its own Central link context
              (country, sector, frameworks) instead of the last link overwriting Customer Context.
              Each row shows effective scope; you can add{" "}
              <strong className="text-foreground">additional frameworks</strong> per config.
              Individual and compliance reports use the matching scope per firewall; combined
              compliance and executive summaries include per-firewall jurisdiction details (and a
              jurisdictional note when sites differ). Saved browser sessions restore the per-config
              map.
            </li>
            <li>
              <strong className="text-foreground">SE team dashboard</strong>: the team health-check
              list loads only the small &quot;top findings&quot; slice from each row&apos;s summary
              JSON (not the full saved snapshot), and refetches less aggressively — lowering
              PostgREST payload size and database time on busy projects.
            </li>
            <li>
              <strong className="text-foreground">Accessibility</strong>: flow error detail text
              (upload, save, export) uses higher-contrast colours in light mode so it meets WCAG AA
              and passes automated axe checks in CI. Run{" "}
              <code className="text-xs">npm run test:e2e:a11y</code> for a fast Playwright axe slice
              before pushing signed-in UI changes.
            </li>
            <li>
              <strong className="text-foreground">Customers</strong>: the directory only lists
              Sophos Central tenants that have firewalls, a linked agent, or portal mapping — empty
              partner child tenants no longer inflate the count. If loading fails, the page shows an
              error and retry instead of five demo customers; search and filters show &quot;X of
              Y&quot; when the list is narrowed. Fleet Command customer counts group assessments the
              same way as the directory (resolved customer name, not raw name × environment). For
              cloud workspaces, the Assess customer list is built from that directory so it matches
              the Customers page; Central-only and connector labels still appear when needed.
              Customer delete clears assessments and saved reports with case-insensitive name
              matching, removes matching scheduled reports, and drops the portal row when your role
              allows; Sophos Central tenants with live firewalls or agents may still appear until
              adjusted in Agent Management.
            </li>
            <li>
              <strong className="text-foreground">Assess overview</strong>: the Tenant Overview and
              Fleet Health Map reload cloud assessments when you delete a customer or change
              assessment history. The customer list and fleet tiles are limited to names on the
              Customers page, and assessment grouping uses the same agent site-label → Central
              tenant folding as Customer Management so legacy labels (for example an old tenant
              title) do not show as a second row.
            </li>
            <li>
              <strong className="text-foreground">Customer cards</strong>: rows tied to a Sophos
              Central tenant show a clear &quot;Sophos Central&quot; pill (cloud icon, brand-tinted)
              next to environment; vague assessment environments like &quot;Unknown&quot; read as
              &quot;Environment not set&quot; with a neutral badge.
            </li>
            <li>
              <strong className="text-foreground">Client portal access</strong>: portal viewer
              invites and the Customer Management &quot;Portal Access&quot; list are scoped to each
              customer&apos;s portal slug (not the whole organisation). External viewers only pass
              the access check for the slug they were invited to. Configure Portal must be saved
              with a slug before inviting viewers for that customer. Apply the database migration
              for <code className="text-xs">portal_viewers.portal_slug</code> on self-hosted
              Supabase.
            </li>
            <li>
              <strong className="text-foreground">Severity colours</strong>: High findings use pink;
              Medium uses the orange previously used for High, so the stacked bar and badges read as
              Critical → High → Medium → Low more distinctly.
            </li>
            <li>
              <strong className="text-foreground">First-time setup</strong>: Welcome and completion
              steps mention the Assess workflow stepper, command palette (⌘K / Ctrl+K), Insights,
              status cards for parse/Central, Trust, team invites, and scheduled reports; wizard
              previews use the same severity palette as the product. The MSP checklist explains
              upload-only vs full stack and adds optional links (Trust, team, branding, scheduled
              reports).
            </li>
            <li>
              <strong className="text-foreground">Accessibility</strong>: dashboard stat card
              captions (for example &quot;Issues&quot;) use full-opacity muted text so small labels
              meet contrast checks in light mode.
            </li>
            <li>
              <strong className="text-foreground">Workspace UX</strong>:{" "}
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
                ⌘K
              </kbd>{" "}
              / Ctrl+K opens a command palette to jump to hubs, SE Health Check, or workspace
              settings; Assess shows a compact workflow stepper; Overview analysis adds a
              collapsible &quot;Extended overview&quot; block; Insights shows a portfolio risk
              strip; upload, save, failed report generation, Sophos Central status on Assess, and
              Export Centre pre-flight checks use a shared status card (retry, settings link, or
              Trust where relevant).
            </li>
            <li>
              <strong className="text-foreground">Theme</strong>: reduced light/dark flicker on load
              and on the main dashboard by syncing <code className="text-xs">color-scheme</code>{" "}
              with the early theme script, disabling transitions during theme class updates,
              aligning toasts with the document, and using the same resolved dark/light signal as{" "}
              <code className="text-xs">&lt;html class&gt;</code> for tab bars, tours, charts, and
              theme toggles when the stored preference is &quot;system&quot; (next-themes used to
              leave <code className="text-xs">resolvedTheme</code> briefly undefined).
            </li>
            <li>
              <strong className="text-foreground">Connectors</strong>: customer site labels can be
              set when registering an agent and edited anytime from Management (expand the agent);
              the fleet list no longer shows a bare &quot;Unnamed&quot; when Central tenant or other
              context applies. When Sophos Central is linked, that label is only the site or
              location — new assessments bucket under the Central tenant (not a second customer),
              Management shows your org name instead of &quot;(This tenant)&quot; for single-tenant
              accounts, and existing mis-keyed rows fold into the right customer in the directory
              where possible. <strong className="text-foreground">Connected Firewalls</strong> waits
              until the connector reports firewall serial or firmware so partial wizard /
              API-key-only check-ins do not show as an extra row. You can set{" "}
              <strong className="text-foreground">Customer (grouping)</strong> on each connector in
              Management so multiple agents share one customer (same name = same group and
              assessment bucket; optional pick list from existing customers).
            </li>
            <li>
              <strong className="text-foreground">Report identity</strong>: the workspace{" "}
              <strong className="text-foreground">Company logo</strong> (Settings) is applied
              automatically to <strong className="text-foreground">Report identity</strong> when you
              have not chosen a different file there; it stays in sync until you upload an
              assessment-specific logo.
            </li>
            <li>
              <strong className="text-foreground">Management</strong>: connector{" "}
              <strong className="text-foreground">Customer (grouping)</strong> is a dropdown of
              existing customers only (add customers via assessments or Customer Management). Saving
              labels uses a stricter <code className="text-xs">api</code> agent route so PATCH is
              not mistaken for a connector call (no more misleading &quot;Missing X-API-Key&quot;).
            </li>
            <li>
              <strong className="text-foreground">Extraction Summary</strong>: dark mode uses solid
              card-style surfaces, clearer metric labels, an amber-tinted (not beige) empty-sections
              warning, and readable file rows.
            </li>
            <li>
              <strong className="text-foreground">Outcome summary</strong>: &quot;Top actions&quot;
              panel and cards use dark surfaces; evidence blocks use slate backgrounds and zinc text
              with readable rose/amber labels.
            </li>
            <li>
              <strong className="text-foreground">Header / theme</strong>: full refresh now keeps{" "}
              <strong className="text-foreground">light</strong> vs{" "}
              <strong className="text-foreground">dark</strong> in sync with next-themes (including
              explicit light mode), and the app header / workspace nav use an opaque navy fallback
              plus forced light text on ghost buttons so connector and toolbar labels stay readable.
            </li>
            <li>
              <strong className="text-foreground">Light mode polish</strong>: dashboard stat tiles
              (outcome summary, security analysis strip, extraction summary, estate overview, score
              dial) use neutral card surfaces with readable{" "}
              <strong className="text-foreground">emerald / amber / rose</strong> typography instead
              of neon text on pale mint or yellow washes; coloured glass gradients stay in dark
              mode.
            </li>
            <li>
              <strong className="text-foreground">Rule optimiser</strong>: shadowed-rule hints now
              respect <strong className="text-foreground">user identity</strong>,{" "}
              <strong className="text-foreground">Match known users</strong>, and{" "}
              <strong className="text-foreground">schedule</strong> when those columns appear in the
              export, so a broader rule for one user group no longer implies a later rule
              &quot;never&quot; matches. Shadowing card detail text is easier to read in light mode.
            </li>
            <li>
              <strong className="text-foreground">Compliance tab</strong>: the sticky{" "}
              <strong className="text-foreground">Control</strong> column on the framework heatmap
              uses a light card background in light mode so control names stay readable (no more
              dark column with low-contrast text).
            </li>
            <li>
              <strong className="text-foreground">Sign up / sign in</strong>: clearer feedback when
              creating an account — Sonner toasts on failure, a persistent &quot;confirm your
              email&quot; screen when verification is required (and local session cleared so you
              aren&apos;t dropped into setup while still a guest), plus guidance when email
              confirmation isn&apos;t needed. Guest upsell copy mentions confirming email after
              register.
            </li>
            <li>
              <strong className="text-foreground">Security</strong>:{" "}
              <strong className="text-foreground">Passkey sign-in</strong> now verifies the full
              WebAuthn assertion (challenge, signature, origin, RP ID, counter) on{" "}
              <code className="text-xs">api-public</code>; login uses a short-lived signed challenge
              token. Deploy the matching frontend; optional secret{" "}
              <code className="text-xs">PASSKEY_CHALLENGE_SECRET</code> is documented in{" "}
              <code className="text-xs">docs/SELF-HOSTED.md</code>.
            </li>
            <li>
              <strong className="text-foreground">Quality &amp; exports</strong>: CI enforces a{" "}
              <strong className="text-foreground">JS bundle budget</strong>; E2E can assert a real{" "}
              <strong className="text-foreground">PDF download</strong> for the executive one-pager
              when the preview build sets the PDF test flag; shared health-check{" "}
              <strong className="text-foreground">Print</strong> uses the same sandboxed-iframe idea
              as the in-page preview. Analysis failures surface a clearer{" "}
              <strong className="text-foreground">toast</strong> with Retry guidance.
            </li>
            <li>
              <strong className="text-foreground">SE Health Check</strong>: the{" "}
              <strong className="text-foreground">results</strong> step is a dedicated module for
              easier maintenance; the <strong className="text-foreground">landing</strong> /
              analysing step is extracted in the same way.{" "}
              <strong className="text-foreground">Sophos Central</strong> discovery (connect +
              licence load) cancels in-flight requests when credentials or tenant change, or when
              you start a new connect while one is still running. Leaving the page during{" "}
              <strong className="text-foreground">AI report generation</strong> cancels the
              in-flight stream; PSA settings, the public config-upload page, client portal load, and
              fleet scan/delete actions use the same cancellation pattern where it matters.
            </li>
          </ul>
        </section>
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">2026-03</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Workspace headers</strong>: Customer Management,
              Trust, and What&apos;s new share the same sticky bar (Home crumb, theme toggle, navy
              gradient in dark mode). Primary buttons no longer use backdrop blur on the solid brand
              fill so the blue stays correct after a full page refresh.
            </li>
            <li>
              <strong className="text-foreground">Trust centre</strong>: procurement stub copy
              (placeholders such as attach diagram / link) uses standard muted body colour instead
              of extra transparency so small text passes WCAG AA contrast on light panels and E2E
              axe checks stay green.
            </li>
            <li>
              <strong className="text-foreground">Security</strong>:{" "}
              <strong className="text-foreground">Shared health-check</strong> report HTML loads in
              a sandboxed iframe (embedded scripts do not run);{" "}
              <strong className="text-foreground">PDF / HTML export</strong> escapes branding text
              in the document shell and only allows <code className="text-xs">https://</code> or{" "}
              <code className="text-xs">data:image/…;base64</code> logos.
            </li>
            <li>
              <strong className="text-foreground">Trust &amp; privacy</strong>:{" "}
              <strong className="text-foreground">Trust</strong> page and{" "}
              <code className="text-xs">docs/DATA-PRIVACY.md</code> now spell out{" "}
              <strong className="text-foreground">Gemini / cross-border processing</strong> (no
              region pinning), practical controls (local mode, anonymisation), and recommended
              consent / subprocessor documentation for MSPs.
            </li>
            <li>
              <strong className="text-foreground">Trust — Legal &amp; questionnaires</strong>:
              expanded skeleton for security reviews — checklist, SOC2/ISO mapping table (stubs),
              data-flow diagram placeholders, questionnaire topic matrix, legal doc links, and
              procurement callout; subprocessors section has an in-page anchor.
            </li>
            <li>
              <strong className="text-foreground">License</strong>: application source is released
              under the <strong className="text-foreground">MIT</strong> licence (repository{" "}
              <code className="text-xs">LICENSE</code>); third-party dependencies keep their own
              terms.
            </li>
            <li>
              <strong className="text-foreground">Export Centre</strong>: when you are signed in,
              the linked cloud assessment id is saved with your session so after a page refresh{" "}
              <strong className="text-foreground">findings CSV</strong> can still include{" "}
              <strong className="text-foreground">reviewer sign-off</strong> (reloaded from the
              server).
            </li>
            <li>
              <strong className="text-foreground">Compliance frameworks</strong>:{" "}
              <strong className="text-foreground">CIS</strong> and{" "}
              <strong className="text-foreground">SOC 2</strong> are available in Assessment Context
              with the same control heatmap and export mapping as other frameworks; Financial
              Services defaults include SOC 2 alongside PCI DSS and SOX.
            </li>
            <li>
              <strong className="text-foreground">UX &amp; quality bar</strong>: consistent{" "}
              <strong className="text-foreground">EmptyState</strong> on more analysis surfaces;
              signed-in <strong className="text-foreground">Playwright</strong> viewports (home,
              Fleet Command, Customers, management drawer, demo Assess on desktop) plus{" "}
              <strong className="text-foreground">axe</strong> on key routes;{" "}
              <strong className="text-foreground">docs/UI-NOTIFICATIONS.md</strong> explains toasts
              vs Notification Centre; <strong className="text-foreground">Invite</strong> and{" "}
              <strong className="text-foreground">Webhook</strong> settings use{" "}
              <strong className="text-foreground">Zod</strong> field errors;{" "}
              <strong className="text-foreground">Export Centre</strong> can include reviewer
              sign-off on findings CSV when a linked cloud assessment has sign-off saved. Hub
              workspace-settings hint text meets light-theme contrast for accessibility checks.
            </li>
            <li>
              <strong className="text-foreground">Polish</strong>: corner highlight glows on the
              analysis <strong className="text-foreground">outcome summary</strong> metrics and on{" "}
              <strong className="text-foreground">Best for / Scale</strong>-style info pills stay
              inside rounded corners; blurred glows were replaced with gradients so WebKit cannot
              paint past the curve.
            </li>
            <li>
              <strong className="text-foreground">Performance</strong>:{" "}
              <strong className="text-foreground">Vercel Speed Insights</strong> is enabled for
              real-user Core Web Vitals when the app runs on Vercel (no extra config in the
              dashboard beyond enabling the product for the project).
            </li>
            <li>
              <strong className="text-foreground">Security &amp; governance hygiene</strong>: GitHub
              Actions pinned to commit SHAs; <strong className="text-foreground">npm</strong>{" "}
              dependencies use exact versions with{" "}
              <code className="text-xs">package-lock.json</code> and{" "}
              <code className="text-xs">.npmrc</code> <code className="text-xs">save-exact</code>;{" "}
              <strong className="text-foreground">LICENSE</strong>,{" "}
              <code className="text-xs">.github/CODEOWNERS</code>, PR{" "}
              <strong className="text-foreground">dependency review</strong>,{" "}
              <strong className="text-foreground">Dependabot</strong>, and blocking{" "}
              <code className="text-xs">npm audit --omit=dev</code> in CI;{" "}
              <strong className="text-foreground">E2E auth bypass</strong> stays loopback-only with
              explicit denial on common hosted host suffixes, and{" "}
              <strong className="text-foreground">Vercel Production</strong> builds fail if{" "}
              <code className="text-xs">VITE_E2E_AUTH_BYPASS</code> is set;{" "}
              <strong className="text-foreground">DATA-PRIVACY</strong> adds TIA / SCC / consent
              guidance for Gemini transfers.
            </li>
            <li>
              <strong className="text-foreground">ADR 0004 wave 2</strong>: management drawer
              settings (invites, scheduled reports, portal save, passkeys, MSP checklist, fleet
              agents list, playbook remediation sync) route Supabase reads/writes through shared{" "}
              <code className="text-xs">src/hooks/queries</code> and{" "}
              <code className="text-xs">src/lib/data</code> helpers with TanStack Query
              invalidation.
            </li>
            <li>
              <strong className="text-foreground">Fleet &amp; playbook data</strong>: connected
              firewalls load latest submissions via TanStack Query; playbook library and remediation
              panel hydrate completion from Query.{" "}
              <strong className="text-foreground">SE Health Check</strong> findings CSV adds mapped{" "}
              <strong className="text-foreground">control IDs</strong> and optional{" "}
              <strong className="text-foreground">reviewer sign-off</strong>; main findings CSV/PDF
              include a control-ID column. <strong className="text-foreground">Analysis</strong>{" "}
              adds legacy <strong className="text-foreground">PPTP/L2TP</strong> VPN signal and
              deeper <strong className="text-foreground">email / anti-spam</strong> checks when
              those sections exist. Setup wizard{" "}
              <strong className="text-foreground">Optimisation</strong> and{" "}
              <strong className="text-foreground">Remediation</strong> guide steps live in dedicated
              files under <code className="text-xs">setup-wizard/steps</code>. Scheduled report
              email uses a <strong className="text-foreground">job outbox</strong>:{" "}
              <code className="text-xs">send-scheduled-reports</code> enqueues due runs;{" "}
              <code className="text-xs">process-job-outbox</code> claims, sends via Resend, and
              retries or dead-letters failed jobs (see{" "}
              <code className="text-xs">docs/job-queue-outline.md</code>).
            </li>
            <li>
              <strong className="text-foreground">Workspace navigation</strong>: the same primary
              tabs (Assess through Updates) appear under the header on Fleet, Customers, Reports,
              Insights, Drift, Playbooks, API, Trust, and this page when you are signed in with an
              organisation; the Reports tab stays active when viewing a saved report.
            </li>
            <li>
              <strong className="text-foreground">Keyboard shortcuts</strong> (
              <kbd className="text-xs">?</kbd>
              ): in light theme the help panel uses a solid card background (no frosted blur) so it
              stays readable; dark theme is unchanged.
            </li>
            <li>
              <strong className="text-foreground">Tours</strong> (Compass): the guided-tour menu
              uses a light popover in light theme so labels are readable; dark theme keeps the navy
              gradient menu.
            </li>
            <li>
              <strong className="text-foreground">Bottom bar</strong>: Tours and Shortcuts stay on
              the left on the same full-width strip as soon as you open Assess (including before you
              upload a config); <strong className="text-foreground">View findings</strong> /{" "}
              <strong className="text-foreground">Generate reports</strong> appear once analysis is
              ready. Report view keeps the same left-aligned utilities without the primary actions.
            </li>
            <li>
              <strong className="text-foreground">Bottom bar (light)</strong>: the Tours/Shortcuts
              strip uses a lighter frosted treatment (more transparent fill,{" "}
              <code className="text-xs">backdrop-blur</code> + Safari{" "}
              <code className="text-xs">-webkit-backdrop-filter</code>) so content behind it reads
              like dark mode.
            </li>
            <li>
              <strong className="text-foreground">Analysis tabs</strong>: tab order is Overview →
              Security → Compliance → Remediation (when there are findings) → Optimisation → Tools →
              Insurance Readiness → Compare. Primary panels on each tab (risk dashboard, heatmap,
              rule optimiser, insurance readiness, remediation playbooks, etc.) load with the main
              analysis bundle so Vite dev does not leave them on skeletons until you switch tabs;
              deeper widgets still lazy-load and preload in the background.
            </li>
            <li>
              <strong className="text-foreground">Compliance &amp; exports</strong>: cloud{" "}
              <strong className="text-foreground">Assessment History</strong> supports reviewer{" "}
              <strong className="text-foreground">sign-off</strong> (Postgres on{" "}
              <code className="text-xs">assessments</code>);{" "}
              <strong className="text-foreground">Export Centre</strong> shows validation reminders
              for high/critical findings and can append a sign-off block to the findings CSV when
              wired. <strong className="text-foreground">Certificate posture</strong> and a compact{" "}
              <strong className="text-foreground">VPN topology</strong> summary appear on Compliance
              / Security when data exists.
            </li>
            <li>
              <strong className="text-foreground">Finding Priority Matrix</strong>: quadrant
              highlights and labels match the impact/effort model (Quick Wins top-left, Strategic
              top-right, Low Priority bottom-left, Reconsider bottom-right) so filter chips select
              the correct region.
            </li>
            <li>
              <strong className="text-foreground">Quality &amp; platform</strong>:{" "}
              <code className="text-xs">job_outbox</code> +{" "}
              <code className="text-xs">claim_job_outbox_batch</code> for scheduled email delivery;{" "}
              <code className="text-xs">portal-data</code> GET validated at the Edge (Zod + OpenAPI
              limits); scheduled-report producer exports a testable{" "}
              <code className="text-xs">handler.ts</code> with Deno coverage; main score dial chart
              wrapped to skip unnecessary re-renders; unused-variable lint is stricter in shared{" "}
              <code className="text-xs">src/lib</code> code.
            </li>
            <li>
              <strong className="text-foreground">Frontend data boundary (ADR 0004)</strong>: org
              cloud purge goes through shared helpers under{" "}
              <code className="text-xs">src/lib/data/</code> with coordinated TanStack Query
              invalidation (including client portal preview and regulatory digest). Self-hosted
              operators can enable an optional{" "}
              <strong className="text-foreground">portal read cache</strong> (Upstash Redis —{" "}
              <code className="text-xs">docs/redis-pilot.md</code>). The curated{" "}
              <strong className="text-foreground">engineering scorecard</strong> in{" "}
              <code className="text-xs">docs/REVIEW.md</code> summarises platform maturity; the
              weighted narrative moved meaningfully when architecture, scalability, and
              documentation were rescored together; the March follow-on nudged the weighted score
              again (see the scorecard note at the top of that doc).
            </li>
            <li>
              <strong className="text-foreground">Workspace data purge</strong> uses a shared
              mutation hook; optional <code className="text-xs">VITE_ANALYTICS_INGEST_URL</code> can
              receive a <code className="text-xs">workspace_data_purged</code> event (see{" "}
              <code className="text-xs">docs/SELF-HOSTED.md</code>). More TanStack Query loads
              (agents, customer directory, team roster, PSA flags, submission retention, passkeys,
              SE teams, SE health-check list) pass an{" "}
              <strong className="text-foreground">abort signal</strong> so navigation cancels
              in-flight requests. SE Health Check uploads show clearer copy when a file is not a
              valid Sophos export; AI report failures point you to{" "}
              <strong className="text-foreground">Retry analysis</strong> on the report panel.
            </li>
            <li>
              <strong className="text-foreground">Compliance heatmap</strong> tooltips debounce
              briefly so moving across cells stays smooth. Secondary brand images on shared / portal
              / wizard previews use lazy loading where appropriate. Optional{" "}
              <code className="text-xs">VITE_ANALYTICS_INGEST_URL</code> also receives{" "}
              <code className="text-xs">spa_page_view</code> on navigation (see{" "}
              <code className="text-xs">docs/SELF-HOSTED.md</code>).
            </li>
            <li>
              CI Playwright can run the signed-in workspace journey{" "}
              <strong className="text-foreground">without</strong> storing test passwords:
              loopback-only auth bypass when the bundle is built with{" "}
              <code className="text-xs">VITE_E2E_AUTH_BYPASS</code> (see{" "}
              <code className="text-xs">.env.example</code>). Optional{" "}
              <code className="text-xs">E2E_USER_*</code> secrets still exercise real sign-in.
              Viewport checks (375 / 768 / 1024) cover the public home and What&apos;s new pages;
              <strong className="text-foreground"> signed-in</strong> viewport + accessibility smoke
              covers workspace home and <strong className="text-foreground">Fleet Command</strong>{" "}
              under the same bypass. Use <code className="text-xs">npm run test:e2e:ci</code>{" "}
              locally so the preview bundle includes the bypass flag before running Playwright.
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
              <strong className="text-foreground">Fleet Command</strong> loads the combined Central
              / agent / links view via TanStack Query. Empty states are aligned on more lists
              (playbook library, drawer history, client portal findings, firewall linking, licence
              filters, control map, remediation playbooks). Firewall link saves, playbook completion
              sync, passkey removal, org-wide data delete, and customer delete use mutations with
              cache refresh. The connector <strong className="text-foreground">fleet panel</strong>{" "}
              drops stale Supabase loads when you navigate away or request a newer batch.
            </li>
            <li>
              <strong className="text-foreground">Management drawer</strong> Client View preview and
              regulatory digest headlines use TanStack Query (loading and error states in the
              preview dialog). <strong className="text-foreground">Fleet Command</strong> search is
              debounced on large lists. SE Health Check{" "}
              <strong className="text-foreground">PDF / ZIP</strong> downloads load the large PDF
              engine only when you start an export.
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
              <code className="text-xs">scripts/k6/smoke.js</code> and{" "}
              <code className="text-xs">scripts/k6/sustained.js</code> harnesses (
              <code className="text-xs">BASE_URL</code>), an optional GitHub Action when{" "}
              <code className="text-xs">K6_BASE_URL</code> is configured, and a{" "}
              <code className="text-xs">supabase/seed.sql</code> stub for future local fixtures. A
              composite index on agent submission history speeds org-scoped time-range queries (
              <code className="text-xs">EXPLAIN</code> on your data per{" "}
              <code className="text-xs">docs/PERF-EXPLAIN.md</code>). Apply pending migrations with{" "}
              <code className="text-xs">supabase db push</code> on each environment.
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
              <strong className="text-foreground">After a deploy:</strong> if you see
              &quot;Importing a module script failed&quot;, use{" "}
              <strong className="text-foreground">Reload page</strong> (or a normal browser refresh)
              so the app loads the new script bundle. The error screen explains this; HTML responses
              use <code className="text-xs">no-cache</code> to reduce stale shells.
            </li>
            <li>
              <strong className="text-foreground">Report exports:</strong> PDF (browser print) and
              Word downloads use Sophos-styled tables (navy headers, purple accent rule, light row
              bands). PDF/print uses <strong className="text-foreground">A4 landscape</strong>{" "}
              throughout (same idea as Word); wide rule tables (10+ columns) get denser typography.
              Headers wrap by word; the top brand bar no longer clips dates. Fixed “page x of y”
              footers that showed <strong className="text-foreground">0 of 0</strong> and cut off
              the last lines are removed — margins come from <code className="text-xs">@page</code>{" "}
              instead. Word stays landscape with a fixed column grid. Export action labels keep full
              width in the document toolbar.
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

export default function ChangelogPage() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <ChangelogPageInner />
    </AuthProvider>
  );
}

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import {
  MOCK_THREAT_INTEL,
  MOCK_FIRMWARE_TABLE,
  type FirmwareRow,
  type ThreatIntelCard,
} from "@/lib/mock-data";
import { queryKeys } from "@/hooks/queries/keys";
import { useSophosAdvisoriesFeedQuery } from "@/hooks/queries/use-sophos-advisories-feed-query";
import { getCachedFirewalls } from "@/lib/sophos-central";
import { PLATFORM_UPDATE_CARD, type PlatformHighlightTag } from "@/data/platform-update-highlights";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function threatMatchesTab(t: ThreatIntelCard, tab: string) {
  if (tab === "all") return true;
  if (tab === "Critical") return t.severity === "CRITICAL";
  if (tab === "Firewall") return t.category === "Firewall";
  if (tab === "Endpoint") return t.category === "Endpoint";
  if (tab === "Network") return t.category === "Network";
  return true;
}

function platformHighlightTagClass(tag: PlatformHighlightTag) {
  switch (tag) {
    case "new":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
    case "improved":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
    case "fixed":
      return "bg-violet-500/15 text-violet-800 dark:text-violet-300";
  }
}

function cleanCentralFirewallModel(model: string | null | undefined): string {
  const m = (model ?? "").trim();
  if (!m) return "—";
  return m.replace(/SFVUNL_SO01_|_SO01_/g, "").trim() || "—";
}

const CHANGELOG_FW_CAP = 40;

type ChangelogFirmwareTableRow = FirmwareRow & { rowKey: string };

function centralFirewallsToFirmwareRows(
  rows: Awaited<ReturnType<typeof getCachedFirewalls>>,
): ChangelogFirmwareTableRow[] {
  const sorted = [...rows].sort((a, b) => {
    const ha = (a.hostname || a.name || "").toLowerCase();
    const hb = (b.hostname || b.name || "").toLowerCase();
    return ha.localeCompare(hb);
  });
  return sorted.slice(0, CHANGELOG_FW_CAP).map((fw) => {
    const host = (fw.hostname ?? "").trim() || (fw.name ?? "").trim() || "—";
    const serial = (fw.serialNumber ?? "").trim();
    const serialNote = serial.length > 6 ? `…${serial.slice(-6)}` : serial || "—";
    const synced = fw.syncedAt?.slice(0, 10) ?? "—";
    const rowKey =
      (fw.firewallId ?? "").trim() ||
      `${(fw.centralTenantId ?? "").trim()}-${serial}` ||
      `fw-${host}-${synced}`;
    return {
      rowKey,
      model: cleanCentralFirewallModel(fw.model),
      current: (fw.firmwareVersion ?? "").trim() || "—",
      latest: "—",
      released: synced,
      status: "Synced inventory" as const,
      notes: `${host} · SN ${serialNote}`,
    };
  });
}

function scrollToChangelogHistory(navigate: ReturnType<typeof useNavigate>) {
  void navigate({ pathname: "/changelog", hash: "history" }, { replace: true });
  requestAnimationFrame(() => {
    document.getElementById("history")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function UpdatesOverviewPanels() {
  const navigate = useNavigate();
  const { isGuest, org } = useAuth();
  const centralFwQuery = useQuery({
    queryKey: org?.id
      ? queryKeys.central.cachedFirewalls(org.id, "all")
      : ["central", "changelog_fw", "off"],
    queryFn: () => getCachedFirewalls(org!.id),
    enabled: Boolean(!isGuest && org?.id),
    staleTime: 60_000,
  });

  const firmwareRows = useMemo((): ChangelogFirmwareTableRow[] => {
    if (isGuest) {
      return MOCK_FIRMWARE_TABLE.map((f) => ({ ...f, rowKey: `demo-${f.model}` }));
    }
    const data = centralFwQuery.data;
    if (!data?.length) return [];
    return centralFirewallsToFirmwareRows(data);
  }, [isGuest, centralFwQuery.data]);
  const {
    data: digestCards,
    isPending,
    isError,
    error,
    refetch,
  } = useSophosAdvisoriesFeedQuery(!isGuest);

  const [threatTab, setThreatTab] = useState<
    "all" | "Critical" | "Firewall" | "Endpoint" | "Network"
  >("all");

  const threatCards = useMemo((): ThreatIntelCard[] => {
    if (isGuest) return MOCK_THREAT_INTEL;
    return digestCards ?? [];
  }, [isGuest, digestCards]);

  const filtered = useMemo(
    () => threatCards.filter((t) => threatMatchesTab(t, threatTab)),
    [threatCards, threatTab],
  );

  const showDigestEmpty = !isGuest && !isPending && !isError && (digestCards?.length ?? 0) === 0;

  const showThreatList = isGuest || (!isPending && !isError && (digestCards?.length ?? 0) > 0);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-35" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              Latest threats
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Intel feed
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {isGuest
              ? "Sample cards — sign in to load live advisories from Sophos (same listing as the Security Advisories site)."
              : "Live feed from the Sophos Security Advisories RSS (en-us). Firewall, Endpoint, and Network (switch / AP / wireless) are inferred from each advisory title so filters stay aligned."}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "Critical", "Firewall", "Endpoint", "Network"] as const).map((tab) => (
              <Button
                key={tab}
                type="button"
                size="sm"
                variant={threatTab === tab ? "default" : "outline"}
                className="h-8 rounded-full text-xs"
                onClick={() => setThreatTab(tab)}
              >
                {tab === "all" ? "All" : tab}
              </Button>
            ))}
          </div>
          {!isGuest && isPending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Loading headlines…
            </div>
          ) : null}
          {!isGuest && isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-muted-foreground space-y-2">
              <p>
                Could not load Sophos advisories
                {error instanceof Error ? `: ${error.message}` : "."}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          ) : null}
          {showDigestEmpty ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">No advisories returned</p>
              <p>
                When the <code className="text-[10px]">sophos-advisories-feed</code> Edge Function
                is unavailable, the app falls back to the same RSS via{" "}
                <code className="text-[10px]">/api/sophos-advisories-feed</code> (Vercel rewrite +
                Vite dev proxy) or a direct request to{" "}
                <a
                  href="https://www.sophos.com/en-us/security-advisories/feed"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  sophos.com/…/security-advisories/feed
                </a>
                . If you still see nothing, check network/CORS or deploy the Edge Function on
                Supabase. Regulatory digest for Compliance → Regulatory Tracker still uses{" "}
                <code className="text-[10px]">regulatory-scanner</code>.
              </p>
            </div>
          ) : null}
          {showThreatList ? (
            <ul className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <li className="rounded-xl border border-border/40 bg-muted/10 py-8 text-center text-xs text-muted-foreground">
                  No items match this filter.
                </li>
              ) : (
                filtered.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-border/50 bg-background/60 p-3 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-bold rounded border px-1.5 py-0.5",
                          t.severity === "CRITICAL" &&
                            "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
                          t.severity === "HIGH" &&
                            "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                          t.severity === "MEDIUM" &&
                            "border-border bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {t.severity}
                      </span>
                      {t.cve ? (
                        <span className="text-[10px] font-mono text-muted-foreground">{t.cve}</span>
                      ) : null}
                      <span className="text-[10px] rounded border border-border/60 px-1.5 py-0.5">
                        {t.products}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{t.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground">{t.published}</p>
                    <Button variant="link" className="h-auto p-0 text-xs" asChild>
                      <a
                        href={t.link?.trim() || "https://www.sophos.com/en-us/security-advisories"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t.link?.trim() ? "Read source" : "View advisory"}{" "}
                        <ExternalLink className="inline h-3 w-3 ml-0.5" />
                      </a>
                    </Button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold">Platform updates</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Summary card is driven by{" "}
            <code className="text-[10px]">src/data/platform-update-highlights.ts</code> — update it
            when you add month bullets below. The full curated list continues under each month
            heading.
          </p>
          <div className="rounded-xl border border-[#2006F7]/25 bg-[#2006F7]/5 p-4 space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              {PLATFORM_UPDATE_CARD.versionLabel ? (
                <span className="text-lg font-bold font-mono text-foreground">
                  {PLATFORM_UPDATE_CARD.versionLabel}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {PLATFORM_UPDATE_CARD.monthLabel}
              </span>
              <span className="text-[10px] text-muted-foreground/80 font-mono">
                ({PLATFORM_UPDATE_CARD.monthKey})
              </span>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              {PLATFORM_UPDATE_CARD.highlights.map((h, i) => (
                <p key={i}>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-[10px] mr-2 capitalize",
                      platformHighlightTagClass(h.tag),
                    )}
                  >
                    {h.tag}
                  </span>
                  {h.text}
                </p>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => scrollToChangelogHistory(navigate)}
            >
              Jump to detailed history
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 space-y-3">
        <h2 className="text-sm font-semibold">Sophos firmware reference</h2>
        <p className="text-xs text-muted-foreground">
          {isGuest
            ? "Illustrative sample rows — not your environment."
            : "Current firmware from Sophos Central synced inventory. Latest GA / release dates are not fetched in-app — confirm in your support or downloads portal before change windows. “Released” is last sync date."}
        </p>
        {!isGuest && centralFwQuery.isPending ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Loading synced firewalls…
          </div>
        ) : null}
        {!isGuest && centralFwQuery.isError ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs text-muted-foreground">
            Could not load Central firewall inventory.
            {centralFwQuery.error instanceof Error ? ` ${centralFwQuery.error.message}` : ""}
          </div>
        ) : null}
        {!isGuest &&
        !centralFwQuery.isPending &&
        !centralFwQuery.isError &&
        firmwareRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">No synced firewalls yet</p>
            <p>
              Connect Sophos Central and sync tenants so devices appear in{" "}
              <Link to="/command" className="text-primary underline-offset-2 hover:underline">
                Fleet
              </Link>
              . This table will list reported model and firmware from that inventory.
            </p>
          </div>
        ) : null}
        {(isGuest ||
          (!centralFwQuery.isPending && !centralFwQuery.isError && firmwareRows.length > 0)) && (
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Model</TableHead>
                  <TableHead className="text-xs">Current</TableHead>
                  <TableHead className="text-xs">Latest</TableHead>
                  <TableHead className="text-xs">{isGuest ? "Released" : "Last synced"}</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firmwareRows.map((f) => (
                  <TableRow key={f.rowKey}>
                    <TableCell className="text-sm font-medium">{f.model}</TableCell>
                    <TableCell className="font-mono text-xs">{f.current}</TableCell>
                    <TableCell className="font-mono text-xs">{f.latest}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.released}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-[10px] font-bold rounded-md border px-2 py-0.5",
                          f.status === "Up to Date" &&
                            "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                          f.status === "Update Available" &&
                            "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                          f.status === "Critical Update" &&
                            "border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-300",
                          f.status === "Synced inventory" &&
                            "border-sky-500/35 bg-sky-500/10 text-sky-900 dark:text-sky-200",
                        )}
                      >
                        {f.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!isGuest &&
        !centralFwQuery.isPending &&
        (centralFwQuery.data?.length ?? 0) > CHANGELOG_FW_CAP ? (
          <p className="text-[10px] text-muted-foreground">
            Showing first {CHANGELOG_FW_CAP} of {centralFwQuery.data?.length} synced firewalls. Open{" "}
            <Link to="/command" className="text-primary underline-offset-2 hover:underline">
              Fleet
            </Link>{" "}
            for the full list.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** In-app “What’s new” page (curate releases here). */
function ChangelogPageInner() {
  const { isGuest } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader loginShell={isGuest} />
      <WorkspacePrimaryNav />
      <main
        className="mx-auto max-w-7xl space-y-8 px-4 pt-10 assist-chrome-pad-bottom"
        data-tour="tour-page-changelog"
      >
        <div className="space-y-2" data-tour="tour-changelog-hero">
          <p className="text-xs text-muted-foreground">
            Technical changelog: <code className="text-xs">CHANGELOG.md</code> at the repository
            root (Keep a Changelog).
          </p>
        </div>
        <div data-tour="tour-changelog-panels">
          <UpdatesOverviewPanels />
        </div>
        <div
          id="history"
          className="max-w-3xl mx-auto space-y-8 border-t border-border/40 pt-10 scroll-mt-24"
          data-tour="tour-changelog-history"
        >
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">2026-04</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">
                  Updates page — real intel + platform card
                </strong>
                : Latest threats uses the <code className="text-xs">sophos-advisories-feed</code>{" "}
                Edge Function to proxy the official{" "}
                <a
                  href="https://www.sophos.com/en-us/security-advisories/feed"
                  className="text-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Sophos Security Advisories RSS
                </a>{" "}
                (aligned with the{" "}
                <a
                  href="https://www.sophos.com/en-us/security-advisories"
                  className="text-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  advisory listing
                </a>
                ); if the function is missing or unreachable, the app falls back to the same RSS via{" "}
                <code className="text-xs">/api/sophos-advisories-feed</code> (Vercel rewrite + Vite
                proxy) or a direct fetch. Firewall / Endpoint / Network filters map from each
                advisory title (switch, AP, wireless → Network). Guests still see sample cards. The
                Platform updates summary is maintained in{" "}
                <code className="text-xs">platform-update-highlights.ts</code> alongside month
                bullets. The Sophos firmware reference table uses synced{" "}
                <code className="text-xs">central_firewalls</code> inventory when you&apos;re signed
                in (not the old static demo rows); guests still see illustrative samples.
              </li>
              <li>
                <strong className="text-foreground">
                  Workspace header — Central status popover
                </strong>
                : the Sophos Central connection panel (Wi-Fi icon) now uses a portaled popover so it
                stays anchored under the trigger and no longer overlaps the bottom hub navigation.
              </li>
              <li>
                <strong className="text-foreground">Visual polish</strong>: layered mesh backgrounds
                with a subtle ambient pulse (respects reduced motion), glassier panels and widgets
                with brand sheen and top highlights, gradient product title and glowing app mark,
                stronger primary buttons, a soft-shimmer workspace tab strip, and uplifted assist
                bar chrome — same layout, more presence.
              </li>
              <li>
                <strong className="text-foreground">Help centre — doc illustrations</strong>:
                preview frames size to content, wider column (
                <code className="text-xs">max-w-6xl</code>), taller scroll cap, slightly larger
                window chrome, and responsive <code className="text-xs">zoom</code> on sm+ so tab
                mocks and labels read larger (reduced motion / narrow viewports stay at 1×).
                Captions match width; portfolio group art stays centre-aligned.
              </li>
              <li>
                <strong className="text-foreground">Global assist bar and AI chat</strong>: the
                bottom <em>Tours</em> and <em>Shortcuts</em> strip and the floating AI assistant are
                available on every route (including shared links and token pages). Suggested
                questions and AI context follow the page you&apos;re on; full assessment data still
                applies on Assess when configs are loaded. Keyboard shortcuts (Shift+?) open from
                anywhere without blocking Escape elsewhere.
              </li>
              <li>
                <strong className="text-foreground">Assess — single bottom bar</strong>:{" "}
                <strong className="text-foreground">View Findings</strong> and{" "}
                <strong className="text-foreground">Generate Reports</strong> (plus the
                missing-context dialog) live on the{" "}
                <strong className="text-foreground">same</strong> fixed footer as <em>Tours</em> and{" "}
                <em>Shortcuts</em> — right-aligned on wide layouts — instead of a second strip above
                it.
              </li>
              <li>
                <strong className="text-foreground">Sign out</strong>: workspace header sign-out
                clears session immediately, resets a stale <em>Skip sign-in</em> choice after you
                had signed in, and navigates to Assess (<code className="text-xs">/</code>) so the
                login gate appears from hub routes (Fleet, Central, and others) that do not wrap the
                gate themselves.
              </li>
              <li>
                <strong className="text-foreground">Report exports — PDF and Word</strong>: print
                PDF keeps <strong className="text-foreground">A4 landscape</strong> with tighter
                table breaks for wide recommendation tables, header row grouping, and a
                medium-density tier for 7–9 columns; MSP logos in the document body are capped when
                Tailwind is not loaded in the print window, the duplicate MSP logo in the document
                body is hidden when the navy header already shows it (subtitle text stays), and
                Download PDF includes a short orientation hint. Word exports stay landscape with{" "}
                <strong className="text-foreground">autofit</strong> tables for five or fewer
                columns and a wider first column for larger tables; E2E pdfmake downloads use
                landscape A4 for parity. In the live document preview (and any{" "}
                <code className="text-xs">.doc-section</code> shell), the MSP branding logo uses a
                bounded flex slot so large intrinsic SVG/raster dimensions cannot blow out the
                layout, and images from report markdown are capped (
                <code className="text-xs">max-width: 100%</code>,{" "}
                <code className="text-xs">max-height</code> clamp).
              </li>
              <li>
                <strong className="text-foreground">Report library — quick email</strong>: the row
                email icon opens a dialog to send the saved package to a recipient (HTML attachment,
                same rendering pipeline as the saved report viewer). Backend:{" "}
                <code className="text-xs">POST /api/send-report/saved-library</code> (primary) or{" "}
                <code className="text-xs">POST /api/send-saved-library-report</code> (org JWT + row
                ownership check, Resend). API router uses the last{" "}
                <code className="text-xs">/api/</code> segment in the pathname so varied gateways
                still match routes. Demo/sample rows stay non-actionable; the dialog still links to{" "}
                <strong className="text-foreground">Scheduled reports</strong> for recurring
                delivery.
              </li>
              <li>
                <strong className="text-foreground">Report Centre — archives</strong>: archive and
                restore persist in Supabase on{" "}
                <code className="text-xs">saved_reports.archived_at</code>. The Report Centre page
                includes a collapsible <strong className="text-foreground">Archives</strong> area;
                the main library and Saved Reports list omit archived packages. The client portal
                data function excludes archived rows so customers do not see them.
              </li>
              <li>
                <strong className="text-foreground">Report Centre — row actions</strong>: the main
                library and <strong className="text-foreground">Archives</strong> tables use a
                relaxed horizontal layout (wrap when needed) with larger gaps and 36px hit targets
                instead of a tight 3×2 icon grid, so view, PDF, Markdown, email, archive, and delete
                are easier to use.
              </li>
              <li>
                <strong className="text-foreground">Client portal — HA firewalls</strong>:{" "}
                <strong className="text-foreground">Firewall overview</strong> merges Sophos Central
                HA peers into one row (shared cluster id, or same hostname and model with two
                distinct serials), listing both serial numbers.
              </li>
              <li>
                <strong className="text-foreground">Customers — create on this page</strong>:{" "}
                <strong className="text-foreground">Add customer</strong> /{" "}
                <strong className="text-foreground">Onboard Customer</strong> open a dialog that
                saves to <code className="text-xs">customer_directory_manual</code> (name, contact,
                environment, country) so new customers appear in the directory before the first
                assessment. Delete removes that row when present. Optional logo field is not
                persisted yet.
              </li>
              <li>
                <strong className="text-foreground">Workspace pages — bottom spacing</strong>: hub
                screens (Customers, Mission control, Fleet, Insights, Central, Drift, Playbooks,
                API, Trust, Updates, Activity log, saved reports, and Assess) add padding above the
                fixed Tours/Shortcuts bar and AI assistant so content does not sit flush against the
                bottom of the viewport.
              </li>
              <li>
                <strong className="text-foreground">Fleet — Map tab</strong>: Natural Earth
                landmasses,{" "}
                <strong className="text-foreground">one compact pin per firewall</strong> in the
                filtered list, <strong className="text-foreground">pan</strong> (drag) +{" "}
                <strong className="text-foreground">zoom</strong> (scroll or +/−) with reset;{" "}
                <strong className="text-foreground">pan is bounded</strong> so the map cannot slide
                away and leave an empty or strip-thin frame. Pin position: optional{" "}
                <strong className="text-foreground">latitude/longitude</strong> on each
                firewall&apos;s location card (WGS84, saved to{" "}
                <code className="text-xs">map_latitude</code> /{" "}
                <code className="text-xs">map_longitude</code>), else Sophos Central{" "}
                <code className="text-xs">geo_location</code> when present, else compliance country
                centroid. Hover a pin for customer, Sophos tenant (when known), and firewall lines.{" "}
                <strong className="text-foreground">Rendering</strong>: pin glows avoid SVG Gaussian
                blur under CSS zoom. Pin hover details use a small card{" "}
                <strong className="text-foreground">portaled to</strong>{" "}
                <code className="text-xs">document.body</code>, positioned from the hovered pin
                button&apos;s <code className="text-xs">getBoundingClientRect()</code> (updates on
                pan/zoom/resize) so it stays on the dot at deep zoom — nested{" "}
                <code className="text-xs">scale(zoom)</code> + percentage offsets inside the map
                layer caused drift when zoomed in. On-screen size still follows{" "}
                <code className="text-xs">tipScreen</code> (zoom curve). Zoom range{" "}
                <strong className="text-foreground">1×</strong> (min, fills the frame) through{" "}
                <strong className="text-foreground">12×</strong> (max).
              </li>
              <li>
                <strong className="text-foreground">Workspace header — organisation button</strong>:
                from Fleet, Customers, Central, and other hub pages, clicking the org name opens{" "}
                <strong className="text-foreground">Workspace Controls</strong> in place (no jump to
                Assess). Assess still uses the same drawer with full assessment context.
              </li>
              <li>
                <strong className="text-foreground">Fleet — customer row health</strong>: collapsed
                MSP/customer groups show average score/grade (same source as each firewall row:
                latest submission recompute or last stored score), or — when no scores exist.
              </li>
              <li>
                <strong className="text-foreground">Fleet — Agent Status (7 days)</strong>: a daily
                server job records one UTC calendar-day presence row per connector agent (
                <code className="text-xs">agent_daily_presence</code> via the{" "}
                <code className="text-xs">agent-daily-presence</code> Edge Function), so the
                timeline can show activity without a full assessment or opening the desktop
                connector. Connector heartbeats on{" "}
                <code className="text-xs">agents.last_seen_at</code> are unchanged.
              </li>
              <li>
                <strong className="text-foreground">API hub — endpoint list</strong>: the API &amp;
                Integrations <em>Endpoints</em> section now uses the same canonical route list as
                the management panel API documentation (including public{" "}
                <code className="text-xs">api-public</code> paths, portal data,{" "}
                <code className="text-xs">parse-config</code>, portal viewers, service-key ping,
                send-report, and PSA overview routes), with resolved full URLs and auth-aware
                cURL/fetch snippets where applicable.
              </li>
              <li>
                <strong className="text-foreground">
                  Richer guided tours — full route coverage
                </strong>
                : <em>This page</em> walks multiple highlighted regions per screen (dense hubs get
                longer sequences; token and shared links get shorter multi-step paths). Coverage
                includes Assess, Mission control, Fleet, Customers, every Central sub-route
                (including firewall detail), Reports, saved report viewer, Insights, Drift,
                Playbooks, API hub, Trust, Updates, Activity log, health check (workspace and shared
                link), shared reports, client portal, config upload, team invite, theme preview, and
                the 404 page. <em>Workspace navigation</em> still covers the tab bar, shortcuts, and
                management menu where applicable; steps skip missing anchors (for example hub tabs
                when you&apos;re not signed in).
              </li>
              <li>
                <strong className="text-foreground">Documentation</strong>: the{" "}
                <code className="text-xs">/help</code> <em>Docs</em> tab groups workspace docs into
                hub pages under <code className="text-xs">/help/pages/groups/…</code> (portfolio,
                assessment, reports, platform); each hub links to the per-screen articles. Assess
                tab docs use two section hubs under{" "}
                <code className="text-xs">/help/pages/assess/sections/…</code> and a single sidebar
                entry for all <code className="text-xs">/help/pages/assess</code> routes;{" "}
                <code className="text-xs">/?tab=</code> deep links on each tab page. Site map and
                interactive guides unchanged. The bottom Tours/Shortcuts bar stays hidden on all
                documentation routes.
              </li>
              <li>
                <strong className="text-foreground">Help topic illustrations</strong>: documentation
                heroes now mirror the real UI across workspace pages, group hubs (portfolio,
                assessment, reports, platform), the Assess hub and every Assess tab (including
                separate art for Tools vs Compare), section hubs, the docs home, and interactive
                guides (upload, connector agent, pre-AI tabs, AI reports, optimisation, remediation,
                tools/compare, management menu, team, portal/alerts/webhooks). Site map keeps its
                route-tree diagram.
              </li>
              <li>
                <strong className="text-foreground">Documentation — upload formats</strong>: help
                text, route blurbs, tours, and upload illustrations now call out{" "}
                <strong className="text-foreground">HTML and XML</strong> exports (not HTML alone),
                consistent with SFOS Config Viewer HTML and entities-style XML on Assess.
              </li>
              <li>
                <strong className="text-foreground">Documentation — Connector agent</strong>: new
                interactive guide <em>Connector (collector) agent</em> explains the optional
                FireComply Connector (registration in Settings, install, API key, schedule, and
                dashboard status), with cross-links from Upload &amp; assess, Management panel, the
                API hub workspace doc, the platform doc group intro, and the site map (Operations).
              </li>
              <li>
                <strong className="text-foreground">Documentation — richer context</strong>:
                workspace page articles, Assess tab docs, group and section intros, guides (upload,
                connector, pre-AI, AI reports, management, portal), and documentation home/Assess
                hub/site map intros include more situational guidance — when to use each area, how
                Central compares to Assess, drift vs Compare, audit/API tips, and navigation hints.
              </li>
              <li>
                <strong className="text-foreground">
                  Central — Alerts, MDR &amp; Groups speed
                </strong>
                : Alerts uses the same single Edge merge as Mission control (not dozens of browser
                round-trips). MDR and <strong className="text-foreground">Groups</strong> use merged
                Edge modes with parallel tenant fetches on the server. Alerts and MDR are prefetched
                in the background after sign-in and when you open the Central hub. Mission
                control&apos;s recent-alerts table no longer shows &quot;No alerts&quot; while the
                first fetch is still running; the last successful alert bundle is also stored in the
                browser (per org) so return visits can paint immediately while a refresh runs.
              </li>
              <li>
                <strong className="text-foreground">
                  Central — tenant-type (single-tenant) API keys
                </strong>
                : merged alerts (Mission control, Central Alerts, Insights threat charts), merged
                Groups, and merged MDR always use Sophos <code className="text-xs">whoAmI</code> for
                the tenant id and regional API host. If{" "}
                <code className="text-xs">central_tenants</code> had a different UUID, the Edge
                function used to send the wrong <code className="text-xs">X-Tenant-ID</code> and you
                could see no open alerts despite Central having them.
              </li>
              <li>
                <strong className="text-foreground">
                  Mission control &amp; Central — live alert recency
                </strong>
                : merged alert fetches <strong className="text-foreground">omit</strong>{" "}
                <code className="text-xs">sort=</code> on Sophos GET (some tenants error and the
                Edge handler used to return an empty list, so Mission control showed no alerts while
                Central still had open items). We still paginate when{" "}
                <code className="text-xs">pages.total</code> is missing and sort newest-first in the
                Edge merge. Open-alert pagination follows Sophos{" "}
                <code className="text-xs">pages.nextKey</code> /{" "}
                <code className="text-xs">pageFromKey</code> when present (GET list docs use cursor
                fields, not only numeric <code className="text-xs">page</code>), so all open alerts
                load before client-side newest-first sort. Browser cache uses the v5 mission-alerts
                key; dev skips rehydrate so local browsers stay aligned. Timestamps prefer the
                latest among raised, modified, updated, reported, created, detected, and other known
                Central fields (including <code className="text-xs">when</code> /{" "}
                <code className="text-xs">occurredAt</code> variants) on the alert and{" "}
                <strong className="text-foreground">one nested object level</strong> (e.g. threat /
                managed-agent payloads); digit-only epoch seconds or milliseconds strings are parsed
                (ISO strings still supported). Recent alerts{" "}
                <strong className="text-foreground">Time</strong> shows that instant as an absolute
                local date/time (aligned with Central); hover for relative “ago” plus ISO.
              </li>
              <li>
                <strong className="text-foreground">API Explorer — real org keys</strong>: when
                you&apos;re signed in with an organisation, the API tab shows live scoped service
                keys (create, revoke, one-time secret copy) instead of sample rows; usage charts and
                request tables show honest empty states until metrics exist. Guests still see the
                layout preview with demo numbers.
              </li>
              <li>
                <strong className="text-foreground">Insights — data clarity</strong>: Security
                Intelligence keeps banners for guest demo and organisations with no saved
                assessments (illustrative charts hidden; empty states and CTA to Assess); the
                signed-in live vs sample explainer strip was removed. Score trend resets correctly
                when there is no history; help docs for Insights still note the live vs sample
                split. When you&apos;re signed in with saved assessments,{" "}
                <strong className="text-foreground">Threat landscape</strong> charts Sophos Central
                open alerts (same merged bundle as Mission control): daily counts by alert time,
                stacked buckets (Malware / Phishing / IPS / Web / Other) from Central{" "}
                <strong className="text-foreground">product</strong>,{" "}
                <code className="text-xs">Event::</code>{" "}
                <strong className="text-foreground">type</strong>, category, and description —
                operational rows (e.g. RED tunnel, patch state) stay in Other; Mission
                control&apos;s 30-day threat strip uses the same mapping. Each alert uses the latest
                Central instant among raised, modified, reported, and created fields; guests still
                see the demo series. <strong className="text-foreground">Compliance trends</strong>{" "}
                (posture categories from score history),{" "}
                <strong className="text-foreground">report activity</strong> (weekly save totals
                plus a dated list of busy days for saved reports + assessments), and{" "}
                <strong className="text-foreground">recommendations</strong> (scores + recency) are
                live for signed-in orgs with saved assessments; guests keep the demo GDPR/NIST-style
                lines and sample cards.
              </li>
              <li>
                <strong className="text-foreground">Central firewall sync (MSP)</strong>: tenant
                rows that omit <code className="text-xs">apiHost</code> from Sophos now get a
                regional API base URL from <code className="text-xs">dataRegion</code> (or your
                connector region as a fallback), so per-tenant firewall inventory can populate into
                Fleet after refresh; syncing a tenant with no firewalls clears cached rows for that
                tenant instead of leaving stale devices.
              </li>
              <li>
                <strong className="text-foreground">Mission control — live workspace data</strong>:
                when you&apos;re signed into an organisation,{" "}
                <code className="text-xs">/dashboard</code> pulls customer counts, fleet size and
                health, portfolio compliance, assessment activity, saved reports, and (with Central
                tenants synced) merged alerts and alert-driven charts; guest mode still uses the
                demo dashboard. Recent alerts include the alert summary and device labels: firewalls
                use hostnames from synced inventory; endpoint / computer alerts prefer
                Central&apos;s name and hostname fields (and related nested objects) before falling
                back to a short id. Recent documents cards surface the assessed firewall hostname(s)
                from the saved package, with the customer line below and placeholder tenant names
                mapped to your organisation display name where applicable. Open alerts load in one
                server round-trip (merged on the edge with parallel Sophos calls) instead of many
                per-tenant requests from the browser, so a full page refresh feels much faster; the
                table still refreshes about every 45 seconds while the tab is active, with a 60
                second freshness window. Cached tenants, firewalls, and the merged alerts bundle
                also prefetch in the background after sign-in and when you open the Central hub so
                tab switches are snappier.
              </li>
              <li>
                <strong className="text-foreground">Mission control — bad timestamps</strong>:
                Central alerts or assessment rows with missing or unparseable dates no longer blank
                the whole <code className="text-xs">/dashboard</code> page; charts skip those points
                and the alerts table shows an em dash instead of a relative time when needed.
              </li>
              <li>
                <strong className="text-foreground">Mission control — workspace theme</strong>: KPI
                cards, charts, alert table, sidebar widgets, quick actions, and recent documents use
                the same card and colour tokens as the rest of the hub (light and dark), aligned
                with the navy header and brand accents.
              </li>
              <li>
                <strong className="text-foreground">Unified FireComply header everywhere</strong>:
                hub pages (Mission control, Customers, Central, Reports, Fleet, Insights, Playbooks,
                Drift, API, Trust, Updates, Activity log, saved reports) use the same top bar as
                Assess — Sophos mark, enterprise badge, org selector, Central Wi‑Fi status,
                connector line, SE Health Check, notifications, account, sign out, and theme — with
                page actions (where applicable) in the strip.
              </li>
              <li>
                <strong className="text-foreground">Header stays on one row</strong>: org, Central,
                connector, page actions, and account controls no longer wrap under the Sophos
                FireComply title when space is tight; the title area can shrink and the bar scrolls
                horizontally on very narrow widths instead.
              </li>
              <li>
                <strong className="text-foreground">Hub actions below tab row</strong>: primary
                buttons (e.g. <strong className="text-foreground">New assessment</strong> on Mission
                control, <strong className="text-foreground">Generate report</strong> on Reports,
                Customers add/onboard, Activity log &quot;Open in drawer&quot;) sit in a{" "}
                <strong className="text-foreground">light page toolbar</strong> directly under the
                navy workspace tabs — not inside the dark menu strip; the top header no longer shows
                a live &quot;Updated … ago&quot; clock on Mission control.
              </li>
              <li>
                <strong className="text-foreground">
                  Workspace tabs without under-nav Central strip
                </strong>
                : the row under the primary tabs no longer repeats the Sophos Central connection
                banner (MSP pill + last sync + Central settings). Central status stays in the top
                header next to your organisation.
              </li>
              <li>
                <strong className="text-foreground">Workspace command centre rollout</strong>:{" "}
                <strong className="text-foreground">Mission control</strong> at{" "}
                <code className="text-xs">/dashboard</code> (Assess stays on{" "}
                <code className="text-xs">/</code>
                ); <strong className="text-foreground">Customers</strong> with grid/table toggle,
                detail sheet, and add-customer dialog;{" "}
                <strong className="text-foreground">Reports</strong> library with filters, bulk
                actions, full-screen preview, and generate sidebar;{" "}
                <strong className="text-foreground">Insights</strong> with threat/compliance
                visuals, risk matrix + drawer, and recommendations;{" "}
                <strong className="text-foreground">Drift</strong> manual compare and diff explorer;{" "}
                <strong className="text-foreground">API</strong> tab health strip, keys
                (reveal/revoke), and usage charts (demo metrics where noted);{" "}
                <strong className="text-foreground">Updates</strong> page adds threat feed +
                firmware table above; <strong className="text-foreground">Fleet</strong> adds a map
                tab.
              </li>
              <li>
                <strong className="text-foreground">Sophos Central hub</strong>:{" "}
                <strong className="text-foreground">Central</strong> workspace tab with overview
                (regions, online/offline counts, API hosts, hub links), full{" "}
                <strong className="text-foreground">firewall inventory</strong> with search and
                tenant filter, <strong className="text-foreground">MDR threat feed</strong> and{" "}
                <strong className="text-foreground">firewall groups</strong> (batched per tenant),
                alerts with filters and refresh, licensing split into{" "}
                <strong className="text-foreground">devices</strong> and{" "}
                <strong className="text-foreground">tenant licence</strong> tabs, sync page with
                connector context, richer firewall detail (WAN, HA, Fleet / Assess shortcuts), and
                command palette <strong className="text-foreground">Sophos Central</strong>.
              </li>
              <li>
                <strong className="text-foreground">Sign-in header (light mode)</strong>: the auth
                shell header (sign-in, org setup, MFA) now switches to a light card-style bar with
                foreground text, muted subtitle, blue Sophos mark, and readable status chips when
                the theme is light; dark theme keeps the navy gradient bar. A sun/moon control on
                that bar switches light/dark (preview builds still need{" "}
                <code className="text-xs">npm run build</code> before{" "}
                <code className="text-xs">npm run preview</code>).
              </li>
              <li>
                <strong className="text-foreground">Compliance heatmap — multi-firewall</strong>:
                the heatmap, posture ring, coverage bars, gap analysis, evidence collection, and
                control map now show the <strong className="text-foreground">union</strong> of all
                per-config compliance frameworks and merge findings from every uploaded firewall
                instead of only the first.
              </li>
              <li>
                <strong className="text-foreground">Assess — Connected Firewalls</strong>:{" "}
                <strong className="text-foreground">Load full estate</strong> adds every agent that
                has a stored full assessment to the workbench in one click; each{" "}
                <strong className="text-foreground">customer row</strong> also has{" "}
                <strong className="text-foreground">Load all</strong> to pull every firewall under
                that customer that has a full assessment (batch-fetches latest submissions so you
                don&apos;t need to expand each device first).
              </li>
              <li>
                <strong className="text-foreground">Fleet Command</strong>: when Sophos Central is
                connected and healthy, the page shows a{" "}
                <strong className="text-foreground">Connected to Sophos Central</strong> strip (same
                visual language as the Central pill on customer cards), plus optional API type and
                last sync, with a shortcut to Central settings. The page also adds jump links to
                other workspace areas, per-tenant sort and config-link filters, expand/collapse all
                groups, a <strong className="text-foreground">Customer sites</strong> count, URL
                prefill via <code className="text-xs">?customer=</code> /{" "}
                <code className="text-xs">?q=</code>, and help text for those deep links.
              </li>
              <li>
                <strong className="text-foreground">Customers &amp; API</strong>: the customer
                directory adds workspace shortcut links, a country filter, total{" "}
                <strong className="text-foreground">Firewalls tracked</strong>, and a{" "}
                <strong className="text-foreground">Fleet</strong> button that opens Fleet with that
                customer pre-searched. It also adds a{" "}
                <strong className="text-foreground">Portfolio pulse</strong> bar (A/B grade share),{" "}
                <strong className="text-foreground">starred customers</strong> pinned to the top
                (saved per org in this browser), sort options, a one-click{" "}
                <strong className="text-foreground">Needs follow-up</strong> slice, and{" "}
                <strong className="text-foreground">CSV export</strong>. The{" "}
                <strong className="text-foreground">API</strong> hub adds the same style shortcuts,
                a <strong className="text-foreground">REST base URL</strong> card with copy, copy
                for the auth header template, endpoint search, per-route{" "}
                <strong className="text-foreground">full URL</strong>,{" "}
                <strong className="text-foreground">cURL</strong>, and{" "}
                <strong className="text-foreground">fetch()</strong> copy buttons, plus method
                counts for the filtered list.
              </li>
              <li>
                <strong className="text-foreground">Fleet Command — power tools</strong>:{" "}
                <strong className="text-foreground">Spotlight</strong> toggles for devices that need
                attention (critical/offline/stale/suspended) or weak grades (C–F),{" "}
                <strong className="text-foreground">CSV export</strong> for the current filtered
                view, a live <strong className="text-foreground">showing X of Y</strong> counter,
                and keyboard <kbd className="text-xs">/</kbd> / <kbd className="text-xs">Esc</kbd>{" "}
                for the search field (documented in help).
              </li>
              <li>
                <strong className="text-foreground">Demo &amp; agent polish</strong>: Central link
                loading no longer logs 406 when a config has no saved firewall link; report
                generation skips empty config sections instead of hammering the API; fleet overview
                tolerates snapshots missing risk score details.
              </li>
              <li>
                <strong className="text-foreground">Demo mode</strong>: a{" "}
                <strong className="text-foreground">Demo mode</strong> button on the login page
                signs you into a fully populated workspace with 10 customers across 7 countries (UK,
                DE, FR, SE, US, JP, AU), 51 firewalls (including HA pairs), a realistic Sophos
                Central connection, sample assessments and reports, and client portals — no
                credentials needed.
              </li>
              <li>
                <strong className="text-foreground">Sophos Central link</strong>: the per-upload{" "}
                <strong className="text-foreground">Link to Sophos Central</strong> control is{" "}
                <strong className="text-foreground">full width</strong> with a calm outline + brand
                tint (no heavy gradient or glow). When expanded, the picker keeps comfortable
                padding, taller inputs, and readable firewall rows.
              </li>
              <li>
                <strong className="text-foreground">Assessment Context</strong>:{" "}
                <strong className="text-foreground">Report identity</strong> and{" "}
                <strong className="text-foreground">Customer name</strong> share one card (single
                column). <strong className="text-foreground">Environment</strong> and{" "}
                <strong className="text-foreground">country</strong> are no longer edited on this
                screen — set them per upload under{" "}
                <strong className="text-foreground">Compliance (this firewall)</strong>, or they
                come from a Central link / Fleet-backed defaults.
              </li>
              <li>
                <strong className="text-foreground">Customer Context — auto fill</strong>: choosing
                a customer from your org directory (when signed in) fills{" "}
                <strong className="text-foreground">environment</strong>,{" "}
                <strong className="text-foreground">country</strong>, and default{" "}
                <strong className="text-foreground">compliance frameworks</strong> from Fleet when
                available — including after the directory loads if you landed via{" "}
                <strong className="text-foreground">?customer=</strong>. Central firewall links do
                the same when global context was still empty (single file, or first link while
                global geo is unset with multiple files), matching the scope chips on the upload
                row.
              </li>
              <li>
                <strong className="text-foreground">Compliance per firewall</strong>: every upload
                row has <strong className="text-foreground">Compliance (this firewall)</strong> —
                web filter tone (strict vs informational) and the full framework checklist. New
                uploads copy defaults from session branding; a{" "}
                <strong className="text-foreground">Central link</strong> still sets country and
                sector on that row. Unlinking removes the tenant label but keeps that row&apos;s
                compliance choices. The old global Compliance alignment block is removed so there is
                a single place to tune each device. When a file is not Central-linked, or the link
                did not supply both sector and country, a highlighted{" "}
                <strong className="text-foreground">Scope for this export</strong> block appears in
                that row so you set geography next to frameworks; fully linked devices keep compact
                chips above and hide the duplicate geo fields.
              </li>
              <li>
                <strong className="text-foreground">Mixed regions in one session</strong>: if
                uploads use different country or sector (for example UK Education and Canada
                Education), an amber note in Assessment Context clarifies that the session customer
                label is not enough on its own; each row&apos;s compliance panel and link chips are
                what apply per firewall for frameworks and findings.
              </li>
              <li>
                <strong className="text-foreground">New assessment flow</strong>: saved local
                sessions offer Resume session or Start fresh instead of auto-restoring reports,
                branding, and the header report count. For manual config uploads, the Context step
                stays incomplete until you enter a customer; agent-sourced configs can still advance
                from tenant context alone.
              </li>
              <li>
                <strong className="text-foreground">Compliance heatmap</strong>: hovering a cell
                opens a tooltip above it (framework, control, evidence, status) using a portaled
                layer so it is not clipped by the card.
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
                <strong className="text-foreground">Not selected</strong> (with customer default),
                or prompts to set defaults. Row chips use effective country. Grid view uses the same
                customer grouping. Migration{" "}
                <code className="text-xs">customer_compliance_country</code> adds default country
                columns.
              </li>
              <li>
                <strong className="text-foreground">Light mode polish</strong>: dashboard hover
                popovers (configuration stats, feature coverage, charts, compliance heatmap,
                priority matrix) use the same readable surface as other popovers instead of dark
                glass with theme text; report/QBR/deterministic-finding shells paint their top
                accent as part of the rounded background so corners stay consistent. Customer
                Management, Trust, and What&apos;s new use the same navy banner strip as Report
                Centre (white title, cyan title icon, muted Home crumb) in light and dark mode.
              </li>
              <li>
                <strong className="text-foreground">Readability</strong>: medium severity and grade
                C use dark amber on light backgrounds (charts, badges, posture scorecard) instead of
                neon yellow; dark mode keeps brighter yellow where it helps. Compliance heatmap
                hover popovers render outside the clipped card; heatmap cells gain spacing so
                rounded corners read clearly; the heatmap header accent follows the card radius.
              </li>
              <li>
                <strong className="text-foreground">Central linking</strong>: auto-linking a file to
                a Sophos Central firewall by serial no longer re-saves the link on every UI refresh
                — a stable callback and one-time persist guard prevent accidental repeat database
                writes (which could overwhelm small Supabase plans). Manual HTML/XML uploads no
                longer auto-match or auto-link Central by serial or hostname — only configs pulled
                via the <strong className="text-foreground">connected agents</strong> path do.
                Central links are keyed per uploaded config row (not by file contents), so removing
                a file clears its link and re-adding the same export starts unlinked. When you link
                (or reload with an existing link), the green link row shows that firewall&apos;s
                fleet <strong className="text-foreground">sector</strong> and{" "}
                <strong className="text-foreground">country</strong> (same rules as Fleet Command),
                and <strong className="text-foreground">Customer Context</strong> picks up customer
                name (Sophos tenant), environment type, country, US state when applicable, and
                default frameworks aligned to that scope. The Central firewall picker shows each
                row&apos;s <strong className="text-foreground">sector</strong> and{" "}
                <strong className="text-foreground">country</strong> (and US state when applicable)
                before you select.
              </li>
              <li>
                <strong className="text-foreground">Per-config compliance scope</strong>: with
                multiple firewall exports in one session, each file keeps its own Central link
                context (country, sector, frameworks) instead of the last link overwriting Customer
                Context. Each row shows effective scope; you can add{" "}
                <strong className="text-foreground">additional frameworks</strong> per config.
                Individual and compliance reports use the matching scope per firewall; combined
                compliance and executive summaries include per-firewall jurisdiction details (and a
                jurisdictional note when sites differ). Saved browser sessions restore the
                per-config map.
              </li>
              <li>
                <strong className="text-foreground">SE team dashboard</strong>: the team
                health-check list loads only the small &quot;top findings&quot; slice from each
                row&apos;s summary JSON (not the full saved snapshot), and refetches less
                aggressively — lowering PostgREST payload size and database time on busy projects.
              </li>
              <li>
                <strong className="text-foreground">Accessibility</strong>: flow error detail text
                (upload, save, export) uses higher-contrast colours in light mode so it meets WCAG
                AA and passes automated axe checks in CI. Run{" "}
                <code className="text-xs">npm run test:e2e:a11y</code> for a fast Playwright axe
                slice before pushing signed-in UI changes.
              </li>
              <li>
                <strong className="text-foreground">Customers</strong>: the directory only lists
                Sophos Central tenants that have firewalls, a linked agent, or portal mapping —
                empty partner child tenants no longer inflate the count. If loading fails, the page
                shows an error and retry instead of five demo customers; search and filters show
                &quot;X of Y&quot; when the list is narrowed. Fleet Command customer counts group
                assessments the same way as the directory (resolved customer name, not raw name ×
                environment). For cloud workspaces, the Assess customer list is built from that
                directory so it matches the Customers page; Central-only and connector labels still
                appear when needed. Customer delete clears assessments and saved reports with
                case-insensitive name matching, removes matching scheduled reports, and drops the
                portal row when your role allows; Sophos Central tenants with live firewalls or
                agents may still appear until adjusted in Agent Management.
              </li>
              <li>
                <strong className="text-foreground">Assess overview</strong>: the Tenant Overview
                and Fleet Health Map reload cloud assessments when you delete a customer or change
                assessment history. The customer list and fleet tiles are limited to names on the
                Customers page, and assessment grouping uses the same agent site-label → Central
                tenant folding as Customer Management so legacy labels (for example an old tenant
                title) do not show as a second row.
              </li>
              <li>
                <strong className="text-foreground">Customer cards</strong>: rows tied to a Sophos
                Central tenant show a clear &quot;Sophos Central&quot; pill (cloud icon,
                brand-tinted) next to environment; vague assessment environments like
                &quot;Unknown&quot; read as &quot;Environment not set&quot; with a neutral badge.
              </li>
              <li>
                <strong className="text-foreground">Client portal access</strong>: portal viewer
                invites and the Customer Management &quot;Portal Access&quot; list are scoped to
                each customer&apos;s portal slug (not the whole organisation). External viewers only
                pass the access check for the slug they were invited to. Configure Portal must be
                saved with a slug before inviting viewers for that customer. Apply the database
                migration for <code className="text-xs">portal_viewers.portal_slug</code> on
                self-hosted Supabase.
              </li>
              <li>
                <strong className="text-foreground">Severity colours</strong>: High findings use
                pink; Medium uses the orange previously used for High, so the stacked bar and badges
                read as Critical → High → Medium → Low more distinctly.
              </li>
              <li>
                <strong className="text-foreground">First-time setup</strong>: Welcome and
                completion steps mention the Assess workflow stepper, command palette (⌘K / Ctrl+K),
                Insights, status cards for parse/Central, Trust, team invites, and scheduled
                reports; wizard previews use the same severity palette as the product. The MSP
                checklist explains upload-only vs full stack and adds optional links (Trust, team,
                branding, scheduled reports).
              </li>
              <li>
                <strong className="text-foreground">Accessibility</strong>: dashboard stat card
                captions (for example &quot;Issues&quot;) use full-opacity muted text so small
                labels meet contrast checks in light mode.
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
                <strong className="text-foreground">Theme</strong>: reduced light/dark flicker on
                load and on the main dashboard by syncing{" "}
                <code className="text-xs">color-scheme</code> with the early theme script, disabling
                transitions during theme class updates, aligning toasts with the document, and using
                the same resolved dark/light signal as{" "}
                <code className="text-xs">&lt;html class&gt;</code> for tab bars, tours, charts, and
                theme toggles when the stored preference is &quot;system&quot; (next-themes used to
                leave <code className="text-xs">resolvedTheme</code> briefly undefined).
              </li>
              <li>
                <strong className="text-foreground">Connectors</strong>: customer site labels can be
                set when registering an agent and edited anytime from Management (expand the agent);
                the fleet list no longer shows a bare &quot;Unnamed&quot; when Central tenant or
                other context applies. When Sophos Central is linked, that label is only the site or
                location — new assessments bucket under the Central tenant (not a second customer),
                Management shows your org name instead of &quot;(This tenant)&quot; for
                single-tenant accounts, and existing mis-keyed rows fold into the right customer in
                the directory where possible.{" "}
                <strong className="text-foreground">Connected Firewalls</strong> waits until the
                connector reports firewall serial or firmware so partial wizard / API-key-only
                check-ins do not show as an extra row. You can set{" "}
                <strong className="text-foreground">Customer (grouping)</strong> on each connector
                in Management so multiple agents share one customer (same name = same group and
                assessment bucket; optional pick list from existing customers).
              </li>
              <li>
                <strong className="text-foreground">Report identity</strong>: the workspace{" "}
                <strong className="text-foreground">Company logo</strong> (Settings) is applied
                automatically to <strong className="text-foreground">Report identity</strong> when
                you have not chosen a different file there; it stays in sync until you upload an
                assessment-specific logo.
              </li>
              <li>
                <strong className="text-foreground">Management</strong>: connector{" "}
                <strong className="text-foreground">Customer (grouping)</strong> is a dropdown of
                existing customers only (add customers via assessments or Customer Management).
                Saving labels uses a stricter <code className="text-xs">api</code> agent route so
                PATCH is not mistaken for a connector call (no more misleading &quot;Missing
                X-API-Key&quot;).
              </li>
              <li>
                <strong className="text-foreground">Extraction Summary</strong>: dark mode uses
                solid card-style surfaces, clearer metric labels, an amber-tinted (not beige)
                empty-sections warning, and readable file rows.
              </li>
              <li>
                <strong className="text-foreground">Outcome summary</strong>: &quot;Top
                actions&quot; panel and cards use dark surfaces; evidence blocks use slate
                backgrounds and zinc text with readable rose/amber labels.
              </li>
              <li>
                <strong className="text-foreground">Header / theme</strong>: full refresh now keeps{" "}
                <strong className="text-foreground">light</strong> vs{" "}
                <strong className="text-foreground">dark</strong> in sync with next-themes
                (including explicit light mode), and the app header / workspace nav use an opaque
                navy fallback plus forced light text on ghost buttons so connector and toolbar
                labels stay readable.
              </li>
              <li>
                <strong className="text-foreground">Light mode polish</strong>: dashboard stat tiles
                (outcome summary, security analysis strip, extraction summary, estate overview,
                score dial) use neutral card surfaces with readable{" "}
                <strong className="text-foreground">emerald / amber / rose</strong> typography
                instead of neon text on pale mint or yellow washes; coloured glass gradients stay in
                dark mode.
              </li>
              <li>
                <strong className="text-foreground">Rule optimiser</strong>: shadowed-rule hints now
                respect <strong className="text-foreground">user identity</strong>,{" "}
                <strong className="text-foreground">Match known users</strong>, and{" "}
                <strong className="text-foreground">schedule</strong> when those columns appear in
                the export, so a broader rule for one user group no longer implies a later rule
                &quot;never&quot; matches. Shadowing card detail text is easier to read in light
                mode.
              </li>
              <li>
                <strong className="text-foreground">Compliance tab</strong>: the sticky{" "}
                <strong className="text-foreground">Control</strong> column on the framework heatmap
                uses a light card background in light mode so control names stay readable (no more
                dark column with low-contrast text).
              </li>
              <li>
                <strong className="text-foreground">Sign up / sign in</strong>: clearer feedback
                when creating an account — Sonner toasts on failure, a persistent &quot;confirm your
                email&quot; screen when verification is required (and local session cleared so you
                aren&apos;t dropped into setup while still a guest), plus guidance when email
                confirmation isn&apos;t needed. Guest upsell copy mentions confirming email after
                register.
              </li>
              <li>
                <strong className="text-foreground">Security</strong>:{" "}
                <strong className="text-foreground">Passkey sign-in</strong> now verifies the full
                WebAuthn assertion (challenge, signature, origin, RP ID, counter) on{" "}
                <code className="text-xs">api-public</code>; login uses a short-lived signed
                challenge token. Deploy the matching frontend; optional secret{" "}
                <code className="text-xs">PASSKEY_CHALLENGE_SECRET</code> is documented in{" "}
                <code className="text-xs">docs/SELF-HOSTED.md</code>.
              </li>
              <li>
                <strong className="text-foreground">Quality &amp; exports</strong>: CI enforces a{" "}
                <strong className="text-foreground">JS bundle budget</strong>; E2E can assert a real{" "}
                <strong className="text-foreground">PDF download</strong> for the executive
                one-pager when the preview build sets the PDF test flag; shared health-check{" "}
                <strong className="text-foreground">Print</strong> uses the same sandboxed-iframe
                idea as the in-page preview. Analysis failures surface a clearer{" "}
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
                in-flight stream; PSA settings, the public config-upload page, client portal load,
                and fleet scan/delete actions use the same cancellation pattern where it matters.
              </li>
            </ul>
          </section>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">2026-03</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Workspace headers</strong>: Customer Management,
                Trust, and What&apos;s new share the same sticky bar (Home crumb, theme toggle, navy
                gradient in dark mode). Primary buttons no longer use backdrop blur on the solid
                brand fill so the blue stays correct after a full page refresh.
              </li>
              <li>
                <strong className="text-foreground">Trust centre</strong>: procurement stub copy
                (placeholders such as attach diagram / link) uses standard muted body colour instead
                of extra transparency so small text passes WCAG AA contrast on light panels and E2E
                axe checks stay green.
              </li>
              <li>
                <strong className="text-foreground">Security</strong>:{" "}
                <strong className="text-foreground">Shared health-check</strong> report HTML loads
                in a sandboxed iframe (embedded scripts do not run);{" "}
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
                <strong className="text-foreground">SOC 2</strong> are available in Assessment
                Context with the same control heatmap and export mapping as other frameworks;
                Financial Services defaults include SOC 2 alongside PCI DSS and SOX.
              </li>
              <li>
                <strong className="text-foreground">UX &amp; quality bar</strong>: consistent{" "}
                <strong className="text-foreground">EmptyState</strong> on more analysis surfaces;
                signed-in <strong className="text-foreground">Playwright</strong> viewports (home,
                Fleet Command, Customers, management drawer, demo Assess on desktop) plus{" "}
                <strong className="text-foreground">axe</strong> on key routes;{" "}
                <strong className="text-foreground">docs/UI-NOTIFICATIONS.md</strong> explains
                toasts vs Notification Centre; <strong className="text-foreground">Invite</strong>{" "}
                and <strong className="text-foreground">Webhook</strong> settings use{" "}
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
                <strong className="text-foreground">Security &amp; governance hygiene</strong>:
                GitHub Actions pinned to commit SHAs;{" "}
                <strong className="text-foreground">npm</strong> dependencies use exact versions
                with <code className="text-xs">package-lock.json</code> and{" "}
                <code className="text-xs">.npmrc</code> <code className="text-xs">save-exact</code>;{" "}
                <strong className="text-foreground">LICENSE</strong>,{" "}
                <code className="text-xs">.github/CODEOWNERS</code>, PR{" "}
                <strong className="text-foreground">dependency review</strong>,{" "}
                <strong className="text-foreground">Dependabot</strong>, and blocking{" "}
                <code className="text-xs">npm audit --omit=dev</code> in CI;{" "}
                <strong className="text-foreground">E2E auth bypass</strong> stays loopback-only
                with explicit denial on common hosted host suffixes, and{" "}
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
                firewalls load latest submissions via TanStack Query; playbook library and
                remediation panel hydrate completion from Query.{" "}
                <strong className="text-foreground">SE Health Check</strong> findings CSV adds
                mapped <strong className="text-foreground">control IDs</strong> and optional{" "}
                <strong className="text-foreground">reviewer sign-off</strong>; main findings
                CSV/PDF include a control-ID column.{" "}
                <strong className="text-foreground">Analysis</strong> adds legacy{" "}
                <strong className="text-foreground">PPTP/L2TP</strong> VPN signal and deeper{" "}
                <strong className="text-foreground">email / anti-spam</strong> checks when those
                sections exist. Setup wizard{" "}
                <strong className="text-foreground">Optimisation</strong> and{" "}
                <strong className="text-foreground">Remediation</strong> guide steps live in
                dedicated files under <code className="text-xs">setup-wizard/steps</code>. Scheduled
                report email uses a <strong className="text-foreground">job outbox</strong>:{" "}
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
                ): in light theme the help panel uses a solid card background (no frosted blur) so
                it stays readable; dark theme is unchanged.
              </li>
              <li>
                <strong className="text-foreground">Tours</strong> (Compass): the guided-tour menu
                uses a light popover in light theme so labels are readable; dark theme keeps the
                navy gradient menu.
              </li>
              <li>
                <strong className="text-foreground">Bottom bar</strong>: Tours and Shortcuts stay on
                the left on the same full-width strip as soon as you open Assess (including before
                you upload a config); <strong className="text-foreground">View findings</strong> /{" "}
                <strong className="text-foreground">Generate reports</strong> on the right once
                analysis is ready (see April 2026 for the single-bar layout). Report view keeps the
                same left-aligned utilities without the primary actions.
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
                Security → Compliance → Remediation (when there are findings) → Optimisation → Tools
                → Insurance Readiness → Compare. Primary panels on each tab (risk dashboard,
                heatmap, rule optimiser, insurance readiness, remediation playbooks, etc.) load with
                the main analysis bundle so Vite dev does not leave them on skeletons until you
                switch tabs; deeper widgets still lazy-load and preload in the background.
              </li>
              <li>
                <strong className="text-foreground">Compliance &amp; exports</strong>: cloud{" "}
                <strong className="text-foreground">Assessment History</strong> supports reviewer{" "}
                <strong className="text-foreground">sign-off</strong> (Postgres on{" "}
                <code className="text-xs">assessments</code>);{" "}
                <strong className="text-foreground">Export Centre</strong> shows validation
                reminders for high/critical findings and can append a sign-off block to the findings
                CSV when wired. <strong className="text-foreground">Certificate posture</strong> and
                a compact <strong className="text-foreground">VPN topology</strong> summary appear
                on Compliance / Security when data exists.
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
                <code className="text-xs">claim_job_outbox_batch</code> for scheduled email
                delivery; <code className="text-xs">portal-data</code> GET validated at the Edge
                (Zod + OpenAPI limits); scheduled-report producer exports a testable{" "}
                <code className="text-xs">handler.ts</code> with Deno coverage; main score dial
                chart wrapped to skip unnecessary re-renders; unused-variable lint is stricter in
                shared <code className="text-xs">src/lib</code> code.
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
                mutation hook; optional <code className="text-xs">VITE_ANALYTICS_INGEST_URL</code>{" "}
                can receive a <code className="text-xs">workspace_data_purged</code> event (see{" "}
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
                briefly so moving across cells stays smooth. Secondary brand images on shared /
                portal / wizard previews use lazy loading where appropriate. Optional{" "}
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
                <strong className="text-foreground"> signed-in</strong> viewport + accessibility
                smoke covers workspace home and{" "}
                <strong className="text-foreground">Fleet Command</strong> under the same bypass.
                Use <code className="text-xs">npm run test:e2e:ci</code> locally so the preview
                bundle includes the bypass flag before running Playwright.
              </li>
              <li>
                Team invites: <strong className="text-foreground">Invite Staff</strong> loads
                pending invites and members via TanStack Query; customer search debounces for
                smoother typing. <strong className="text-foreground">Customer Management</strong>{" "}
                loads the customer directory via TanStack Query; the management drawer PSA summary
                and data-governance retention line use Query too. More surfaces use the shared{" "}
                <strong className="text-foreground">empty state</strong> pattern (fleet, SE history,
                assessments, drift, customers, connectors, config history, audit log, notifications,
                portfolio trend chart, SE upload-requests dialog).
              </li>
              <li>
                <strong className="text-foreground">Fleet Command</strong> loads the combined
                Central / agent / links view via TanStack Query. Empty states are aligned on more
                lists (playbook library, drawer history, client portal findings, firewall linking,
                licence filters, control map, remediation playbooks). Firewall link saves, playbook
                completion sync, passkey removal, org-wide data delete, and customer delete use
                mutations with cache refresh. The connector{" "}
                <strong className="text-foreground">fleet panel</strong> drops stale Supabase loads
                when you navigate away or request a newer batch.
              </li>
              <li>
                <strong className="text-foreground">Management drawer</strong> Client View preview
                and regulatory digest headlines use TanStack Query (loading and error states in the
                preview dialog). <strong className="text-foreground">Fleet Command</strong> search
                is debounced on large lists. SE Health Check{" "}
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
                <code className="text-xs">docs/PERF-EXPLAIN.md</code>). Apply pending migrations
                with <code className="text-xs">supabase db push</code> on each environment.
              </li>
              <li>
                Edge API: stricter validation on agent registration, connector heartbeat/submit,
                admin MFA reset, MFA recovery, assessment list paging, health-check team/follow-up
                patches, SE teams (create/rename/invite/transfer admin), passkey verify, and
                ConnectWise Cloud credentials; partial OpenAPI sketch in repo docs for integrators.
              </li>
              <li>
                API Hub / integrators: in-app API docs and{" "}
                <code className="text-xs">openapi.yaml</code> now cover Autotask PSA and ConnectWise
                Manage (mappings, credentials, tickets); public{" "}
                <code className="text-xs">api-public</code> shared-report and shared-health-check
                GET paths are documented for embeds. Self-hosted runbook links an edge{" "}
                <code className="text-xs">logJson</code> catalog and saved-search examples for
                drains.
              </li>
              <li>
                <strong className="text-foreground">After a deploy:</strong> if you see
                &quot;Importing a module script failed&quot;, use{" "}
                <strong className="text-foreground">Reload page</strong> (or a normal browser
                refresh) so the app loads the new script bundle. The error screen explains this;
                HTML responses use <code className="text-xs">no-cache</code> to reduce stale shells.
              </li>
              <li>
                <strong className="text-foreground">Report exports:</strong> PDF (browser print) and
                Word downloads use Sophos-styled tables (navy headers, purple accent rule, light row
                bands). PDF/print uses <strong className="text-foreground">A4 landscape</strong>{" "}
                throughout (same idea as Word); wide rule tables (10+ columns) get denser
                typography. Headers wrap by word; the top brand bar no longer clips dates. Fixed
                “page x of y” footers that showed{" "}
                <strong className="text-foreground">0 of 0</strong> and cut off the last lines are
                removed — margins come from <code className="text-xs">@page</code> instead. Word
                stays landscape with a fixed column grid. Export action labels keep full width in
                the document toolbar.
              </li>
              <li>
                SE Health Check: config upload request list loads via TanStack Query (cancellable
                fetch); main page shell slimmed for easier maintenance — including extracted{" "}
                <strong className="text-foreground">Central API help</strong> panel component.
                Optional Sentry browser reporting when{" "}
                <code className="text-xs">VITE_SENTRY_DSN</code> is set.
              </li>
              <li>
                Setup wizard: <strong className="text-foreground">Branding</strong> step moved to
                its own component under <code className="text-xs">setup-wizard/steps/</code>{" "}
                (alongside Welcome) to keep the orchestrator smaller.
              </li>
              <li>
                Self-hosted / ops: <code className="text-xs">docs/observability.md</code> now
                includes per-function <code className="text-xs">logJson</code> catalogs for{" "}
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
                download, and PDF export path (print preview{" "}
                <code className="text-xs">print()</code> stubbed for automation). Saved reports
                library in the management drawer uses TanStack Query for list/delete refresh. Portal
                viewers and scheduled-report settings use the shared empty-state pattern.{" "}
                <code className="text-xs">api-public</code> and{" "}
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
                Regulatory Tracker (Compliance): RSS sources refreshed; headlines ingest
                automatically every day (~06:00 UTC) via the{" "}
                <code className="text-xs">regulatory-scanner</code> Edge Function and pg_cron. The
                manual Scan Feeds control was removed in favour of that schedule; the widget shows
                last ingest time when live rows exist.
              </li>
              <li>
                Workspace settings → Regulatory digest and Data governance: copy updated for the
                daily scanner and where headlines appear.
              </li>
              <li>
                <strong className="text-foreground">ConnectWise Cloud Services:</strong> PSA &amp;
                API automation → ConnectWise Cloud — store encrypted API user ID and subscription
                key (same encryption key as Sophos Central), verify OAuth client-credentials token
                on save, test token, and load Partner Cloud{" "}
                <code className="text-xs">GET /whoami</code> profile from the Edge API (credentials
                never returned to the browser).
              </li>
              <li>
                <strong className="text-foreground">ConnectWise Manage (tickets):</strong> Manage
                REST credentials under PSA settings; admins create idempotent service tickets from{" "}
                <strong className="text-foreground">Findings — bulk actions</strong> (one finding
                selected) with server-side dedupe and audit (
                <code className="text-xs">psa_ticket_idempotency</code>).
              </li>
              <li>
                <strong className="text-foreground">PSA customer mapping:</strong> under ConnectWise
                Manage settings, map each FireComply customer name (same label as the Customers
                page) to a Manage company ID; tickets from findings pre-fill the ID or can use the
                mapping server-side when the field is left empty. Combobox pickers and Manage
                company list (REST) reduce typos.
              </li>
              <li>
                <strong className="text-foreground">Autotask PSA (Datto):</strong> second PSA under
                the same settings drawer — zone URL, API user, encrypted secret and integration
                code, ticket picklist defaults; customer ↔ Autotask company mapping with company
                query; idempotent tickets from findings when Autotask is linked (
                <code className="text-xs">autotask_psa_credentials</code>,{" "}
                <code className="text-xs">provider = autotask</code> on shared mapping / idempotency
                tables).
              </li>
              <li>
                <strong className="text-foreground">Org service API keys:</strong> workspace
                settings list, create, and revoke keys; Edge validates{" "}
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
                Agent connector: package version from submissions is shown in Fleet views for
                support and upgrade tracking.
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
                API Hub, customer management, playbook library, and portfolio insights: navigation
                and copy aligned with workspace settings and MSP workflows.
              </li>
              <li>
                <strong className="text-foreground">Firewall Licence Monitor:</strong> HA A-P rows
                cap displayed serials at two (primary + peer from Central cluster or licence
                heuristic). When <strong className="text-foreground">Xstream</strong> is active on a
                device, expired <strong className="text-foreground">FullGuard</strong> and expired{" "}
                <strong className="text-foreground">trial</strong> lines for bundled modules (e.g.
                Network/Web/Zero-Day/Email) no longer drive an{" "}
                <strong className="text-foreground">EXPIRED</strong> header — Central often keeps
                legacy rows next to Xstream.
              </li>
              <li>
                <strong className="text-foreground">Config History:</strong> the saved customer
                label uses your FireComply org name when Sophos Central returned the{" "}
                <code className="text-xs">(This tenant)</code> placeholder; tooltip notes the value
                comes from report branding at snapshot time (not a separate MSP account).
              </li>
              <li>
                <strong className="text-foreground">PSA &amp; API automation</strong> (workspace
                settings) and <strong className="text-foreground">API &amp; Integrations</strong>:
                ConnectWise Cloud, ConnectWise Manage, Autotask PSA, and scoped service keys use the
                same <strong className="text-foreground">Connect / Configure → dialog</strong>{" "}
                pattern as Slack and Microsoft Teams — no inline dropdown; API Hub lists each as its
                own card with live connected state.
              </li>
              <li>
                <strong className="text-foreground">Scoped service keys:</strong> clearer in-app
                messages when key list or issue/revoke calls fail at the network layer (instead of a
                bare &quot;Failed to fetch&quot;).
              </li>
              <li>
                <strong className="text-foreground">Fleet (list view):</strong> Sophos Central
                customer groups start <strong className="text-foreground">collapsed</strong> — open
                a row to see its firewalls (reduces scroll on large estates).
              </li>
              <li>
                <strong className="text-foreground">Scoped service keys UI:</strong> the long usage
                / ping-URL blurb is under{" "}
                <strong className="text-foreground">Using service keys &amp; ping URL</strong>,
                collapsed by default (API Hub panel and workspace PSA settings).
              </li>
            </ul>
            <div className="space-y-2 pt-2 border-t border-border/50">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Fixes
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  Risk summary cards: Overall Score (and trend vs. previous run) show again on
                  Assess.
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
                  numeric loopback instead of <code className="text-xs">localhost</code>. Redeploy
                  the <code className="text-xs">api</code> function after updating.
                </li>
              </ul>
            </div>
          </section>
        </div>
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

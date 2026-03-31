import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspacePanelLink } from "@/components/WorkspaceSettingsStrip";
import { useAuthProvider, AuthProvider } from "@/hooks/use-auth";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";

const DATA_PRIVACY_HREF =
  "https://github.com/joseph15562/sophos-firecomply/blob/main/docs/DATA-PRIVACY.md";

/**
 * Trust centre: how we handle data, subprocessors, retention pointers, legal placeholders.
 * Replace highlighted copy with counsel-approved text before procurement.
 */
function TrustPageInner() {
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
      <WorkspacePrimaryNav />
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

        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-tight">How we handle your data</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This summary matches the in-app{" "}
            <strong className="text-foreground">How we handle your data</strong> section (workspace
            settings). For flow diagrams and mode details, see the{" "}
            <a
              href={DATA_PRIVACY_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-accent hover:underline font-medium"
            >
              DATA-PRIVACY
            </a>{" "}
            document in the repository (replace the host with your fork if self-hosting).
          </p>

          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 space-y-3 text-xs text-muted-foreground leading-relaxed">
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">Data residency</p>
              <p>
                Cloud data lives in the FireComply platform database (Supabase). Firewall
                configuration exports are parsed and scored in your browser; raw config is not
                uploaded or stored on our servers for that workflow.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">
                What we store in the cloud
              </p>
              <p>
                When you use cloud mode: assessments, saved reports, finding snapshots, remediation
                progress, alert rules, shared report links, audit metadata, encrypted Sophos Central
                credentials, and cached firewall metadata — scoped per organisation (row-level
                security).
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">
                Local (air-gapped) mode
              </p>
              <p>
                Optional local mode keeps parsing, scoring, and UI state on your machine (e.g.
                IndexedDB). AI report generation and Sophos Central integration are disabled in that
                mode.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">
                Retention and automated cleanup
              </p>
              <p>
                Submission and saved-report retention follow your organisation policy and scheduled
                cleanup jobs. A daily regulatory RSS ingest may run in your project (Compliance /
                Regulatory Tracker) — see product docs for operator setup.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">AI report generation</p>
              <p>
                For AI-generated reports, config can be{" "}
                <strong className="text-foreground">anonymised before transmission</strong>{" "}
                (placeholders for IPs, hostnames, labels). Payloads are sent to Google Gemini via a
                Supabase Edge Function over HTTPS.{" "}
                <strong className="text-foreground">Inference is not region-pinned</strong> — Google
                may process in the US or other jurisdictions per their infrastructure. Use{" "}
                <strong className="text-foreground">local mode</strong> to avoid AI transit;
                organisations with cross-border rules should document consent or legal basis and
                treat Google as a subprocessor. See{" "}
                <a
                  href={`${DATA_PRIVACY_HREF}#data-residency-and-ai-gemini`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-2 decoration-brand-accent hover:text-brand-accent"
                >
                  Data residency and AI (Gemini)
                </a>{" "}
                in <code className="text-[10px]">DATA-PRIVACY.md</code> and{" "}
                <a
                  href="https://ai.google.dev/gemini-api/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline underline-offset-2 decoration-brand-accent hover:text-brand-accent"
                >
                  Gemini API terms
                </a>
                .
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">
                Deterministic analysis
              </p>
              <p>
                Rule-based findings, risk scoring, and compliance mappings run in the browser; no
                raw config is sent to a server for that analysis.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">Other external calls</p>
              <ul className="list-disc pl-4 space-y-1 mt-1">
                <li>
                  <span className="text-foreground font-medium">Geo-IP</span> — public IPs may be
                  looked up via ip-api.com for map features (no auth data).
                </li>
                <li>
                  <span className="text-foreground font-medium">CVE correlation</span> — service
                  names may be queried against the NIST NVD API (no firewall config payload).
                </li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">Sophos Central</p>
              <p>
                If connected, credentials are encrypted at rest; Central API calls are proxied
                server-side so secrets are not exposed in the browser after setup.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">Connector agent</p>
              <p>
                The connector uses your firewall XML API locally and submits results through an
                authenticated server path; it does not expose firewall credentials externally.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground text-[11px] mb-1">Shared reports</p>
              <p>
                Share links are time-limited (default seven days). Shared content is assessment
                report material, not raw firewall configuration exports.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">In the product:</strong> open{" "}
            <WorkspacePanelLink section="data-governance">
              How we handle your data
            </WorkspacePanelLink>{" "}
            from Assess (workspace panel → Settings) to see your org retention value, regulatory
            scanner notes, and <strong className="text-foreground">Delete all data</strong> (org
            admins — irreversible).
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

export default function TrustPage() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <TrustPageInner />
    </AuthProvider>
  );
}

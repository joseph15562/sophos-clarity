import { FileQuestion, GitBranch, Layers } from "lucide-react";
import { WorkspacePanelLink } from "@/components/WorkspaceSettingsStrip";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";

const DATA_PRIVACY_HREF =
  "https://github.com/joseph15562/sophos-firecomply/blob/main/docs/DATA-PRIVACY.md";

/**
 * Trust centre: data handling, subprocessors, retention pointers, legal & questionnaire skeleton.
 * Legal & questionnaires: stub tables and checklists for SOC2/ISO mappings, diagrams, RFP coverage —
 * replace with counsel-approved content before customer procurement.
 */
function TrustPageInner() {
  const { isGuest } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader loginShell={isGuest} />
      <WorkspacePrimaryNav />
      <main
        className="mx-auto max-w-3xl space-y-8 px-4 pt-10 assist-chrome-pad-bottom"
        data-tour="tour-page-trust"
      >
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Trust</h1>
        <section className="space-y-2" data-tour="tour-trust-hero">
          <h2 className="text-sm font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sophos FireComply helps partners assess Sophos firewall posture from configuration
            exports and optional Sophos Central metadata. Hosting, authentication, and long-lived
            data are processed in line with your workspace configuration and the documents linked
            below.
          </p>
        </section>

        <section className="space-y-4" data-tour="tour-trust-security">
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

        <section
          id="trust-subprocessors"
          className="space-y-3 scroll-mt-20"
          data-tour="tour-trust-privacy"
        >
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

        <section className="space-y-6" data-tour="tour-trust-compliance">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold tracking-tight">Legal &amp; questionnaires</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use this area as a{" "}
              <strong className="text-foreground">skeleton for security reviews</strong> and vendor
              diligence. As your compliance program matures, attach or link SOC2/ISO control
              mappings, an authoritative subprocessors register, and data-flow diagrams. Nothing
              here is a commitment until your counsel replaces stubs with approved language.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed">
              <strong className="text-foreground">Procurement readiness:</strong> replace all stub
              copy, placeholder links, and TBD cells with{" "}
              <strong className="text-foreground">legal-reviewed</strong> content before sharing
              this page with customers or answering formal RFPs/security questionnaires.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <FileQuestion className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-1 min-w-0">
                <h3 className="text-xs font-semibold text-foreground tracking-tight">
                  Security review pack (checklist)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Typical buyer requests — tick off as you publish artefacts (internal or
                  customer-facing).
                </p>
                <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5 mt-2">
                  <li>
                    Product overview, trust page URL, and supported deployment models (cloud vs
                    local).
                  </li>
                  <li>
                    Data inventory: categories processed, retention, encryption in transit/at rest,
                    admin roles.
                  </li>
                  <li>
                    Incident response and subprocessors: see{" "}
                    <a
                      href="#trust-subprocessors"
                      className="text-foreground font-medium underline underline-offset-2 decoration-brand-accent hover:text-brand-accent"
                    >
                      Subprocessors (baseline)
                    </a>{" "}
                    — expand with regions, DPAs, and sub-subprocessors as required.
                  </li>
                  <li>Penetration test summary or attestation letter (when available).</li>
                  <li>
                    Completed SIG Lite, CAIQ, or custom questionnaire (attach PDF or link to secure
                    vault).
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Layers className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-2 min-w-0 w-full">
                <h3 className="text-xs font-semibold text-foreground tracking-tight">
                  Framework mappings (SOC 2 / ISO 27001)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Map product and operational controls to framework criteria. Replace example rows
                  with your control matrix (spreadsheet or GRC export).
                </p>
                <div className="overflow-x-auto rounded-lg border border-border/60 mt-2">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Framework ref.</th>
                        <th className="px-3 py-2 font-medium">Theme</th>
                        <th className="px-3 py-2 font-medium">
                          FireComply control / evidence (stub)
                        </th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-muted-foreground">
                      <tr>
                        <td className="px-3 py-2 font-mono text-[10px]">SOC 2 CC6.x / ISO A.8.x</td>
                        <td className="px-3 py-2">Access &amp; authentication</td>
                        <td className="px-3 py-2">
                          Supabase Auth, RLS, org-scoped roles — document in SSP.
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">TBD</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-[10px]">
                          SOC 2 CC7.x / ISO A.12.x
                        </td>
                        <td className="px-3 py-2">Logging &amp; monitoring</td>
                        <td className="px-3 py-2">
                          Edge <code className="text-[10px]">logJson</code>, audit trails — link
                          runbooks.
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">TBD</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-[10px]">SOC 2 CC8.x</td>
                        <td className="px-3 py-2">Change management</td>
                        <td className="px-3 py-2">
                          CI/CD, preview deploys, change records — attach policy.
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">TBD</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-[10px]">ISO A.18 / privacy</td>
                        <td className="px-3 py-2">Subprocessors &amp; transfers</td>
                        <td className="px-3 py-2">
                          Cross-reference subprocessors table; AI/Gemini transfer — see
                          DATA-PRIVACY.
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">TBD</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <GitBranch className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-2 min-w-0 w-full">
                <h3 className="text-xs font-semibold text-foreground tracking-tight">
                  Data-flow diagrams
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Procurement teams expect diagrams for assessment data, auth, optional AI, and
                  Central connectivity. Drop images or links below when design assets exist.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="rounded-lg border border-dashed border-border/80 bg-background/50 px-3 py-3">
                    <span className="font-medium text-foreground">High-level logical flow</span> —
                    browser, optional local mode, Supabase, Edge Functions, external APIs (Gemini,
                    Geo-IP, NVD).{" "}
                    <span className="text-muted-foreground">[Attach PNG/SVG or link]</span>
                  </li>
                  <li className="rounded-lg border border-dashed border-border/80 bg-background/50 px-3 py-3">
                    <span className="font-medium text-foreground">
                      AI report path (when enabled)
                    </span>{" "}
                    — anonymisation step, HTTPS to Edge Function, Gemini.{" "}
                    <span className="text-muted-foreground">[Attach PNG/SVG or link]</span>
                  </li>
                  <li className="rounded-lg border border-dashed border-border/80 bg-background/50 px-3 py-3">
                    <span className="font-medium text-foreground">
                      Sophos Central (when connected)
                    </span>{" "}
                    — credential storage, server-side proxy.{" "}
                    <span className="text-muted-foreground">[Attach PNG/SVG or link]</span>
                  </li>
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Source narrative for flows:{" "}
                  <a
                    href={DATA_PRIVACY_HREF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground font-medium underline underline-offset-2 decoration-brand-accent hover:text-brand-accent"
                  >
                    DATA-PRIVACY.md
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-foreground tracking-tight">
              Questionnaire coverage (stub)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Map common vendor questions to where answers will live. Replace &quot;TBD&quot; with
              paragraph references, policy names, or ticket IDs.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Topic</th>
                    <th className="px-3 py-2 font-medium">Typical question</th>
                    <th className="px-3 py-2 font-medium">Where to answer (stub)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-muted-foreground">
                  <tr>
                    <td className="px-3 py-2 text-foreground font-medium">Encryption</td>
                    <td className="px-3 py-2">TLS version, data at rest, key management</td>
                    <td className="px-3 py-2">TBD — link architecture doc</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-foreground font-medium">Access control</td>
                    <td className="px-3 py-2">MFA, RBAC, least privilege</td>
                    <td className="px-3 py-2">TBD — link access policy</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-foreground font-medium">Availability</td>
                    <td className="px-3 py-2">Uptime targets, DR, backups</td>
                    <td className="px-3 py-2">TBD — link SLA / BCP</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-foreground font-medium">
                      AI &amp; subprocessors
                    </td>
                    <td className="px-3 py-2">Model provider, data retention, opt-out</td>
                    <td className="px-3 py-2">
                      Trust page + DATA-PRIVACY AI section (expand for legal)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-4 space-y-2">
            <h3 className="text-xs font-semibold text-foreground tracking-tight">
              Legal documents
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add links to executed or template agreements. Do not paste confidential contract text
              into the app.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>
                <span className="text-foreground font-medium">Data Processing Agreement (DPA)</span>{" "}
                —{" "}
                <span className="text-muted-foreground">
                  [Link to template or customer-specific file]
                </span>
              </li>
              <li>
                <span className="text-foreground font-medium">Terms of service</span> —{" "}
                <span className="text-muted-foreground">[Link]</span>
              </li>
              <li>
                <span className="text-foreground font-medium">Privacy notice</span> —{" "}
                <span className="text-muted-foreground">[Link]</span>
              </li>
            </ul>
          </div>
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

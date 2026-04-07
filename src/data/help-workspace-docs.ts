import type { AssessAnalysisTabValue } from "@/lib/assess-analysis-tabs";
import type { DocIllustrationId } from "@/data/doc-illustration-id";

export type HelpWorkspacePageSlug =
  | "mission-control"
  | "assess"
  | "fleet"
  | "customers"
  | "central"
  | "reports"
  | "insights"
  | "drift"
  | "playbooks"
  | "api"
  | "audit"
  | "health-check";

const PAGE_SLUGS: readonly HelpWorkspacePageSlug[] = [
  "mission-control",
  "assess",
  "fleet",
  "customers",
  "central",
  "reports",
  "insights",
  "drift",
  "playbooks",
  "api",
  "audit",
  "health-check",
] as const;

export function isHelpWorkspacePageSlug(s: string): s is HelpWorkspacePageSlug {
  return (PAGE_SLUGS as readonly string[]).includes(s);
}

export type HelpWorkspacePageDoc = {
  slug: HelpWorkspacePageSlug;
  /** Matches primary nav / product language */
  title: string;
  /** Router path for Open in app */
  appPath: string;
  tagline: string;
  illustration: DocIllustrationId;
  sections: { heading: string; paragraphs: string[] }[];
  tips?: string[];
  /** Optional workspace guide slug under `/help/guides/…` */
  relatedGuide?: string;
};

export const HELP_WORKSPACE_PAGE_DOCS: Record<HelpWorkspacePageSlug, HelpWorkspacePageDoc> = {
  "mission-control": {
    slug: "mission-control",
    title: "Mission control",
    appPath: "/dashboard",
    tagline: "Portfolio snapshot, recent alerts, quick actions, and workspace entry points.",
    illustration: "workspace-mission-control",
    sections: [
      {
        heading: "What it’s for",
        paragraphs: [
          "Mission control is the signed-in home for your organisation. It surfaces KPIs across customers and fleet, recent Sophos Central alerts when tenants are synced, saved reports, and shortcuts into Assess, Fleet, and Central.",
        ],
      },
      {
        heading: "How it connects",
        paragraphs: [
          "Tiles and charts pull from the same data you’ll see in Fleet, Customers, and Central — but summarized for a morning stand-up or QBR prep. Use it before drilling into a single firewall on Assess.",
          "Alert and chart freshness depends on Central sync and browser session: if tenants are not linked or sync is stale, Mission control still loads but some widgets fall back to placeholders or empty states until data catches up.",
        ],
      },
    ],
    tips: [
      "Guest mode shows a demo dashboard until you select an organisation.",
      "Use quick actions as the fastest path back to Assess, Fleet, or Report centre without hunting the tab bar.",
    ],
    relatedGuide: "management",
  },
  assess: {
    slug: "assess",
    title: "Assess",
    appPath: "/",
    tagline:
      "Upload firewall exports, set context, and run detailed analysis on the tabs below the workflow.",
    illustration: "workspace-assess",
    sections: [
      {
        heading: "The Assess page",
        paragraphs: [
          "Assess is the main analysis surface at `/`. After you upload configuration (or load a saved assessment), the Detailed Security Analysis strip lists tabs: Overview, Security Analysis, Compliance, Remediation (when there are findings), Optimisation, Tools, Insurance Readiness, and Compare when two or more configs are loaded.",
          "Optional FireComply Connector (collector) agents can push configuration from the customer network on a schedule so new assessments appear without manual uploads — see Documentation → Interactive guides → Connector (collector) agent.",
        ],
      },
      {
        heading: "Documentation",
        paragraphs: [
          "Each tab has its own documentation page under Documentation → Assess tabs, with the same names you see in the UI. Open Assess with a specific tab using the link on that doc page.",
        ],
      },
      {
        heading: "Signed-in vs guest",
        paragraphs: [
          "Signed-in users analyse against their organisation context (customers, Central, saved history). Guests can still explore Assess with sample or uploaded files, but workspace hubs and persistence behave differently — expect demo data on Mission control until you authenticate and pick an org.",
        ],
      },
    ],
    tips: [
      "Bookmark `/?tab=compliance` (or any tab slug) after you have confirmed the label matches your UI — links on each tab’s doc page stay aligned with the product.",
    ],
    relatedGuide: "upload-assess",
  },
  fleet: {
    slug: "fleet",
    title: "Fleet",
    appPath: "/command",
    tagline: "Firewall inventory, health, and command-centre views across customers.",
    illustration: "workspace-fleet",
    sections: [
      {
        heading: "Fleet overview",
        paragraphs: [
          "Fleet aggregates devices from your customer mappings and Sophos Central sync. Use it to spot firmware drift, offline devices, and which firewalls are tied to assessments.",
          "Rows usually reflect what Sophos Central last returned for synced tenants plus any customer linkage you maintain in the Customers area — if a device is missing, check Central sync and tenant mapping before assuming the firewall is absent from the estate.",
        ],
      },
      {
        heading: "When to use Fleet first",
        paragraphs: [
          "Open Fleet when you need inventory truth across the portfolio (names, models, firmware) rather than rule-level detail. Pair it with Assess when you are about to deep-dive a specific appliance you picked from the list.",
        ],
      },
    ],
    tips: [
      "After changing Central credentials or tenant scope, refresh sync from the Central hub so Fleet is not showing a stale picture.",
    ],
    relatedGuide: "management",
  },
  customers: {
    slug: "customers",
    title: "Customers",
    appPath: "/customers",
    tagline:
      "Customer directory, Sophos Central tenant mapping, and portal configuration entry points.",
    illustration: "workspace-customers",
    sections: [
      {
        heading: "Customer records",
        paragraphs: [
          "Each customer can map to Central tenants and feed Fleet and alerts. Portal links and branding often start from customer context before you run Assess.",
          "Think of a customer record as the anchor for “who this engagement is for”: it influences how reports read, which Central data rolls up, and how portal recipients are scoped.",
        ],
      },
      {
        heading: "Before you run Assess",
        paragraphs: [
          "Aligning the right Central tenant(s) to a customer early reduces mismatched hostnames in alerts and reports. You can still assess ad hoc uploads without perfect mapping, but portfolio views stay cleaner when directory data matches reality.",
        ],
      },
    ],
    tips: [
      "Document customer portal URLs in your PSA after you generate them — they are tenant-specific and easy to misplace.",
    ],
    relatedGuide: "portal-alerts",
  },
  central: {
    slug: "central",
    title: "Central",
    appPath: "/central/overview",
    tagline: "Sophos Central connection, tenants, firewalls, alerts, licensing, and sync.",
    illustration: "workspace-central",
    sections: [
      {
        heading: "Central hub",
        paragraphs: [
          "The Central area has its own sub-navigation: Overview, Tenants, Firewalls, Alerts, MDR, Groups, Licensing, and Sync. Use the in-app site map (Documentation → Site map) for every sub-route with deep links.",
          "FireComply reads Central through the credentials and regions you configure in organisation settings. API host and region matter for MSPs with tenants in multiple geographies — wrong region symptoms often show up as empty inventories or failed sync rather than a hard error on every screen.",
        ],
      },
      {
        heading: "Central vs manual assess",
        paragraphs: [
          "Central supplies live inventory, alerts, and naming context across the workspace; Assess still accepts HTML/XML exports and connector submissions for full rule-and-object analysis. Many teams use both: Central for “what’s deployed,” Assess for “how it’s configured.”",
        ],
      },
    ],
    tips: [
      "If Mission control alerts look wrong, verify hostname resolution from synced firewall inventory — endpoint vs firewall alerts use different label precedence.",
    ],
    relatedGuide: "portal-alerts",
  },
  reports: {
    slug: "reports",
    title: "Reports",
    appPath: "/reports",
    tagline: "Generate packages, open saved reports, and manage schedules.",
    illustration: "workspace-reports",
    sections: [
      {
        heading: "Report centre",
        paragraphs: [
          "Report centre is where generated and saved reports live. Saved report URLs use `/reports/saved/:id` for read-only viewing and export.",
          "Generation flows (AI, templates, schedules) usually start here; Mission control may surface recents for quick reopen. Permissions still follow organisation membership — shared links and portals are separate mechanisms for external readers.",
        ],
      },
      {
        heading: "Outputs and formats",
        paragraphs: [
          "Depending on template and settings you may see PDF, Word, HTML, or bundled exports. When customers need editable deliverables, prefer Word or structured exports from Tools on Assess rather than screenshotting PDFs.",
        ],
      },
    ],
    tips: [
      "Name scheduled reports clearly in the UI — they show up in lists and audit trails months later.",
    ],
    relatedGuide: "ai-reports",
  },
  insights: {
    slug: "insights",
    title: "Insights",
    appPath: "/insights",
    tagline: "Portfolio-level compliance and risk trends for MSPs.",
    illustration: "workspace-insights",
    sections: [
      {
        heading: "Portfolio insights",
        paragraphs: [
          "Insights rolls up signals across customers you’ve assessed, helping you compare posture and spot systemic gaps.",
          "Coverage is assessment-driven: customers with no recent assess activity may appear thin or absent compared to heavily assessed accounts. Use Insights for portfolio QBRs and prioritisation, not as a substitute for Central inventory counts.",
          "The page labels what is live: customer KPIs, matrix, sector breakdown, and tables use saved assessments when you are signed into an organisation. Threat landscape, compliance line charts, report heatmaps, and recommendation cards are illustrative samples until wired to telemetry — the UI shows a banner that explains the split.",
        ],
      },
      {
        heading: "Pairing with other hubs",
        paragraphs: [
          "When a chart flags a recurring control gap, drill into Assess for one customer to confirm whether it is policy, template drift, or a one-off. Fleet and Central help validate whether the same device estate is still in scope.",
        ],
      },
    ],
    tips: [
      "Refresh assessments after major template rollouts so portfolio trends reflect the new baseline.",
    ],
  },
  drift: {
    slug: "drift",
    title: "Drift",
    appPath: "/drift",
    tagline: "Compare configuration over time and highlight meaningful changes.",
    illustration: "workspace-drift",
    sections: [
      {
        heading: "Drift monitor",
        paragraphs: [
          "Use Drift after change windows or upgrades to see what moved between exports or baselines. It complements the Compare tab on Assess when you have two files loaded there.",
          "Workspace Drift is oriented around saved snapshots and history across time; Assess Compare is best when you deliberately load two configs in one session for a side-by-side review. Many teams use both in the same engagement at different stages.",
        ],
      },
      {
        heading: "Inputs that work well",
        paragraphs: [
          "Consistent export sources (same firewall, same export type) make diffs easier to read. Mixing unrelated appliances or partial exports can produce noisy deltas that need human interpretation.",
        ],
      },
    ],
    tips: [
      "Capture a baseline export before change freeze and another after go-live — Drift excels at that before/after story.",
    ],
    relatedGuide: "tools-compare",
  },
  playbooks: {
    slug: "playbooks",
    title: "Playbooks",
    appPath: "/playbooks",
    tagline: "Remediation playbooks and repeatable response patterns.",
    illustration: "workspace-playbooks",
    sections: [
      {
        heading: "Playbook library",
        paragraphs: [
          "Playbooks tie narrative remediation steps to findings classes. They’re especially useful when the same fixes apply across many firewalls.",
          "They do not replace your change-management system — they give engineers and customers a consistent explanation of what “good” looks like and how to verify a fix.",
        ],
      },
      {
        heading: "With remediation on Assess",
        paragraphs: [
          "Use the Remediation tab to track state (open, owned, closed) and playbooks to standardise the narrative you attach to recurring finding types. Together they support both MSP hygiene and customer-facing reporting.",
        ],
      },
    ],
    tips: [
      "Align playbook titles with how your team speaks on tickets so staff reach for the same document every time.",
    ],
    relatedGuide: "remediation",
  },
  api: {
    slug: "api",
    title: "API hub",
    appPath: "/api",
    tagline: "API keys, regional endpoints, and integration documentation.",
    illustration: "workspace-api",
    sections: [
      {
        heading: "Automation",
        paragraphs: [
          "API hub is the place to issue keys and read endpoint details for scripting report retrieval, webhooks, or partner integrations. The Agents tab lists FireComply Connector (collector) downloads and platform notes alongside REST documentation.",
          "Keys are organisation-scoped: treat them like production secrets, rotate on offboarding, and avoid embedding them in client-side code. Regional base URLs on the same page must match where your org was provisioned.",
        ],
      },
      {
        heading: "Common integration patterns",
        paragraphs: [
          "Partners often poll saved reports, register webhooks for completion events, or drive everything from a PSA via the connector plus API for status. Start from the documented paths in the hub rather than guessing URL shapes from browser traffic.",
        ],
      },
    ],
    tips: ["Test new keys against a read-only endpoint before wiring production automation."],
    relatedGuide: "connector-agent",
  },
  audit: {
    slug: "audit",
    title: "Activity log",
    appPath: "/audit",
    tagline: "Organisation audit trail of key workspace actions.",
    illustration: "workspace-audit",
    sections: [
      {
        heading: "Audit trail",
        paragraphs: [
          "The activity log helps administrators see who changed settings, ran sensitive actions, or exported data — aligned to governance reviews.",
          "Events are scoped to the organisation you are viewing — use filters and timestamps when reconciling with IdP or PSA tickets. Not every UI click is logged; focus on security-relevant and data-export actions the product explicitly records.",
        ],
      },
      {
        heading: "Who should review it",
        paragraphs: [
          "Security leads and MSP operations managers are the typical audience. Pair reviews with Central and API key hygiene (who can still authenticate, which integrations are active) for a complete access picture.",
        ],
      },
    ],
    tips: [
      "Export or screenshot audit excerpts before access changes when you need a permanent record outside FireComply.",
    ],
    relatedGuide: "team-security",
  },
  "health-check": {
    slug: "health-check",
    title: "Health check",
    appPath: "/health-check",
    tagline: "Sophos SE firewall health check workflow in the workspace.",
    illustration: "workspace-health-check",
    sections: [
      {
        heading: "Health check",
        paragraphs: [
          "The health check flow produces structured outputs for SE-style reviews. Shared links use their own URL pattern; see Site map → token links for details.",
          "It is separate from interactive Assess: expect a guided questionnaire-style workflow and downloadable pack suited to field engagements rather than the full tabbed analysis strip on `/`.",
        ],
      },
      {
        heading: "Sharing with customers",
        paragraphs: [
          "When sharing read-only health check links, confirm expiry and branding with your customer success team — recipients may not have FireComply logins. Combine with Assess exports when technical stakeholders need full rule-level evidence.",
        ],
      },
    ],
    tips: [
      "Complete health check runs while signed into the right org so outputs land under the correct customer context.",
    ],
  },
};

export type HelpAssessTabDoc = {
  tabValue: AssessAnalysisTabValue;
  /** Same string as tab value — used in URL /help/pages/assess/:tabSlug */
  slug: AssessAnalysisTabValue;
  /** Exact label as shown on the Assess tab bar */
  label: string;
  tagline: string;
  illustration: DocIllustrationId;
  sections: { heading: string; paragraphs: string[] }[];
  tips?: string[];
  relatedGuide?: string;
  /** Shown when the tab is hidden in the UI (e.g. no findings) */
  visibilityNote?: string;
};

export const HELP_ASSESS_TAB_DOCS: Record<AssessAnalysisTabValue, HelpAssessTabDoc> = {
  overview: {
    tabValue: "overview",
    slug: "overview",
    label: "Overview",
    tagline:
      "Score, hero outcomes, quick actions, and configurable widgets for the current assessment.",
    illustration: "assess-tab-overview",
    sections: [
      {
        heading: "On this tab",
        paragraphs: [
          "Overview is the default after analysis completes. It highlights risk score, critical actions, compliance posture widgets, and optional modules like Assessment Pulse, Quick Actions, and fleet-aware tiles when Central data is present.",
        ],
      },
      {
        heading: "Customisation",
        paragraphs: [
          "Use the widget customiser (same row as the disclaimer under the tabs) to show or hide optional widgets per tab without losing data.",
        ],
      },
      {
        heading: "How it fits with other tabs",
        paragraphs: [
          "Overview is the executive summary layer: it aggregates scores and highlights from analysis that Security, Compliance, and Remediation explain in depth. If a number looks wrong, validate on Security Analysis before changing customer-facing narrative.",
        ],
      },
    ],
    tips: [
      "Collapse rarely used widgets during screen shares so stakeholders focus on score and critical actions.",
    ],
    relatedGuide: "pre-ai",
  },
  security: {
    tabValue: "security",
    slug: "security",
    label: "Security Analysis",
    tagline:
      "Deep technical views: rules, VPN, IDS/IPS, certificates, zones, and threat-related context.",
    illustration: "assess-tab-security",
    sections: [
      {
        heading: "On this tab",
        paragraphs: [
          "Security Analysis concentrates on how the firewall is built: rule health, VPN topology, admin exposure, unused objects, protocol usage, and supporting charts. It’s the right place before you trust AI narrative on technical detail.",
          "Sub-views vary by export completeness — if VPN or IPS sections are empty, the appliance may not expose that module in the file you uploaded, not necessarily that the feature is unused.",
        ],
      },
      {
        heading: "When to start here",
        paragraphs: [
          "Start on Security Analysis when the question is “how is this firewall actually configured?” rather than “which control IDs fail?” Compliance maps those technical facts to frameworks; this tab is the source of truth for engineers.",
        ],
      },
    ],
    tips: [
      "Cross-check unusually permissive rules against change tickets — false positives are rarer than missing change record context.",
    ],
    relatedGuide: "pre-ai",
  },
  compliance: {
    tabValue: "compliance",
    slug: "compliance",
    label: "Compliance",
    tagline: "Framework mapping, heatmaps, evidence-style widgets, and regulatory trackers.",
    illustration: "assess-tab-compliance",
    sections: [
      {
        heading: "On this tab",
        paragraphs: [
          "Compliance translates configuration into control coverage for the frameworks you selected in branding scope. Heatmaps, gap widgets, and framework bars update as findings change.",
          "Framework scope is set before or during assess setup — if a customer cares about ISO but you only enabled CIS, revisit branding and scope then re-run analysis so this tab reflects the right obligations.",
        ],
      },
      {
        heading: "Evidence and reporting",
        paragraphs: [
          "Widgets here are designed to support evidence conversations: what is covered, what is partial, and what is unknown from parsed config. Pair exports from the Tools tab with Compliance screenshots when auditors ask for traceability.",
        ],
      },
    ],
    tips: [
      "Align framework names in reports with what appears on this tab to avoid customer confusion in QBRs.",
    ],
    relatedGuide: "pre-ai",
  },
  remediation: {
    tabValue: "remediation",
    slug: "remediation",
    label: "Remediation",
    tagline: "Prioritised findings, bulk views, roadmaps, and progress widgets.",
    illustration: "remediation",
    sections: [
      {
        heading: "On this tab",
        paragraphs: [
          "The Remediation tab appears when there is at least one finding. It’s where you triage severity, effort, SLAs, and export-oriented views before closing items in your own change process.",
          "Status you set here is for FireComply and reporting — it does not push changes to the firewall. Use your change system as the system of record for actual rule edits; use Remediation to communicate progress to stakeholders viewing the assess workspace.",
        ],
      },
      {
        heading: "Working with playbooks",
        paragraphs: [
          "For recurring finding classes, open the Playbooks workspace in another tab to copy consistent remediation language into tickets or customer updates, then track closure state back on this tab.",
        ],
      },
    ],
    tips: [
      "Bulk views help when the same finding hits many rules — filter before exporting to CSV so the file matches the story you are telling.",
    ],
    visibilityNote:
      "If you don’t see this tab, there are no open findings for the loaded configuration — run analysis or load a report that includes findings.",
    relatedGuide: "remediation",
  },
  optimisation: {
    tabValue: "optimisation",
    slug: "optimisation",
    label: "Optimisation",
    tagline: "Sophos best practice, rule optimiser, and hardening-oriented surfaces.",
    illustration: "optimisation",
    sections: [
      {
        heading: "On this tab",
        paragraphs: [
          "Optimisation focuses on improving posture: vendor best-practice alignment, rule hygiene, and recommendations that may not be severity-1 findings but still reduce risk.",
          "Expect overlap with Compliance and Security Analysis — optimisation is framed as “how to make this config better” rather than “does this control pass.” Both views can reference the same underlying objects.",
        ],
      },
      {
        heading: "Prioritisation",
        paragraphs: [
          "Use severity and effort signals together: quick wins that close multiple hygiene items are often better QBR stories than a single critical finding that needs a maintenance window.",
        ],
      },
    ],
    tips: [
      "Re-run analysis after optimisation work so the next assess session reflects the new config, not stale findings.",
    ],
    relatedGuide: "optimisation",
  },
  tools: {
    tabValue: "tools",
    slug: "tools",
    label: "Tools",
    tagline: "Simulator, attack surface map, exports, baselines, and supporting utilities.",
    illustration: "assess-tab-tools",
    sections: [
      {
        heading: "On this tab",
        paragraphs: [
          "Tools collects interactive and export utilities: remediation impact simulator, attack surface visualisation, export centre, baseline compare, and related helpers that don’t fit a single narrative tab.",
          "The Compare tab (when visible) is also listed separately when two or more configs are loaded; Tools remains the home for utilities that are not strict side-by-side diffs.",
        ],
      },
      {
        heading: "Exports and customers",
        paragraphs: [
          "When customers want spreadsheets or evidence packs, start from Export centre on this tab rather than copying tables from screenshots — exports carry structure that stands up better under audit questions.",
        ],
      },
    ],
    tips: [
      "Run the simulator before promising score movement to executives — it highlights directional impact, not guarantees.",
    ],
    relatedGuide: "tools-compare",
  },
  "insurance-readiness": {
    tabValue: "insurance-readiness",
    slug: "insurance-readiness",
    label: "Insurance Readiness",
    tagline: "Questionnaire-style posture signals for cyber insurance conversations.",
    illustration: "assess-tab-insurance",
    sections: [
      {
        heading: "On this tab",
        paragraphs: [
          "Insurance Readiness surfaces controls and gaps insurers often ask about, based on parsed configuration. Use it as a conversation aid — not a guarantee of coverage or acceptance.",
          "Carrier questionnaires still win when wording conflicts — treat FireComply output as prep material your risk owner maps to each insurer’s exact questions.",
        ],
      },
      {
        heading: "Working with brokers and customers",
        paragraphs: [
          "Export or summarise this tab for renewal meetings; pair it with Compliance when the customer asks how firewall posture supports a specific control family the underwriter named.",
        ],
      },
    ],
    tips: [
      "Refresh the assess session before renewal season so readiness reflects current firmware and policy.",
    ],
  },
  compare: {
    tabValue: "compare",
    slug: "compare",
    label: "Compare",
    tagline: "Side-by-side diff when two or more firewall configs are loaded.",
    illustration: "assess-tab-compare",
    sections: [
      {
        heading: "On this tab",
        paragraphs: [
          "Compare activates when at least two files are in the current assess session. It highlights structural and rule-level differences useful after migrations or template rollouts.",
          "For historical drift across many saves, also consider the workspace Drift monitor — Compare is optimised for intentional two-config reviews in one browser session.",
        ],
      },
      {
        heading: "Getting clean diffs",
        paragraphs: [
          "Label files clearly in the upload strip (e.g. “before” / “after”) so reviewers do not invert the baseline. Matching the same appliance across exports reduces noise from unrelated devices.",
        ],
      },
    ],
    tips: [
      "Load gold-standard template plus customer export when auditing standardisation across sites.",
    ],
    visibilityNote: "Load at least two configurations on Assess to enable the Compare tab.",
    relatedGuide: "tools-compare",
  },
};

export function helpAssessOpenPath(tab: AssessAnalysisTabValue): string {
  return `/?tab=${encodeURIComponent(tab)}`;
}

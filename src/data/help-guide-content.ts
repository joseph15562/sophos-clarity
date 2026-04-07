import type { HelpGuideSlug } from "./help-doc-nav";

export type HelpGuideContent = {
  slug: HelpGuideSlug;
  title: string;
  tagline: string;
  /** Visual treatment for the doc hero figure */
  illustration: HelpGuideSlug | "overview" | "site-map";
  /** Long-form sections with optional figure between */
  sections: {
    heading: string;
    paragraphs: string[];
  }[];
  tips: string[];
  /** Primary “try in app” deep link */
  primaryAction: { to: string; label: string };
};

export const HELP_GUIDE_CONTENT: Record<HelpGuideSlug, HelpGuideContent> = {
  "upload-assess": {
    slug: "upload-assess",
    title: "Upload & assess",
    tagline: "Bring firewall configuration into FireComply, set context, and run analysis.",
    illustration: "upload-assess",
    sections: [
      {
        heading: "What you’re uploading",
        paragraphs: [
          "FireComply ingests Sophos Firewall HTML and XML exports (and related assessment inputs). You can drag files into the assess drop zone or use the file picker. Large exports are normal — the workspace parses structure, rules, and objects for downstream AI and compliance views.",
          "For hands-off collection, you can deploy the optional FireComply Connector (collector) agent on a host that reaches the firewall API; it pulls config on a schedule and submits assessments automatically. See the Connector (collector) agent guide for registration, install, and keys.",
          "If you use Sophos Central, link tenants and devices so assessments can reference live inventory and naming instead of only static exports.",
        ],
      },
      {
        heading: "Customer and framework context",
        paragraphs: [
          "Before analysis, set the customer name, industry context, and frameworks you care about. That context steers AI narrative, control mapping, and report tone so outputs read like your delivery, not a generic template.",
        ],
      },
      {
        heading: "After upload",
        paragraphs: [
          "Once files are loaded, the assess workspace unlocks tabs for findings, topology, and tooling. You can re-run analysis after tweaks, compare runs, and open reports without leaving the flow.",
        ],
      },
      {
        heading: "How this fits the workspace",
        paragraphs: [
          "Assess is the deepest technical surface; Mission control and Fleet summarise portfolio health; Report centre packages outcomes for customers. You do not need every hub on every engagement — many projects start at Assess and only open Central or Customers when mapping or alerts matter.",
        ],
      },
    ],
    tips: [
      "Prefer a fresh export after material rule changes so drift and remediation views stay aligned.",
      "Name files clearly — they appear in history and saved report metadata.",
    ],
    primaryAction: { to: "/", label: "Open Assess" },
  },
  "connector-agent": {
    slug: "connector-agent",
    title: "Connector (collector) agent",
    tagline:
      "Optional FireComply Connector on the customer network pulls firewall configuration on a schedule and submits assessments — no manual HTML or XML export.",
    illustration: "connector-agent",
    sections: [
      {
        heading: "What it is",
        paragraphs: [
          "The FireComply Connector is a lightweight desktop agent you install on a Windows, macOS, or Linux host that can reach the firewall’s admin interface. It uses the Sophos XML API to pull configuration, runs the same deterministic analysis as interactive Assess, and posts scores, findings, and drift signals back to your organisation in FireComply.",
          "The agent is optional. Manual uploads on Assess and Sophos Central linking work the same as today; the connector automates recurring collection for ongoing monitoring.",
        ],
      },
      {
        heading: "Where to configure it",
        paragraphs: [
          "Register agents and copy API keys from your organisation menu → Settings → Connector agents (sometimes labelled Agent manager in the UI). There you name the firewall, set schedule expectations, and see last-seen status for each collector.",
          "Current connector installers are also summarised on the API hub under the Agents tab, alongside platform notes for Windows, macOS, and Linux artefacts.",
        ],
      },
      {
        heading: "Typical rollout",
        paragraphs: [
          "Register an agent in the workspace to obtain an API key. Install the connector on a jump host or management VM on the customer LAN, paste the key in the connector wizard, add the firewall management IP or hostname and API credentials, then enable the schedule. Successful runs appear in the agent list with version and recency, and new assessments show up like other submissions.",
        ],
      },
      {
        heading: "When not to use the connector",
        paragraphs: [
          "One-off audits, air-gapped reviews, or customers who forbid persistent agents are still fully supported via HTML/XML upload on Assess. The connector is for recurring or high-frequency posture checks where automation beats manual export discipline.",
        ],
      },
    ],
    tips: [
      "Treat connector API keys like other secrets — rotate if a host is decommissioned.",
      "Ensure outbound HTTPS from the agent host to FireComply is allowed; firewall API access must be permitted from that host only.",
    ],
    primaryAction: { to: "/api", label: "Open API hub" },
  },
  "pre-ai": {
    slug: "pre-ai",
    title: "Pre-AI assessment",
    tagline: "Explore structure, coverage, and evidence before you generate AI narratives.",
    illustration: "pre-ai",
    sections: [
      {
        heading: "Why use pre-AI surfaces",
        paragraphs: [
          "AI reports are most accurate when you’ve validated what was parsed: objects, rules, VPNs, and hardening signals. Pre-AI tabs summarise that picture so you spot gaps before spending tokens on long outputs.",
        ],
      },
      {
        heading: "Tabs and overlays",
        paragraphs: [
          "Use the interactive reference below to open the same spotlight tiles used in first-time setup. Each tile explains a region of the assess UI and how it feeds compliance and risk scoring.",
        ],
      },
      {
        heading: "Order of operations",
        paragraphs: [
          "A practical sequence is: confirm upload and parsing (Overview), validate technical claims (Security Analysis), then map to customer obligations (Compliance), then generate AI or PDFs. Skipping straight to AI reports often produces confident language on top of unvalidated gaps.",
        ],
      },
    ],
    tips: [
      "If a section looks empty, confirm the export included that module (some features are optional on the appliance).",
    ],
    primaryAction: { to: "/", label: "Open Assess" },
  },
  "ai-reports": {
    slug: "ai-reports",
    title: "AI reports",
    tagline: "Generate executive and technical narratives from assessed configuration.",
    illustration: "ai-reports",
    sections: [
      {
        heading: "Report types",
        paragraphs: [
          "FireComply can produce multiple report shapes — from executive summaries to detailed control narratives. Delivery options tie into Report centre and saved packages so you can version what customers receive.",
        ],
      },
      {
        heading: "Quality and iteration",
        paragraphs: [
          "Re-run AI after you adjust scope or upload a newer export. Saved reports preserve a point-in-time snapshot; the assess view always reflects the latest loaded configuration.",
        ],
      },
      {
        heading: "Deterministic vs AI layers",
        paragraphs: [
          "Findings, scores, and compliance mapping come from deterministic analysis on parsed config. AI narratives interpret that structured output — if a story disagrees with a finding, trust the finding and fix the narrative or the underlying data.",
        ],
      },
    ],
    tips: [
      "Align framework selection with the customer’s audit language before generating long PDFs.",
    ],
    primaryAction: { to: "/reports", label: "Open Report centre" },
  },
  optimisation: {
    slug: "optimisation",
    title: "Optimisation",
    tagline: "Hardening suggestions, rule hygiene, and posture improvements.",
    illustration: "optimisation",
    sections: [
      {
        heading: "Hardening workflows",
        paragraphs: [
          "Optimisation views translate raw config into prioritised improvements: insecure defaults, overly broad rules, and feature gaps. Use them as a backlog for engineering changes or customer QBRs.",
        ],
      },
      {
        heading: "Linking to remediation",
        paragraphs: [
          "Many optimisation items can be tracked through remediation so owners and dates stay visible across the workspace.",
        ],
      },
    ],
    tips: ["Filter by severity when presenting to non-technical stakeholders."],
    primaryAction: { to: "/", label: "Open Assess" },
  },
  remediation: {
    slug: "remediation",
    title: "Remediation",
    tagline: "Track findings, owners, and closure status across engagements.",
    illustration: "remediation",
    sections: [
      {
        heading: "Remediation lifecycle",
        paragraphs: [
          "Findings can move from open to accepted or closed with rationale. The workspace keeps an audit-friendly trail so MSPs can show progress over time, not just a single snapshot.",
        ],
      },
      {
        heading: "Playbooks",
        paragraphs: [
          "Pair remediation items with playbooks for repeatable fixes — especially useful across a fleet with similar posture.",
        ],
      },
    ],
    tips: ["Export or report on remediation status before quarterly reviews."],
    primaryAction: { to: "/playbooks", label: "Open Playbooks" },
  },
  "tools-compare": {
    slug: "tools-compare",
    title: "Tools & compare",
    tagline: "Simulator, attack surface, exports, and configuration diff.",
    illustration: "tools-compare",
    sections: [
      {
        heading: "Deep tools",
        paragraphs: [
          "Beyond tables and charts, FireComply includes specialised tools: path simulation, attack surface visualisation, and structured exports for customers who want machine-readable evidence.",
        ],
      },
      {
        heading: "Compare runs",
        paragraphs: [
          "Drift and diff views highlight what changed between exports or time windows — ideal after change windows or firmware upgrades.",
        ],
      },
    ],
    tips: ["Use diff before and after major rule pushes to shorten incident postmortems."],
    primaryAction: { to: "/drift", label: "Open Drift monitor" },
  },
  management: {
    slug: "management",
    title: "Management panel",
    tagline: "Organisation menu for dashboard, reports, history, and settings.",
    illustration: "management",
    sections: [
      {
        heading: "Org menu",
        paragraphs: [
          "Open management from your organisation name in the header. You’ll find shortcuts to Mission control, saved reports, activity history, and the full settings surface for Central, branding, and integrations.",
          "If you are looking for connector agents, API keys, or webhook endpoints, they live under Settings within this drawer — not on the main hub tab bar.",
        ],
      },
      {
        heading: "Settings depth",
        paragraphs: [
          "Settings are where API keys, webhooks, portal configuration, FireComply Connector (collector) agent registration, and team access come together. You rarely need them during day-to-day assess work, but they’re essential for multi-tenant MSP operations.",
        ],
      },
    ],
    tips: [
      "Re-run first-time setup from settings when onboarding a new stack or changing Central credentials.",
    ],
    primaryAction: { to: "/dashboard", label: "Open Mission control" },
  },
  "team-security": {
    slug: "team-security",
    title: "Team & security",
    tagline: "Invite colleagues, enforce MFA, and adopt passkeys.",
    illustration: "team-security",
    sections: [
      {
        heading: "Collaboration",
        paragraphs: [
          "Invite users with organisation-scoped roles so customers and reports stay partitioned. Invites flow through email links the same way other workspace entry points do.",
        ],
      },
      {
        heading: "Account security",
        paragraphs: [
          "MFA and passkeys reduce risk for accounts that can see customer configs and reports. Align workspace access with your own MSP security policy.",
        ],
      },
    ],
    tips: ["Review seated users after project churn to avoid stale access."],
    primaryAction: { to: "/dashboard", label: "Open Mission control" },
  },
  "portal-alerts": {
    slug: "portal-alerts",
    title: "Portal, alerts & integrations",
    tagline: "Customer portals, schedules, webhooks, and alert-driven workflows.",
    illustration: "portal-alerts",
    sections: [
      {
        heading: "Customer portal",
        paragraphs: [
          "Configure branded or neutral customer portals so stakeholders can read approved reports without a full seat. Portal URLs are tenant-scoped — document them in your runbooks.",
        ],
      },
      {
        heading: "Alerts and integrations",
        paragraphs: [
          "Central alerts can feed Mission control and reporting. Webhooks and API hub settings let you push events into PSA or SIEM stacks when you need automation beyond the UI.",
        ],
      },
      {
        heading: "Portals vs seats",
        paragraphs: [
          "Portal readers consume approved content without a full FireComply seat. Internal analysts still sign in for Assess, settings, and sensitive exports — clarify that split when customers ask for “logins for everyone.”",
        ],
      },
    ],
    tips: ["Test webhooks in a sandbox org before pointing production PSA workflows."],
    primaryAction: { to: "/central/alerts", label: "Open Central alerts" },
  },
};

/**
 * Documentation site map — grouped routes aligned with `src/App.tsx`.
 * When adding routes, update this file in the same PR.
 */

export type HelpRouteGroupId =
  | "assess"
  | "hub"
  | "central"
  | "reports"
  | "operations"
  | "trust"
  | "health"
  | "token"
  | "other";

export type HelpRouteEntry = {
  label: string;
  /** Router path for “Open in app” */
  to: string;
  description: string;
};

export type HelpRouteGroup = {
  id: HelpRouteGroupId;
  title: string;
  entries: HelpRouteEntry[];
};

export const HELP_ROUTE_GROUPS: HelpRouteGroup[] = [
  {
    id: "assess",
    title: "Assess & analysis",
    entries: [
      {
        label: "Assess",
        to: "/",
        description:
          "Upload firewall HTML and XML exports, set customer context and frameworks, run AI analysis, and generate reports. Optional FireComply Connector agent can submit configs on a schedule.",
      },
    ],
  },
  {
    id: "hub",
    title: "Workspace hub",
    entries: [
      {
        label: "Mission control",
        to: "/dashboard",
        description: "Portfolio KPIs, recent alerts, quick actions, and workspace snapshot.",
      },
      {
        label: "Fleet",
        to: "/command",
        description: "Firewall inventory, health, and command-centre views across customers.",
      },
      {
        label: "Customers",
        to: "/customers",
        description: "Customer directory, onboarding, and mapping to Sophos Central tenants.",
      },
    ],
  },
  {
    id: "central",
    title: "Sophos Central",
    entries: [
      {
        label: "Overview",
        to: "/central/overview",
        description: "Central connection summary and entry to tenant and inventory tools.",
      },
      {
        label: "Tenants",
        to: "/central/tenants",
        description: "Synced tenants, API hosts, and sync actions per organisation.",
      },
      {
        label: "Firewalls",
        to: "/central/firewalls",
        description: "Merged firewall inventory from Central; open a row for per-device detail.",
      },
      {
        label: "Firewall detail",
        to: "/central/firewalls",
        description:
          "Deep link: Central → Firewalls → choose a device. Per-firewall context and actions.",
      },
      {
        label: "Alerts",
        to: "/central/alerts",
        description: "Sophos Central alerts merged for your synced estate.",
      },
      {
        label: "MDR",
        to: "/central/mdr",
        description: "Managed detection and response signal where available from Central.",
      },
      {
        label: "Groups",
        to: "/central/groups",
        description: "Central group structure referenced for policy and coverage views.",
      },
      {
        label: "Licensing",
        to: "/central/licensing",
        description: "Licence and subscription posture from synced Central data.",
      },
      {
        label: "Sync",
        to: "/central/sync",
        description: "Tenant and firewall sync status, refresh, and troubleshooting.",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & insights",
    entries: [
      {
        label: "Report centre",
        to: "/reports",
        description: "Generate, schedule, and manage report packages and templates.",
      },
      {
        label: "Saved report viewer",
        to: "/reports",
        description:
          "Open any saved report from Report centre or Mission control recents to view or export.",
      },
      {
        label: "Portfolio insights",
        to: "/insights",
        description: "Cross-customer compliance and risk trends for MSP portfolios.",
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    entries: [
      {
        label: "Drift monitor",
        to: "/drift",
        description: "Compare configs over time and highlight meaningful changes.",
      },
      {
        label: "Playbooks",
        to: "/playbooks",
        description: "Remediation playbooks and repeatable response patterns.",
      },
      {
        label: "API hub",
        to: "/api",
        description:
          "API keys, regional endpoints, integration docs, and FireComply Connector (collector) download matrix on the Agents tab.",
      },
      {
        label: "Connector agents",
        to: "/dashboard",
        description:
          "Register collector agents and API keys under your organisation menu → Settings → Connector agents. Installers also linked from API hub → Agents.",
      },
      {
        label: "Activity log",
        to: "/audit",
        description: "Organisation audit trail of key workspace actions.",
      },
    ],
  },
  {
    id: "trust",
    title: "Trust, updates & documentation",
    entries: [
      {
        label: "Trust & compliance",
        to: "/trust",
        description: "Security, privacy, subprocessors, and questionnaire downloads.",
      },
      {
        label: "Updates",
        to: "/changelog",
        description: "What’s new, advisories context, and platform notes.",
      },
      {
        label: "Documentation",
        to: "/help",
        description:
          "Multi-page docs — workspace hubs, Assess tab docs in two sections under /help/pages/assess (one sidebar link); site map; interactive guides. ?tab= on /.",
      },
    ],
  },
  {
    id: "health",
    title: "SE health check",
    entries: [
      {
        label: "Health check",
        to: "/health-check",
        description: "Sophos SE firewall health check workflow in the workspace.",
      },
    ],
  },
  {
    id: "token",
    title: "Shared & token links",
    entries: [
      {
        label: "Shared report",
        to: "/reports",
        description:
          "Recipients open a magic link (no login). Expiry and branding follow the publisher’s settings.",
      },
      {
        label: "Client portal",
        to: "/customers",
        description:
          "Customer-facing portal URLs include a tenant id. Configure portals from Settings.",
      },
      {
        label: "Config upload (token)",
        to: "/health-check",
        description:
          "Time-limited upload links for customers to submit configs without a full account.",
      },
      {
        label: "Team invite",
        to: "/dashboard",
        description: "Accept invitations to join an organisation’s workspace via email link.",
      },
      {
        label: "Shared health check",
        to: "/health-check",
        description: "Read-only health check HTML shared by link; download/print when enabled.",
      },
      {
        label: "Theme preview",
        to: "/preview",
        description: "Internal preview of theme tokens and sample components.",
      },
    ],
  },
  {
    id: "other",
    title: "Other",
    entries: [
      {
        label: "Page not found",
        to: "/dashboard",
        description:
          "Unknown URLs show a 404 page. Use workspace tabs or this site map to navigate.",
      },
    ],
  },
];

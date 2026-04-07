/** Page-aware copy for global AI chat and shortcuts (pathname prefix match, longest first). */

export interface RouteAssistConfig {
  title: string;
  blurb: string;
  suggestions: string[];
}

const ROUTES: { prefix: string; config: RouteAssistConfig }[] = [
  {
    prefix: "/central/alerts",
    config: {
      title: "Sophos Central — Alerts",
      blurb:
        "The user is on Sophos FireComply Central Alerts: cross-tenant open alerts from Sophos Central. Help interpret severities, triage, and next steps for MSP operators.",
      suggestions: [
        "How should I triage high-severity Central alerts?",
        "What’s the difference between alert categories I see here?",
        "How do I reduce noise from recurring alerts?",
      ],
    },
  },
  {
    prefix: "/central/firewall",
    config: {
      title: "Sophos Central — Firewall",
      blurb:
        "The user is viewing a single firewall in the Central workspace (inventory / detail context). Help with Sophos Central concepts and operational checks.",
      suggestions: [
        "What should I verify on this firewall in Central?",
        "How does inventory sync relate to assessments?",
      ],
    },
  },
  {
    prefix: "/central",
    config: {
      title: "Sophos Central workspace",
      blurb:
        "The user is in the Sophos FireComply Central hub (tenants, firewalls, licensing, sync, MDR, groups). Explain Central integration concepts and where to act in the product.",
      suggestions: [
        "How does FireComply sync with Sophos Central?",
        "Where do I manage tenants and firewalls?",
        "What is the Central sync status telling me?",
      ],
    },
  },
  {
    prefix: "/dashboard",
    config: {
      title: "Mission Control",
      blurb:
        "The user is on Mission Control: MSP portfolio overview, risk, recent activity, and Central-backed signals. Help them prioritize customers and operational follow-ups.",
      suggestions: [
        "How do I read the portfolio risk summary?",
        "What should I do first when alerts spike?",
        "How does Mission Control relate to assessments?",
      ],
    },
  },
  {
    prefix: "/customers",
    config: {
      title: "Customer management",
      blurb:
        "The user manages customers / tenants in FireComply. Help with onboarding, portals, and linking assessments.",
      suggestions: ["How do I onboard a new customer?", "What is the client portal used for?"],
    },
  },
  {
    prefix: "/reports",
    config: {
      title: "Report centre",
      blurb:
        "The user is in the report centre: saved reports, generation, and delivery. Help with report types and workflows.",
      suggestions: ["What reports can I generate?", "How do I find a saved report?"],
    },
  },
  {
    prefix: "/audit",
    config: {
      title: "Activity log",
      blurb:
        "The user is viewing org audit / activity history. Help interpret events and compliance value.",
      suggestions: [
        "What events appear in the activity log?",
        "How do I trace who changed a setting?",
      ],
    },
  },
  {
    prefix: "/drift",
    config: {
      title: "Drift monitor",
      blurb:
        "The user monitors configuration or posture drift. Help explain drift signals and remediation patterns.",
      suggestions: [
        "What counts as drift in FireComply?",
        "How should I respond to drift findings?",
      ],
    },
  },
  {
    prefix: "/playbooks",
    config: {
      title: "Playbook library",
      blurb: "The user browses remediation playbooks. Help map playbooks to findings and rollout.",
      suggestions: ["How do playbooks relate to findings?", "Where do I track remediation status?"],
    },
  },
  {
    prefix: "/insights",
    config: {
      title: "Portfolio insights",
      blurb: "The user views portfolio-level analytics. Help interpret trends and benchmarks.",
      suggestions: [
        "What insights are available at portfolio level?",
        "How do I compare customers?",
      ],
    },
  },
  {
    prefix: "/api",
    config: {
      title: "API hub",
      blurb:
        "The user is on the API hub for FireComply integrations. Help with keys, scopes, and safe usage.",
      suggestions: ["How do I authenticate API requests?", "What data can I access via the API?"],
    },
  },
  {
    prefix: "/command",
    config: {
      title: "Fleet Command",
      blurb:
        "The user works in Fleet Command: fleet-wide firewall and assessment context. Help with fleet operations.",
      suggestions: [
        "How does Fleet Command relate to Central?",
        "What can I do from the fleet map?",
      ],
    },
  },
  {
    prefix: "/trust",
    config: {
      title: "Trust",
      blurb:
        "The user is on trust / security documentation pages. Answer about data handling and product security at a high level.",
      suggestions: [
        "Where is data processed and stored?",
        "How does authentication work for teams?",
      ],
    },
  },
  {
    prefix: "/changelog",
    config: {
      title: "What’s new",
      blurb:
        "The user is reading product changelog / release notes. Summarize recent changes if asked.",
      suggestions: ["What changed recently in FireComply?"],
    },
  },
  {
    prefix: "/health-check",
    config: {
      title: "Health check",
      blurb:
        "The user is in the health check flow (SE or shared). Help with checks, exports, and sharing.",
      suggestions: ["How do I run or export a health check?", "What do health check results mean?"],
    },
  },
  {
    prefix: "/portal",
    config: {
      title: "Client portal",
      blurb:
        "The user is in a client portal view. Keep answers appropriate for customer-facing context.",
      suggestions: ["How do I read scores shown here?", "Where can I download reports?"],
    },
  },
  {
    prefix: "/shared",
    config: {
      title: "Shared report",
      blurb:
        "The user views a shared read-only report link. Explain findings generically without asking for secrets.",
      suggestions: ["Summarize the main risks in this report", "What should we fix first?"],
    },
  },
  {
    prefix: "/upload",
    config: {
      title: "Config upload",
      blurb:
        "The user uploads a firewall config via a token link. Help with supported formats and privacy.",
      suggestions: ["What file format should I upload?", "Is my configuration data kept private?"],
    },
  },
  {
    prefix: "/team-invite",
    config: {
      title: "Team invite",
      blurb: "The user is accepting a team invitation. Help with account and org access.",
      suggestions: ["What happens after I accept this invite?"],
    },
  },
  {
    prefix: "/",
    config: {
      title: "FireComply",
      blurb:
        "The user is in Sophos FireComply (assessment workspace or general app shell). Help with firewall assessment, compliance, and reporting concepts.",
      suggestions: [
        "How do I start a firewall assessment?",
        "What compliance frameworks are supported?",
        "How does scoring work?",
      ],
    },
  },
];

export function normalizeAssistPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p;
}

export function getRouteAssistConfig(pathname: string): RouteAssistConfig {
  const path = normalizeAssistPath(pathname);
  let best: RouteAssistConfig | null = null;
  let bestLen = -1;
  for (const { prefix, config } of ROUTES) {
    const pre = normalizeAssistPath(prefix);
    if (path === pre || path.startsWith(pre + "/")) {
      if (pre.length > bestLen) {
        bestLen = pre.length;
        best = config;
      }
    }
  }
  return (
    best ?? {
      title: "Sophos FireComply",
      blurb:
        "The user is using Sophos FireComply. Help with firewall security assessment, Sophos Central integration, compliance reporting, and MSP workflows.",
      suggestions: [
        "What is Sophos FireComply used for?",
        "How do assessments relate to Sophos Central?",
      ],
    }
  );
}

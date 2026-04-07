/**
 * Documentation IA — paths under `/help`. Keep in sync with App.tsx nested routes.
 */

import {
  HELP_WORKSPACE_GROUP_SLUGS,
  HELP_WORKSPACE_GROUPS,
  helpWorkspaceGroupChildPaths,
} from "./help-workspace-groups";

export type HelpDocNavItem = {
  to: string;
  /** When true, only active on exact path match (for `/help` index). */
  end?: boolean;
  label: string;
  description: string;
  /** Extra paths that keep this link highlighted (e.g. child workspace doc pages under a group hub). */
  activeWhenExactPaths?: string[];
  /** Highlight when pathname equals `to` or starts with this prefix (e.g. all Assess tab docs). */
  activeWhenPathPrefix?: string;
};

export type HelpDocNavSection = {
  id: string;
  title: string;
  items: HelpDocNavItem[];
};

export const HELP_GUIDE_SLUGS = [
  "upload-assess",
  "connector-agent",
  "pre-ai",
  "ai-reports",
  "optimisation",
  "remediation",
  "tools-compare",
  "management",
  "team-security",
  "portal-alerts",
] as const;

export type HelpGuideSlug = (typeof HELP_GUIDE_SLUGS)[number];

export function isHelpGuideSlug(s: string): s is HelpGuideSlug {
  return (HELP_GUIDE_SLUGS as readonly string[]).includes(s);
}

const workspaceGroupNavItems: HelpDocNavItem[] = HELP_WORKSPACE_GROUP_SLUGS.map((slug) => {
  const g = HELP_WORKSPACE_GROUPS[slug];
  return {
    to: `/help/pages/groups/${slug}`,
    label: g.title,
    description: g.tagline,
    activeWhenExactPaths: helpWorkspaceGroupChildPaths(slug),
  };
});

export const HELP_DOC_NAV: HelpDocNavSection[] = [
  {
    id: "start",
    title: "Start here",
    items: [
      {
        to: "/help",
        end: true,
        label: "Overview",
        description: "How documentation is organised and where to go next.",
      },
      {
        to: "/help/site-map",
        label: "Site map",
        description: "Every major workspace route with open-in-app links.",
      },
    ],
  },
  {
    id: "workspace",
    title: "Workspace",
    items: workspaceGroupNavItems,
  },
  {
    id: "assess-tabs",
    title: "Assess",
    items: [
      {
        to: "/help/pages/assess",
        end: true,
        label: "Analysis tabs",
        description: "Two section hubs, every tab article, and open Assess — all under this entry.",
        activeWhenPathPrefix: "/help/pages/assess",
      },
    ],
  },
  {
    id: "guides",
    title: "Interactive guides",
    items: [
      {
        to: "/help/guides/upload-assess",
        label: "Upload & assess",
        description: "Exports, drag-and-drop, and Sophos Central linking.",
      },
      {
        to: "/help/guides/connector-agent",
        label: "Connector (collector) agent",
        description:
          "Optional desktop agent: register, install, schedule pulls, and auto-submit assessments.",
      },
      {
        to: "/help/guides/pre-ai",
        label: "Pre-AI assessment",
        description: "Tabs and surfaces before you generate AI output.",
      },
      {
        to: "/help/guides/ai-reports",
        label: "AI reports",
        description: "Report types and delivery concepts.",
      },
      {
        to: "/help/guides/optimisation",
        label: "Optimisation",
        description: "Hardening and tuning workflows.",
      },
      {
        to: "/help/guides/remediation",
        label: "Remediation",
        description: "Tracking and closing findings.",
      },
      {
        to: "/help/guides/tools-compare",
        label: "Tools & compare",
        description: "Simulator, attack surface, exports, diff.",
      },
      {
        to: "/help/guides/management",
        label: "Management panel",
        description: "Org menu: dashboard, saved reports, history, settings.",
      },
      {
        to: "/help/guides/team-security",
        label: "Team & security",
        description: "Invites, MFA, and passkeys.",
      },
      {
        to: "/help/guides/portal-alerts",
        label: "Portal, alerts & integrations",
        description: "Customer portal, schedules, and webhooks.",
      },
    ],
  },
];

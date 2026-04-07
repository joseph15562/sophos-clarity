import type { DocIllustrationId } from "@/data/doc-illustration-id";
import type { HelpWorkspacePageSlug } from "./help-workspace-docs";

export const HELP_WORKSPACE_GROUP_SLUGS = [
  "portfolio",
  "assessment",
  "reports",
  "platform",
] as const;

export type HelpWorkspaceGroupSlug = (typeof HELP_WORKSPACE_GROUP_SLUGS)[number];

export function isHelpWorkspaceGroupSlug(s: string): s is HelpWorkspaceGroupSlug {
  return (HELP_WORKSPACE_GROUP_SLUGS as readonly string[]).includes(s);
}

export type HelpWorkspaceGroup = {
  slug: HelpWorkspaceGroupSlug;
  title: string;
  tagline: string;
  illustration: DocIllustrationId;
  intro: string;
  pages: HelpWorkspacePageSlug[];
};

export const HELP_WORKSPACE_GROUPS: Record<HelpWorkspaceGroupSlug, HelpWorkspaceGroup> = {
  portfolio: {
    slug: "portfolio",
    title: "Portfolio & customers",
    tagline: "Mission control, fleet inventory, and customer directory.",
    illustration: "help-group-portfolio",
    intro:
      "Start here for cross-customer visibility: who you protect, which firewalls are in scope, and how Central tenants map before you open a single Assess session. MSPs typically anchor daily stand-ups on Mission control, then use Fleet and Customers to decide which site needs a deeper assess or report run.",
    pages: ["mission-control", "fleet", "customers"],
  },
  assessment: {
    slug: "assessment",
    title: "Assessment & trends",
    tagline: "Assess workflow, portfolio insights, and configuration drift.",
    illustration: "help-group-assessment",
    intro:
      "Everything tied to analysing posture over time — from interactive assess tabs to portfolio rollups and drift between exports. Use Assess for one (or a few) configs in depth; Insights when you want trends across customers you have already assessed; Drift when you care about what changed between two points in time.",
    pages: ["assess", "insights", "drift"],
  },
  reports: {
    slug: "reports",
    title: "Reports & playbooks",
    tagline: "Report centre, saved packages, and repeatable remediation.",
    illustration: "help-group-reports",
    intro:
      "Generate and schedule customer-facing output, reopen saved snapshots, and align repeatable fixes with playbooks. Report centre is the hand-off point for PDFs and saved packages; Playbooks help you standardise how you talk about fixes that show up again and again across the fleet.",
    pages: ["reports", "playbooks"],
  },
  platform: {
    slug: "platform",
    title: "Central, API & operations",
    tagline: "Sophos Central hub, automation APIs, audit trail, and health check.",
    illustration: "help-group-platform",
    intro:
      "Connect to Sophos Central, automate via API, deploy optional FireComply Connector (collector) agents for scheduled config pull, review workspace activity, and run SE-style health checks. Central answers “what does Sophos see for this estate?”; the API hub and connector cover automation; the activity log and health check support governance and field workflows.",
    pages: ["central", "api", "audit", "health-check"],
  },
};

/** Doc URL for a workspace page (Assess uses tab hub, not `/pages/assess` slug page). */
export function helpWorkspacePageDocPath(slug: HelpWorkspacePageSlug): string {
  return slug === "assess" ? "/help/pages/assess" : `/help/pages/${slug}`;
}

/** Paths that belong to a group (for sidebar highlight). */
export function helpWorkspaceGroupChildPaths(slug: HelpWorkspaceGroupSlug): string[] {
  return HELP_WORKSPACE_GROUPS[slug].pages.map(helpWorkspacePageDocPath);
}

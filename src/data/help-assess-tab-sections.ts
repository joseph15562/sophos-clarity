import type { AssessAnalysisTabValue } from "@/lib/assess-analysis-tabs";
import type { DocIllustrationId } from "@/data/doc-illustration-id";

/** Two high-level buckets — everything else lives under `/help/pages/assess`. */
export const HELP_ASSESS_TAB_SECTION_SLUGS = [
  "posture-and-governance",
  "hardening-and-specialist",
] as const;

export type HelpAssessTabSectionSlug = (typeof HELP_ASSESS_TAB_SECTION_SLUGS)[number];

export function isHelpAssessTabSectionSlug(s: string): s is HelpAssessTabSectionSlug {
  return (HELP_ASSESS_TAB_SECTION_SLUGS as readonly string[]).includes(s);
}

export type HelpAssessTabSection = {
  slug: HelpAssessTabSectionSlug;
  title: string;
  tagline: string;
  illustration: DocIllustrationId;
  intro: string;
  tabs: readonly AssessAnalysisTabValue[];
};

export const HELP_ASSESS_TAB_SECTIONS: Record<HelpAssessTabSectionSlug, HelpAssessTabSection> = {
  "posture-and-governance": {
    slug: "posture-and-governance",
    title: "Posture, compliance & findings",
    tagline: "Overview, security deep-dives, framework mapping, and remediation workflows.",
    illustration: "assess-section-posture",
    intro:
      "This half of Detailed Security Analysis covers how you read posture: the Overview dashboard, Security Analysis for rules and topology, Compliance for frameworks and evidence-style widgets, and Remediation when findings exist (triage, roadmaps, and progress). Work top-to-bottom when you are new to a config — Overview and Security for facts, Compliance for control language, Remediation when you are ready to act on findings.",
    tabs: ["overview", "security", "compliance", "remediation"],
  },
  "hardening-and-specialist": {
    slug: "hardening-and-specialist",
    title: "Hardening, tools & specialist",
    tagline: "Optimisation, utilities, insurance-style views, and multi-config compare.",
    illustration: "assess-section-hardening",
    intro:
      "The remaining tabs focus on improvement and utilities: Optimisation and vendor best practice, Tools (simulator, attack surface, exports, baselines), Insurance Readiness for insurer conversations, and Compare when two or more configs are loaded. Use Optimisation and Tools during hardening projects; Insurance Readiness for renewal prep; Compare for migrations, templates, or before/after change windows (workspace Drift is another angle when you track history outside a single assess session).",
    tabs: ["optimisation", "tools", "insurance-readiness", "compare"],
  },
};

export function helpAssessTabSectionChildPaths(slug: HelpAssessTabSectionSlug): string[] {
  return HELP_ASSESS_TAB_SECTIONS[slug].tabs.map((t) => `/help/pages/assess/${t}`);
}

export function helpAssessTabParentSectionSlug(
  tab: AssessAnalysisTabValue,
): HelpAssessTabSectionSlug | undefined {
  for (const slug of HELP_ASSESS_TAB_SECTION_SLUGS) {
    if ((HELP_ASSESS_TAB_SECTIONS[slug].tabs as readonly AssessAnalysisTabValue[]).includes(tab)) {
      return slug;
    }
  }
  return undefined;
}

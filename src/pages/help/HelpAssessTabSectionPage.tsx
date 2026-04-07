import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { DocIllustration } from "@/components/help/DocIllustration";
import {
  HELP_ASSESS_TAB_SECTIONS,
  isHelpAssessTabSectionSlug,
} from "@/data/help-assess-tab-sections";
import { HELP_ASSESS_TAB_DOCS, helpAssessOpenPath } from "@/data/help-workspace-docs";

export default function HelpAssessTabSectionPage() {
  const { sectionSlug } = useParams<{ sectionSlug: string }>();

  if (!sectionSlug || !isHelpAssessTabSectionSlug(sectionSlug)) {
    return <Navigate to="/help/pages/assess" replace />;
  }

  const section = HELP_ASSESS_TAB_SECTIONS[sectionSlug];

  return (
    <div className="space-y-10 scroll-mt-28">
      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <Link to="/help" className="hover:text-foreground transition-colors">
          Documentation
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <Link to="/help/pages/assess" className="hover:text-foreground transition-colors">
          Assess
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-medium">{section.title}</span>
      </nav>

      <header className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">
          Assess tabs
        </p>
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
          {section.title}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{section.intro}</p>
        <DocIllustration id={section.illustration} caption={section.tagline} />
      </header>

      <section className="space-y-4" aria-labelledby="assess-section-tabs-heading">
        <h2
          id="assess-section-tabs-heading"
          className="text-lg font-display font-bold text-foreground"
        >
          Tabs in this section
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {section.tabs.map((tab) => {
            const doc = HELP_ASSESS_TAB_DOCS[tab];
            return (
              <li key={tab}>
                <Link
                  to={`/help/pages/assess/${tab}`}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-accent/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground">{doc.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-accent shrink-0 mt-0.5" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed flex-1">
                    {doc.tagline}
                  </p>
                  <p className="mt-3 text-[10px] text-muted-foreground/80 font-mono truncate">
                    In app: {helpAssessOpenPath(tab)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

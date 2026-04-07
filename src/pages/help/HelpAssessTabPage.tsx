import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronRight, Lightbulb } from "lucide-react";
import { DocIllustration } from "@/components/help/DocIllustration";
import { Button } from "@/components/ui/button";
import { HELP_ASSESS_TAB_DOCS, helpAssessOpenPath } from "@/data/help-workspace-docs";
import {
  HELP_ASSESS_TAB_SECTIONS,
  helpAssessTabParentSectionSlug,
} from "@/data/help-assess-tab-sections";
import { isAssessAnalysisTabValue } from "@/lib/assess-analysis-tabs";

export default function HelpAssessTabPage() {
  const { tabSlug } = useParams<{ tabSlug: string }>();

  if (!tabSlug || !isAssessAnalysisTabValue(tabSlug)) {
    return <Navigate to="/help/pages/assess" replace />;
  }

  const doc = HELP_ASSESS_TAB_DOCS[tabSlug];
  const openPath = helpAssessOpenPath(tabSlug);
  const parentSection = helpAssessTabParentSectionSlug(tabSlug);
  const sectionMeta = parentSection ? HELP_ASSESS_TAB_SECTIONS[parentSection] : null;

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
        {sectionMeta ? (
          <>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <Link
              to={`/help/pages/assess/sections/${parentSection}`}
              className="hover:text-foreground transition-colors max-w-[10rem] truncate sm:max-w-none"
            >
              {sectionMeta.title}
            </Link>
          </>
        ) : null}
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-medium">{doc.label}</span>
      </nav>

      <header className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">
          Assess tab
        </p>
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
          {doc.label}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">{doc.tagline}</p>
        <DocIllustration
          id={doc.illustration}
          caption={`Conceptual view — ${doc.label} on the Assess page.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link to={openPath}>Open Assess on this tab</Link>
          </Button>
          {doc.relatedGuide ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/help/guides/${doc.relatedGuide}`}>Related interactive guide</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {doc.visibilityNote ? (
        <p className="text-sm rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-muted-foreground">
          <strong className="text-foreground">Visibility:</strong> {doc.visibilityNote}
        </p>
      ) : null}

      {doc.sections.map((section) => (
        <section key={section.heading} className="space-y-3 scroll-mt-28">
          <h2 className="text-lg font-display font-bold text-foreground">{section.heading}</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {section.paragraphs.map((p, i) => (
              <p key={`${section.heading}-${i}`}>{p}</p>
            ))}
          </div>
        </section>
      ))}

      {doc.tips && doc.tips.length > 0 ? (
        <section
          className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] p-5 space-y-3"
          aria-labelledby="assess-tab-tips"
        >
          <div
            className="flex items-center gap-2 text-foreground font-semibold text-sm"
            id="assess-tab-tips"
          >
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            Tips
          </div>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
            {doc.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronRight, Lightbulb } from "lucide-react";
import { DocIllustration } from "@/components/help/DocIllustration";
import { Button } from "@/components/ui/button";
import { HELP_WORKSPACE_PAGE_DOCS, isHelpWorkspacePageSlug } from "@/data/help-workspace-docs";

export default function HelpWorkspacePageDoc() {
  const { pageSlug } = useParams<{ pageSlug: string }>();

  if (!pageSlug || !isHelpWorkspacePageSlug(pageSlug)) {
    return <Navigate to="/help" replace />;
  }

  const doc = HELP_WORKSPACE_PAGE_DOCS[pageSlug];

  return (
    <div className="space-y-10 scroll-mt-28">
      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <Link to="/help" className="hover:text-foreground transition-colors">
          Documentation
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-medium">{doc.title}</span>
      </nav>

      <header className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">
          Workspace page
        </p>
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
          {doc.title}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">{doc.tagline}</p>
        <DocIllustration
          id={doc.illustration}
          caption={`Illustrated overview — ${doc.title} in FireComply.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link to={doc.appPath}>Open in app</Link>
          </Button>
          {doc.relatedGuide ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/help/guides/${doc.relatedGuide}`}>Related interactive guide</Link>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/help/site-map">Site map</Link>
          </Button>
        </div>
      </header>

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
          aria-labelledby="workspace-doc-tips"
        >
          <div
            className="flex items-center gap-2 text-foreground font-semibold text-sm"
            id="workspace-doc-tips"
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

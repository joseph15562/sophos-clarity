import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { DocIllustration } from "@/components/help/DocIllustration";
import {
  HELP_WORKSPACE_GROUPS,
  helpWorkspacePageDocPath,
  isHelpWorkspaceGroupSlug,
} from "@/data/help-workspace-groups";
import { HELP_WORKSPACE_PAGE_DOCS } from "@/data/help-workspace-docs";

export default function HelpWorkspaceGroupPage() {
  const { groupSlug } = useParams<{ groupSlug: string }>();

  if (!groupSlug || !isHelpWorkspaceGroupSlug(groupSlug)) {
    return <Navigate to="/help" replace />;
  }

  const group = HELP_WORKSPACE_GROUPS[groupSlug];

  return (
    <div className="space-y-10 scroll-mt-28">
      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <Link to="/help" className="hover:text-foreground transition-colors">
          Documentation
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-medium">{group.title}</span>
      </nav>

      <header className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">
          Workspace
        </p>
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
          {group.title}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{group.intro}</p>
        <DocIllustration id={group.illustration} caption={group.tagline} />
      </header>

      <section className="space-y-4" aria-labelledby="group-pages-heading">
        <h2 id="group-pages-heading" className="text-lg font-display font-bold text-foreground">
          Pages in this group
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {group.pages.map((slug) => {
            const doc = HELP_WORKSPACE_PAGE_DOCS[slug];
            const to = helpWorkspacePageDocPath(slug);
            return (
              <li key={slug}>
                <Link
                  to={to}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-accent/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground">{doc.title}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-accent shrink-0 mt-0.5" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed flex-1">
                    {doc.tagline}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        <Link to="/help/site-map" className="text-primary underline-offset-2 hover:underline">
          Full site map
        </Link>{" "}
        lists every route with open-in-app links.
      </p>
    </div>
  );
}

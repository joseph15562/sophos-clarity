import { Link } from "react-router-dom";
import { ArrowRight, Layers, Map, Sparkles } from "lucide-react";
import { HelpDocHero } from "@/components/help/HelpDocHero";
import { DocIllustration } from "@/components/help/DocIllustration";
import { HELP_DOC_NAV } from "@/data/help-doc-nav";
import { HELP_WORKSPACE_GROUP_SLUGS, HELP_WORKSPACE_GROUPS } from "@/data/help-workspace-groups";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HelpHomePage() {
  const guideItems = HELP_DOC_NAV.find((s) => s.id === "guides")?.items ?? [];

  return (
    <div className="space-y-12 scroll-mt-28">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <HelpDocHero />
        <DocIllustration
          id="docs-home"
          caption="Documentation mirrors the workspace: hubs for portfolio, assessment, reports, and platform operations."
          className="lg:pt-2"
        />
      </div>

      <section className="space-y-4" aria-labelledby="doc-browse-heading">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-accent shrink-0" />
          <h2
            id="doc-browse-heading"
            className="text-lg font-display font-bold tracking-tight text-foreground"
          >
            Browse documentation
          </h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          <strong className="text-foreground">Workspace</strong> docs use hub pages (portfolio,
          assessment, reports, platform). <strong className="text-foreground">Assess</strong> uses
          one sidebar entry: two section hubs plus every tab article under{" "}
          <code className="text-xs">/help/pages/assess</code>.{" "}
          <strong className="text-foreground">Interactive guides</strong> add click-through panels
          like first-time setup — without connection or branding forms. Start from a hub if you are
          unsure which screen to open; open <strong className="text-foreground">Site map</strong>{" "}
          when you already know the route name and want a direct link.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {HELP_WORKSPACE_GROUP_SLUGS.map((slug) => {
            const g = HELP_WORKSPACE_GROUPS[slug];
            return (
              <Link
                key={slug}
                to={`/help/pages/groups/${slug}`}
                className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-accent/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Layers className="h-4 w-4 text-brand-accent shrink-0" />
                    {g.title}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-accent shrink-0" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{g.tagline}</p>
              </Link>
            );
          })}
          <Link
            to="/help/site-map"
            className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-accent/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Map className="h-4 w-4 text-brand-accent shrink-0" />
                Site map
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-accent transition-colors shrink-0" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Every major workspace route, grouped by area, with open-in-app links.
            </p>
          </Link>

          {guideItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-accent/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-foreground pr-2">{item.label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-accent transition-colors shrink-0 mt-0.5" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section
        className={cn(
          "rounded-2xl border border-border bg-muted/20 p-6 space-y-4",
          "bg-[linear-gradient(135deg,rgba(32,6,247,0.04),transparent_55%)]",
        )}
      >
        <h2 className="text-base font-display font-bold text-foreground">Next steps</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Open <strong className="text-foreground">Settings</strong> from your organisation name in
          the header for Central, branding, team, and integrations. Re-run first-time setup from
          there whenever you want the full connection wizard.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" asChild>
            <Link to="/dashboard">Mission control</Link>
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to="/">Assess</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight } from "lucide-react";
import { DocIllustration } from "@/components/help/DocIllustration";
import {
  HELP_ASSESS_TAB_SECTION_SLUGS,
  HELP_ASSESS_TAB_SECTIONS,
} from "@/data/help-assess-tab-sections";
import { HELP_ASSESS_TAB_DOCS } from "@/data/help-workspace-docs";
import { Button } from "@/components/ui/button";

export default function HelpAssessHubPage() {
  return (
    <div className="space-y-10 scroll-mt-28">
      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <Link to="/help" className="hover:text-foreground transition-colors">
          Documentation
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-medium">Assess</span>
      </nav>

      <header className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
          Assess
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          The Assess page (<code className="text-xs rounded bg-muted px-1 py-px">/</code>) is where
          you upload firewall configuration and work through the{" "}
          <strong className="text-foreground">Detailed Security Analysis</strong> tabs.
          Documentation splits those tabs into{" "}
          <strong className="text-foreground">two sections</strong> below; each links to per-tab
          articles and <code className="text-xs">?tab=</code> deep links. Section hubs explain the
          intent of each group; per-tab pages add visibility notes (for example when Remediation or
          Compare is hidden) and link to related interactive guides.
        </p>
        <DocIllustration
          id="workspace-assess"
          caption="Assess combines upload, context, and the Detailed Security Analysis tab strip."
        />
        <Button size="sm" asChild>
          <Link to="/">Open Assess</Link>
        </Button>
      </header>

      <section className="space-y-4" aria-labelledby="assess-sections-heading">
        <h2 id="assess-sections-heading" className="text-lg font-display font-bold text-foreground">
          Tab documentation (two sections)
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {HELP_ASSESS_TAB_SECTION_SLUGS.map((slug) => {
            const s = HELP_ASSESS_TAB_SECTIONS[slug];
            return (
              <li key={slug}>
                <Link
                  to={`/help/pages/assess/sections/${slug}`}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand-accent/30 hover:shadow-md h-full min-h-[140px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground">{s.title}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-accent shrink-0" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed flex-1">
                    {s.tagline}
                  </p>
                  <p className="mt-3 text-[10px] text-muted-foreground/70 leading-snug">
                    {s.tabs.map((t) => HELP_ASSESS_TAB_DOCS[t].label).join(" · ")}
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

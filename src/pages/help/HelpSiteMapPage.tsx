import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { HelpDocumentationSiteMap } from "@/components/help/HelpDocumentationSiteMap";
import { DocIllustration } from "@/components/help/DocIllustration";

export default function HelpSiteMapPage() {
  return (
    <div className="space-y-8 scroll-mt-28">
      <nav className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <Link to="/help" className="hover:text-foreground transition-colors">
          Documentation
        </Link>
        <ChevronRight className="h-3 w-3 opacity-60" />
        <span className="text-foreground font-medium">Site map</span>
      </nav>

      <header className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
          Site map
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          This reference mirrors the routes in the FireComply workspace. Use{" "}
          <strong className="text-foreground">Open in app</strong> to jump straight to a screen. For
          deeper, illustrated guides to workflows, open any page under{" "}
          <Link
            to="/help/guides/upload-assess"
            className="text-primary underline-offset-2 hover:underline"
          >
            Workspace guides
          </Link>{" "}
          from the sidebar or documentation home. Some destinations (for example connector
          registration) live inside the organisation management drawer rather than a top-level URL —
          those rows describe the closest hub route and what to open next.
        </p>
        <DocIllustration
          id="site-map"
          caption="Routes branch from hub areas — Central, reports, and assess are the busiest clusters."
        />
      </header>

      <HelpDocumentationSiteMap />
    </div>
  );
}

import { Link } from "react-router-dom";
import { BookOpen, FileText, Keyboard } from "lucide-react";

export function HelpDocHero() {
  return (
    <div
      id="documentation-overview"
      className="scroll-mt-28 rounded-[28px] border border-brand-accent/20 bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.12),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,255,0.96))] dark:bg-[radial-gradient(circle_at_top_left,rgba(32,6,247,0.18),transparent_40%),linear-gradient(180deg,rgba(13,18,32,0.96),rgba(10,15,28,0.96))] shadow-elevated overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-[#2006F7] via-[#5A00FF] to-[#00EDFF]" />
      <div className="p-6 sm:p-8 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-accent">
          Documentation
        </p>
        <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
          FireComply workspace
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Multi-page documentation: workspace areas grouped into hub pages, Assess tab articles, a
          full site map, and <strong className="text-foreground">interactive guides</strong> with
          illustrations — the same previews as first-time setup, without connection or branding
          forms. Use the left sidebar to move between workspace hubs, the single Assess entry (all
          tab docs), and guides; open <strong className="text-foreground">Site map</strong> when you
          want every app route in one list with deep links.
        </p>
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <li className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
            <FileText className="h-3.5 w-3.5 text-brand-accent shrink-0" />
            Grouped workspace + site map
          </li>
          <li className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
            <Keyboard className="h-3.5 w-3.5 text-brand-accent shrink-0" />
            <span>
              <strong className="text-foreground">Shift+?</strong> shortcuts anywhere else
            </span>
          </li>
          <li className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5">
            <BookOpen className="h-3.5 w-3.5 text-brand-accent shrink-0" />
            <span>
              <Link to="/changelog" className="text-primary underline-offset-2 hover:underline">
                Updates
              </Link>
              {" · "}
              <Link to="/trust" className="text-primary underline-offset-2 hover:underline">
                Trust
              </Link>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

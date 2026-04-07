import { Link } from "react-router-dom";
import { ExternalLink, Map } from "lucide-react";
import { HELP_ROUTE_GROUPS, type HelpRouteEntry } from "@/data/help-routes";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function HelpRouteRow({ entry }: { entry: HelpRouteEntry }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-foreground">{entry.label}</p>
        <Link
          to={entry.to}
          className="inline-flex items-center gap-1 text-[10px] text-primary font-medium hover:underline"
        >
          Open in app
          <ExternalLink className="h-3 w-3 opacity-70" />
        </Link>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{entry.description}</p>
    </div>
  );
}

export function HelpDocumentationSiteMap() {
  const defaultOpen = HELP_ROUTE_GROUPS.slice(0, 3).map((g) => g.id);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-display font-bold tracking-tight text-foreground flex items-center gap-2">
          <Map className="h-5 w-5 text-brand-accent shrink-0" />
          Site map
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Every major screen in the workspace, grouped by area. Use{" "}
          <strong className="text-foreground">Open in app</strong> to jump straight there.
        </p>
      </div>

      <Accordion
        type="multiple"
        defaultValue={defaultOpen}
        className="border border-border rounded-xl px-3 bg-card/30"
      >
        {HELP_ROUTE_GROUPS.map((group) => (
          <AccordionItem key={group.id} value={group.id} className="border-border/60">
            <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
              {group.title}
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-3 pt-0">
              {group.entries.map((entry) => (
                <HelpRouteRow key={`${group.id}-${entry.label}`} entry={entry} />
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

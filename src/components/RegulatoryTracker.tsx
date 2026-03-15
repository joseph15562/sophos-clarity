import { ExternalLink } from "lucide-react";

const UPDATES = [
  {
    title: "PCI DSS v4.0.1",
    subtitle: "New requirements for authentication",
    description: "Updated multi-factor authentication requirements and new guidance on passwordless authentication.",
    link: "#",
  },
  {
    title: "Cyber Essentials",
    subtitle: "Updated technical controls 2025",
    description: "Revised technical control themes including cloud services, home working, and multi-factor authentication.",
    link: "#",
  },
  {
    title: "GDPR",
    subtitle: "Enhanced data breach notification requirements",
    description: "Clarified 72-hour breach notification timelines and documentation expectations for supervisory authorities.",
    link: "#",
  },
];

export function RegulatoryTracker() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Regulatory Tracker</h3>
      <p className="text-[10px] text-muted-foreground mb-4">
        Recent framework changes and updates
      </p>

      <div className="space-y-3">
        {UPDATES.map((u, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-muted/10 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold text-foreground">{u.title}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">{u.subtitle}</p>
              </div>
              <a
                href={u.link}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                aria-label="View details"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-[10px] text-foreground mt-2 leading-relaxed">{u.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

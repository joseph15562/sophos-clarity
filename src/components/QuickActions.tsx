import {
  FileText,
  Download,
  ArrowLeftRight,
  Wrench,
  ClipboardCheck,
} from "lucide-react";

const ACTIONS = [
  {
    id: "tools",
    title: "Generate Report",
    description: "Create AI-powered PDF/Word report",
    icon: FileText,
    color: "#2006F7",
  },
  {
    id: "overview",
    title: "Export Risk Register",
    description: "Download findings as CSV/Excel",
    icon: Download,
    color: "#00F2B3",
  },
  {
    id: "compare",
    title: "Compare Configs",
    description: "Side-by-side firewall comparison",
    icon: ArrowLeftRight,
    color: "#5A00FF",
  },
  {
    id: "remediation",
    title: "View Remediation",
    description: "Prioritised remediation playbooks",
    icon: Wrench,
    color: "#EA0022",
  },
  {
    id: "compliance",
    title: "Compliance Check",
    description: "Framework compliance status",
    icon: ClipboardCheck,
    color: "#F29400",
  },
] as const;

type QuickActionsProps = {
  onNavigate?: (tab: string) => void;
};

export function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ACTIONS.map(({ id, title, description, icon: Icon, color }) => (
        <button
          key={id}
          type="button"
          onClick={() => onNavigate?.(id)}
          className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 cursor-pointer"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </span>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="text-[10px] text-muted-foreground">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

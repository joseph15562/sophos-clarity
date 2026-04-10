import { FileText, Download, ArrowLeftRight, Wrench, ClipboardCheck } from "lucide-react";

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
          className="group relative overflow-hidden flex flex-col items-start gap-2.5 rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-4 text-left shadow-card transition-all duration-200 hover:scale-[1.03] hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated cursor-pointer"
          style={{ backgroundImage: `linear-gradient(145deg, ${color}12, ${color}05)` }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute -top-5 -right-5 h-14 w-14 rounded-full blur-[24px] opacity-20 transition-opacity duration-200 group-hover:opacity-35"
              style={{ backgroundColor: color }}
            />
          </div>
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(90deg, transparent, ${color}28, transparent)`,
            }}
          />
          <span
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-900/[0.12] dark:border-white/[0.08] transition-transform duration-200 group-hover:scale-110"
            style={{ backgroundColor: `${color}18` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </span>
          <div className="relative space-y-0.5">
            <p className="text-xs font-bold text-foreground tracking-tight">{title}</p>
            <p className="text-[10px] text-muted-foreground/80">{description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

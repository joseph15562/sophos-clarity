import { Checkbox } from "@/components/ui/checkbox";
import { ALL_FRAMEWORKS, type ComplianceFramework } from "@/lib/compliance-context-options";

type Props = {
  selectedFrameworks: ComplianceFramework[];
  onChange: (next: ComplianceFramework[]) => void;
  /** Smaller type and scroll for per-file rows */
  variant?: "default" | "compact";
};

export function ComplianceFrameworkGrid({
  selectedFrameworks,
  onChange,
  variant = "default",
}: Props) {
  const set = new Set(selectedFrameworks);
  const toggle = (fw: ComplianceFramework) => {
    const next = new Set(set);
    if (next.has(fw)) next.delete(fw);
    else next.add(fw);
    onChange(Array.from(next) as ComplianceFramework[]);
  };

  const isCompact = variant === "compact";

  return (
    <div
      className={
        isCompact
          ? "grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1 pt-1"
          : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 pt-1"
      }
    >
      {ALL_FRAMEWORKS.map((fw) => {
        const checked = set.has(fw);
        return (
          <label
            key={fw}
            className={
              isCompact
                ? `flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-2 py-1.5 text-[10px] cursor-pointer hover:bg-muted/30 ${checked ? "border-brand-accent/25 bg-brand-accent/[0.06]" : ""}`
                : `group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm cursor-pointer transition-all duration-200 ${checked ? "border-brand-accent/30 bg-brand-accent/[0.07] dark:bg-brand-accent/[0.10] shadow-[0_0_16px_-4px] shadow-brand-accent/15 dark:shadow-brand-accent/20 ring-1 ring-brand-accent/10" : "border-border/50 bg-card/60 hover:bg-card hover:border-border/70 hover:shadow-card"}`
            }
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => toggle(fw)}
              className={isCompact ? "h-3.5 w-3.5" : undefined}
            />
            <span
              className={
                isCompact
                  ? `select-none leading-snug ${checked ? "font-medium text-foreground" : "text-foreground/80"}`
                  : `select-none leading-snug ${checked ? "font-semibold text-foreground" : "text-foreground/80 group-hover:text-foreground"}`
              }
            >
              {fw}
            </span>
          </label>
        );
      })}
    </div>
  );
}

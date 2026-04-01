import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ALL_FRAMEWORKS, type ComplianceFramework } from "@/lib/compliance-context-options";

type Props = {
  configId: string;
  /** Additional frameworks only (not auto defaults). */
  additionalFrameworks: ComplianceFramework[];
  onAdditionalChange: (configId: string, frameworks: ComplianceFramework[]) => void;
};

/** Per-uploaded-config extra compliance frameworks (merged with defaults for that config). */
export function ConfigFileAdditionalFrameworks({
  configId,
  additionalFrameworks,
  onAdditionalChange,
}: Props) {
  const set = new Set(additionalFrameworks);
  const toggle = (fw: ComplianceFramework) => {
    const next = new Set(set);
    if (next.has(fw)) next.delete(fw);
    else next.add(fw);
    onAdditionalChange(configId, Array.from(next) as ComplianceFramework[]);
  };

  return (
    <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Additional frameworks (this config)
      </Label>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Defaults come from Customer Context or Central link. Add contractual or site-specific
        frameworks here without affecting other configs.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
        {ALL_FRAMEWORKS.map((fw) => (
          <label
            key={fw}
            className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 px-2 py-1.5 text-[10px] cursor-pointer hover:bg-muted/30"
          >
            <Checkbox
              checked={set.has(fw)}
              onCheckedChange={() => toggle(fw)}
              className="h-3.5 w-3.5"
            />
            <span className="leading-tight text-foreground/85">{fw}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

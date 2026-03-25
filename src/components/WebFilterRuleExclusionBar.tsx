import { useCallback, useMemo } from "react";
import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  /** Enabled WAN rules with web-capable services that have no web filter (from analysis) */
  candidateRuleNames: string[];
  /** Rule names excluded from the missing-web-filter compliance check */
  exemptRuleNames: string[];
  onChange: (names: string[]) => void;
}

export function WebFilterRuleExclusionBar({
  candidateRuleNames,
  exemptRuleNames,
  onChange,
}: Props) {
  const unique = useMemo(
    () => [...new Set(candidateRuleNames.filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [candidateRuleNames],
  );

  const toggle = useCallback(
    (ruleName: string) => {
      const lower = ruleName.toLowerCase();
      if (exemptRuleNames.some((n) => n.toLowerCase() === lower)) {
        onChange(exemptRuleNames.filter((n) => n.toLowerCase() !== lower));
      } else {
        onChange([...exemptRuleNames, ruleName]);
      }
    },
    [exemptRuleNames, onChange],
  );

  if (unique.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Filter className="h-4 w-4 text-muted-foreground" />
        Web filter rule scope
        <span className="text-[11px] text-muted-foreground font-normal">
          Exclude rule names from the &quot;missing web filtering&quot; check when agreed with the
          customer (e.g. infrastructure, out-of-scope).
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 max-h-32 overflow-y-auto">
        {unique.map((name) => {
          const isExempt = exemptRuleNames.some((n) => n.toLowerCase() === name.toLowerCase());
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className="focus:outline-none"
            >
              <Badge
                variant={isExempt ? "default" : "outline"}
                className={`cursor-pointer text-xs transition-colors max-w-[220px] truncate ${
                  isExempt
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                    : "hover:bg-muted"
                }`}
                title={name}
              >
                {name}
                {isExempt && " (excluded)"}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

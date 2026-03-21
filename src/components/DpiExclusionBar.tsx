import { useCallback, useMemo } from "react";
import { ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  /** All WAN source zones detected from the config */
  detectedZones: string[];
  /** Currently excluded zones */
  excludedZones: string[];
  onChange: (zones: string[]) => void;
}

const BUILTIN_RE = /guest|iot|byod|printer|camera|cctv|voip|phone|sip|dmz|server|red/i;

export function DpiExclusionBar({ detectedZones, excludedZones, onChange }: Props) {
  const userZones = useMemo(
    () => detectedZones.filter((z) => !BUILTIN_RE.test(z)),
    [detectedZones],
  );

  const toggle = useCallback(
    (zone: string) => {
      const lower = zone.toLowerCase();
      if (excludedZones.some((z) => z.toLowerCase() === lower)) {
        onChange(excludedZones.filter((z) => z.toLowerCase() !== lower));
      } else {
        onChange([...excludedZones, zone]);
      }
    },
    [excludedZones, onChange],
  );

  if (userZones.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldOff className="h-4 w-4 text-muted-foreground" />
        DPI Zone Exclusions
        <span className="text-[11px] text-muted-foreground font-normal">
          Exclude zones where SSL/TLS certificate cannot be deployed:
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {userZones.map((zone) => {
          const isExcluded = excludedZones.some(
            (z) => z.toLowerCase() === zone.toLowerCase(),
          );
          return (
            <button
              key={zone}
              type="button"
              onClick={() => toggle(zone)}
              className="focus:outline-none"
            >
              <Badge
                variant={isExcluded ? "default" : "outline"}
                className={`cursor-pointer text-xs transition-colors ${
                  isExcluded
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                    : "hover:bg-muted"
                }`}
              >
                {zone.toUpperCase()}
                {isExcluded && " (excluded)"}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

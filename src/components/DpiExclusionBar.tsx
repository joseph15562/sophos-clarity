import { useCallback, useMemo } from "react";
import { ShieldOff, Network, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ExclusionVariant = "dpi" | "webFilter";

const VARIANT_META: Record<
  ExclusionVariant,
  { title: string; description: string; Icon: typeof ShieldOff }
> = {
  dpi: {
    title: "DPI Exclusions",
    description: "Exclude zones or networks where SSL/TLS certificate cannot be deployed:",
    Icon: ShieldOff,
  },
  webFilter: {
    title: "Web Filter Scope (Zones / Networks)",
    description: "Exclude source zones or networks from the missing-web-filter check (agreed customer scope):",
    Icon: Filter,
  },
};

interface Props {
  detectedZones: string[];
  excludedZones: string[];
  onZonesChange: (zones: string[]) => void;
  detectedNetworks?: string[];
  excludedNetworks?: string[];
  onNetworksChange?: (networks: string[]) => void;
  /** Same toggle UI as DPI; separate excluded state for web filter compliance scope. */
  variant?: ExclusionVariant;
}

const BUILTIN_ZONE_RE = /guest|iot|byod|printer|camera|cctv|voip|phone|sip|dmz|server|red/i;
const BUILTIN_NET_RE = /printer|camera|cctv|voip|phone|sip|iot|guest|byod/i;

function ToggleRow({
  items,
  excluded,
  onToggle,
  uppercase,
}: {
  items: string[];
  excluded: string[];
  onToggle: (item: string) => void;
  uppercase?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const isExcluded = excluded.some(
          (e) => e.toLowerCase() === item.toLowerCase(),
        );
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
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
              {uppercase ? item.toUpperCase() : item}
              {isExcluded && " (excluded)"}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

export function DpiExclusionBar({
  detectedZones,
  excludedZones,
  onZonesChange,
  detectedNetworks = [],
  excludedNetworks = [],
  onNetworksChange,
  variant = "dpi",
}: Props) {
  const { title, description, Icon } = VARIANT_META[variant];
  const userZones = useMemo(
    () => detectedZones.filter((z) => !BUILTIN_ZONE_RE.test(z)),
    [detectedZones],
  );
  const userNetworks = useMemo(
    () => detectedNetworks.filter((n) => !BUILTIN_NET_RE.test(n)),
    [detectedNetworks],
  );

  const toggleZone = useCallback(
    (zone: string) => {
      const lower = zone.toLowerCase();
      if (excludedZones.some((z) => z.toLowerCase() === lower)) {
        onZonesChange(excludedZones.filter((z) => z.toLowerCase() !== lower));
      } else {
        onZonesChange([...excludedZones, zone]);
      }
    },
    [excludedZones, onZonesChange],
  );

  const toggleNetwork = useCallback(
    (net: string) => {
      if (!onNetworksChange) return;
      const lower = net.toLowerCase();
      if (excludedNetworks.some((n) => n.toLowerCase() === lower)) {
        onNetworksChange(excludedNetworks.filter((n) => n.toLowerCase() !== lower));
      } else {
        onNetworksChange([...excludedNetworks, net]);
      }
    },
    [excludedNetworks, onNetworksChange],
  );

  if (userZones.length === 0 && userNetworks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        {title}
        <span className="text-[11px] text-muted-foreground font-normal">{description}</span>
      </div>

      {userZones.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Zones</p>
          <ToggleRow items={userZones} excluded={excludedZones} onToggle={toggleZone} uppercase />
        </div>
      )}

      {userNetworks.length > 0 && onNetworksChange && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Network className="h-3 w-3" />
            Source Networks
          </p>
          <ToggleRow items={userNetworks} excluded={excludedNetworks} onToggle={toggleNetwork} />
        </div>
      )}
    </div>
  );
}

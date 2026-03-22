import { Radar, Globe } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  mdrAcknowledged: boolean;
  ndrAcknowledged: boolean;
  onMdrChange: (value: boolean) => void;
  onNdrChange: (value: boolean) => void;
}

export function SeThreatResponseAckBar({
  mdrAcknowledged,
  ndrAcknowledged,
  onMdrChange,
  onNdrChange,
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <Radar className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF] shrink-0" aria-hidden />
        <span>Active threat response (export gaps)</span>
        <span className="text-[11px] text-muted-foreground font-normal w-full sm:w-auto sm:flex-1">
          Toggle when you have verified on the appliance — MDR threat feeds and NDR Essentials are often omitted from HTML/XML exports. This scores those best-practice rows as pass without using per-check manual overrides.
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-x-8 sm:gap-y-3">
        <div className="flex items-center justify-between gap-4 sm:justify-start sm:gap-3">
          <Label htmlFor="se-ack-mdr" className="text-xs font-normal cursor-pointer">
            MDR threat feeds configured
          </Label>
          <Switch id="se-ack-mdr" checked={mdrAcknowledged} onCheckedChange={onMdrChange} />
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-start sm:gap-3">
          <Label htmlFor="se-ack-ndr" className="text-xs font-normal cursor-pointer">
            NDR Essentials enabled
          </Label>
          <Switch id="se-ack-ndr" checked={ndrAcknowledged} onCheckedChange={onNdrChange} />
        </div>
      </div>
    </div>
  );
}

interface DnsProtectionAckBarProps {
  acknowledged: boolean;
  onChange: (value: boolean) => void;
}

export function SeDnsProtectionAckBar({ acknowledged, onChange }: DnsProtectionAckBarProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <Globe className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF] shrink-0" aria-hidden />
        <span>DNS Protection</span>
        <span className="text-[11px] text-muted-foreground font-normal w-full sm:w-auto sm:flex-1">
          DNS Protection configuration is not included in HTML/XML exports. Toggle when you have verified that Sophos DNS Protection IPs are configured as the firewall's upstream DNS servers.
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-start sm:gap-3">
        <Label htmlFor="se-ack-dns" className="text-xs font-normal cursor-pointer">
          DNS Protection configured
        </Label>
        <Switch id="se-ack-dns" checked={acknowledged} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

import { HeartPulse } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  excludeHeartbeatCheck: boolean;
  onExcludeChange: (value: boolean) => void;
}

export function SeHeartbeatScopeBar({ excludeHeartbeatCheck, onExcludeChange }: Props) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <HeartPulse className="h-4 w-4 text-brand-accent shrink-0" aria-hidden />
        <span>Synchronized Security scope</span>
        <span className="text-[11px] text-muted-foreground font-normal w-full sm:w-auto sm:flex-1">
          Some estates have no Sophos endpoint agents — Security Heartbeat on WAN rules does not
          apply. Excluding removes that best-practice row from scoring (N/A).
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-start sm:gap-3">
        <Label
          htmlFor="se-exclude-heartbeat"
          className="text-xs font-normal cursor-pointer max-w-[min(100%,28rem)]"
        >
          Exclude Security Heartbeat check (no Sophos endpoints)
        </Label>
        <Switch
          id="se-exclude-heartbeat"
          checked={excludeHeartbeatCheck}
          onCheckedChange={onExcludeChange}
        />
      </div>
    </div>
  );
}

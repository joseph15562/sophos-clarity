import { Users, ChevronDown, User } from "lucide-react";
import { useActiveTeam } from "@/hooks/use-active-team";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TeamSwitcher() {
  const { teams, activeTeamId, setActiveTeamId, loading } = useActiveTeam();

  if (loading || teams.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={activeTeamId ?? "__personal__"}
        onValueChange={(v) => setActiveTeamId(v === "__personal__" ? null : v)}
      >
        <SelectTrigger className="h-8 w-auto min-w-[140px] max-w-[220px] rounded-lg text-xs font-medium gap-1.5 border-border/60 bg-card">
          <div className="flex items-center gap-1.5 truncate">
            {activeTeamId ? (
              <Users className="h-3.5 w-3.5 shrink-0 text-[#2006F7] dark:text-[#00EDFF]" />
            ) : (
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__personal__">
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Personal
            </span>
          </SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#2006F7] dark:text-[#00EDFF]" />
                {t.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

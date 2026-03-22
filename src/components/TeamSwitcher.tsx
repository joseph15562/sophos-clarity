import { Users, User } from "lucide-react";
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
    <Select
      value={activeTeamId ?? "__personal__"}
      onValueChange={(v) => setActiveTeamId(v === "__personal__" ? null : v)}
    >
      <SelectTrigger className="h-8 w-auto min-w-[120px] max-w-[200px] rounded-lg text-xs font-medium gap-1.5 border-border/60 bg-card shrink-0">
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
        <SelectItem value="__personal__">Personal</SelectItem>
        {teams.map((t) => (
          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

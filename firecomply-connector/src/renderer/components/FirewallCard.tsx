import { StatusDot } from "./StatusDot";
import { ScoreBadge } from "./ScoreBadge";

interface Props {
  label: string;
  status: "idle" | "running" | "success" | "error";
  lastScore?: number;
  lastGrade?: string;
  lastRun?: string;
  error?: string;
  firmwareVersion?: string;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function FirewallCard({ label, status, lastScore, lastGrade, lastRun, error, firmwareVersion }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3">
        <StatusDot status={status} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{label}</p>
          <p className="text-[10px] text-muted-foreground">
            {status === "running" && "Analysing…"}
            {status === "error" && <span className="text-red-500">{error}</span>}
            {status === "success" && lastRun && `Last sync: ${timeAgo(lastRun)}`}
            {status === "idle" && "Waiting for first run"}
          </p>
        </div>
        {firmwareVersion && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {firmwareVersion}
          </span>
        )}
        {lastScore != null && lastGrade && (
          <ScoreBadge score={lastScore} grade={lastGrade} />
        )}
      </div>
    </div>
  );
}

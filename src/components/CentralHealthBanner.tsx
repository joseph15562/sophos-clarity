import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, WifiOff, Loader2 } from "lucide-react";
import { getCentralStatus } from "@/lib/sophos-central";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";

const STALE_MS = 48 * 3_600_000; // 48h without sync → stale

type HealthKind = "ok" | "disconnected" | "stale" | "error";

function classify(
  status: Awaited<ReturnType<typeof getCentralStatus>> | null,
  fetchError: boolean,
): HealthKind {
  if (fetchError) return "error";
  if (!status) return "ok";
  if (!status.connected) return "disconnected";
  if (!status.last_synced_at) return "stale";
  const age = Date.now() - new Date(status.last_synced_at).getTime();
  if (age > STALE_MS) return "stale";
  return "ok";
}

type Props = { orgId: string; className?: string };

export function CentralHealthBanner({ orgId, className = "" }: Props) {
  const [kind, setKind] = useState<HealthKind>("ok");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let err = false;
      let st: Awaited<ReturnType<typeof getCentralStatus>> | null = null;
      try {
        st = await getCentralStatus(orgId);
      } catch {
        err = true;
      }
      if (!cancelled) {
        setKind(classify(st, err));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading) {
    return (
      <div
        className={`mb-3 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground ${className}`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking Sophos Central connection…
      </div>
    );
  }

  if (kind === "ok") return null;

  const centralHref = `/?${buildManagePanelSearch({ panel: "settings", section: "central" })}`;

  const copy =
    kind === "disconnected"
      ? "Sophos Central is not connected — sync and inventory features need API credentials."
      : kind === "stale"
        ? "Sophos Central last synced more than 48 hours ago — refresh or check credentials."
        : "Could not verify Sophos Central status — try again or open settings.";

  return (
    <div
      className={`mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        kind === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      } ${className}`}
    >
      {kind === "disconnected" ? (
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="flex-1">{copy}</span>
      <Link to={centralHref} className="font-medium text-[#2006F7] underline dark:text-[#00EDFF]">
        Central settings
      </Link>
    </div>
  );
}

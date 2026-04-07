import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cloud } from "lucide-react";
import { getCentralStatus, type CentralStatus } from "@/lib/sophos-central";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";
import { warnOptionalError } from "@/lib/client-error-feedback";
import { FlowStatusCard } from "@/components/FlowStatusCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type Props = {
  orgId: string;
  className?: string;
  /**
   * When connected and healthy, show a compact “Connected to Sophos Central” strip
   * (matches the customer card pill on Customer Management). Default: hidden when OK.
   */
  showConnectedIndicator?: boolean;
};

function partnerLabel(st: CentralStatus): string | null {
  const t = st.partner_type;
  if (t === "partner") return "Partner API";
  if (t === "organization") return "Organization API";
  if (t === "tenant") return "Tenant API";
  return null;
}

function formatLastSync(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const a = Math.abs(diffSec);
  if (a < 60) return rtf.format(diffSec, "second");
  if (a < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (a < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  return d.toLocaleDateString();
}

export function CentralHealthBanner({
  orgId,
  className = "",
  showConnectedIndicator = false,
}: Props) {
  const [kind, setKind] = useState<HealthKind>("ok");
  const [loading, setLoading] = useState(true);
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [refetchTick, setRefetchTick] = useState(0);
  const [statusSnapshot, setStatusSnapshot] = useState<CentralStatus | null>(null);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorDetail(undefined);
      let err = false;
      let st: Awaited<ReturnType<typeof getCentralStatus>> | null = null;
      try {
        st = await getCentralStatus(orgId);
      } catch (e) {
        warnOptionalError("CentralHealthBanner.getCentralStatus", e);
        err = true;
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setErrorDetail(msg);
      }
      if (!cancelled) {
        setKind(classify(st, err));
        if (!err && st) setStatusSnapshot(st);
        else if (err) setStatusSnapshot(null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, refetchTick]);

  if (loading) {
    return (
      <FlowStatusCard
        variant="loading"
        title="Checking Sophos Central connection"
        description="Verifying API credentials and last sync time."
        className={className}
      />
    );
  }

  if (kind === "ok") {
    if (!showConnectedIndicator) return null;
    const pl = statusSnapshot ? partnerLabel(statusSnapshot) : null;
    const lastSync = statusSnapshot ? formatLastSync(statusSnapshot.last_synced_at) : null;
    const centralHref = `/?${buildManagePanelSearch({ panel: "settings", section: "central" })}`;
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-xs",
          "border-[#2006F7]/22 bg-[#2006F7]/[0.09] text-[#2006F7] dark:border-[#00EDFF]/28 dark:bg-[#009CFB]/[0.12] dark:text-[#7ae8ff]",
          className,
        )}
        role="status"
      >
        <span
          className="inline-flex items-center gap-1.5 font-semibold tracking-tight"
          title="This workspace is linked to Sophos Central — fleet data syncs from the API."
        >
          <Cloud className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden />
          Connected to Sophos Central
        </span>
        {pl ? (
          <span className="text-[11px] font-medium opacity-90 dark:opacity-95">{pl}</span>
        ) : null}
        {lastSync ? (
          <span className="text-[11px] text-[#2006F7]/80 dark:text-[#7ae8ff]/85">
            Last sync {lastSync}
          </span>
        ) : null}
        <Button variant="outline" size="sm" className="ml-auto h-7 text-[11px]" asChild>
          <Link to={centralHref}>Central settings</Link>
        </Button>
      </div>
    );
  }

  const centralHref = `/?${buildManagePanelSearch({ panel: "settings", section: "central" })}`;
  const settingsLink = (
    <Button variant="outline" size="sm" className="h-8" asChild>
      <Link to={centralHref}>Open Central settings</Link>
    </Button>
  );

  if (kind === "error") {
    return (
      <FlowStatusCard
        variant="error"
        title="Could not verify Sophos Central"
        description="The status check failed. Confirm network access and try again, or open Central settings."
        errorDetail={errorDetail}
        onRetry={refetch}
        retryLabel="Check again"
        footerSlot={settingsLink}
        className={className}
      />
    );
  }

  const copy =
    kind === "disconnected"
      ? "Sophos Central is not connected — sync and inventory features need API credentials."
      : "Sophos Central last synced more than 48 hours ago — refresh or check credentials.";

  return (
    <FlowStatusCard
      variant="error"
      tone="warning"
      title={
        kind === "disconnected" ? "Sophos Central not connected" : "Sophos Central sync is stale"
      }
      description={copy}
      showTrustLink={false}
      footerSlot={settingsLink}
      onRetry={refetch}
      retryLabel="Recheck status"
      className={className}
    />
  );
}

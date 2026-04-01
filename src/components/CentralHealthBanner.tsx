import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCentralStatus } from "@/lib/sophos-central";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";
import { warnOptionalError } from "@/lib/client-error-feedback";
import { FlowStatusCard } from "@/components/FlowStatusCard";
import { Button } from "@/components/ui/button";

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
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [refetchTick, setRefetchTick] = useState(0);

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

  if (kind === "ok") return null;

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

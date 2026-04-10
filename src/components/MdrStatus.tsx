import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";

interface MdrIndicator {
  indicator: string;
  type: string;
}

interface FileItem {
  label: string;
  centralEnrichment?: {
    alerts?: unknown[];
    mdrFeed?: MdrIndicator[];
  };
}

interface MdrStatusProps {
  analysisResults: Record<string, AnalysisResult>;
  files: FileItem[];
}

function StatusCircle({ status }: { status: "green" | "amber" | "red" }) {
  const colors = {
    green: "bg-[#00F2B3]",
    amber: "bg-[#F29400]",
    red: "bg-[#EA0022]",
  };
  return (
    <div
      className={`h-4 w-4 rounded-full ${colors[status]} ring-4 ring-offset-2 ring-offset-card`}
      style={{
        boxShadow: `0 0 0 2px var(--card)`,
      }}
    />
  );
}

export function MdrStatus({ analysisResults, files }: MdrStatusProps) {
  const perFileData = useMemo(() => {
    return files.map((file) => {
      const result = analysisResults[file.label];
      const mdr = result?.threatStatus?.mdr;
      const mdrFeed = file.centralEnrichment?.mdrFeed ?? [];
      const hasMdrConfig = mdr != null;
      const enabled = mdr?.enabled ?? false;
      const connected = mdr?.connected ?? false;
      const policy = mdr?.policy ?? "—";

      let status: "green" | "amber" | "red" = "red";
      if (enabled && connected) status = "green";
      else if (enabled) status = "amber";

      return {
        label: file.label,
        enabled,
        connected,
        policy,
        status,
        mdrFeedCount: mdrFeed.length,
        hasMdrConfig,
      };
    });
  }, [analysisResults, files]);

  const hasAnyMdrData = perFileData.some((d) => d.hasMdrConfig || d.mdrFeedCount > 0);

  if (!hasAnyMdrData) {
    return (
      <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          MDR Integration
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          MDR status not available. Check firewall configuration.
        </p>
      </div>
    );
  }

  const singleFile = perFileData.length === 1;
  const primary = perFileData[0];

  return (
    <div className="rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        MDR Integration
      </h3>

      {singleFile ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <StatusCircle status={primary.status} />
            <span className="text-sm text-foreground">
              {primary.status === "green"
                ? "Enabled & connected"
                : primary.status === "amber"
                  ? "Enabled, check connection"
                  : "Not configured"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Enabled:</span>
            <span>{primary.enabled ? "Yes" : "No"}</span>
            <span className="text-muted-foreground">Connected:</span>
            <span>{primary.connected ? "Yes" : "No"}</span>
            <span className="text-muted-foreground">Policy:</span>
            <span>{primary.policy}</span>
          </div>
          {primary.mdrFeedCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {primary.mdrFeedCount} threat indicator{primary.mdrFeedCount !== 1 ? "s" : ""} active
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {perFileData.map((d) => (
            <div
              key={d.label}
              className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
            >
              <div className="flex items-center gap-2">
                <StatusCircle status={d.status} />
                <span className="text-sm font-medium">{d.label}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Enabled: {d.enabled ? "Yes" : "No"}</span>
                <span>Connected: {d.connected ? "Yes" : "No"}</span>
                {d.mdrFeedCount > 0 && <span>{d.mdrFeedCount} indicators</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

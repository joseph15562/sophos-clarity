/**
 * Latest connector release the UI recommends. Set in env to flag outdated agents in Fleet / API hub.
 * Agent sends `connector_version` on POST /heartbeat (api-agent).
 */
export function getLatestConnectorVersion(): string {
  const v = import.meta.env.VITE_CONNECTOR_VERSION_LATEST;
  return typeof v === "string" && v.trim() ? v.trim() : "1.0.0";
}

/** True when agent reported a version string that differs from the configured latest (simple string equality). */
export function isConnectorVersionOutdated(reported: string | null | undefined): boolean {
  const latest = getLatestConnectorVersion();
  const r = reported?.trim();
  if (!r) return false;
  return r !== latest;
}

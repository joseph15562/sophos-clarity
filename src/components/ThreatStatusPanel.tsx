import { Shield, Activity, Wifi, WifiOff, AlertTriangle, Radio, Satellite, Rss } from "lucide-react";

export interface ThreatStatusData {
  firmwareVersion: string;
  atp: { enabled: boolean; policy: string; inspectContent: string } | null;
  mdr: { enabled: boolean; policy: string; connected: boolean } | null;
  ndr: {
    enabled: boolean;
    interfaces: string[];
    dataCenter: string;
    minThreatScore: string;
    iocCount?: number;
  } | null;
  thirdPartyFeeds: Array<{
    name: string;
    syncStatus: string;
    lastSync?: string;
  }> | null;
  collectedAt: string;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${active ? "bg-[#00995a]" : "bg-[#EA0022]"}`} />
  );
}

function UnavailableCard({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 opacity-60">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">{title}</span>
      </div>
      <p className="text-[9px] text-muted-foreground mt-1">{reason}</p>
    </div>
  );
}

function FirmwareBadge({ version }: { version: string }) {
  const major = parseFloat(version.replace(/^v/i, ""));
  const color =
    major >= 22
      ? "bg-[#00995a]/10 text-[#00995a] dark:text-[#00F2B3] border-[#00995a]/20"
      : major >= 19
        ? "bg-[#F29400]/10 text-[#F29400] border-[#F29400]/20"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      SFOS {version}
    </span>
  );
}

export function ThreatStatusPanel({ data }: { data: ThreatStatusData }) {
  const collectedDate = new Date(data.collectedAt);
  const fwMajor = parseFloat(data.firmwareVersion.replace(/^v/i, ""));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#6B5BFF]" />
          <span className="text-xs font-semibold text-foreground">Threat Protection Status</span>
        </div>
        <FirmwareBadge version={data.firmwareVersion} />
      </div>
      <p className="text-[9px] text-muted-foreground">
        Collected {collectedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} at {collectedDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </p>

      {/* ATP */}
      {data.atp ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot active={data.atp.enabled} />
            <Activity className="h-3.5 w-3.5 text-[#F29400]" />
            <span className="text-[11px] font-medium text-foreground">Sophos X-Ops Active Threat Response</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 text-[10px] pl-5">
            <div><span className="text-muted-foreground">Status:</span> <span className="font-medium text-foreground">{data.atp.enabled ? "Enabled" : "Disabled"}</span></div>
            <div><span className="text-muted-foreground">Policy:</span> <span className="font-medium text-foreground">{data.atp.policy}</span></div>
            <div><span className="text-muted-foreground">Inspect:</span> <span className="font-medium text-foreground">{data.atp.inspectContent}</span></div>
          </div>
        </div>
      ) : fwMajor < 19 ? (
        <UnavailableCard title="Sophos X-Ops ATP" reason="Not available on v18 — requires v19+" />
      ) : null}

      {/* MDR */}
      {data.mdr ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot active={data.mdr.enabled} />
            <Satellite className="h-3.5 w-3.5 text-[#009CFB]" />
            <span className="text-[11px] font-medium text-foreground">MDR Threat Feed</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 text-[10px] pl-5">
            <div><span className="text-muted-foreground">Status:</span> <span className="font-medium text-foreground">{data.mdr.enabled ? "Enabled" : "Disabled"}</span></div>
            <div>
              <span className="text-muted-foreground">Connection:</span>{" "}
              <span className={`font-medium ${data.mdr.connected ? "text-[#00995a] dark:text-[#00F2B3]" : "text-[#EA0022]"}`}>
                {data.mdr.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      ) : fwMajor < 21 ? (
        <UnavailableCard title="MDR Threat Feed" reason="Requires v21+" />
      ) : null}

      {/* NDR */}
      {data.ndr ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot active={data.ndr.enabled} />
            <Radio className="h-3.5 w-3.5 text-[#2006F7]" />
            <span className="text-[11px] font-medium text-foreground">NDR Essentials</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 text-[10px] pl-5">
            <div><span className="text-muted-foreground">Status:</span> <span className="font-medium text-foreground">{data.ndr.enabled ? "Enabled" : "Disabled"}</span></div>
            <div><span className="text-muted-foreground">Interfaces:</span> <span className="font-medium text-foreground">{data.ndr.interfaces.join(", ") || "None"}</span></div>
            <div><span className="text-muted-foreground">Data Center:</span> <span className="font-medium text-foreground">{data.ndr.dataCenter || "—"}</span></div>
            <div><span className="text-muted-foreground">Min Threat Score:</span> <span className="font-medium text-foreground">{data.ndr.minThreatScore || "—"}</span></div>
            {data.ndr.iocCount != null && (
              <div><span className="text-muted-foreground">IoC Count:</span> <span className="font-medium text-foreground">{data.ndr.iocCount}</span></div>
            )}
          </div>
        </div>
      ) : fwMajor < 21.5 ? (
        <UnavailableCard title="NDR Essentials" reason="Requires v21.5+ on XGS hardware" />
      ) : null}

      {/* Third-party feeds */}
      {data.thirdPartyFeeds ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Rss className="h-3.5 w-3.5 text-[#6B5BFF]" />
            <span className="text-[11px] font-medium text-foreground">Third-Party Threat Feeds</span>
          </div>
          {data.thirdPartyFeeds.length === 0 ? (
            <p className="text-[10px] text-muted-foreground pl-5">No feeds configured</p>
          ) : (
            <div className="space-y-1 pl-5">
              {data.thirdPartyFeeds.map((feed, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <StatusDot active={feed.syncStatus.toLowerCase() === "success"} />
                  <span className="font-medium text-foreground flex-1 truncate">{feed.name}</span>
                  <span className="text-muted-foreground">{feed.syncStatus}</span>
                  {feed.lastSync && <span className="text-muted-foreground">{feed.lastSync}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : fwMajor < 21 ? (
        <UnavailableCard title="Third-Party Feeds" reason="Requires v21+" />
      ) : null}
    </div>
  );
}

import { useMemo } from "react";
import { AlertTriangle, CheckCircle, Server } from "lucide-react";

interface FileItem {
  label: string;
  centralEnrichment?: {
    firmware?: string;
    model?: string;
  };
}

interface FirmwareTrackerProps {
  files: FileItem[];
}

export function FirmwareTracker({ files }: FirmwareTrackerProps) {
  const firmwareData = useMemo(() => {
    return files.map((file) => ({
      label: file.label,
      model: file.centralEnrichment?.model ?? "—",
      firmware: file.centralEnrichment?.firmware ?? "—",
      hasData: Boolean(file.centralEnrichment?.firmware || file.centralEnrichment?.model),
    }));
  }, [files]);

  const hasAnyFirmwareData = firmwareData.some((d) => d.hasData);

  if (!hasAnyFirmwareData) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Server className="h-4 w-4" />
          Firmware Status
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          Connect to Sophos Central to see firmware status
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground flex items-center gap-2 mb-4">
        <Server className="h-4 w-4" />
        Firmware Status
      </h3>

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/30">
            <th className="text-left py-2 font-medium text-muted-foreground">Firewall</th>
            <th className="text-left py-2 font-medium text-muted-foreground">Model</th>
            <th className="text-left py-2 font-medium text-muted-foreground">Firmware</th>
            <th className="text-left py-2 font-medium text-muted-foreground w-8">Status</th>
          </tr>
        </thead>
        <tbody>
          {firmwareData.map((row) => {
            const isLatest = row.firmware !== "—";
            const updateAvailable = false;
            return (
              <tr key={row.label} className="border-b border-border/30">
                <td className="py-2 text-foreground">{row.label}</td>
                <td className="py-2 text-muted-foreground">{row.model}</td>
                <td className="py-2 text-foreground font-mono">{row.firmware}</td>
                <td className="py-2">
                  {updateAvailable ? (
                    <AlertTriangle
                      className="h-4 w-4 text-[#F29400]"
                      aria-label="Update available"
                    />
                  ) : isLatest ? (
                    <CheckCircle className="h-4 w-4 text-[#00F2B3]" aria-label="Latest" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-4 text-xs text-muted-foreground">
        Check Sophos Central for latest firmware versions
      </p>
    </div>
  );
}

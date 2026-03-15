import { useState } from "react";
import { ProtocolDistribution } from "./ProtocolDistribution";
import { ServiceUsage } from "./ServiceUsage";
import type { ParsedFile } from "@/hooks/use-report-generation";

interface Props {
  files: ParsedFile[];
}

export function ProtocolServiceWidget({ files }: Props) {
  const [view, setView] = useState<"protocols" | "services">("protocols");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setView("protocols")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "protocols"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Protocol Distribution
        </button>
        <button
          onClick={() => setView("services")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "services"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Service Usage
        </button>
      </div>
      {view === "protocols" ? (
        <ProtocolDistribution files={files} />
      ) : (
        <ServiceUsage files={files} />
      )}
    </div>
  );
}

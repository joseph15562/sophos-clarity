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
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 sm:p-6 space-y-4 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(32,6,247,0.05), rgba(0,156,251,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(32,6,247,0.2), rgba(0,156,251,0.12), transparent)",
        }}
      />
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => setView("protocols")}
          className="px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer"
          style={
            view === "protocols"
              ? {
                  background:
                    "linear-gradient(145deg, rgba(56,136,255,0.18), rgba(0,156,251,0.08))",
                  color: "rgba(255,255,255,0.92)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)",
                }
              : { color: "rgba(255,255,255,0.45)" }
          }
        >
          Protocol Distribution
        </button>
        <button
          onClick={() => setView("services")}
          className="px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer"
          style={
            view === "services"
              ? {
                  background:
                    "linear-gradient(145deg, rgba(56,136,255,0.18), rgba(0,156,251,0.08))",
                  color: "rgba(255,255,255,0.92)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)",
                }
              : { color: "rgba(255,255,255,0.45)" }
          }
        >
          Service Usage
        </button>
      </div>
      <div className="min-h-[280px] flex flex-col">
        {view === "protocols" ? (
          <ProtocolDistribution files={files} />
        ) : (
          <ServiceUsage files={files} />
        )}
      </div>
    </div>
  );
}

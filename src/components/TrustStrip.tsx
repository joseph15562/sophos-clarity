import { Shield, Cpu, FileCheck2, Lock, Clock } from "lucide-react";

export function TrustStrip() {
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 px-5 py-3">
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Cpu className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF]" />
          Client-side extraction — config never leaves your browser
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Shield className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF]" />
          Deterministic findings before AI
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Lock className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF]" />
          Full data anonymisation
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <FileCheck2 className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF]" />
          Export-ready reports in seconds
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Clock className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF]" />
          Hours of manual review → minutes
        </span>
      </div>
    </div>
  );
}

import { Shield, Cpu, FileCheck2, Lock, Clock, Gauge } from "lucide-react";

export function TrustStrip() {
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 px-5 py-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[#2006F7]/15 bg-[#2006F7]/[0.04] px-3 py-2 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Manual review</p>
          <p className="text-lg font-black text-foreground mt-0.5">3–4 hours</p>
        </div>
        <div className="rounded-xl border border-[#00F2B3]/20 bg-[#00F2B3]/[0.05] px-3 py-2 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">With FireComply</p>
          <p className="text-lg font-black text-[#00774a] dark:text-[#00F2B3] mt-0.5">Under 2 minutes</p>
        </div>
        <div className="rounded-xl border border-border bg-card/70 px-3 py-2 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Effort saved</p>
          <p className="text-lg font-black text-foreground mt-0.5">90%+</p>
        </div>
      </div>

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
          <Gauge className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF]" />
          Evidence-backed posture scoring
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Clock className="h-3 w-3 text-[#2006F7] dark:text-[#00EDFF]" />
          Hours of manual review → minutes
        </span>
      </div>
    </div>
  );
}

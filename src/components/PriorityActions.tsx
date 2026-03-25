import { useMemo, useState, useEffect } from "react";
import type { AnalysisResult, Finding, Severity } from "@/lib/analyse-config";
import { loadAcceptedFindings, isAccepted, type AcceptedFinding } from "@/lib/accepted-findings";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const SEVERITY_STYLE: Record<Severity, { bg: string; text: string }> = {
  critical: { bg: "bg-[#EA0022]/10", text: "text-[#EA0022]" },
  high: { bg: "bg-[#F29400]/10", text: "text-[#c47800] dark:text-[#F29400]" },
  medium: { bg: "bg-[#F8E300]/10", text: "text-[#b8a200] dark:text-[#F8E300]" },
  low: {
    bg: "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10",
    text: "text-[#007A5A] dark:text-[#00F2B3]",
  },
  info: { bg: "bg-[#009CFB]/10", text: "text-[#0077cc] dark:text-[#009CFB]" },
};

function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "…";
}

export function PriorityActions({ analysisResults }: Props) {
  const [acceptedList, setAcceptedList] = useState<AcceptedFinding[]>([]);

  useEffect(() => {
    loadAcceptedFindings().then(setAcceptedList);
    const refresh = () => loadAcceptedFindings().then(setAcceptedList);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "sophos-accepted-findings") refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("accepted-findings-changed", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("accepted-findings-changed", refresh);
    };
  }, []);

  const top3 = useMemo(() => {
    const all: (Finding & { firewall: string })[] = [];
    for (const [label, ar] of Object.entries(analysisResults)) {
      for (const f of ar.findings) {
        if (isAccepted(acceptedList, f.title)) continue;
        all.push({ ...f, firewall: label });
      }
    }
    const highOrCritical = all.filter((f) => f.severity === "critical" || f.severity === "high");
    if (highOrCritical.length === 0) return [];

    const sorted = [...highOrCritical].sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      const aLen = (a.remediation ?? "").length;
      const bLen = (b.remediation ?? "").length;
      return aLen - bLen;
    });
    return sorted.slice(0, 3);
  }, [analysisResults, acceptedList]);

  if (top3.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-border/50 bg-card p-5 shadow-card"
      data-tour="priority-actions"
    >
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">
        Priority Actions
      </h3>
      <div className="space-y-3">
        {top3.map((f, i) => {
          const style = SEVERITY_STYLE[f.severity];
          return (
            <div
              key={`${f.id}-${f.firewall}-${i}`}
              className="flex items-start gap-3 rounded-lg border border-border bg-muted/5 px-3 py-2.5"
            >
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${style.bg} ${style.text}`}
              >
                {f.severity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{f.title}</p>
                {f.remediation && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {truncate(f.remediation, 120)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ReportUpsellStripProps {
  fileCount: number;
  averageScore?: number;
  hasComplianceFrameworks: boolean;
  isGuest: boolean;
}

type RuleId = "single-firewall" | "compliance-frameworks" | "low-score";

function dismissKey(ruleId: RuleId): string {
  return `firecomply-upsell-dismiss-${ruleId}`;
}

function readDismissed(ruleId: RuleId): boolean {
  try {
    return localStorage.getItem(dismissKey(ruleId)) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(ruleId: RuleId): void {
  try {
    localStorage.setItem(dismissKey(ruleId), "1");
  } catch {
    /* ignore */
  }
}

export function ReportUpsellStrip({
  fileCount,
  averageScore,
  hasComplianceFrameworks,
  isGuest,
}: ReportUpsellStripProps) {
  const [dismissed, setDismissed] = useState<Partial<Record<RuleId, boolean>>>({});

  const activeRule = useMemo((): { id: RuleId; message: string } | null => {
    if (isGuest) return null;

    const isRuleDismissed = (id: RuleId) => dismissed[id] || readDismissed(id);

    if (fileCount === 1 && !isRuleDismissed("single-firewall")) {
      return { id: "single-firewall", message: "Add a second firewall to unlock the Executive Summary." };
    }
    if (fileCount >= 2 && !hasComplianceFrameworks && !isRuleDismissed("compliance-frameworks")) {
      return {
        id: "compliance-frameworks",
        message: "Select compliance frameworks in Assessment Context to generate a Compliance Report.",
      };
    }
    if (averageScore !== undefined && averageScore < 75 && !isRuleDismissed("low-score")) {
      return {
        id: "low-score",
        message: "Score below 75 — an Executive + Compliance report helps prioritise remediation for leadership.",
      };
    }
    return null;
  }, [isGuest, fileCount, hasComplianceFrameworks, averageScore, dismissed]);

  const handleDismiss = useCallback((id: RuleId) => {
    writeDismissed(id);
    setDismissed((prev) => ({ ...prev, [id]: true }));
  }, []);

  if (!activeRule) return null;

  return (
    <div className="w-full rounded-xl border border-border bg-card px-4 py-2.5 flex items-center gap-3">
      <Info className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
      <p className="text-xs sm:text-sm text-foreground flex-1 min-w-0 leading-snug">{activeRule.message}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        onClick={() => handleDismiss(activeRule.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

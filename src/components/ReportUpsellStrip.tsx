"use client";

import { useCallback, useMemo, useState } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { warnOptionalError } from "@/lib/client-error-feedback";

export interface ReportUpsellStripProps {
  fileCount: number;
  averageScore?: number;
  hasComplianceFrameworks: boolean;
  isGuest: boolean;
}

type RuleId = "guest" | "single-firewall" | "compliance-frameworks" | "low-score";

function dismissKey(ruleId: RuleId): string {
  return `firecomply-upsell-dismiss-${ruleId}`;
}

function readDismissed(ruleId: RuleId): boolean {
  try {
    return localStorage.getItem(dismissKey(ruleId)) === "1";
  } catch (e) {
    warnOptionalError("ReportUpsellStrip.readDismissed", e);
    return false;
  }
}

function writeDismissed(ruleId: RuleId): void {
  try {
    localStorage.setItem(dismissKey(ruleId), "1");
  } catch (e) {
    warnOptionalError("ReportUpsellStrip.writeDismissed", e);
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
    const isRuleDismissed = (id: RuleId) => dismissed[id] || readDismissed(id);

    if (isGuest) {
      if (!isRuleDismissed("guest")) {
        return {
          id: "guest",
          message: "Sign in or create an account to save reports and unlock the Executive Summary.",
        };
      }
      return null;
    }

    if (fileCount === 1 && !isRuleDismissed("single-firewall")) {
      return {
        id: "single-firewall",
        message: "Add a second firewall to unlock the Executive Summary.",
      };
    }
    if (fileCount >= 2 && !hasComplianceFrameworks && !isRuleDismissed("compliance-frameworks")) {
      return {
        id: "compliance-frameworks",
        message:
          "Select compliance frameworks in Assessment Context to generate a Compliance Report.",
      };
    }
    if (averageScore !== undefined && averageScore < 75 && !isRuleDismissed("low-score")) {
      return {
        id: "low-score",
        message:
          "Score below 75 — an Executive + Compliance report helps prioritise remediation for leadership.",
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
    <div
      className="relative overflow-hidden w-full rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-3 flex items-center gap-3 shadow-card transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{ background: "linear-gradient(135deg, rgba(32,6,247,0.07), rgba(32,6,247,0.02))" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-4 -left-4 h-12 w-12 rounded-full blur-[24px] opacity-20 bg-brand-accent" />
      </div>
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(32,6,247,0.2), transparent)",
        }}
      />
      <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-brand-accent/20 bg-brand-accent/10 shrink-0">
        <Info className="h-3.5 w-3.5 text-brand-accent" aria-hidden />
      </div>
      <p className="relative text-xs sm:text-sm font-medium text-foreground flex-1 min-w-0 leading-snug">
        {activeRule.message}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        onClick={() => handleDismiss(activeRule.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

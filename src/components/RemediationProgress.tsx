import { useState, useEffect, useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { generatePlaybook } from "@/lib/remediation-playbooks";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = ((h << 5) - h + c) | 0;
  }
  return Math.abs(h).toString(36);
}

function getCustomerHash(analysisResults: Record<string, AnalysisResult>): string {
  const ids: string[] = [];
  for (const result of Object.values(analysisResults)) {
    for (const f of result.findings) ids.push(f.id);
  }
  ids.sort();
  return simpleHash(ids.join(","));
}

async function loadCompleted(customerHash: string): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: orgData } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (orgData?.org_id) {
      const { data } = await supabase
        .from("remediation_status")
        .select("playbook_id")
        .eq("org_id", orgData.org_id)
        .eq("customer_hash", customerHash);
      if (data) return new Set(data.map((r) => r.playbook_id));
    }
  }
  try {
    const raw = localStorage.getItem(`firecomply_remediation_${customerHash}`);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Set();
}

interface CategoryProgress {
  section: string;
  total: number;
  completed: number;
  estimatedMinutesRemaining: number;
}

export function RemediationProgress({ analysisResults }: Props) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const customerHash = useMemo(() => getCustomerHash(analysisResults), [analysisResults]);

  useEffect(() => {
    let cancelled = false;
    loadCompleted(customerHash).then((ids) => {
      if (!cancelled) setCompleted(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [customerHash]);

  const { playbooks, bySection, totalCompleted, totalFindings, hoursRemaining } = useMemo(() => {
    const list: { findingId: string; title: string; section: string; estimatedMinutes: number }[] = [];
    for (const result of Object.values(analysisResults)) {
      for (const finding of result.findings) {
        const pb = generatePlaybook(finding);
        if (pb) {
          list.push({
            findingId: pb.findingId,
            title: pb.title,
            section: finding.section,
            estimatedMinutes: pb.estimatedMinutes,
          });
        }
      }
    }

    const bySection = new Map<string, CategoryProgress>();
    for (const pb of list) {
      const section = pb.section || "Other";
      const existing = bySection.get(section);
      const isDone = completed.has(pb.findingId);
      if (existing) {
        existing.total++;
        if (isDone) existing.completed++;
        if (!isDone) existing.estimatedMinutesRemaining += pb.estimatedMinutes;
      } else {
        bySection.set(section, {
          section,
          total: 1,
          completed: isDone ? 1 : 0,
          estimatedMinutesRemaining: isDone ? 0 : pb.estimatedMinutes,
        });
      }
    }

    const totalCompleted = list.filter((p) => completed.has(p.findingId)).length;
    const totalFindings = list.length;
    const hoursRemaining = list
      .filter((p) => !completed.has(p.findingId))
      .reduce((s, p) => s + p.estimatedMinutes, 0) / 60;

    return {
      playbooks: list,
      bySection: Array.from(bySection.values()).sort((a, b) => b.total - a.total),
      totalCompleted,
      totalFindings,
      hoursRemaining,
    };
  }, [analysisResults, completed]);

  if (playbooks.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card" data-tour="remediation-progress">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-2">Remediation Progress</h3>
        <p className="text-sm text-muted-foreground">No findings to remediate</p>
      </div>
    );
  }

  const pct = totalFindings > 0 ? Math.round((100 * totalCompleted) / totalFindings) : 0;
  const weeksEstimate = hoursRemaining > 0 ? Math.ceil(hoursRemaining / 8) : 0;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card" data-tour="remediation-progress">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground mb-4">Remediation Progress</h3>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">
            {totalCompleted} of {totalFindings} findings resolved ({pct}%)
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: pct >= 100 ? "#00F2B3" : pct > 0 ? "#F29400" : "#EA0022",
            }}
          />
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {bySection.map((cat) => {
          const catPct = cat.total > 0 ? Math.round((100 * cat.completed) / cat.total) : 0;
          const fillColor = catPct >= 100 ? "#00F2B3" : catPct > 0 ? "#F29400" : "#EA0022";
          return (
            <div key={cat.section}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-foreground">{cat.section}</span>
                <span className="text-muted-foreground">
                  {cat.completed} of {cat.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${catPct}%`, backgroundColor: fillColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          Estimated <span className="font-semibold text-foreground">{hoursRemaining.toFixed(1)}</span> hours
          remaining
        </p>
        {weeksEstimate > 0 && (
          <p>At current pace, all findings will be resolved in ~{weeksEstimate} weeks</p>
        )}
      </div>
    </div>
  );
}

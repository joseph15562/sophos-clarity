import { useEffect, useState, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";
import { trackProductEvent } from "@/lib/product-telemetry";
import { warnOptionalError } from "@/lib/client-error-feedback";
import { useMspSetupStatusQuery } from "@/hooks/queries/use-msp-setup-status-query";

const DISMISS_KEY = "firecomply-msp-checklist-dismissed";

type Props = {
  orgId: string;
  canManage: boolean;
};

export function MspSetupChecklist({ orgId, canManage }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch (e) {
      warnOptionalError("MspSetupChecklist.readDismissed", e);
      return false;
    }
  });
  const statusQuery = useMspSetupStatusQuery(orgId);
  const centralOk = statusQuery.data?.centralOk ?? false;
  const agentCount = statusQuery.data?.agentCount ?? 0;
  const assessmentCount = statusQuery.data?.assessmentCount ?? 0;
  const portalSlugOk = statusQuery.data?.portalSlugOk ?? false;
  const loading = statusQuery.isPending;
  const prevAgentCount = useRef(0);
  const checklistCompleteFired = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (agentCount > 0 && prevAgentCount.current === 0) {
      trackProductEvent("first_agent_registered", { orgId });
    }
    prevAgentCount.current = agentCount;
  }, [loading, agentCount, orgId]);

  const allDone = centralOk && agentCount > 0 && assessmentCount > 0 && portalSlugOk;

  useEffect(() => {
    if (loading || !allDone || checklistCompleteFired.current) return;
    checklistCompleteFired.current = true;
    trackProductEvent("msp_checklist_complete", { orgId });
  }, [loading, allDone, orgId]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch (e) {
      warnOptionalError("MspSetupChecklist.dismiss", e);
    }
    trackProductEvent("msp_checklist_dismissed", { orgId });
    setDismissed(true);
  };

  if (!canManage || dismissed || loading || allDone) return null;

  const centralSearch = buildManagePanelSearch({ panel: "settings", section: "central" });
  const agentsSearch = buildManagePanelSearch({ panel: "settings", section: "agents" });
  const portalSearch = buildManagePanelSearch({ panel: "settings", section: "portal" });

  const Row = ({ done, label, cta }: { done: boolean; label: string; cta: ReactNode }) => (
    <li className="flex flex-wrap items-start gap-2 py-1.5 text-sm">
      {done ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#007A5A] dark:text-[#00F2B3]" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <span
          className={done ? "text-muted-foreground line-through" : "font-medium text-foreground"}
        >
          {label}
        </span>
        {!done && <div className="mt-1">{cta}</div>}
      </div>
    </li>
  );

  return (
    <div className="mb-4 rounded-xl border border-[#2006F7]/25 bg-[#2006F7]/5 p-4 dark:border-[#00EDFF]/20 dark:bg-[#00EDFF]/5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">First-time setup</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={dismiss}
        >
          <X className="h-3 w-3" />
          Dismiss
        </Button>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Complete these once so assessments, agents, and the client portal work end-to-end.
      </p>
      <ul className="divide-y divide-border/50">
        <Row
          done={centralOk}
          label="Connect Sophos Central API"
          cta={
            <Link
              to={{ pathname: "/", search: centralSearch }}
              className="text-xs font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
            >
              Open Central settings
            </Link>
          }
        />
        <Row
          done={agentCount > 0}
          label="Register a connector agent"
          cta={
            <Link
              to={{ pathname: "/", search: agentsSearch }}
              className="text-xs font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
            >
              Open agent settings
            </Link>
          }
        />
        <Row
          done={assessmentCount > 0}
          label="Save your first assessment to the cloud"
          cta={
            <span className="text-xs text-muted-foreground">
              Upload a config, run analysis, then use <strong>Save assessment</strong> in History.
            </span>
          }
        />
        <Row
          done={portalSlugOk}
          label="Set a client portal slug"
          cta={
            <Link
              to={{ pathname: "/", search: portalSearch }}
              className="text-xs font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
            >
              Open portal settings
            </Link>
          }
        />
      </ul>
    </div>
  );
}

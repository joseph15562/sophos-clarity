import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { buildManagePanelSearch, type ManageSettingsSection } from "@/lib/workspace-deeplink";

/** Opens Assess with management drawer (same contract as ApiHub). */
export function WorkspacePanelLink({
  section,
  children,
  className = "font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]",
}: {
  section?: ManageSettingsSection;
  children: ReactNode;
  className?: string;
}) {
  const search = buildManagePanelSearch({ panel: "settings", section });
  return (
    <Link to={{ pathname: "/", search }} className={className}>
      {children}
    </Link>
  );
}

const stripClass =
  "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground";

type StripVariant = "fleet" | "customers" | "insights";

/** Compact “open workspace settings” row for non-Assess routes. */
export function WorkspaceSettingsStrip({ variant }: { variant: StripVariant }) {
  const central = <WorkspacePanelLink section="central">Sophos Central</WorkspacePanelLink>;
  const agents = <WorkspacePanelLink section="agents">Connector agents</WorkspacePanelLink>;
  const webhooks = <WorkspacePanelLink section="webhooks">Webhooks</WorkspacePanelLink>;

  let middle: ReactNode;
  if (variant === "fleet") {
    middle = (
      <>
        {central} · {agents} · {webhooks}
      </>
    );
  } else if (variant === "customers") {
    middle = (
      <>
        {central} · <WorkspacePanelLink section="portal">Client portal</WorkspacePanelLink> ·{" "}
        {agents}
      </>
    );
  } else {
    middle = (
      <>
        {central} · {webhooks} ·{" "}
        <WorkspacePanelLink section="report-template">Report template</WorkspacePanelLink>
      </>
    );
  }

  return (
    <div className={stripClass}>
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <Settings2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
        Workspace settings
      </span>
      <span className="hidden sm:inline text-border">|</span>
      <span>{middle}</span>
      <span className="text-[10px] text-foreground/75 dark:text-muted-foreground">
        Opens on Assess
      </span>
    </div>
  );
}

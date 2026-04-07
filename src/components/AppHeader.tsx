import type { ReactNode } from "react";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { displayCustomerNameForUi } from "@/lib/sophos-central";
import { useAuth } from "@/hooks/use-auth";

interface AppHeaderProps {
  hasFiles: boolean;
  fileCount: number;
  customerName: string;
  environment: string;
  selectedFrameworks: string[];
  reportCount: number;
  notificationSlot?: ReactNode;
  onOrgClick?: () => void;
  localMode?: boolean;
}

export function AppHeader({
  hasFiles,
  fileCount,
  customerName,
  environment,
  selectedFrameworks,
  reportCount,
  notificationSlot,
  onOrgClick,
  localMode,
}: AppHeaderProps) {
  const { org, isGuest } = useAuth();

  const showContext = hasFiles || customerName || selectedFrameworks.length > 0;
  const loginShell = isGuest && !showContext;
  const customerLabel = customerName ? displayCustomerNameForUi(customerName, org?.name) : "";

  return (
    <>
      <FireComplyWorkspaceHeader
        localMode={localMode}
        onOrgClick={onOrgClick}
        notificationSlot={notificationSlot}
        loginShell={loginShell}
      />

      <WorkspacePrimaryNav />

      {showContext && (
        <div className="border-b border-border/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(180deg,rgba(11,16,28,0.92),rgba(14,20,34,0.92))] no-print hidden sm:block backdrop-blur-sm">
          <div className="max-w-[1320px] mx-auto px-4 md:px-6 py-2 flex items-center gap-4 text-[11px] text-muted-foreground overflow-x-auto">
            {customerName &&
              (onOrgClick ? (
                <button
                  type="button"
                  onClick={onOrgClick}
                  className="flex items-center gap-1.5 shrink-0 rounded-full border border-border/50 bg-card/70 px-2.5 py-1 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                  title={
                    customerLabel !== customerName
                      ? `Customer in data: ${customerName}. Click to open workspace controls.`
                      : "Open workspace controls — customer & scope"
                  }
                >
                  <span className="font-semibold text-foreground">{customerLabel}</span>
                  {environment && <span className="opacity-60">· {environment}</span>}
                </button>
              ) : (
                <span
                  className="flex items-center gap-1.5 shrink-0 rounded-full border border-border/50 bg-card/70 px-2.5 py-1"
                  title={
                    customerLabel !== customerName ? `Customer in data: ${customerName}` : undefined
                  }
                >
                  <span className="font-semibold text-foreground">{customerLabel}</span>
                  {environment && <span className="opacity-60">· {environment}</span>}
                </span>
              ))}
            {hasFiles && (
              <span className="flex items-center gap-1 shrink-0 rounded-full border border-[#008F69]/30 dark:border-[#00F2B3]/20 bg-[#00F2B3]/[0.06] px-2.5 py-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00A878] dark:bg-[#00F2B3]" />
                {fileCount} firewall{fileCount !== 1 ? "s" : ""} loaded
              </span>
            )}
            {selectedFrameworks.length > 0 && (
              <span className="flex items-center gap-1.5 shrink-0 rounded-full border border-border/50 bg-card/70 px-2.5 py-1">
                <span className="opacity-60">Frameworks:</span>
                {selectedFrameworks.map((fw) => (
                  <span
                    key={fw}
                    className="px-1.5 py-0.5 rounded bg-brand-accent/10 dark:bg-brand-accent/20 text-[#10037C] dark:text-[#009CFB] font-medium"
                  >
                    {fw}
                  </span>
                ))}
              </span>
            )}
            {reportCount > 0 && (
              <span className="flex items-center gap-1 shrink-0 ml-auto rounded-full border border-brand-accent/15 bg-brand-accent/[0.06] px-2.5 py-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2006F7]" />
                {reportCount} report{reportCount !== 1 ? "s" : ""} generated
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

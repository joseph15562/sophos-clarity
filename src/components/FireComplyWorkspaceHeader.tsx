import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Moon,
  Sun,
  LogOut,
  Building2,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
  Cpu,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useResolvedIsDark } from "@/hooks/use-resolved-appearance";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import {
  getCentralStatus,
  syncTenants,
  syncFirewalls,
  type CentralStatus,
} from "@/lib/sophos-central";
import { buildManagePanelSearch } from "@/lib/workspace-deeplink";
import { supabase } from "@/integrations/supabase/client";
import { NotificationCentre } from "@/components/NotificationCentre";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type FireComplyWorkspaceHeaderProps = {
  localMode?: boolean;
  onOrgClick?: () => void;
  /** Override default notification bell; omit to use workspace notification centre */
  notificationSlot?: ReactNode;
  /** Shown after Central / connector controls, before SE Health Check */
  headerActions?: ReactNode;
  /** Guest sign-in shell — alternate badge / subtitle copy */
  loginShell?: boolean;
};

function WorkspaceHeaderNotifications() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll } =
    useNotifications();
  return (
    <NotificationCentre
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      onDismiss={dismiss}
      onClearAll={clearAll}
    />
  );
}

function CentralStatusDot({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<CentralStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!orgId) return;
    try {
      const s = await getCentralStatus(orgId);
      setStatus(s);
    } catch (err) {
      console.warn("[loadStatus]", err);
      setStatus({ connected: false });
    }
  }, [orgId]);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setRefreshing(true);
    try {
      const tenants = await syncTenants(orgId);
      for (const t of tenants) {
        try {
          await syncFirewalls(orgId, t.id);
        } catch (err) {
          console.warn("[refresh] syncFirewalls best-effort", err);
        }
      }
      const s = await getCentralStatus(orgId);
      setStatus(s);
    } catch (err) {
      console.warn("[refresh]", err);
      setStatus({ connected: false });
    }
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (popoverOpen && orgId) loadStatus();
  }, [popoverOpen, orgId, loadStatus]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && orgId) loadStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [orgId, loadStatus]);

  useEffect(() => {
    if (!status?.connected || !status.last_synced_at || refreshing) return;
    const age = Date.now() - new Date(status.last_synced_at).getTime();
    const STALE_MS = 15 * 60 * 1000;

    if (age >= STALE_MS) {
      refresh();
      return;
    }

    const delay = STALE_MS - age + 500;
    const timer = setTimeout(() => {
      refresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [status?.connected, status?.last_synced_at, refreshing, refresh]);

  if (!status) return null;

  const isStale =
    status.connected && status.last_synced_at
      ? Date.now() - new Date(status.last_synced_at).getTime() > 15 * 60 * 1000
      : false;

  const dotColor = status.connected ? (isStale ? "bg-[#F29400]" : "bg-[#00F2B3]") : "bg-[#6A889B]";

  const label = status.connected
    ? isStale
      ? "Central (stale)"
      : "Central"
    : "Central (not linked)";

  const timeAgo = (iso: string | null | undefined) => {
    if (!iso) return "never";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-[10px] text-[#9BB0D3] hover:text-white transition-colors px-1.5 py-1 rounded hover:bg-[#10037C]/40 shrink-0"
          title={label}
          aria-label={label}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${dotColor} ${status.connected && !isStale ? "animate-pulse" : ""}`}
          />
          {status.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-56 space-y-2 p-3"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className="text-xs font-semibold text-foreground">
            {status.connected ? "Sophos Central Connected" : "Not Connected"}
          </span>
        </div>
        {status.connected && (
          <>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>
                Type: <span className="text-foreground font-medium">{status.partner_type}</span>
              </p>
              <p>
                Last synced:{" "}
                <span className="text-foreground font-medium">
                  {timeAgo(status.last_synced_at)}
                </span>
              </p>
              {isStale && <p className="text-[#F29400] font-medium">Auto-refreshing...</p>}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                refresh();
              }}
              disabled={refreshing}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium text-brand-accent hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh Now"}
            </button>
          </>
        )}
        {!status.connected && (
          <p className="text-[10px] text-muted-foreground">
            Link your Sophos Central account in the Multi-Tenant Dashboard settings.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ConnectorStatus({ orgId, onOpenSetup }: { orgId: string; onOpenSetup?: () => void }) {
  const [agentCount, setAgentCount] = useState<number>(0);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const { count } = await supabase
          .from("agents")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);
        if (cancelled) return;
        setAgentCount(count ?? 0);
        if ((count ?? 0) > 0) {
          const { data } = await supabase
            .from("agent_submissions")
            .select("created_at")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cancelled && data) setLastRunAt((data as { created_at: string }).created_at);
        }
      } catch {
        if (!cancelled) setAgentCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (loading || (agentCount === 0 && !lastRunAt)) {
    if (agentCount === 0 && !loading) {
      return (
        <button
          type="button"
          onClick={onOpenSetup}
          className="flex items-center gap-1.5 text-[10px] text-[#9BB0D3] hover:text-white transition-colors px-1.5 py-1 rounded hover:bg-[#10037C]/40"
          title="No connector agents — click to set up"
          aria-label="Connector: none configured"
        >
          <Cpu className="h-3 w-3" />
          <span className="hidden sm:inline">Connector: none</span>
        </button>
      );
    }
    return null;
  }

  const timeAgo = (iso: string | null): string => {
    if (!iso) return "never";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  };

  return (
    <button
      type="button"
      onClick={onOpenSetup}
      className="flex items-center gap-1.5 text-[10px] text-[#9BB0D3] hover:text-white transition-colors px-1.5 py-1 rounded hover:bg-[#10037C]/40"
      title={`Connector: ${agentCount} agent(s), last run ${timeAgo(lastRunAt)}`}
      aria-label={`Connector: ${agentCount} agents, last run ${timeAgo(lastRunAt)}`}
    >
      <Cpu className="h-3 w-3" />
      <span className="hidden sm:inline">
        Connector: {agentCount} agent{agentCount !== 1 ? "s" : ""}
      </span>
      {lastRunAt && <span className="hidden md:inline opacity-70">· {timeAgo(lastRunAt)}</span>}
    </button>
  );
}

/**
 * Primary FireComply chrome: Sophos mark, enterprise badge, org + Central + connector + account controls.
 * Use under the router; pair with {@link WorkspacePrimaryNav} on hub routes.
 */
export function FireComplyWorkspaceHeader({
  localMode,
  onOrgClick,
  notificationSlot,
  headerActions,
  loginShell = false,
}: FireComplyWorkspaceHeaderProps) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const isDark = useResolvedIsDark();
  const { user, org, isGuest, signOut } = useAuth();

  const openManagement = useCallback(() => {
    if (onOrgClick) onOrgClick();
    else
      navigate({
        pathname: "/",
        search: buildManagePanelSearch({ panel: "settings", section: "team" }),
      });
  }, [navigate, onOrgClick]);

  return (
    <header
      className="app-header-bar relative isolate sticky top-0 z-40 no-print border-b border-[#10037C]/30 bg-[radial-gradient(ellipse_120%_100%_at_0%_-20%,rgba(0,237,255,0.18),transparent_42%),radial-gradient(ellipse_100%_90%_at_100%_-10%,rgba(32,6,247,0.32),transparent_48%),linear-gradient(90deg,#001030_0%,#001A47_38%,#12007a_58%,#10037C_100%)] shadow-[0_14px_48px_-8px_rgba(0,0,0,0.5),0_0_80px_-24px_rgba(0,237,255,0.15),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md"
      style={{ backgroundColor: "#00163d" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#00EDFF]/55 to-transparent shadow-[0_0_24px_rgba(0,237,255,0.35)]"
      />
      <div className="max-w-[1320px] mx-auto px-4 md:px-6 py-3 flex flex-nowrap items-center gap-2 sm:gap-3 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-hide">
        {/* Single row: left cluster may shrink; account controls stay inline (no wrap under title). */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/30 bg-white/12 backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.35),0_0_32px_-4px_rgba(0,237,255,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] shrink-0 ring-1 ring-white/10 dark:border-white/12 dark:bg-white/[0.07] dark:shadow-[0_8px_28px_rgba(0,0,0,0.45),0_0_40px_-4px_rgba(0,237,255,0.25)] dark:backdrop-blur-none">
            <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 mb-1 backdrop-blur-xl
                border-[#00F2B3]/45 bg-[linear-gradient(135deg,rgba(0,242,179,0.22),rgba(0,196,163,0.12))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_24px_rgba(0,242,179,0.12)]
                dark:border-white/10 dark:bg-white/[0.04] dark:[background-image:none] dark:shadow-none dark:backdrop-blur-none
                ${loginShell ? "dark:shadow-[0_8px_24px_rgba(0,0,0,0.18)]" : ""}`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] dark:bg-[#00F2B3] dark:shadow-none" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] !text-white dark:!text-[#B6C4FF]">
                {loginShell ? "Firewall Compliance Workspace" : "Enterprise Firewall Compliance"}
              </span>
            </div>
            <h1 className="text-lg font-display font-black leading-tight tracking-tight truncate bg-gradient-to-r from-white via-[#E8F8FF] to-[#7EE8FF] bg-clip-text text-transparent dark:from-white dark:via-[#C8F4FF] dark:to-[#00EDFF] drop-shadow-[0_2px_18px_rgba(0,237,255,0.25)]">
              Sophos FireComply
            </h1>
            <p className="text-[11px] text-[#9BB0D3] hidden sm:block line-clamp-2 sm:line-clamp-none">
              {loginShell
                ? "Executive-ready firewall security assessments and compliance reporting"
                : "Firewall Configuration Assessment & Compliance Reporting"}
            </p>
          </div>
        </div>

        {!isGuest && (
          <div className="flex items-center gap-2 shrink-0 flex-nowrap justify-end">
            {org && (
              <button
                type="button"
                onClick={openManagement}
                className="flex items-center gap-1.5 text-[10px] text-white transition-colors px-2 py-1.5 rounded-xl border border-white/25 bg-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/18 hover:text-white dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur-none dark:text-[#B6C4FF] dark:hover:text-white dark:hover:bg-white/[0.08]"
                title="Open management panel"
                aria-label="Open management panel"
                data-tour="management-panel"
              >
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="font-medium text-white dark:text-white/80 max-w-[120px] truncate hidden sm:inline">
                  {org.name}
                </span>
                <ChevronDown className="h-2.5 w-2.5 shrink-0" />
              </button>
            )}
            {org && !localMode && <CentralStatusDot orgId={org.id} />}
            {org && !localMode && <ConnectorStatus orgId={org.id} onOpenSetup={openManagement} />}
            {headerActions}
            <Button
              variant="ghost"
              size="sm"
              className="inline-flex h-8 px-2.5 text-[10px] !text-white gap-1.5 shrink-0 max-sm:px-1.5 rounded-xl border border-white/25 bg-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/18 hover:!text-white dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur-none dark:!text-[#B6C4FF] dark:hover:!text-white dark:hover:bg-white/[0.08]"
              asChild
            >
              <Link to="/health-check" data-tour="health-check-nav" title="SE Health Check">
                <Shield className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">SE Health Check</span>
              </Link>
            </Button>
            {notificationSlot ?? <WorkspaceHeaderNotifications />}
            <span className="flex items-center gap-1 text-[10px] text-white rounded-xl border border-white/25 bg-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur-none dark:text-[#B6C4FF]">
              <User className="h-3 w-3 shrink-0" />
              <span className="max-w-[100px] truncate hidden sm:inline text-white dark:text-inherit">
                {user?.email?.split("@")[0]}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="shrink-0 h-8 w-8 rounded-xl border border-white/25 bg-white/10 backdrop-blur-md !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/18 hover:!text-white dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur-none dark:!text-[#B6C4FF] dark:hover:!text-white dark:hover:bg-white/[0.08]"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {isGuest && (
          <div className="flex items-center gap-2 shrink-0 flex-nowrap justify-end">
            {loginShell && (
              <div className="hidden md:flex items-center gap-2 rounded-xl border border-[#00F2B3]/40 bg-[linear-gradient(135deg,rgba(0,242,179,0.2),rgba(0,196,163,0.1))] backdrop-blur-xl px-3 py-1.5 text-[10px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] dark:border-white/10 dark:bg-white/[0.04] dark:[background-image:none] dark:text-[#B6C4FF] dark:shadow-none">
                <span className="inline-block h-2 w-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)] dark:bg-[#00F2B3] dark:shadow-none" />
                Boardroom-ready reporting
              </div>
            )}
            <button
              type="button"
              onClick={openManagement}
              className="flex items-center gap-1.5 text-[10px] text-white transition-colors px-2.5 py-1.5 rounded-xl border border-white/25 bg-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/18 hover:text-white dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur-none dark:text-[#B6C4FF] dark:hover:text-white dark:hover:bg-white/[0.08]"
              title="Open settings"
              aria-label="Open settings"
            >
              <SlidersHorizontal className="h-3 w-3 shrink-0" />
              <span className="font-medium hidden sm:inline">
                {loginShell ? "Workspace options" : "Settings"}
              </span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </button>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`shrink-0 rounded-xl border border-white/25 bg-white/10 backdrop-blur-md !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-white/18 hover:!text-white dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur-none dark:!text-[#B6C4FF] dark:hover:!text-white dark:hover:bg-white/[0.08] ${loginShell ? "dark:shadow-[0_8px_24px_rgba(0,0,0,0.16)]" : ""}`}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          data-tour="theme-toggle"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

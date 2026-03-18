import { useState, useEffect, useCallback } from "react";
import { Moon, Sun, LogOut, Building2, User, Wifi, WifiOff, RefreshCw, ChevronDown, SlidersHorizontal, Cpu } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getCentralStatus, syncTenants, syncFirewalls, type CentralStatus } from "@/lib/sophos-central";
import { supabase } from "@/integrations/supabase/client";

interface AppHeaderProps {
  hasFiles: boolean;
  fileCount: number;
  customerName: string;
  environment: string;
  selectedFrameworks: string[];
  reportCount: number;
  notificationSlot?: React.ReactNode;
  onOrgClick?: () => void;
  localMode?: boolean;
}

function CentralStatusDot({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<CentralStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

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
        try { await syncFirewalls(orgId, t.id); } catch (err) { console.warn("[refresh] syncFirewalls best-effort", err); }
      }
      const s = await getCentralStatus(orgId);
      setStatus(s);
    } catch (err) {
      console.warn("[refresh]", err);
      setStatus({ connected: false });
    }
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Refetch when user opens the popover so we show current state after connecting in Settings
  useEffect(() => {
    if (showPopover && orgId) loadStatus();
  }, [showPopover, orgId, loadStatus]);

  // Refetch when tab becomes visible so we pick up connection changes from another tab/settings
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && orgId) loadStatus(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [orgId, loadStatus]);

  // Auto-refresh: fires when data is >15 min old, then schedules next check
  useEffect(() => {
    if (!status?.connected || !status.last_synced_at || refreshing) return;
    const age = Date.now() - new Date(status.last_synced_at).getTime();
    const STALE_MS = 15 * 60 * 1000;

    if (age >= STALE_MS) {
      refresh();
      return;
    }

    const delay = STALE_MS - age + 500;
    const timer = setTimeout(() => { refresh(); }, delay);
    return () => clearTimeout(timer);
  }, [status?.connected, status?.last_synced_at, refreshing, refresh]);

  if (!status) return null;

  const isStale = status.connected && status.last_synced_at
    ? (Date.now() - new Date(status.last_synced_at).getTime()) > 15 * 60 * 1000
    : false;

  const dotColor = status.connected
    ? isStale ? "bg-[#F29400]" : "bg-[#00995a]"
    : "bg-[#6A889B]";

  const label = status.connected
    ? isStale ? "Central (stale)" : "Central"
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
    <div className="relative shrink-0">
      <button
        onClick={() => setShowPopover(!showPopover)}
        className="flex items-center gap-1.5 text-[10px] text-[#6A889B] hover:text-white transition-colors px-1.5 py-1 rounded hover:bg-[#10037C]/40"
        title={label}
        aria-label={label}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${dotColor} ${status.connected && !isStale ? "animate-pulse" : ""}`} />
        {status.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      </button>
      {showPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPopover(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-card shadow-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
              <span className="text-xs font-semibold text-foreground">
                {status.connected ? "Sophos Central Connected" : "Not Connected"}
              </span>
            </div>
            {status.connected && (
              <>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <p>Type: <span className="text-foreground font-medium">{status.partner_type}</span></p>
                  <p>Last synced: <span className="text-foreground font-medium">{timeAgo(status.last_synced_at)}</span></p>
                  {isStale && <p className="text-[#F29400] font-medium">Auto-refreshing...</p>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); refresh(); }}
                  disabled={refreshing}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium text-[#2006F7] dark:text-[#00EDFF] hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing..." : "Refresh Now"}
                </button>
              </>
            )}
            {!status.connected && (
              <p className="text-[10px] text-muted-foreground">Link your Sophos Central account in the Multi-Tenant Dashboard settings.</p>
            )}
          </div>
        </>
      )}
    </div>
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
        const { count } = await supabase.from("agents").select("id", { count: "exact", head: true }).eq("org_id", orgId);
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
    return () => { cancelled = true; };
  }, [orgId]);

  if (loading || (agentCount === 0 && !lastRunAt)) {
    if (agentCount === 0 && !loading) {
      return (
        <button
          type="button"
          onClick={onOpenSetup}
          className="flex items-center gap-1.5 text-[10px] text-[#6A889B] hover:text-white transition-colors px-1.5 py-1 rounded hover:bg-[#10037C]/40"
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
      className="flex items-center gap-1.5 text-[10px] text-[#6A889B] hover:text-white transition-colors px-1.5 py-1 rounded hover:bg-[#10037C]/40"
      title={`Connector: ${agentCount} agent(s), last run ${timeAgo(lastRunAt)}`}
      aria-label={`Connector: ${agentCount} agents, last run ${timeAgo(lastRunAt)}`}
    >
      <Cpu className="h-3 w-3" />
      <span className="hidden sm:inline">Connector: {agentCount} agent{agentCount !== 1 ? "s" : ""}</span>
      {lastRunAt && <span className="hidden md:inline opacity-70">· {timeAgo(lastRunAt)}</span>}
    </button>
  );
}

export function AppHeader({ hasFiles, fileCount, customerName, environment, selectedFrameworks, reportCount, notificationSlot, onOrgClick, localMode }: AppHeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { user, org, isGuest, signOut } = useAuth();

  const showContext = hasFiles || customerName || selectedFrameworks.length > 0;

  return (
    <>
      <header className="border-b border-[#10037C]/20 bg-[#001A47] sticky top-0 z-40 no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/sophos-icon-white.svg" alt="Sophos" className="h-7 w-7" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-display font-bold text-white leading-tight tracking-tight">
              Sophos FireComply
            </h1>
            <p className="text-[11px] text-[#6A889B] hidden sm:block">
              Firewall Configuration Assessment & Compliance Reporting
            </p>
          </div>

          {/* Auth status */}
          {!isGuest && (
            <div className="flex items-center gap-2 shrink-0">
              {org && (
                <button
                  onClick={onOrgClick}
                  className="flex items-center gap-1.5 text-[10px] text-[#6A889B] hover:text-white transition-colors px-1.5 py-1 rounded hover:bg-[#10037C]/40"
                  title="Open management panel"
                  aria-label="Open management panel"
                >
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="font-medium text-white/80 max-w-[120px] truncate hidden sm:inline">{org.name}</span>
                  <ChevronDown className="h-2.5 w-2.5 shrink-0" />
                </button>
              )}
              {org && !localMode && <CentralStatusDot orgId={org.id} />}
              {org && !localMode && <ConnectorStatus orgId={org.id} onOpenSetup={onOrgClick} />}
              {notificationSlot}
              <span className="flex items-center gap-1 text-[10px] text-[#6A889B]">
                <User className="h-3 w-3 shrink-0" />
                <span className="max-w-[100px] truncate hidden sm:inline">{user?.email?.split("@")[0]}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="shrink-0 text-[#6A889B] hover:text-white hover:bg-[#10037C]/40 h-7 w-7"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {isGuest && (
            <button
              onClick={onOrgClick}
              className="flex items-center gap-1.5 text-[10px] text-[#6A889B] hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#10037C]/40"
              title="Open settings"
              aria-label="Open settings"
            >
              <SlidersHorizontal className="h-3 w-3 shrink-0" />
              <span className="font-medium hidden sm:inline">Settings</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="shrink-0 text-[#6A889B] hover:text-white hover:bg-[#10037C]/40"
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {showContext && (
        <div className="border-b border-border bg-muted/50 no-print hidden sm:block">
          <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center gap-4 text-[11px] text-muted-foreground overflow-x-auto">
            {customerName && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="font-semibold text-foreground">{customerName}</span>
                {environment && <span className="opacity-60">· {environment}</span>}
              </span>
            )}
            {hasFiles && (
              <span className="flex items-center gap-1 shrink-0">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00995a] dark:bg-[#00F2B3]" />
                {fileCount} firewall{fileCount !== 1 ? "s" : ""} loaded
              </span>
            )}
            {selectedFrameworks.length > 0 && (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="opacity-60">Frameworks:</span>
                {selectedFrameworks.map((fw) => (
                  <span key={fw} className="px-1.5 py-0.5 rounded bg-[#2006F7]/10 dark:bg-[#2006F7]/20 text-[#10037C] dark:text-[#009CFB] font-medium">
                    {fw}
                  </span>
                ))}
              </span>
            )}
            {reportCount > 0 && (
              <span className="flex items-center gap-1 shrink-0 ml-auto">
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

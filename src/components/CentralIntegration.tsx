import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, Trash2, ChevronDown, Shield, ExternalLink, Eye, EyeOff, Server, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCentral } from "@/hooks/use-central";
import { useAuth } from "@/hooks/use-auth";
import { logAudit } from "@/lib/audit";

function SetupStep({ step, title, children, defaultOpen }: { step: number; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors">
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#2006F7]/10 text-[#2006F7] dark:text-[#00EDFF] text-xs font-bold shrink-0">{step}</span>
        <span className="text-sm font-medium text-foreground flex-1">{title}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">{children}</div>}
    </div>
  );
}

export function CentralIntegration() {
  const { org, isGuest } = useAuth();
  const central = useCentral();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const handleConnect = useCallback(async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setConnectError("Both Client ID and Client Secret are required");
      return;
    }
    setConnecting(true);
    setConnectError("");
    const result = await central.connect(clientId.trim(), clientSecret.trim());
    if (result.error) {
      setConnectError(result.error);
    } else {
      setClientId("");
      setClientSecret("");
      setShowSecret(false);
      if (org?.id) {
        logAudit(org.id, "central.linked", "central", "", { partnerType: central.status?.partner_type }).catch(() => {});
      }
    }
    setConnecting(false);
  }, [clientId, clientSecret, central, org]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm("Disconnect from Sophos Central? This will remove stored credentials and cached data.")) return;
    await central.disconnect();
  }, [central]);

  useEffect(() => {
    if (central.isConnected && central.tenants.length === 0) {
      central.loadCachedTenants();
    }
  }, [central.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isGuest || !org) {
    return (
      <div className="p-5 text-center text-sm text-muted-foreground">
        <p>Sign in and create an organisation to connect Sophos Central.</p>
      </div>
    );
  }

  const timeAgo = (iso: string | null | undefined) => {
    if (!iso) return "never";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  };

  return (
    <div className="p-5 space-y-5">
      {/* Connection Status Banner */}
      {central.isConnected ? (
        <div className="rounded-lg border border-[#00995a]/20 dark:border-[#00F2B3]/20 bg-[#00995a]/[0.04] dark:bg-[#00F2B3]/[0.04] px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#00995a]/10 dark:bg-[#00F2B3]/10 flex items-center justify-center shrink-0">
            <Wifi className="h-4 w-4 text-[#00995a] dark:text-[#00F2B3]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Sophos Central Connected</p>
            <p className="text-[10px] text-muted-foreground">
              Type: <span className="font-medium text-foreground">{central.status?.partner_type}</span>
              {" · "}Last synced: <span className="font-medium text-foreground">{timeAgo(central.status?.last_synced_at)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {central.status?.partner_type !== "tenant" && (
              <Button variant="outline" size="sm" onClick={() => central.refreshTenants()} disabled={central.isLoading} className="gap-1.5 text-xs">
                <RefreshCw className={`h-3 w-3 ${central.isLoading ? "animate-spin" : ""}`} />
                Sync Tenants
                {central.tenants.length > 0 && <span className="text-[10px] opacity-60">({central.tenants.length})</span>}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleDisconnect} className="gap-1.5 text-xs text-[#EA0022] hover:text-[#EA0022] hover:bg-[#EA0022]/10">
              <Trash2 className="h-3 w-3" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4" data-tour="central-section">
          {/* Guide toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Connect to Sophos Central</span>
            </div>
            <button
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="text-[10px] text-[#2006F7] dark:text-[#00EDFF] hover:underline flex items-center gap-1"
            >
              {showSetupGuide ? "Hide setup guide" : "How do I get API credentials?"}
            </button>
          </div>

          {/* Guided Setup */}
          {showSetupGuide && (
            <div className="space-y-2">
              <SetupStep step={1} title="Sign in to Sophos Central" defaultOpen>
                <p>Go to <a href="https://central.sophos.com" target="_blank" rel="noopener noreferrer" className="text-[#2006F7] dark:text-[#00EDFF] hover:underline inline-flex items-center gap-0.5">central.sophos.com <ExternalLink className="h-2.5 w-2.5" /></a></p>
                <p className="mt-1">Partners: use the Partner dashboard. Customers: use Sophos Central Admin.</p>
              </SetupStep>
              <SetupStep step={2} title="Navigate to API Credentials">
                <p>Go to <span className="font-medium text-foreground">Settings & Policies</span> → <span className="font-medium text-foreground">API Credentials Management</span></p>
              </SetupStep>
              <SetupStep step={3} title='Add a new credential named "FireComply"'>
                <p>Click <span className="font-medium text-foreground">Add Credential</span>, enter the name <span className="font-mono bg-muted px-1 rounded">FireComply</span>, and select the role:</p>
                <div className="mt-2 rounded border border-border overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00995a]/5">
                    <Shield className="h-3 w-3 text-[#00995a]" />
                    <span className="font-medium text-foreground">Service Principal Read-Only</span>
                    <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#00995a]/10 text-[#00995a] font-bold">RECOMMENDED</span>
                  </div>
                  <p className="px-3 py-1.5 text-[10px]">View-only access. FireComply never modifies your Sophos Central configuration.</p>
                </div>
              </SetupStep>
              <SetupStep step={4} title="Copy Client ID and Client Secret">
                <p>After clicking Add, copy the <span className="font-medium text-foreground">Client ID</span> and <span className="font-medium text-foreground">Client Secret</span>.</p>
                <p className="mt-1 text-[#F29400] font-medium">The Client Secret is only shown once. Store it securely.</p>
              </SetupStep>
              <SetupStep step={5} title="Paste credentials below and click Connect">
                <p>Enter the credentials in the fields below. They will be encrypted (AES-256-GCM) before being stored.</p>
              </SetupStep>
            </div>
          )}

          {/* Credential Input */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client ID</label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-xs"
                data-tour="central-client-id"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client Secret</label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Enter your client secret"
                  className="font-mono text-xs pr-10"
                  data-tour="central-client-secret"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  aria-label={showSecret ? "Hide client secret" : "Show client secret"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {connectError && (
              <p className="text-xs text-[#EA0022] bg-[#EA0022]/5 rounded px-3 py-2">{connectError}</p>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleConnect}
                disabled={connecting || !clientId.trim() || !clientSecret.trim()}
                className="gap-2 bg-[#2006F7] hover:bg-[#10037C] text-white"
                data-tour="central-connect-btn"
              >
                <Wifi className="h-3.5 w-3.5" />
                {connecting ? "Connecting..." : "Connect to Sophos Central"}
              </Button>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" /> Credentials encrypted at rest
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {central.error && (
        <p className="text-xs text-[#EA0022] bg-[#EA0022]/5 rounded px-3 py-2">{central.error}</p>
      )}

      {/* Tenant List (when connected as partner/org) */}
      {central.isConnected && central.status?.partner_type !== "tenant" && central.tenants.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Managed Customers ({central.tenants.length})
          </h4>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {central.tenants.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/30 transition-colors">
                <span className="flex-1 font-medium text-foreground truncate">{t.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{t.dataRegion}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{t.billingType || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Firewall list preview (when connected as single tenant) */}
      {central.isConnected && central.status?.partner_type === "tenant" && central.firewalls.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" />
            Your Firewalls ({central.firewalls.length})
          </h4>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {central.firewalls.map((fw) => (
              <div key={fw.id} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/30 transition-colors">
                <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${fw.status?.connected ? "bg-[#00995a]" : "bg-[#EA0022]"}`} />
                <span className="font-medium text-foreground truncate">{fw.hostname || fw.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">{fw.serialNumber}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{fw.firmwareVersion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Docs link */}
      <div className="pt-2 border-t border-border">
        <a
          href="https://developer.sophos.com/getting-started"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-muted-foreground hover:text-[#2006F7] dark:hover:text-[#00EDFF] flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> Sophos Central API Documentation
        </a>
      </div>
    </div>
  );
}

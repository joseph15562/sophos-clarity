import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Code2,
  Plug,
  ArrowLeft,
  Webhook,
  Server,
  Cpu,
  ExternalLink,
  Check,
  X,
  Clock,
  Download,
  Copy,
  ChevronDown,
  ChevronRight,
  Globe,
  MessageSquare,
  Ticket,
  KeyRound,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiDocumentation } from "@/components/ApiDocumentation";
import { getLatestConnectorVersion, isConnectorVersionOutdated } from "@/lib/connector-version";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense } from "react";
import { WorkspacePanelLink } from "@/components/WorkspaceSettingsStrip";

const CentralIntegration = lazy(() =>
  import("@/components/CentralIntegration").then((m) => ({ default: m.CentralIntegration })),
);
const SlackIntegration = lazy(() =>
  import("@/components/SlackIntegration").then((m) => ({ default: m.SlackIntegration })),
);
const TeamsIntegration = lazy(() =>
  import("@/components/TeamsIntegration").then((m) => ({ default: m.TeamsIntegration })),
);
const ConnectWiseCloudSettings = lazy(() =>
  import("@/components/ConnectWiseCloudSettings").then((m) => ({
    default: m.ConnectWiseCloudSettings,
  })),
);
const ConnectWiseManageSettings = lazy(() =>
  import("@/components/ConnectWiseManageSettings").then((m) => ({
    default: m.ConnectWiseManageSettings,
  })),
);
const AutotaskPsaSettings = lazy(() =>
  import("@/components/AutotaskPsaSettings").then((m) => ({ default: m.AutotaskPsaSettings })),
);
const OrgServiceKeysSettings = lazy(() =>
  import("@/components/OrgServiceKeysSettings").then((m) => ({
    default: m.OrgServiceKeysSettings,
  })),
);

/* ───────── types ───────── */

type TabId = "integrations" | "api" | "webhooks" | "agents";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "connected" | "available" | "coming-soon" | "partial";
  action: string;
}

interface Endpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  request?: string;
  response: string;
}

interface WebhookDelivery {
  id: string;
  timestamp: string;
  event: string;
  success: boolean;
  statusCode: number;
}

interface Agent {
  id: string;
  hostname: string;
  lastHeartbeat: string;
  status: "online" | "offline";
  configPulls: number;
  pullsLast7d: number;
  connectorVersion?: string | null;
  errorMessage?: string | null;
}

interface AgentActivityRow {
  id: string;
  created_at: string;
  overall_score: number;
  overall_grade: string;
}

function shortAgentId(id: string): string {
  if (id.length < 24) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/* ───────── demo data ───────── */

const INTEGRATIONS: Integration[] = [
  {
    id: "sophos-central",
    name: "Sophos Central",
    description: "Sync firewalls, endpoints and alerts from your Sophos Central tenant.",
    icon: <Globe className="h-6 w-6" />,
    status: "connected",
    action: "Configure",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send alerts and assessment summaries to Slack channels.",
    icon: <MessageSquare className="h-6 w-6" />,
    status: "available",
    action: "Connect",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Push notifications and findings to Microsoft Teams.",
    icon: <MessageSquare className="h-6 w-6" />,
    status: "available",
    action: "Connect",
  },
  {
    id: "connectwise-cloud",
    name: "ConnectWise Cloud",
    description:
      "Partner Cloud API — OAuth client credentials for ConnectWise Cloud Services (separate from Manage tickets).",
    icon: <Ticket className="h-6 w-6" />,
    status: "available",
    action: "Connect",
  },
  {
    id: "connectwise-manage",
    name: "ConnectWise Manage",
    description: "Site REST API for service tickets — create from Assess → Findings bulk actions.",
    icon: <Ticket className="h-6 w-6" />,
    status: "available",
    action: "Connect",
  },
  {
    id: "datto-autotask",
    name: "Datto Autotask PSA",
    description:
      "REST API for tickets from Assess → Findings; defaults and company mapping in-app.",
    icon: <Ticket className="h-6 w-6" />,
    status: "available",
    action: "Connect",
  },
  {
    id: "scoped-service-keys",
    name: "Scoped service keys",
    description:
      "Org-level API keys (hashed at rest) for RMM and automation — firewalls and assessments.",
    icon: <KeyRound className="h-6 w-6" />,
    status: "available",
    action: "Connect",
  },
  {
    id: "halopsa",
    name: "HaloPSA",
    description: "Sync findings as tickets in HaloPSA.",
    icon: <Ticket className="h-6 w-6" />,
    status: "coming-soon",
    action: "Coming Soon",
  },
  {
    id: "servicenow",
    name: "ServiceNow",
    description: "CMDB integration — map firewalls to configuration items.",
    icon: <Server className="h-6 w-6" />,
    status: "coming-soon",
    action: "Coming Soon",
  },
];

const API_ENDPOINTS: Endpoint[] = [
  {
    id: "get-assessments",
    method: "GET",
    path: "/api/assessments",
    description: "List all assessments for the authenticated organisation (paginated).",
    response: `{
  "data": [
    {
      "id": "a1b2c3d4",
      "customer_name": "Acme Corp",
      "score": 78,
      "grade": "B",
      "created_at": "2025-03-10T14:22:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}`,
  },
  {
    id: "get-firewalls",
    method: "GET",
    path: "/api/firewalls",
    description: "List Central-synced firewalls with latest health scores.",
    response: `{
  "data": [
    {
      "id": "fw-001",
      "hostname": "xgs-4500-hq",
      "serial": "C44012345678",
      "last_score": 72,
      "last_grade": "C",
      "synced_at": "2025-03-12T09:15:00Z"
    }
  ]
}`,
  },
  {
    id: "post-assessments",
    method: "POST",
    path: "/api/assessments",
    description: "Create a new assessment by uploading a Sophos XG/XGS configuration export.",
    request: `{
  "customer_name": "Acme Corp",
  "environment": "Production",
  "config_html": "<base64-encoded config>"
}`,
    response: `{
  "id": "a1b2c3d4",
  "score": 78,
  "grade": "B",
  "findings_count": 14,
  "created_at": "2025-03-12T10:00:00Z"
}`,
  },
  {
    id: "get-reports",
    method: "GET",
    path: "/api/reports",
    description: "List saved reports with metadata and sharing status.",
    response: `{
  "data": [
    {
      "id": "rpt-001",
      "title": "Q1 2025 Health Check",
      "format": "pdf",
      "shared": true,
      "created_at": "2025-03-01T08:00:00Z"
    }
  ]
}`,
  },
  {
    id: "post-config-upload",
    method: "POST",
    path: "/api/config-upload",
    description:
      "Upload a raw configuration file for parsing and analysis without creating an assessment record.",
    request: `{
  "file": "<multipart/form-data>",
  "parse_only": true
}`,
    response: `{
  "sections": 24,
  "rules_count": 187,
  "firmware": "20.0.2 MR-2",
  "model": "XGS 4500"
}`,
  },
];

const WEBHOOK_EVENTS = [
  { id: "assessment_complete", label: "Assessment Complete" },
  { id: "score_change", label: "Score Change" },
  { id: "critical_finding", label: "Critical Finding" },
  { id: "agent_offline", label: "Agent Offline" },
];

const DEMO_AGENTS: Agent[] = [
  {
    id: "agent-7f3a",
    hostname: "xgs4500-hq-01",
    lastHeartbeat: "2025-03-12T14:58:00Z",
    status: "online",
    configPulls: 34,
    pullsLast7d: 7,
    connectorVersion: "1.0.0",
  },
  {
    id: "agent-b2c1",
    hostname: "xgs3300-branch-02",
    lastHeartbeat: "2025-03-12T14:55:00Z",
    status: "online",
    configPulls: 21,
    pullsLast7d: 5,
    connectorVersion: "1.0.0",
  },
  {
    id: "agent-e9d4",
    hostname: "xgs2300-remote-03",
    lastHeartbeat: "2025-03-12T12:10:00Z",
    status: "online",
    configPulls: 12,
    pullsLast7d: 3,
    connectorVersion: "0.9.2",
  },
  {
    id: "agent-1a8f",
    hostname: "xg135-lab-04",
    lastHeartbeat: "2025-03-10T08:20:00Z",
    status: "offline",
    configPulls: 7,
    pullsLast7d: 0,
    connectorVersion: null,
  },
  {
    id: "agent-c5e2",
    hostname: "xgs4300-dc-05",
    lastHeartbeat: "2025-03-09T16:44:00Z",
    status: "offline",
    configPulls: 3,
    pullsLast7d: 0,
    connectorVersion: "0.8.0",
  },
];

/* ───────── helpers ───────── */

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  connected: {
    label: "Connected",
    cls: "bg-[#00F2B3]/15 text-[#007A5A] dark:text-[#00F2B3] border-[#00F2B3]/25",
  },
  available: {
    label: "Available",
    cls: "bg-[#00EDFF]/15 text-[#007A9F] dark:text-[#00EDFF] border-[#00EDFF]/25",
  },
  "coming-soon": {
    label: "Coming Soon",
    cls: "bg-[#F29400]/15 text-[#9A5F00] dark:text-[#F29400] border-[#F29400]/25",
  },
  partial: {
    label: "In progress",
    cls: "bg-[#5A00FF]/15 text-[#5A00FF] dark:text-[#C4B5FD] border-[#5A00FF]/25",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeAgoStr(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const GLASS =
  "rounded-2xl border border-border/60 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]";

/* ───────── sub-components ───────── */

function TabPill({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
        active
          ? "bg-[#2006F7] text-white shadow-[0_4px_16px_rgba(32,6,247,0.3)]"
          : "bg-white/60 dark:bg-white/[0.06] text-muted-foreground hover:bg-white/80 dark:hover:bg-white/[0.10] border border-border/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IntegrationCard({
  item,
  onAction,
}: {
  item: Integration;
  onAction?: (id: string) => void;
}) {
  const s = STATUS_MAP[item.status];
  return (
    <div className={`${GLASS} p-5 flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2006F7]/10 text-[#2006F7] dark:bg-[#2006F7]/20 dark:text-[#00EDFF]">
            {item.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {item.description}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}
        >
          {s.label}
        </span>
      </div>
      <div className="flex items-center justify-end mt-auto">
        {item.status === "coming-soon" ? (
          <span className="text-xs text-muted-foreground italic">Coming soon</span>
        ) : item.status === "connected" || item.status === "partial" ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onAction?.(item.id)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {item.action}
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5" onClick={() => onAction?.(item.id)}>
            <Plug className="h-3.5 w-3.5" />
            {item.action}
          </Button>
        )}
      </div>
    </div>
  );
}

function EndpointRow({ ep }: { ep: Endpoint }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`${GLASS} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-accent/40 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold font-mono ${METHOD_COLORS[ep.method]}`}
        >
          {ep.method}
        </span>
        <code className="text-sm font-mono text-foreground">{ep.path}</code>
        <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">
          {ep.description}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border/50 bg-muted/20 px-5 py-4 space-y-4">
          <p className="text-xs text-muted-foreground sm:hidden">{ep.description}</p>

          {ep.request && (
            <div>
              <p className="text-[11px] font-semibold text-foreground mb-1.5">Request body</p>
              <pre className="rounded-xl bg-slate-950 p-4 text-[12px] font-mono text-emerald-300 overflow-x-auto">
                {ep.request}
              </pre>
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold text-foreground mb-1.5">Response</p>
            <pre className="rounded-xl bg-slate-950 p-4 text-[12px] font-mono text-emerald-300 overflow-x-auto">
              {ep.response}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationsTab() {
  const { org } = useAuth();
  const [centralConnected, setCentralConnected] = useState(false);
  const [cwCloudLinked, setCwCloudLinked] = useState(false);
  const [cwManageLinked, setCwManageLinked] = useState(false);
  const [autotaskLinked, setAutotaskLinked] = useState(false);
  const [hasServiceKeys, setHasServiceKeys] = useState(false);
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  useEffect(() => {
    if (!org?.id) return;
    supabase
      .from("central_credentials")
      .select("org_id")
      .eq("org_id", org.id)
      .maybeSingle()
      .then(({ data }) => setCentralConnected(!!data));
  }, [org?.id]);

  useEffect(() => {
    if (!org?.id) return;
    supabase
      .from("connectwise_cloud_credentials")
      .select("org_id")
      .eq("org_id", org.id)
      .maybeSingle()
      .then(({ data }) => setCwCloudLinked(!!data));
  }, [org?.id]);

  useEffect(() => {
    if (!org?.id) return;
    supabase
      .from("connectwise_manage_credentials")
      .select("org_id")
      .eq("org_id", org.id)
      .maybeSingle()
      .then(({ data }) => setCwManageLinked(!!data));
  }, [org?.id]);

  useEffect(() => {
    if (!org?.id) return;
    supabase
      .from("autotask_psa_credentials")
      .select("org_id")
      .eq("org_id", org.id)
      .maybeSingle()
      .then(({ data }) => setAutotaskLinked(!!data));
  }, [org?.id]);

  useEffect(() => {
    if (!org?.id) {
      setHasServiceKeys(false);
      return;
    }
    supabase
      .from("org_service_api_keys")
      .select("id")
      .eq("org_id", org.id)
      .is("revoked_at", null)
      .limit(1)
      .then(({ data }) => setHasServiceKeys((data?.length ?? 0) > 0));
  }, [org?.id, openPanel]);

  useEffect(() => {
    if (!openPanel) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openPanel]);

  const items = INTEGRATIONS.map((item) => {
    if (item.id === "sophos-central") {
      return {
        ...item,
        status: centralConnected ? ("connected" as const) : ("available" as const),
        action: centralConnected ? "Configure" : "Connect",
      };
    }
    if (item.id === "connectwise-cloud") {
      return {
        ...item,
        status: cwCloudLinked ? ("connected" as const) : ("available" as const),
        action: cwCloudLinked ? "Configure" : "Connect",
      };
    }
    if (item.id === "connectwise-manage") {
      return {
        ...item,
        status: cwManageLinked ? ("connected" as const) : ("available" as const),
        action: cwManageLinked ? "Configure" : "Connect",
      };
    }
    if (item.id === "datto-autotask") {
      return {
        ...item,
        status: autotaskLinked ? ("connected" as const) : ("available" as const),
        action: autotaskLinked ? "Configure" : "Connect",
      };
    }
    if (item.id === "scoped-service-keys") {
      return {
        ...item,
        status: hasServiceKeys ? ("connected" as const) : ("available" as const),
        action: hasServiceKeys ? "Configure" : "Connect",
      };
    }
    return item;
  });

  const onIntegrationAction = (id: string) => {
    setOpenPanel(id);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <IntegrationCard key={i.id} item={i} onAction={onIntegrationAction} />
        ))}
      </div>

      {!centralConnected && (
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
          Prefer the main workspace? On <strong className="text-foreground">Assess</strong>, open
          your organisation panel (top bar) → Settings →{" "}
          <WorkspacePanelLink section="central">Sophos Central API</WorkspacePanelLink> to connect.
        </p>
      )}

      {openPanel &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              aria-hidden
              onClick={() => setOpenPanel(null)}
            />
            <div
              className="fixed inset-x-4 top-[max(1rem,8vh)] z-[101] mx-auto max-w-2xl max-h-[min(84vh,calc(100dvh-2rem))] flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background text-foreground shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="api-hub-integration-panel-title"
            >
              <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-border/50 bg-background">
                <h3
                  id="api-hub-integration-panel-title"
                  className="text-sm font-display font-bold text-foreground"
                >
                  {openPanel === "sophos-central" && "Sophos Central Integration"}
                  {openPanel === "slack" && "Slack Integration"}
                  {openPanel === "teams" && "Microsoft Teams Integration"}
                  {openPanel === "connectwise-cloud" && "ConnectWise Cloud"}
                  {openPanel === "connectwise-manage" && "ConnectWise Manage"}
                  {openPanel === "datto-autotask" && "Datto Autotask PSA"}
                  {openPanel === "scoped-service-keys" && "Scoped service keys"}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpenPanel(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-12">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
                    </div>
                  }
                >
                  {openPanel === "sophos-central" && <CentralIntegration />}
                  {openPanel === "slack" && <SlackIntegration />}
                  {openPanel === "teams" && <TeamsIntegration />}
                  {openPanel === "connectwise-cloud" && <ConnectWiseCloudSettings />}
                  {openPanel === "connectwise-manage" && <ConnectWiseManageSettings />}
                  {openPanel === "datto-autotask" && <AutotaskPsaSettings />}
                  {openPanel === "scoped-service-keys" && <OrgServiceKeysSettings />}
                </Suspense>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function ApiExplorerTab() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-fit gap-2">
              <Code2 className="h-4 w-4" />
              API documentation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <ApiDocumentation />
          </DialogContent>
        </Dialog>
        <p className="text-xs text-muted-foreground leading-relaxed sm:max-w-md">
          Same reference lives under Assess → workspace panel → Settings →{" "}
          <WorkspacePanelLink section="api-docs">API Documentation</WorkspacePanelLink>.
        </p>
      </div>
      <div className={`${GLASS} p-5`}>
        <h3 className="text-sm font-semibold text-foreground mb-1">Authentication</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          All endpoints require a valid JWT in the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            Authorization
          </code>{" "}
          header.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 font-mono text-xs text-emerald-300">
          <span className="select-all">Authorization: Bearer {"<your-jwt>"}</span>
          <button
            className="ml-auto text-slate-400 hover:text-white transition-colors"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {API_ENDPOINTS.map((ep) => (
          <EndpointRow key={ep.id} ep={ep} />
        ))}
      </div>
    </div>
  );
}

function WebhooksTab() {
  const { org } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [enabledEvents, setEnabledEvents] = useState<Set<string>>(
    new Set(["assessment_complete", "critical_finding"]),
  );
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  useEffect(() => {
    if (!org?.id) return;
    supabase
      .from("organisations")
      .select("webhook_url")
      .eq("id", org.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.webhook_url) {
          setWebhookUrl(data.webhook_url);
          setSavedUrl(data.webhook_url);
        }
      });
    supabase
      .from("alert_rules")
      .select("event_type, enabled")
      .eq("org_id", org.id)
      .then(({ data }) => {
        if (data) {
          const enabled = new Set(data.filter((r) => r.enabled).map((r) => r.event_type));
          setEnabledEvents(enabled);
        }
      });
    supabase
      .from("audit_log")
      .select("id, action, resource_type, metadata, created_at")
      .eq("org_id", org.id)
      .in("action", ["webhook_sent", "alert_triggered"])
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!data?.length) {
          setDeliveries([]);
          return;
        }
        const mapped = data.map((d) => ({
          id: d.id,
          timestamp: d.created_at,
          event: d.resource_type || d.action,
          success: !(d.metadata as Record<string, unknown>)?.error,
          statusCode: ((d.metadata as Record<string, unknown>)?.statusCode as number) ?? 200,
        }));
        setDeliveries(mapped);
      });
  }, [org?.id]);

  const saveWebhookUrl = async () => {
    if (!org?.id) return;
    await supabase.from("organisations").update({ webhook_url: webhookUrl }).eq("id", org.id);
    setSavedUrl(webhookUrl);
  };

  const toggle = (id: string) =>
    setEnabledEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <div className={`${GLASS} p-4 text-xs text-muted-foreground leading-relaxed space-y-2`}>
        <p>
          <strong className="text-foreground">Org webhook URL</strong> (saved reports / notify URL)
          and <strong className="text-foreground">webhook secret</strong> are managed under Assess →
          workspace panel → Settings →{" "}
          <WorkspacePanelLink section="webhooks">Integrations (Webhook)</WorkspacePanelLink>
          <span className="text-muted-foreground/80">
            {" "}
            (org admins). Event checkboxes on this page reflect{" "}
            <WorkspacePanelLink section="alerts">Alerts</WorkspacePanelLink> rules (
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">alert_rules</code>).
          </span>
        </p>
      </div>

      <div className={`${GLASS} p-5 space-y-4`}>
        <div>
          <label className="text-sm font-semibold text-foreground" htmlFor="webhook-url">
            Webhook URL
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 rounded-xl border border-border/60 bg-white/60 dark:bg-white/[0.06] px-4 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/40"
              placeholder="https://..."
            />
            <Button size="sm" onClick={saveWebhookUrl} disabled={webhookUrl === savedUrl}>
              Save
            </Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Event types</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENTS.map((evt) => (
              <label
                key={evt.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/50 bg-white/50 dark:bg-white/[0.03] px-4 py-2.5 text-sm transition-colors hover:bg-accent/40"
              >
                <input
                  type="checkbox"
                  checked={enabledEvents.has(evt.id)}
                  onChange={() => toggle(evt.id)}
                  className="h-4 w-4 rounded border-border accent-[#2006F7]"
                />
                <span className="text-foreground">{evt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={`${GLASS} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">Recent deliveries</h3>
        </div>
        <div className="divide-y divide-border/40">
          {deliveries.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground space-y-3 max-w-lg mx-auto">
              <p>
                No webhook deliveries logged yet. Rows appear when outbound webhooks run and write
                to the <strong className="text-foreground">audit log</strong>.
              </p>
              <p className="text-xs leading-relaxed">
                Trace activity in Assess → workspace → Settings →{" "}
                <WorkspacePanelLink
                  section="audit"
                  className="font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                >
                  Activity Log
                </WorkspacePanelLink>
                .
              </p>
            </div>
          ) : (
            deliveries.map((d) => (
              <div key={d.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <span className="shrink-0">
                  {d.success ? (
                    <Check className="h-4 w-4 text-[#00F2B3]" />
                  ) : (
                    <X className="h-4 w-4 text-[#EA0022]" />
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground w-40 shrink-0">
                  {formatTs(d.timestamp)}
                </span>
                <span className="text-foreground truncate">
                  {WEBHOOK_EVENTS.find((e) => e.id === d.event)?.label ?? d.event}
                </span>
                <span
                  className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold font-mono border ${
                    d.success
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                      : "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25"
                  }`}
                >
                  {d.statusCode}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AgentsTab() {
  const { org } = useAuth();
  const [realAgents, setRealAgents] = useState<Agent[]>(DEMO_AGENTS);
  const [loaded, setLoaded] = useState(false);
  const [logAgent, setLogAgent] = useState<Agent | null>(null);
  const [activityRows, setActivityRows] = useState<AgentActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (!org?.id) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("agents")
          .select(
            "id, name, firewall_host, last_seen_at, status, hardware_model, error_message, connector_version",
          )
          .eq("org_id", org.id);
        if (cancelled) return;
        if (!data || data.length === 0) {
          setRealAgents([]);
          setLoaded(true);
          return;
        }

        const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: submissions } = await supabase
          .from("agent_submissions")
          .select("agent_id, created_at")
          .eq("org_id", org.id);

        const totalMap = new Map<string, number>();
        const last7dMap = new Map<string, number>();
        for (const s of submissions ?? []) {
          totalMap.set(s.agent_id, (totalMap.get(s.agent_id) ?? 0) + 1);
          if (s.created_at >= sevenAgo) {
            last7dMap.set(s.agent_id, (last7dMap.get(s.agent_id) ?? 0) + 1);
          }
        }

        const mapped: Agent[] = data.map((a) => ({
          id: a.id,
          hostname: a.firewall_host || a.name,
          lastHeartbeat: a.last_seen_at ?? "",
          status: a.status === "online" ? ("online" as const) : ("offline" as const),
          configPulls: totalMap.get(a.id) ?? 0,
          pullsLast7d: last7dMap.get(a.id) ?? 0,
          connectorVersion: a.connector_version,
          errorMessage: a.error_message,
        }));
        setRealAgents(mapped);
      } catch (err) {
        console.warn("[ApiHub] agents load failed", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  useEffect(() => {
    if (!logAgent || !org?.id) {
      setActivityRows([]);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    void supabase
      .from("agent_submissions")
      .select("id, created_at, overall_score, overall_grade")
      .eq("org_id", org.id)
      .eq("agent_id", logAgent.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[ApiHub] agent activity load failed", error);
          setActivityRows([]);
        } else {
          setActivityRows((data ?? []) as AgentActivityRow[]);
        }
        setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logAgent, org?.id]);

  return (
    <div className="space-y-6">
      <div className={`${GLASS} p-4 text-xs text-muted-foreground leading-relaxed space-y-2`}>
        <p>
          Install agents, API keys, and schedules: Assess → workspace panel → Settings →{" "}
          <WorkspacePanelLink section="agents">FireComply Connector Agents</WorkspacePanelLink>.
        </p>
        <p>
          Fleet-wide scores and assessments:{" "}
          <Link
            to="/command"
            className="font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
          >
            Open Fleet
          </Link>
          .
        </p>
      </div>

      <Sheet
        open={logAgent !== null}
        onOpenChange={(open) => {
          if (!open) setLogAgent(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Agent activity</SheetTitle>
            <SheetDescription>
              Config submissions received from this connector in FireComply. For raw debug logs,
              open the agent app on the firewall host and use its Log viewer.
            </SheetDescription>
          </SheetHeader>
          {logAgent && (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                <p className="font-medium text-foreground">{logAgent.hostname}</p>
                <p className="mt-1 font-mono text-muted-foreground break-all">{logAgent.id}</p>
              </div>
              {logAgent.errorMessage?.trim() ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                  <p className="font-semibold">Last connector error</p>
                  <p className="mt-1 whitespace-pre-wrap">{logAgent.errorMessage}</p>
                </div>
              ) : null}
              {activityLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
                </div>
              ) : activityRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No submissions yet. After the agent uploads a config, each run appears here with
                  score and time.
                </p>
              ) : (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium text-right">Score</th>
                        <th className="px-3 py-2 font-medium text-right">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {activityRows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                            {formatTs(row.created_at)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.overall_score}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {row.overall_grade}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground">Agent fleet</h3>
        <Button size="sm" className="gap-1.5" asChild>
          <WorkspacePanelLink section="agents" className="inline-flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Register / install connector
          </WorkspacePanelLink>
        </Button>
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
        </div>
      ) : realAgents.length === 0 ? (
        <div className={`${GLASS} p-8 text-center space-y-3 max-w-lg mx-auto`}>
          <Server className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No agents deployed</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Register and download installers from Assess → workspace panel → Settings →{" "}
            <WorkspacePanelLink section="agents">FireComply Connector Agents</WorkspacePanelLink>.
            After deployment, monitor the fleet from{" "}
            <Link
              to="/command"
              className="font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
            >
              Fleet
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className={`${GLASS} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Agent ID</th>
                  <th className="px-5 py-3 font-semibold">Hostname</th>
                  <th className="px-5 py-3 font-semibold">Connector</th>
                  <th className="px-5 py-3 font-semibold">Last Heartbeat</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th
                    className="px-5 py-3 font-semibold text-right"
                    title="All-time submission count"
                  >
                    Pulls
                  </th>
                  <th
                    className="px-5 py-3 font-semibold text-right"
                    title="Submissions in last 7 days"
                  >
                    7d
                  </th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {realAgents.map((a) => (
                  <tr key={a.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {shortAgentId(a.id)}
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">{a.hostname}</td>
                    <td className="px-5 py-3 text-xs font-mono text-muted-foreground">
                      {a.connectorVersion ? (
                        <span
                          className={
                            isConnectorVersionOutdated(a.connectorVersion)
                              ? "text-[#F29400] font-semibold"
                              : ""
                          }
                          title={`Latest: ${getLatestConnectorVersion()}`}
                        >
                          {a.connectorVersion}
                        </span>
                      ) : (
                        <span className="italic opacity-70">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {timeAgoStr(a.lastHeartbeat)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          a.status === "online"
                            ? "bg-[#00F2B3]/15 text-[#007A5A] dark:text-[#00F2B3] border-[#00F2B3]/25"
                            : "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25"
                        }`}
                      >
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${a.status === "online" ? "bg-[#00F2B3]" : "bg-[#EA0022]"}`}
                        />
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted-foreground">
                      {a.configPulls}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-muted-foreground">
                      {a.pullsLast7d}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs"
                        onClick={() => setLogAgent(a)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Logs
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`${GLASS} p-5 space-y-3`}>
        <h3 className="text-sm font-semibold text-foreground">Connector installer matrix</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Builds are published on{" "}
          <a
            href="https://github.com/joseph15562/sophos-firecomply/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
          >
            GitHub Releases
          </a>
          . Register the agent on Assess first (
          <WorkspacePanelLink section="agents">Connector agents</WorkspacePanelLink>) to obtain an
          API key, then install on a host that can reach the firewall XML API.
        </p>
        <div className="rounded-lg border border-border/50 overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Platform</th>
                <th className="px-3 py-2 font-medium">Artefact</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              <tr>
                <td className="px-3 py-2 text-foreground">Windows x64</td>
                <td className="px-3 py-2 font-mono text-[11px]">FireComply-Connector-Setup.exe</td>
                <td className="px-3 py-2 text-muted-foreground">Service or interactive install</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-foreground">macOS (Apple Silicon / Intel)</td>
                <td className="px-3 py-2 font-mono text-[11px]">FireComply-Connector-mac.zip</td>
                <td className="px-3 py-2 text-muted-foreground">
                  Extract and run per README in release
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-foreground">Linux x64</td>
                <td className="px-3 py-2 font-mono text-[11px]">FireComply-Connector.AppImage</td>
                <td className="px-3 py-2 text-muted-foreground">chmod +x; no root required</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-foreground">Linux ARM64</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  TBD per release
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  Ship when CI publishes arm64 bundle
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">
          If a download 404s, the release may still be publishing — use{" "}
          <WorkspacePanelLink section="agents">Assess → Connector agents</WorkspacePanelLink> or
          contact support for checksums and signed packages.
        </p>
      </div>
    </div>
  );
}

/* ───────── main page ───────── */

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "integrations", label: "Integrations", icon: <Plug className="h-4 w-4" /> },
  { id: "api", label: "API Explorer", icon: <Code2 className="h-4 w-4" /> },
  { id: "webhooks", label: "Webhooks", icon: <Webhook className="h-4 w-4" /> },
  { id: "agents", label: "Agents", icon: <Cpu className="h-4 w-4" /> },
];

function ApiHubInner() {
  const [activeTab, setActiveTab] = useState<TabId>("integrations");
  const { resolvedTheme, setTheme } = useTheme();
  const auth = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0a0a2e] via-[#111152] to-[#1a1a5c] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(32,6,247,0.18),transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-10">
          <nav className="mb-6 flex items-center gap-2 text-sm text-white/60">
            <Link to="/" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-white/90 font-medium">API &amp; Integrations</span>
          </nav>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">API &amp; Integrations</h1>
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-base text-white/70 max-w-lg">
            Automate and extend FireComply — connect third-party tools, explore the REST API, manage
            webhooks, and monitor your agent fleet.
          </p>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Tab pills */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <TabPill
              key={t.id}
              active={activeTab === t.id}
              label={t.label}
              icon={t.icon}
              onClick={() => setActiveTab(t.id)}
            />
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "integrations" && <IntegrationsTab />}
        {activeTab === "api" && <ApiExplorerTab />}
        {activeTab === "webhooks" && <WebhooksTab />}
        {activeTab === "agents" && <AgentsTab />}
      </main>
    </div>
  );
}

export default function ApiHub() {
  const auth = useAuthProvider();
  return (
    <AuthProvider value={auth}>
      <ApiHubInner />
    </AuthProvider>
  );
}

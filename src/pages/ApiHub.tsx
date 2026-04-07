import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Code2,
  Plug,
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
  Users,
  Monitor,
  Shield,
  FileText,
  BarChart3,
  GitCompare,
  ScrollText,
  ClipboardList,
  Cloud,
  Terminal,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiDocumentation } from "@/components/ApiDocumentation";
import { EmptyState } from "@/components/EmptyState";
import { getLatestConnectorVersion, isConnectorVersionOutdated } from "@/lib/connector-version";
import { useAuthProvider, AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense } from "react";
import { WorkspacePanelLink } from "@/components/WorkspaceSettingsStrip";
import { WorkspacePrimaryNav } from "@/components/WorkspacePrimaryNav";
import { FireComplyWorkspaceHeader } from "@/components/FireComplyWorkspaceHeader";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  MOCK_API_CALLS_HOURLY,
  MOCK_API_BY_ENDPOINT,
  MOCK_API_KEYS,
  MOCK_API_RECENT_REQUESTS,
} from "@/lib/mock-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  API_REFERENCE_ENDPOINTS,
  resolveApiReferenceEndpointUrl,
  type ApiReferenceEndpoint,
} from "@/data/api-reference-endpoints";

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
  MIXED: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25",
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

function curlOneLiner(ep: ApiReferenceEndpoint, fullUrl: string): string {
  if (ep.authMode === "none") {
    if (ep.method === "GET" || ep.method === "DELETE") {
      return `curl -sS -X ${ep.method} "${fullUrl}"`;
    }
    if (ep.method === "MIXED") {
      return `# Public / multi-method — see description and OpenAPI\ncurl -sS -X GET "${fullUrl}"`;
    }
    const body = (ep.requestBody ?? "{}")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    return `curl -sS -X ${ep.method} "${fullUrl}" -H "Content-Type: application/json" -d "${body}"`;
  }
  if (ep.authMode === "service-key") {
    return `curl -sS -X GET "${fullUrl}" -H "X-FireComply-Service-Key: YOUR_SERVICE_KEY"`;
  }
  const authHeader = `Authorization: Bearer YOUR_JWT_HERE`;
  if (ep.method === "MIXED") {
    return `# ${ep.path} — multiple methods; see OpenAPI\ncurl -sS -X GET "${fullUrl}" -H "${authHeader}"`;
  }
  if (ep.method === "GET" || ep.method === "DELETE") {
    return `curl -sS -X ${ep.method} "${fullUrl}" -H "${authHeader}"`;
  }
  const body = (ep.requestBody ?? "{}")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `curl -sS -X ${ep.method} "${fullUrl}" -H "${authHeader}" -H "Content-Type: application/json" -d "${body}"`;
}

function fetchSnippet(ep: ApiReferenceEndpoint, fullUrl: string): string {
  if (ep.authMode === "none") {
    if (ep.method === "GET" || ep.method === "DELETE") {
      return `const res = await fetch("${fullUrl}", { method: "${ep.method}" });
const data = await res.json();`;
    }
    if (ep.method === "MIXED") {
      return `// ${ep.path} — see OpenAPI for methods and bodies
const res = await fetch("${fullUrl}", { method: "GET" });
const data = await res.json();`;
    }
    const rawBody = (ep.requestBody ?? "{}").trim();
    return `const body = ${JSON.stringify(rawBody)};
const res = await fetch("${fullUrl}", {
  method: "${ep.method}",
  headers: { "Content-Type": "application/json" },
  body,
});
const data = await res.json();`;
  }
  if (ep.authMode === "service-key") {
    return `const res = await fetch("${fullUrl}", {
  headers: { "X-FireComply-Service-Key": "<your-service-key>" },
});
const data = await res.json();`;
  }
  if (ep.method === "GET" || ep.method === "DELETE") {
    return `const res = await fetch("${fullUrl}", {
  method: "${ep.method}",
  headers: { Authorization: "Bearer <your-jwt>" },
});
const data = await res.json();`;
  }
  if (ep.method === "MIXED") {
    return `// ${ep.path} — multiple methods; see OpenAPI
const res = await fetch("${fullUrl}", {
  method: "GET",
  headers: { Authorization: "Bearer <your-jwt>" },
});
const data = await res.json();`;
  }
  const rawBody = (ep.requestBody ?? "{}").trim();
  return `const body = ${JSON.stringify(rawBody)};
const res = await fetch("${fullUrl}", {
  method: "${ep.method}",
  headers: {
    Authorization: "Bearer <your-jwt>",
    "Content-Type": "application/json",
  },
  body,
});
const data = await res.json();`;
}

async function copyToClipboard(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

function WorkspaceResourceStrip() {
  const pill =
    "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[#2006F7]/35 hover:bg-white dark:bg-white/[0.06] dark:hover:border-[#00EDFF]/30";
  return (
    <div className={`${GLASS} p-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Workspace shortcuts
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/" className={pill}>
          <Shield className="h-3.5 w-3.5 text-[#2006F7]" />
          Assess
        </Link>
        <Link to="/command" className={pill}>
          <Monitor className="h-3.5 w-3.5 text-[#009CFB]" />
          Fleet
        </Link>
        <Link to="/customers" className={pill}>
          <Users className="h-3.5 w-3.5 text-[#2006F7]" />
          Customers
        </Link>
        <Link to="/central/overview" className={pill}>
          <Cloud className="h-3.5 w-3.5 text-[#00EDFF]" />
          Central hub
        </Link>
        <Link to="/reports" className={pill}>
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          Reports
        </Link>
        <Link to="/insights" className={pill}>
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          Insights
        </Link>
        <Link to="/drift" className={pill}>
          <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
          Drift
        </Link>
        <Link to="/audit" className={pill}>
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
          Activity
        </Link>
        <Link to="/changelog" className={pill}>
          <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
          Updates
        </Link>
      </div>
    </div>
  );
}

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

function EndpointRow({ ep }: { ep: ApiReferenceEndpoint }) {
  const [expanded, setExpanded] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const fullUrl = resolveApiReferenceEndpointUrl(supabaseUrl, ep);
  const responseDoc = `${ep.responseShape}\n\n— Example —\n\n${ep.exampleResponse}`;
  return (
    <div className={`${GLASS} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-accent/40 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold font-mono ${METHOD_COLORS[ep.method] ?? "border-border bg-muted/40 text-muted-foreground"}`}
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

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Full URL
            </span>
            <code className="flex-1 min-w-0 truncate rounded-lg bg-slate-950/90 px-2 py-1.5 font-mono text-[11px] text-emerald-300/95">
              {fullUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                void copyToClipboard(fullUrl, "URL copied");
              }}
            >
              <Copy className="h-3 w-3" />
              URL
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                void copyToClipboard(curlOneLiner(ep, fullUrl), "cURL copied");
              }}
            >
              <Terminal className="h-3 w-3" />
              cURL
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                void copyToClipboard(fetchSnippet(ep, fullUrl), "fetch() copied");
              }}
            >
              <Code2 className="h-3 w-3" />
              fetch
            </Button>
          </div>

          {ep.queryParams.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold text-foreground mb-1.5">Query parameters</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                {ep.queryParams.map((q) => (
                  <li key={q.name}>
                    <code className="text-emerald-300/90">{q.name}</code> ({q.type}) — {q.desc}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {ep.requestBody ? (
            <div>
              <p className="text-[11px] font-semibold text-foreground mb-1.5">Request body</p>
              <pre className="rounded-xl bg-slate-950 p-4 text-[12px] font-mono text-emerald-300 overflow-x-auto">
                {ep.requestBody}
              </pre>
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-semibold text-foreground mb-1.5">Response</p>
            <pre className="rounded-xl bg-slate-950 p-4 text-[12px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
              {responseDoc}
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

function useOrgActiveServiceKeyStats(orgId: string | undefined) {
  const [count, setCount] = useState<number | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!orgId);

  useEffect(() => {
    if (!orgId) {
      setCount(null);
      setLastUsedAt(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("org_service_api_keys")
      .select("last_used_at")
      .eq("org_id", orgId)
      .is("revoked_at", null)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setCount(0);
          setLastUsedAt(null);
          setLoading(false);
          return;
        }
        setCount(data.length);
        let max: string | null = null;
        for (const row of data) {
          const t = row.last_used_at;
          if (!t) continue;
          if (!max || t > max) max = t;
        }
        setLastUsedAt(max);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return { count, lastUsedAt, loading };
}

function formatApiHubShortDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ApiExplorerTab() {
  const { isGuest, org } = useAuth();
  const useLiveWorkspace = !isGuest && !!org;
  const keyStats = useOrgActiveServiceKeyStats(useLiveWorkspace ? org!.id : undefined);

  const [endpointQuery, setEndpointQuery] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [revealConfirmId, setRevealConfirmId] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [demoKeys, setDemoKeys] = useState(() => [...MOCK_API_KEYS]);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const apiBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

  const filteredEndpoints = useMemo(() => {
    const q = endpointQuery.trim().toLowerCase();
    if (!q) return API_REFERENCE_ENDPOINTS;
    return API_REFERENCE_ENDPOINTS.filter(
      (ep) =>
        ep.path.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        ep.id.toLowerCase().includes(q),
    );
  }, [endpointQuery]);

  const methodBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ep of filteredEndpoints) {
      m[ep.method] = (m[ep.method] ?? 0) + 1;
    }
    return m;
  }, [filteredEndpoints]);

  const lastKeyUseLabel = formatApiHubShortDate(keyStats.lastUsedAt);

  return (
    <div className="space-y-6">
      {useLiveWorkspace ? (
        <p className="text-[11px] text-muted-foreground rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
          Request volume, latency, and per-endpoint analytics are not collected in the workspace
          yet. <strong className="text-foreground">Scoped service keys</strong> below are your
          organisation&apos;s live keys (the same list as Integrations → Scoped service keys on this
          page).
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          Usage KPIs and keys below use{" "}
          <strong className="text-foreground">structured demo data</strong> for layout — sign in
          with an organisation for live keys, or open Scoped service keys under Settings.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`${GLASS} p-4 flex items-center gap-3`}>
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              API status
            </p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Operational</p>
          </div>
        </div>
        {useLiveWorkspace ? (
          <>
            <div className={`${GLASS} p-4`}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Active service keys
              </p>
              <p className="text-2xl font-bold tabular-nums mt-1">
                {keyStats.loading ? "—" : keyStats.count}
              </p>
            </div>
            <div className={`${GLASS} p-4`}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Last key use
              </p>
              <p className="text-sm font-bold mt-1 leading-snug">
                {keyStats.loading ? (
                  "—"
                ) : lastKeyUseLabel ? (
                  lastKeyUseLabel
                ) : (
                  <span className="text-muted-foreground font-normal">Not recorded yet</span>
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className={`${GLASS} p-4`}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Requests today
              </p>
              <p className="text-2xl font-bold tabular-nums mt-1">2,847</p>
            </div>
            <div className={`${GLASS} p-4`}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Avg response
              </p>
              <p className="text-2xl font-bold tabular-nums mt-1">
                142<span className="text-sm font-normal text-muted-foreground">ms</span>
              </p>
            </div>
          </>
        )}
      </div>

      {useLiveWorkspace ? (
        <div className={`${GLASS} p-5 space-y-4`}>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Scoped service API keys</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Create and revoke keys for automation. The secret is shown only once when a key is
              issued.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2006F7] border-t-transparent" />
                Loading keys…
              </div>
            }
          >
            <OrgServiceKeysSettings />
          </Suspense>
        </div>
      ) : (
        <div className={`${GLASS} p-5 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-semibold">API keys</h3>
            <Button type="button" size="sm" onClick={() => setCreateKeyOpen(true)}>
              Create new key
            </Button>
          </div>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Key</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs">Last used</TableHead>
                  <TableHead className="text-xs">Permissions</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoKeys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="text-sm font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {revealedKeys[k.id] ? "sk-fc-demo-reveal-9a1b2c3d4e5f" : k.masked}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{k.created}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{k.lastUsed}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={k.permissions}>
                      {k.permissions}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setRevealConfirmId(k.id)}
                      >
                        Reveal
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:text-destructive"
                        onClick={() => setRevokeConfirmId(k.id)}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {useLiveWorkspace ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${GLASS} p-4 h-[220px] flex flex-col`}>
            <p className="text-xs font-semibold mb-2 shrink-0">Calls per hour (24h)</p>
            <div className="flex flex-1 min-h-0 items-center justify-center px-4 text-center">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Hourly request volume is not available yet. Use your API gateway or observability
                stack for traffic charts.
              </p>
            </div>
          </div>
          <div className={`${GLASS} p-4 h-[220px] flex flex-col`}>
            <p className="text-xs font-semibold mb-2 shrink-0">Top endpoints</p>
            <div className="flex flex-1 min-h-0 items-center justify-center px-4 text-center">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Per-endpoint usage is not tracked in FireComply yet.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${GLASS} p-4 h-[220px]`}>
            <p className="text-xs font-semibold mb-2">Calls per hour (24h)</p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_API_CALLS_HOURLY}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="calls"
                  stroke="#2006F7"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={`${GLASS} p-4 h-[220px]`}>
            <p className="text-xs font-semibold mb-2">Top endpoints</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={MOCK_API_BY_ENDPOINT}
                layout="vertical"
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="path" width={120} tick={{ fontSize: 9 }} />
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="calls" fill="#00EDFF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {useLiveWorkspace ? (
        <div className={`${GLASS} p-5`}>
          <h3 className="text-sm font-semibold mb-3">Recent requests</h3>
          <EmptyState
            className="py-10"
            title="No request log yet"
            description="Individual API calls are not listed here. Use server logs or your gateway for request-level tracing."
          />
        </div>
      ) : (
        <div className={`${GLASS} p-5`}>
          <h3 className="text-sm font-semibold mb-3">Recent requests</h3>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Endpoint</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Latency</TableHead>
                <TableHead className="text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_API_RECENT_REQUESTS.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.endpoint}</TableCell>
                  <TableCell className="text-xs">{r.method}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.status}</TableCell>
                  <TableCell className="text-xs tabular-nums">{r.latencyMs}ms</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.ts}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!useLiveWorkspace && (
        <>
          <AlertDialog
            open={revealConfirmId !== null}
            onOpenChange={(o) => !o && setRevealConfirmId(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reveal API key?</AlertDialogTitle>
                <AlertDialogDescription>
                  Anyone with access to this screen could copy the full secret. Continue only in a
                  safe environment.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (revealConfirmId)
                      setRevealedKeys((prev) => ({ ...prev, [revealConfirmId]: true }));
                    setRevealConfirmId(null);
                    toast.success("Key revealed (demo)");
                  }}
                >
                  Reveal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={revokeConfirmId !== null}
            onOpenChange={(o) => !o && setRevokeConfirmId(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke this key?</AlertDialogTitle>
                <AlertDialogDescription>
                  Automations using this key will fail until you issue a replacement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (revokeConfirmId)
                      setDemoKeys((prev) => prev.filter((x) => x.id !== revokeConfirmId));
                    setRevokeConfirmId(null);
                    toast.success("Key revoked (demo)");
                  }}
                >
                  Revoke
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="new-key-name" className="text-xs">
                    Name
                  </Label>
                  <Input id="new-key-name" placeholder="CI export" className="h-9" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Demo only — production keys are provisioned from org service key settings.
                </p>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    setCreateKeyOpen(false);
                    toast.success("Key queued (demo)");
                  }}
                >
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

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

      <div className={`${GLASS} p-5 space-y-3`}>
        <h3 className="text-sm font-semibold text-foreground">REST base URL</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Primary JWT routes use the Edge function below (each row expands to the resolved URL).
          Public and auxiliary functions (<code className="font-mono text-[11px]">api-public</code>,{" "}
          <code className="font-mono text-[11px]">portal-data</code>,{" "}
          <code className="font-mono text-[11px]">parse-config</code>) use different bases — see
          each endpoint.
        </p>
        <div className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 font-mono text-[11px] text-emerald-300 break-all">
          <span className="select-all flex-1 min-w-0">{apiBaseUrl}</span>
          <button
            type="button"
            className="shrink-0 text-slate-400 hover:text-white transition-colors"
            title="Copy base URL"
            onClick={() => void copyToClipboard(apiBaseUrl, "Base URL copied")}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className={`${GLASS} p-5`}>
        <h3 className="text-sm font-semibold text-foreground mb-1">Authentication</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Most org routes use a JWT in the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            Authorization
          </code>{" "}
          header; public routes omit it;{" "}
          <code className="font-mono text-[11px]">GET /api/service-key/ping</code> uses{" "}
          <code className="font-mono text-[11px]">X-FireComply-Service-Key</code>. Expand an
          endpoint for copy-ready cURL and fetch snippets.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 font-mono text-xs text-emerald-300">
          <span className="select-all">Authorization: Bearer {"<your-jwt>"}</span>
          <button
            type="button"
            className="ml-auto text-slate-400 hover:text-white transition-colors"
            title="Copy header template"
            onClick={() =>
              void copyToClipboard("Authorization: Bearer <your-jwt>", "Header template copied")
            }
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Endpoints</h3>
            {filteredEndpoints.length > 0 ? (
              <p className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>
                  <strong className="text-foreground">{filteredEndpoints.length}</strong> in view
                </span>
                {Object.entries(methodBreakdown)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([method, count]) => (
                    <span
                      key={method}
                      className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold ${METHOD_COLORS[method] ?? "border-border bg-muted/40"}`}
                    >
                      {method} ×{count}
                    </span>
                  ))}
              </p>
            ) : null}
          </div>
          <Input
            value={endpointQuery}
            onChange={(e) => setEndpointQuery(e.target.value)}
            placeholder="Filter by path, method, or description…"
            className="h-9 max-w-md bg-white/70 dark:bg-white/[0.06]"
          />
        </div>
        {filteredEndpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No endpoints match &quot;{endpointQuery.trim()}&quot;.
          </p>
        ) : (
          filteredEndpoints.map((ep) => <EndpointRow key={ep.id} ep={ep} />)
        )}
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

  const saveWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!org?.id) throw new Error("No organisation");
      const { error } = await supabase
        .from("organisations")
        .update({ webhook_url: url })
        .eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: (_, url) => setSavedUrl(url),
  });

  const saveWebhookUrl = () => {
    if (!org?.id) return;
    saveWebhookMutation.mutate(webhookUrl);
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
            <EmptyState
              className="py-8 px-5 max-w-lg mx-auto"
              title="No webhook deliveries yet"
              description="Rows appear when outbound webhooks run and write to the audit log."
              action={
                <p className="text-xs text-muted-foreground leading-relaxed text-center max-w-md">
                  Trace activity in Assess → workspace → Settings →{" "}
                  <WorkspacePanelLink
                    section="audit"
                    className="font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                  >
                    Activity Log
                  </WorkspacePanelLink>
                  .
                </p>
              }
            />
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
                <EmptyState
                  className="py-6"
                  title="No submissions yet"
                  description="After the agent uploads a config, each run appears here with score and time."
                />
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
        <div className={GLASS}>
          <EmptyState
            className="py-10 px-5 max-w-lg mx-auto"
            icon={<Server className="h-6 w-6 text-muted-foreground" />}
            title="No agents deployed"
            description="Register and download installers from the workspace settings, then monitor the fleet from Fleet Command."
            action={
              <p className="text-xs text-muted-foreground leading-relaxed text-center max-w-md">
                Assess → workspace → Settings →{" "}
                <WorkspacePanelLink section="agents">
                  FireComply Connector Agents
                </WorkspacePanelLink>
                . After deployment, open{" "}
                <Link
                  to="/command"
                  className="font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
                >
                  Fleet
                </Link>
                .
              </p>
            }
          />
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
  const { isGuest } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <FireComplyWorkspaceHeader loginShell={isGuest} />

      <WorkspacePrimaryNav />

      {/* ── Body ── */}
      <main
        className="mx-auto max-w-6xl px-6 pt-8 space-y-8 assist-chrome-pad-bottom"
        data-tour="tour-page-api"
      >
        <div className="space-y-1" data-tour="tour-api-hero">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            API &amp; Integrations
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Automate and extend FireComply — connect third-party tools, explore the REST API, manage
            webhooks, and monitor your agent fleet.
          </p>
        </div>

        {/* Tab pills */}
        <div className="flex flex-wrap gap-2" data-tour="tour-api-tabs">
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

        <div className="space-y-6" data-tour="tour-api-panel">
          <WorkspaceResourceStrip />

          {/* Tab content */}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "api" && <ApiExplorerTab />}
          {activeTab === "webhooks" && <WebhooksTab />}
          {activeTab === "agents" && <AgentsTab />}
        </div>
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

import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Upload,
  Download,
  Settings,
  User,
  Shield,
  AlertTriangle,
  FileText,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CARD_CLASS =
  "rounded-xl border border-border/50 bg-card p-5 shadow-card transition-[box-shadow,border-color] duration-200 hover:shadow-elevated hover:border-border/70";
const STORAGE_KEY = "firecomply-audit-log";

export type AuditActionType =
  | "assessment_upload"
  | "config_export"
  | "settings_change"
  | "user_login"
  | "finding_accepted"
  | "report_generated"
  | "sla_breach"
  | "agent_registered";

interface AuditEvent {
  id: string;
  actionType: AuditActionType;
  description: string;
  user?: string;
  timestamp: string;
}

const ACTION_LABELS: Record<AuditActionType, string> = {
  assessment_upload: "Assessment upload",
  config_export: "Config export",
  settings_change: "Settings change",
  user_login: "User login",
  finding_accepted: "Finding accepted",
  report_generated: "Report generated",
  sla_breach: "SLA breach",
  agent_registered: "Agent registered",
};

const ACTION_ICONS: Record<AuditActionType, React.ReactNode> = {
  assessment_upload: <Upload className="h-4 w-4" />,
  config_export: <Download className="h-4 w-4" />,
  settings_change: <Settings className="h-4 w-4" />,
  user_login: <User className="h-4 w-4" />,
  finding_accepted: <Shield className="h-4 w-4" />,
  report_generated: <FileText className="h-4 w-4" />,
  sla_breach: <AlertTriangle className="h-4 w-4" />,
  agent_registered: <Activity className="h-4 w-4" />,
};

function loadAuditEvents(): AuditEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const events: AuditEvent[] = raw ? JSON.parse(raw) : [];
    if (events.length === 0) {
      const seed: AuditEvent[] = [
        {
          id: "1",
          actionType: "assessment_upload",
          description: "Config uploaded for firewall XGS-01",
          user: "admin@example.com",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: "2",
          actionType: "report_generated",
          description: "Executive report exported as PDF",
          user: "admin@example.com",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: "3",
          actionType: "finding_accepted",
          description: "Finding 'Broad source zone' accepted",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: "4",
          actionType: "settings_change",
          description: "Alert webhook URL updated",
          user: "ops@example.com",
          timestamp: new Date(Date.now() - 172800000).toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch {
    return [];
  }
}

export function ActivityTimeline() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<AuditActionType | "all">("all");

  useEffect(() => {
    setEvents(loadAuditEvents());
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.actionType === filter);
  }, [events, filter]);

  const actionTypes: (AuditActionType | "all")[] = [
    "all",
    ...(Object.keys(ACTION_LABELS) as AuditActionType[]),
  ];

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
        <Activity className="h-4 w-4" />
        Activity Audit Timeline
      </h3>
      <p className="text-[10px] text-muted-foreground mt-1">
        Chronological feed of actions across the platform.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">Filter</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as AuditActionType | "all")}>
          <SelectTrigger className="h-9 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t === "all" ? "All actions" : ACTION_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4">No events to show.</p>
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3 text-xs"
            >
              <div className="h-8 w-8 shrink-0 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
                {ACTION_ICONS[e.actionType]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{e.description}</p>
                <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                  {e.user && <span>{e.user}</span>}
                  <span>•</span>
                  <span>
                    {new Date(e.timestamp).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px]">
                    {ACTION_LABELS[e.actionType]}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

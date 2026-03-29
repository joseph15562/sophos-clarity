import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Search,
  ChevronDown,
  FileText,
  Shield,
  Users,
  Wifi,
  Upload,
  Trash2,
  Download,
  ExternalLink,
  Plug,
} from "lucide-react";
import { loadAuditLog, type AuditEntry, type AuditAction } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_META: Record<AuditAction, { label: string; icon: typeof FileText; color: string }> = {
  "report.generated": { label: "Report generated", icon: FileText, color: "text-brand-accent" },
  "report.saved": {
    label: "Report saved",
    icon: FileText,
    color: "text-[#007A5A] dark:text-[#00F2B3]",
  },
  "report.deleted": { label: "Report deleted", icon: Trash2, color: "text-[#EA0022]" },
  "config.uploaded": { label: "Config uploaded", icon: Upload, color: "text-brand-accent" },
  "assessment.saved": {
    label: "Assessment saved",
    icon: Shield,
    color: "text-[#007A5A] dark:text-[#00F2B3]",
  },
  "central.linked": { label: "Central API linked", icon: Wifi, color: "text-[#005BC8]" },
  "central.synced": { label: "Central synced", icon: Wifi, color: "text-[#009CFB]" },
  "connectwise.linked": {
    label: "ConnectWise Cloud linked",
    icon: Plug,
    color: "text-[#5A00FF]",
  },
  "connectwise.disconnected": {
    label: "ConnectWise Cloud disconnected",
    icon: Plug,
    color: "text-muted-foreground",
  },
  "team.invited": { label: "Team member invited", icon: Users, color: "text-brand-accent" },
  "team.removed": { label: "Team member removed", icon: Users, color: "text-[#EA0022]" },
  "auth.login": {
    label: "User signed in",
    icon: Shield,
    color: "text-[#007A5A] dark:text-[#00F2B3]",
  },
  "auth.logout": { label: "User signed out", icon: Shield, color: "text-muted-foreground" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function AuditLog({ layout = "drawer" }: { layout?: "drawer" | "page" }) {
  const { org, isGuest } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [exportFrom, setExportFrom] = useState(() =>
    toISODate(new Date(Date.now() - 30 * 86_400_000)),
  );
  const [exportTo, setExportTo] = useState(() => toISODate(new Date()));
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!org?.id || isGuest) return;
    setLoading(true);
    const data = await loadAuditLog(org.id, showMore ? 200 : 50);
    setEntries(data);
    setLoading(false);
  }, [org?.id, isGuest, showMore]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = useCallback(async () => {
    if (!org?.id || isGuest) return;
    setExporting(true);
    try {
      const fromDate = `${exportFrom}T00:00:00.000Z`;
      const toDate = `${exportTo}T23:59:59.999Z`;
      const data = await loadAuditLog(org.id, 5000, 0, { fromDate, toDate });
      const meta = ACTION_META;
      if (exportFormat === "csv") {
        const header = "Date,Action,Resource Type,Resource ID,Metadata,User ID\n";
        const rows = data.map((e) => {
          const metaLabel = meta[e.action as AuditAction]?.label ?? e.action;
          const metaStr = JSON.stringify(e.metadata ?? {}).replace(/"/g, '""');
          return `${e.created_at},${metaLabel},${e.resource_type},${e.resource_id},"${metaStr}",${e.user_id ?? ""}`;
        });
        const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${exportFrom}-to-${exportTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${exportFrom}-to-${exportTo}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  }, [org?.id, isGuest, exportFrom, exportTo, exportFormat]);

  if (isGuest) {
    return (
      <div className="p-5 text-center text-xs text-muted-foreground">
        Sign in to view audit log.
      </div>
    );
  }

  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        const meta = ACTION_META[e.action as AuditAction];
        return (
          meta?.label.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.resource_type.toLowerCase().includes(q) ||
          JSON.stringify(e.metadata).toLowerCase().includes(q)
        );
      })
    : entries;

  const pad = layout === "page" ? "p-4 sm:p-6" : "p-5";

  return (
    <div className={`${pad} space-y-4`}>
      {layout === "drawer" && !isGuest && (
        <div className="flex justify-end -mt-1 mb-1">
          <Link
            to="/audit"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-[#2006F7] hover:underline dark:text-[#00EDFF]"
          >
            Open full screen
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
      <div className="rounded-[20px] border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,249,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(9,13,24,0.92),rgba(14,20,34,0.92))] shadow-[0_8px_30px_rgba(32,6,247,0.05)] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-accent/40" />
            <input
              type="text"
              placeholder="Search activity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent/30 transition-all"
            />
          </div>
          <span className="text-[10px] text-muted-foreground/70">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            className="rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] px-2.5 py-2 text-[11px]"
            title="Export from date"
          />
          <span className="text-[10px] text-muted-foreground/70">to</span>
          <input
            type="date"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
            className="rounded-xl border border-brand-accent/15 bg-brand-accent/[0.04] px-2.5 py-2 text-[11px]"
            title="Export to date"
          />
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "csv" | "json")}>
            <SelectTrigger className="w-[100px] h-8 text-xs rounded-xl border-brand-accent/15 bg-brand-accent/[0.04]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5 h-8 text-xs rounded-xl border-brand-accent/15 hover:bg-brand-accent/[0.06]"
          >
            <Download className="h-3 w-3" />
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <span className="animate-spin h-5 w-5 border-2 border-brand-accent/30 border-t-[#2006F7] rounded-full" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <Clock className="h-6 w-6 mx-auto mb-2 text-brand-accent/30" />
          {entries.length === 0
            ? "No activity recorded yet. Actions like saving reports, uploading configs, and managing your team will appear here."
            : "No matching events found."}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-0.5">
          {filtered.map((entry) => {
            const meta = ACTION_META[entry.action as AuditAction] ?? {
              label: entry.action,
              icon: Clock,
              color: "text-muted-foreground",
            };
            const Icon = meta.icon;
            const detail = entry.resource_type
              ? `${entry.resource_type}${entry.resource_id ? ` · ${entry.resource_id}` : ""}`
              : "";
            const metaStr =
              entry.metadata && Object.keys(entry.metadata).length > 0
                ? Object.entries(entry.metadata)
                    .filter(([, v]) => v !== undefined && v !== null && v !== "")
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")
                : "";

            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-brand-accent/[0.02] dark:hover:bg-brand-accent/[0.04] transition-colors group"
              >
                <div className={`mt-0.5 ${meta.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{meta.label}</p>
                  {(detail || metaStr) && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {detail}
                      {detail && metaStr ? " — " : ""}
                      {metaStr}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                  {timeAgo(entry.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && entries.length >= 50 && !showMore && (
        <button
          onClick={() => setShowMore(true)}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] text-brand-accent hover:underline py-2"
        >
          <ChevronDown className="h-3 w-3" /> Show more activity
        </button>
      )}
    </div>
  );
}

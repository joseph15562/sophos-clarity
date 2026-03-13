import { useState, useEffect, useCallback } from "react";
import { Clock, Search, ChevronDown, FileText, Shield, Users, Wifi, Upload, Trash2 } from "lucide-react";
import { loadAuditLog, type AuditEntry, type AuditAction } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";

const ACTION_META: Record<AuditAction, { label: string; icon: typeof FileText; color: string }> = {
  "report.generated": { label: "Report generated", icon: FileText, color: "text-[#2006F7] dark:text-[#00EDFF]" },
  "report.saved": { label: "Report saved", icon: FileText, color: "text-[#00995a] dark:text-[#00F2B3]" },
  "report.deleted": { label: "Report deleted", icon: Trash2, color: "text-[#EA0022]" },
  "config.uploaded": { label: "Config uploaded", icon: Upload, color: "text-[#2006F7] dark:text-[#00EDFF]" },
  "assessment.saved": { label: "Assessment saved", icon: Shield, color: "text-[#00995a] dark:text-[#00F2B3]" },
  "central.linked": { label: "Central API linked", icon: Wifi, color: "text-[#005BC8]" },
  "central.synced": { label: "Central synced", icon: Wifi, color: "text-[#009CFB]" },
  "team.invited": { label: "Team member invited", icon: Users, color: "text-[#2006F7] dark:text-[#00EDFF]" },
  "team.removed": { label: "Team member removed", icon: Users, color: "text-[#EA0022]" },
  "auth.login": { label: "User signed in", icon: Shield, color: "text-[#00995a] dark:text-[#00F2B3]" },
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

export function AuditLog() {
  const { org, isGuest } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showMore, setShowMore] = useState(false);

  const load = useCallback(async () => {
    if (!org?.id || isGuest) return;
    setLoading(true);
    const data = await loadAuditLog(org.id, showMore ? 200 : 50);
    setEntries(data);
    setLoading(false);
  }, [org?.id, isGuest, showMore]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search activity…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2006F7]/30"
          />
        </div>
        <span className="text-[10px] text-muted-foreground">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <span className="animate-spin h-5 w-5 border-2 border-[#2006F7]/30 border-t-[#2006F7] rounded-full" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
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
            const metaStr = entry.metadata && Object.keys(entry.metadata).length > 0
              ? Object.entries(entry.metadata)
                  .filter(([, v]) => v !== undefined && v !== null && v !== "")
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : "";

            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
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
          className="w-full flex items-center justify-center gap-1.5 text-[10px] text-[#2006F7] dark:text-[#00EDFF] hover:underline py-2"
        >
          <ChevronDown className="h-3 w-3" /> Show more activity
        </button>
      )}
    </div>
  );
}

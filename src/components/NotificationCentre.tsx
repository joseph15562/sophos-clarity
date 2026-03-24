import { useState } from "react";
import { Bell, CheckCheck, X, Trash2, AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import type { AppNotification, NotificationType } from "@/hooks/use-notifications";

interface Props {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

const TYPE_STYLE: Record<NotificationType, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: "text-[#009CFB]", bg: "bg-[#009CFB]/10" },
  success: { icon: CheckCircle, color: "text-[#00F2B3] dark:text-[#00F2B3]", bg: "bg-[#00F2B3]/10 dark:bg-[#00F2B3]/10" },
  warning: { icon: AlertTriangle, color: "text-[#F29400]", bg: "bg-[#F29400]/10" },
  error: { icon: XCircle, color: "text-[#EA0022]", bg: "bg-[#EA0022]/10" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function NotificationCentre({ notifications, unreadCount, onMarkRead, onMarkAllRead, onDismiss, onClearAll }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        data-tour="notification-bell"
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center h-7 w-7 rounded text-[#6A889B] hover:text-white hover:bg-[#10037C]/40 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        title="Notifications"
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-[#EA0022] text-white text-[8px] font-bold px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 w-80 rounded-xl border border-border/70 bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
              <span className="text-xs font-semibold text-foreground">Notifications</span>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="text-[10px] text-brand-accent hover:underline flex items-center gap-1"
                    title="Mark all read"
                  >
                    <CheckCheck className="h-3 w-3" /> Read all
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="text-[10px] text-muted-foreground hover:text-[#EA0022] flex items-center gap-1 ml-2"
                    title="Clear all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  <Bell className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                  No notifications yet
                </div>
              )}

              {notifications.map((n) => {
                const style = TYPE_STYLE[n.type];
                const Icon = style.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2.5 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${
                      !n.read ? "bg-[#2006F7]/[0.03] dark:bg-brand-accent/[0.06]" : ""
                    }`}
                    onClick={() => { if (!n.read) onMarkRead(n.id); }}
                  >
                    <div className={`mt-0.5 p-1 rounded ${style.bg} ${style.color} shrink-0`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium truncate ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#2006F7] dark:bg-[#00EDFF] shrink-0" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{n.message}</p>
                      <span className="text-[9px] text-muted-foreground/60 mt-1 block">{timeAgo(n.timestamp)}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
                      className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 mt-0.5"
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

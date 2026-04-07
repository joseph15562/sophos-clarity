import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: { label: string; onClick: () => void };
}

const STORAGE_KEY = "sophos-firecomply-notifications";
const MAX_NOTIFICATIONS = 50;

function loadFromStorage(): AppNotification[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return parsed.map((n) => ({ ...n, action: undefined }));
  } catch (err) {
    console.warn("[loadFromStorage]", err);
    return [];
  }
}

function saveToStorage(notifications: AppNotification[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const serializable = notifications.map(({ action: _action, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable.slice(0, MAX_NOTIFICATIONS)));
  } catch (err) {
    console.warn("[saveToStorage]", err);
  }
}

export type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (
    type: NotificationType,
    title: string,
    message: string,
    action?: { label: string; onClick: () => void },
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(notifications);
  }, [notifications]);

  const addNotification = useCallback(
    (
      type: NotificationType,
      title: string,
      message: string,
      action?: { label: string; onClick: () => void },
    ) => {
      const notif: AppNotification = {
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        title,
        message,
        timestamp: Date.now(),
        read: false,
        action,
      };
      setNotifications((prev) => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
    },
    [],
  );

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadCount = notifications.filter((n) => !n.read).length;
    return {
      notifications,
      unreadCount,
      addNotification,
      markRead,
      markAllRead,
      dismiss,
      clearAll,
    };
  }, [notifications, addNotification, markRead, markAllRead, dismiss, clearAll]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}

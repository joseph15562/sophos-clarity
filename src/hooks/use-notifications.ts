import { useState, useCallback, useEffect } from "react";

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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    // Exclude action callbacks (they can't be serialized)
    return parsed.map((n) => ({ ...n, action: undefined }));
  } catch (err) {
    console.warn("[loadFromStorage]", err);
    return [];
  }
}

function saveToStorage(notifications: AppNotification[]): void {
  try {
    const serializable = notifications.map(({ action, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable.slice(0, MAX_NOTIFICATIONS)));
  } catch (err) {
    console.warn("[saveToStorage]", err);
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadFromStorage());

  useEffect(() => { saveToStorage(notifications); }, [notifications]);

  const addNotification = useCallback((
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
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, addNotification, markRead, markAllRead, dismiss, clearAll };
}

import React, { useEffect, useRef, useState } from "react";
import { notificationsApi, type NotificationItem } from "../api/notifications";
import { socket } from "../socket";
import "./notification-bell.css";

function timeLabel(value: string) {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  if (difference < 60_000) return "teraz";
  if (difference < 3_600_000) return `${Math.floor(difference / 60_000)} min`;
  if (difference < 86_400_000) return `${Math.floor(difference / 3_600_000)} godz.`;
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
}

export default function NotificationBell({
  navigate
}: {
  navigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const result = await notificationsApi.list(50);
      setItems(result.notifications);
      setUnread(result.unread);
    } catch {
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    if (socket.disconnected) socket.connect();
    const onChanged = () => void refresh();
    const onCreated = (payload: { notification: NotificationItem }) => {
      setItems((current) => [payload.notification, ...current.filter((item) => item.id !== payload.notification.id)]);
      setUnread((current) => current + 1);
    };
    socket.on("notifications.changed", onChanged);
    socket.on("notification.created", onCreated);
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => {
      window.clearInterval(timer);
      socket.off("notifications.changed", onChanged);
      socket.off("notification.created", onCreated);
    };
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnread((current) => Math.max(0, current - 1));
      void notificationsApi.markRead(item.id).catch(() => undefined);
    }
    setOpen(false);
    if (!item.link) return;

    const target = new URL(item.link, window.location.origin);
    if (target.pathname === window.location.pathname) {
      window.location.assign(`${target.pathname}${target.search}${target.hash}`);
      return;
    }
    navigate(`${target.pathname}${target.search}${target.hash}`);
  }

  async function readAll() {
    await notificationsApi.markAllRead();
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
    setUnread(0);
  }

  return (
    <div className="notification-root" ref={rootRef}>
      <button
        className={`notification-trigger ${unread > 0 ? "has-unread" : ""}`}
        type="button"
        aria-label={`Powiadomienia${unread ? `: ${unread} nieprzeczytanych` : ""}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
      </button>

      {open && (
        <div className="notification-popover">
          <div className="notification-heading">
            <div><strong>Powiadomienia</strong><span>{unread} nowych</span></div>
            {unread > 0 && <button type="button" onClick={() => void readAll()}>Oznacz wszystkie</button>}
          </div>
          <div className="notification-list">
            {loading && !items.length && <div className="notification-empty">Ładowanie…</div>}
            {!loading && !items.length && <div className="notification-empty">Nie masz jeszcze powiadomień.</div>}
            {items.map((item) => (
              <button
                type="button"
                className={`notification-item ${item.readAt ? "" : "unread"}`}
                key={item.id}
                onClick={() => void openNotification(item)}
              >
                <span className="notification-dot" />
                <span className="notification-copy">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                  <small>{timeLabel(item.createdAt)}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

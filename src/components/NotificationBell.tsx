"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, Check, MessageSquare, Trophy, CreditCard, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  forum_reply: <MessageSquare className="w-4 h-4 text-blue-500" />,
  forum_mention: <MessageSquare className="w-4 h-4 text-indigo-500" />,
  badge: <Trophy className="w-4 h-4 text-yellow-500" />,
  payment_failed: <CreditCard className="w-4 h-4 text-red-500" />,
  support_reply: <MessageSquare className="w-4 h-4 text-green-500" />,
  message: <MessageSquare className="w-4 h-4 text-[var(--greek-blue)]" />,
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoading(true);
    const res = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setNotifications(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // refresh toutes les 30s
    return () => clearInterval(interval);
  }, []);

  // Fermer en cliquant en dehors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markAllRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ids: null }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative p-2 text-[var(--greek-cream)] hover:text-[var(--greek-gold)] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-[rgba(197,161,72,0.2)] z-[9999] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-[var(--greek-blue)] text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-gray-400 hover:text-[var(--greek-blue)] transition-colors flex items-center gap-1">
                  <Check className="w-3 h-3" /> Tout lire
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Chargement...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune notification</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!n.is_read ? "bg-blue-50/50" : ""}`}
                  onClick={() => { markRead(n.id); if (n.link) setOpen(false); }}
                >
                  <div className="shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] || <Info className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                        {n.link ? (
                          <Link href={n.link} className="hover:text-[var(--greek-blue)]">{n.title}</Link>
                        ) : n.title}
                      </p>
                      {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1" />}
                    </div>
                    {n.body && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-xs text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

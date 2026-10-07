"use client";

import { useVisiblePolling } from "@/lib/useVisiblePolling";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, MessageSquare, Trophy, CreditCard, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

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
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Clic sur une notif : marquée lue immédiatement (retire le point bleu +
   * décrémente le compteur), puis redirection vers l'endroit concerné. */
  const openNotification = (n: Notification) => {
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

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

  // Toutes les 60 s, et seulement onglet visible (au retour sur l'onglet, un
  // rafraîchissement part tout de suite).
  useVisiblePolling(fetchNotifications, 60000, { immediate: true });

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
      <span className="relative inline-block">
        <GlassIconButton
          icon={Bell}
          color="white"
          aria-label={unread > 0 ? `Notifications (${unread} non lues)` : "Notifications"}
          onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        />
        {unread > 0 && (
          <span className="pointer-events-none absolute -top-1 -right-1 z-10 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-[0_2px_6px_rgba(220,38,38,0.5)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </span>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl border border-[rgba(197,161,72,0.25)] z-[9999] overflow-hidden bg-white/85 backdrop-blur-[24px] backdrop-saturate-[1.4]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(197,161,72,0.15)]">
            <h3 className="font-bold text-[var(--greek-blue)] text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <GlassButton onClick={markAllRead} variant="ghost" size="sm">
                  <Check className="w-3 h-3" /> Tout lire
                </GlassButton>
              )}
              <GlassCloseButton onClick={() => setOpen(false)} size="sm" aria-label="Fermer le panneau de notifications" />
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
                  role="button"
                  tabIndex={0}
                  className={`flex gap-3 px-4 py-3 hover:bg-white/60 transition-colors cursor-pointer ${!n.is_read ? "bg-[var(--greek-blue)]/[0.06]" : ""}`}
                  onClick={() => openNotification(n)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNotification(n); } }}
                >
                  <div className="shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] || <Info className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                        {n.title}
                      </p>
                      {!n.is_read && <span className="w-2 h-2 bg-[var(--greek-gold)] rounded-full shrink-0 mt-1" />}
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

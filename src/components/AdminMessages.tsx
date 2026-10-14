"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle, Info, MessageCircle, Ban } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";

interface Notif {
  id: number;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const icons: any = {
  ban: <Ban className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
  message: <MessageCircle className="w-4 h-4" />,
};
const colors: any = {
  ban: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-orange-50 border-orange-200 text-orange-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
  message: "bg-[var(--greek-blue)]/5 border-[var(--greek-blue)]/20 text-[var(--greek-blue)]",
};

export default function AdminMessages() {
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/notifications");
        if (res.ok) setNotifs(await res.json());
      } catch (e) {
        console.error("Failed to load admin notifications:", e);
      }
    })();
  }, []);

  const dismiss = async (id: number) => {
    const res = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      console.error("Failed to dismiss notification");
      return;
    }
    setNotifs(n => n.filter(x => x.id !== id));
  };

  if (notifs.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifs.map(n => (
        <div key={n.id} className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg ${colors[n.type] || colors.message}`}>
          <div className="shrink-0 mt-0.5" aria-hidden="true">{icons[n.type] || icons.message}</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{n.title}</p>
            <p className="text-xs opacity-80 mt-0.5">{n.content}</p>
          </div>
          <GlassIconButton icon={X} onClick={() => dismiss(n.id)} color="gray" size="sm" aria-label="Fermer la notification" className="shrink-0" />
        </div>
      ))}
    </div>
  );
}

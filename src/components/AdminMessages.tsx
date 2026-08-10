"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Bell, X, AlertTriangle, Info, MessageCircle, Ban } from "lucide-react";

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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userData, error: userError } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
        if (userError) throw userError;
        if (!userData) return;
        const { data, error } = await supabase.from("admin_notifications").select("*").eq("user_id", userData.id).eq("is_read", false).order("created_at", { ascending: false });
        if (error) throw error;
        setNotifs(data || []);
      } catch (e) {
        console.error("Failed to load admin notifications:", e);
      }
    })();
  }, []);

  const dismiss = async (id: number) => {
    const { error } = await supabase.from("admin_notifications").update({ is_read: true }).eq("id", id);
    if (error) {
      console.error("Failed to dismiss notification:", error);
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
          <button onClick={() => dismiss(n.id)} aria-label="Fermer la notification" className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"><X className="w-4 h-4" aria-hidden="true" /></button>
        </div>
      ))}
    </div>
  );
}

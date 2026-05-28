"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PresenceTracker() {
  const router = useRouter();

  useEffect(() => {
    const track = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Vérif ban — lit directement le statut
      const { data: user } = await supabase
        .from("users")
        .select("status, ban_reason")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (user?.status === "inactive" || user?.ban_reason) {
        router.push("/auth/banned");
        return;
      }

      // Détecter le device type simple côté client
      const ua = navigator.userAgent;
      const device_type = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";

      // Appel API centralisé — gère login_count, login_streak, last_login_date + history
      await fetch("/api/user/track-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ device_type, user_agent: ua }),
      });
    };

    track();

    // Refresh last_active_at every 2 minutes
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from("users")
          .update({ last_active_at: new Date().toISOString() })
          .eq("auth_id", session.user.id);
      }
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  return null;
}

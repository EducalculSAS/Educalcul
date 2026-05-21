"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getServerGeo } from "@/lib/geoLocation";

export default function PresenceTracker() {
  const router = useRouter();

  useEffect(() => {
    const track = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const now = new Date().toISOString();
      const today = new Date().toISOString().split("T")[0];
      const updates: any = { last_active_at: now };

      // Fetch user data — include ban fields
      const { data: user } = await supabase
        .from("users")
        .select("last_login_date, login_count, login_streak, latitude, status, ban_reason")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      // Vérif ban à chaque refresh
      if (user?.status === "inactive" || user?.ban_reason) {
        router.push("/auth/banned");
        return;
      }

      if (user) {
        // Track login streak
        const lastLogin = user.last_login_date;
        if (lastLogin !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
          updates.last_login_date = today;
          updates.login_count = (user.login_count || 0) + 1;
          updates.login_streak = lastLogin === yesterday ? (user.login_streak || 0) + 1 : 1;
        }

        // Geo if missing — silencieux via headers Vercel (pas de popup)
        if (!user.latitude) {
          const geo = await getServerGeo();
          if (geo) {
            updates.latitude = geo.latitude;
            updates.longitude = geo.longitude;
            if (geo.city)    updates.last_login_city    = geo.city;
            if (geo.country) updates.last_login_country = geo.country;
          }
        }
      }

      await supabase.from("users").update(updates).eq("auth_id", session.user.id);
    };

    track();
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.from("users").update({ last_active_at: new Date().toISOString() }).eq("auth_id", session.user.id);
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  return null;
}

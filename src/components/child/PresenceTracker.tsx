"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PresenceTracker() {
  useEffect(() => {
    const track = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const now = new Date().toISOString();
      const today = new Date().toISOString().split("T")[0];
      const updates: any = { last_active_at: now };

      // Fetch user data once for both login streak + geo check
      const { data: user } = await supabase
        .from("users")
        .select("last_login_date, login_count, login_streak, latitude")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (user) {
        // Track login streak
        const lastLogin = user.last_login_date;
        if (lastLogin !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
          updates.last_login_date = today;
          updates.login_count = (user.login_count || 0) + 1;
          updates.login_streak = lastLogin === yesterday ? (user.login_streak || 0) + 1 : 1;
        }

        // Geo if missing
        if (!user.latitude) {
          try {
            const geo = await fetch("https://ipapi.co/json/").then(r => r.json());
            if (geo.latitude) {
              updates.latitude = geo.latitude;
              updates.longitude = geo.longitude;
              updates.last_login_city = geo.city;
              updates.last_login_country = geo.country_name;
              updates.last_login_ip = geo.ip;
            }
          } catch {}
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

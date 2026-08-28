"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";

export default function PresenceTracker() {
  const router = useRouter();
  const lastPing = useRef(0);

  useEffect(() => {
    // Re-résout présence + géolocalisation (throttle 25s pour éviter le spam).
    const ping = async (force = false) => {
      if (!force && Date.now() - lastPing.current < 25000) return;
      lastPing.current = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const ua = navigator.userAgent;
      const device_type = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
      fetch("/api/user/track-login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ device_type, user_agent: ua }),
      }).catch(() => {});
    };

    const checkBanAndTrack = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const user = await getMyProfile<{ status?: string; ban_reason?: string | null }>();
      if (user?.status === "inactive" || user?.ban_reason) { router.push("/auth/banned"); return; }
      ping(true);
    };

    checkBanAndTrack();

    // Re-résout dès que l'app revient au premier plan (l'utilisateur a pu se
    // déplacer entre-temps) + filet toutes les 2 min.
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = setInterval(() => ping(true), 120000);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);

  return null;
}

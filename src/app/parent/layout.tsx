"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";

import Navbar from "@/components/Navbar";
import AdminMessages from "@/components/AdminMessages";
import AppLoader from "@/components/AppLoader";
import ParentOnboarding from "@/components/onboarding/ParentOnboarding";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      // Flow nouveau signup : l'utilisateur n'a pas encore de compte,
      // on le laisse accéder à /parent/subscription?new=true sans auth
      const isNewSignupFlow =
        typeof window !== "undefined" &&
        window.location.pathname === "/parent/subscription" &&
        new URLSearchParams(window.location.search).get("new") === "true";

      if (isNewSignupFlow) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/connexion");
        return;
      }

      // Verify role
      const userData: any = await getMyProfile();

      if (!userData || userData.role !== "parent") {
        router.push("/dashboard");
        return;
      }

      // Vérif ban — redirige même si déjà connecté
      if (userData.status === "inactive" || userData.ban_reason) {
        router.push("/auth/banned");
        return;
      }

      setUser(userData);
      setLoading(false);

      // Onboarding première connexion
      if (!userData.onboarding_completed) setShowOnboarding(true);

      // Fire-and-forget : ne bloque PAS la navigation
      (async () => {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const device_type = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
        await fetch("/api/user/track-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ device_type, user_agent: ua }),
        });
      })();
    };

    checkUser();

    // Rafraîchit présence + géolocalisation en rappelant track-login (re-résout
    // l'IP) : au retour sur l'app (focus/onglet visible, throttle 25s) et en
    // filet toutes les 2 min — la position suit même sans recharger l'app.
    let lastPing = 0;
    const ping = async (force = false) => {
      if (!force && Date.now() - lastPing < 25000) return;
      lastPing = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const device_type = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
      fetch("/api/user/track-login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ device_type, user_agent: ua }),
      }).catch(() => {});
    };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <AppLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <AdminMessages />
      <main className="pt-[64px]">
        {children}
      </main>
      {showOnboarding && user && (
        <ParentOnboarding
          firstName={user.first_name || ""}
          authId={user.auth_id}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}



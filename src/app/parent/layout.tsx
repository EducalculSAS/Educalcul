"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useGeoConsent } from "@/hooks/useGeoConsent";

import Navbar from "@/components/Navbar";
import AdminMessages from "@/components/AdminMessages";
import AppAdminLoader from "@/components/AppAdminLoader";
import ParentOnboarding from "@/components/onboarding/ParentOnboarding";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  useGeoConsent();
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
      const { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (error || !userData || userData.role !== "parent") {
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

    // Refresh last_active_at every 2 minutes
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("users").update({ last_active_at: new Date().toISOString() }).eq("auth_id", session.user.id);
      }
    }, 120000);

    return () => clearInterval(interval);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <AppAdminLoader />
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



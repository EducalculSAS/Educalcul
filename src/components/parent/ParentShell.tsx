"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Navbar";
import AdminMessages from "@/components/AdminMessages";
import ParentOnboarding from "@/components/onboarding/ParentOnboarding";

/**
 * Coquille de l'espace parent. L'identité, le rôle et l'abonnement sont déjà vérifiés par le layout serveur
 * (src/app/parent/layout.tsx) : la page s'affiche directement. Reste ici ce qui n'a de sens que dans le navigateur :
 * la présence en ligne, la présentation de première connexion et le renvoi vers l'abonnement d'un compte en défaut.
 */
export default function ParentShell({
  children,
  authId,
  firstName,
  showOnboarding: showOnboardingInitial,
  subscriptionOk,
}: {
  children: React.ReactNode;
  authId: string;
  firstName: string;
  showOnboarding: boolean;
  subscriptionOk: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [showOnboarding, setShowOnboarding] = useState(showOnboardingInitial);

  // Compte dont l'abonnement n'est plus actif : seule la page d'abonnement lui reste ouverte.
  useEffect(() => {
    if (!subscriptionOk && pathname !== "/parent/subscription") router.replace("/parent/subscription");
  }, [subscriptionOk, pathname, router]);

  // Présence + géolocalisation : track-login à l'arrivée, au retour sur l'onglet (throttle 25 s) et en filet toutes
  // les 2 min — la position suit même sans recharger l'app.
  useEffect(() => {
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

    void ping(true);
    const onVisible = () => { if (document.visibilityState === "visible") void ping(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // Un onglet oublié n'est pas « en ligne » et n'a pas à solliciter le serveur.
    const interval = setInterval(() => { if (document.visibilityState === "visible") void ping(true); }, 120000);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <AdminMessages />
      <main className="pt-[64px]">{children}</main>
      {showOnboarding && <ParentOnboarding firstName={firstName} authId={authId} onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}

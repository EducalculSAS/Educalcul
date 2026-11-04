"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlassButton from "@/components/ui/GlassButton";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Navbar";
import AdminMessages from "@/components/AdminMessages";
import ParentOnboarding from "@/components/onboarding/ParentOnboarding";

/**
 * Coquille de l'espace parent. L'identité, le rôle et l'abonnement sont déjà vérifiés par le layout serveur
 * (src/app/parent/layout.tsx) : la page s'affiche directement. Reste ici ce qui n'a de sens que dans le navigateur :
 * la présence en ligne, la présentation de première connexion et le bandeau de renouvellement d'un compte dont l'abonnement est terminé.
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
  const pathname = usePathname();
  const [showOnboarding, setShowOnboarding] = useState(showOnboardingInitial);

  // Abonnement terminé ou échu : l'espace parent reste ouvert (le compte repasse simplement aux droits de la formule
  // gratuite, partout contrôlés côté serveur). Avant, chaque page renvoyait vers l'abonnement au bout d'une seconde,
  // y compris en impersonation : un parent ne pouvait plus voir ni ses enfants ni son profil.
  const showRenewBanner = !subscriptionOk && pathname !== "/parent/subscription";

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
      <main className="pt-[64px]">
        {showRenewBanner && (
          <div role="status" className="mx-auto max-w-6xl px-4 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-[rgba(197,161,72,0.35)] bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-sm text-[var(--greek-blue)] flex-1">
                <strong>Votre abonnement n&apos;est plus actif.</strong> Vos enfants ont accès à la formule Découverte en attendant.
              </p>
              <GlassButton href="/parent/subscription" variant="navy" size="sm">Renouveler</GlassButton>
            </div>
          </div>
        )}
        {children}
      </main>
      {showOnboarding && <ParentOnboarding firstName={firstName} authId={authId} onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
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
  // Masqué pour la session une fois fermé (rappel discret, pas un mur).
  const [renewDismissed, setRenewDismissed] = useState(false);
  useEffect(() => { try { if (sessionStorage.getItem("renew-banner-dismissed")) setRenewDismissed(true); } catch {} }, []);

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
      <main className="pt-[64px] relative">
        {/* Posé SUR le haut de la page (sous la barre de navigation) : il ne décale rien et défile avec la page. */}
        {showRenewBanner && !renewDismissed && (
          <div role="status" className="absolute inset-x-0 top-[calc(var(--nav-h)+10px)] z-30 px-4 pointer-events-none">
            <div className="pointer-events-auto mx-auto max-w-3xl flex items-center gap-3 renew-banner rounded-2xl sm:rounded-full border border-[rgba(197,161,72,0.35)] bg-white/95 pl-4 pr-1.5 py-1.5 shadow-md">
              <p className="text-xs sm:text-sm text-[var(--greek-blue)] flex-1 min-w-0">
                <strong>Abonnement terminé.</strong> <span className="hidden sm:inline">Vos enfants ont accès à la formule Découverte en attendant.</span><span className="sm:hidden">Formule Découverte en attendant.</span>
              </p>
              <GlassButton href="/parent/subscription" variant="navy" size="sm" className="whitespace-nowrap">Renouveler</GlassButton>
              <GlassCloseButton onClick={() => { setRenewDismissed(true); try { sessionStorage.setItem("renew-banner-dismissed", "1"); } catch {} }} aria-label="Masquer" size="sm" />
            </div>
          </div>
        )}
        {children}
      </main>
      {showOnboarding && <ParentOnboarding firstName={firstName} authId={authId} onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppLoader from "@/components/AppLoader";
import AdminSidebar from "@/components/AdminSidebar";
import AdminTotpSetupModal from "@/components/admin/AdminTotpSetupModal";
import PresenceTracker from "@/components/child/PresenceTracker";
import { ContentGenerationsProvider } from "@/contexts/ContentGenerationsContext";
import ContentGenerationsWidget from "@/components/admin/ContentGenerationsWidget";

/** Coquille des pages admin : l'identité/rôle/statut banni sont désormais
 * vérifiés côté serveur (src/app/admin/layout.tsx) avant même que ce
 * composant ne s'exécute. Il ne reste ici que la vérification 2FA : le jeton
 * vit dans un cookie httpOnly (voir src/lib/twoFactorCookie.ts), illisible
 * en JS — on demande donc au serveur s'il est valide plutôt que de le lire
 * nous-mêmes. */
export default function AdminShell({
  children,
  adminLevel = "super",
}: {
  children: React.ReactNode;
  adminLevel?: string;
}) {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  // Tant que la 2FA n'est pas configurée, aucun appel /api/admin/* ne peut
  // aboutir (proxy.ts l'exige pour tout admin). Rendre la coquille (sidebar,
  // widgets, contenu de page) en même temps que le popup de configuration
  // faisait partir ces appels immédiatement ; ils échouaient en 401
  // "2FA required" et déclenchaient la déconnexion forcée de
  // src/lib/supabaseClient.ts (le "flash puis déco" observé). Le popup
  // s'affiche donc seul, bloquant, jusqu'à la fin de la configuration.
  const [needsTotpSetup, setNeedsTotpSetup] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      // Le cookie 2FA est httpOnly : seul le serveur peut l'effacer. keepalive
      // évite que la requête soit annulée par la redirection qui suit le logout.
      void fetch("/api/auth/2fa/clear-session", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => undefined);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkTotp = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/connexion");
        return;
      }

      // État de sécurité complet en un seul appel (rôle + TOTP + session 2FA).
      const res = await fetch("/api/auth/security/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.role === "admin" && !data.totpConfirmed) {
        if (mountedRef.current) {
          setNeedsTotpSetup(true);
          setLoading(false);
        }
        return;
      }

      if (!data.twoFactorSessionValid) {
        router.replace(
          `/auth/2fa-verify?redirect=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }

      if (mountedRef.current) setLoading(false);
    };

    checkTotp();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <AppLoader />
      </div>
    );
  }

  if (needsTotpSetup) {
    return (
      <div className="min-h-screen bg-[var(--greek-cream)]">
        <AdminTotpSetupModal onComplete={() => setNeedsTotpSetup(false)} />
      </div>
    );
  }

  return (
    <ContentGenerationsProvider>
      <PresenceTracker />
      <div className="min-h-screen bg-[var(--greek-cream)] flex">
        <AdminSidebar adminLevel={adminLevel} />
        <div className="flex-1 lg:ml-64 pt-14 lg:pt-6 px-4 md:px-6 lg:px-8 pb-8 transition-all duration-300 min-w-0 overflow-x-hidden">
          {children}
        </div>
        <ContentGenerationsWidget />
      </div>
    </ContentGenerationsProvider>
  );
}

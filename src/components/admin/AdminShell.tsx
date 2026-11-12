"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminSidebar from "@/components/AdminSidebar";
import AdminTotpSetupModal from "@/components/admin/AdminTotpSetupModal";
import PresenceTracker from "@/components/child/PresenceTracker";
import { ContentGenerationsProvider } from "@/contexts/ContentGenerationsContext";
import ContentGenerationsWidget from "@/components/admin/ContentGenerationsWidget";
import ExerciseBatchWidget from "@/components/admin/ExerciseBatchWidget";

/** Coquille des pages admin. Identité, rôle, statut banni, session 2FA et état du TOTP sont vérifiés côté serveur
 * (src/app/admin/layout.tsx, et le proxy à chaque requête) : la coquille s'affiche donc directement, sans écran de
 * chargement ni appel réseau. Elle ne garde que l'effacement du cookie 2FA (httpOnly, illisible en JS) à la déconnexion. */
export default function AdminShell({
  children,
  adminLevel = "super",
  needsTotpSetup: needsTotpSetupInitial = false,
}: {
  children: React.ReactNode;
  adminLevel?: string;
  needsTotpSetup?: boolean;
}) {
  // Tant que la 2FA n'est pas configurée, aucun appel /api/admin/* ne peut aboutir (proxy.ts l'exige pour tout
  // admin). Le popup de configuration s'affiche donc seul, bloquant, sans la coquille ni le contenu de page : sinon
  // leurs appels échouaient en 401 "2FA required" et déclenchaient la déconnexion forcée de supabaseClient.ts.
  const [needsTotpSetup, setNeedsTotpSetup] = useState(needsTotpSetupInitial);

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
        {/* Pastilles en haut à droite : générations unitaires, et un lot d'exercices en une seule pastille. */}
        <div className="fixed top-4 right-4 z-[1400] flex items-start gap-2">
          <ExerciseBatchWidget />
          <ContentGenerationsWidget />
        </div>
      </div>
    </ContentGenerationsProvider>
  );
}

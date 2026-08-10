"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppAdminLoader from "@/components/AppAdminLoader";
import AdminSidebar from "@/components/AdminSidebar";
import AdminTotpSetupModal from "@/components/admin/AdminTotpSetupModal";
import { ContentGenerationsProvider } from "@/contexts/ContentGenerationsContext";
import ContentGenerationsWidget from "@/components/admin/ContentGenerationsWidget";

/** Coquille des pages admin : l'identité/rôle/statut banni sont désormais
 * vérifiés côté serveur (src/app/admin/layout.tsx) avant même que ce
 * composant ne s'exécute. Il ne reste ici que la vérification 2FA "sur cet
 * appareil" : le token de vérification vit dans le localStorage du
 * navigateur, donc ne peut pas être lu côté serveur. */
export default function AdminShell({ children, adminLevel = "super" }: { children: React.ReactNode; adminLevel?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTotp = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/connexion");
        return;
      }

      const totpRes = await fetch("/api/auth/2fa/totp/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const totpData = await totpRes.json();
      if (totpRes.ok && totpData.confirmed) {
        const token = window.localStorage.getItem("edu_2fa_token");
        if (!token) {
          router.push(`/auth/2fa-verify?redirect=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
      }

      setLoading(false);
    };

    checkTotp();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <AppAdminLoader />
      </div>
    );
  }

  return (
    <ContentGenerationsProvider>
      <div className="min-h-screen bg-[var(--greek-cream)] flex">
        <AdminTotpSetupModal />
        <AdminSidebar adminLevel={adminLevel} />
        <div className="flex-1 lg:ml-64 pt-14 lg:pt-6 px-4 md:px-6 lg:px-8 pb-8 transition-all duration-300 min-w-0 overflow-x-hidden">
          {children}
        </div>
        <ContentGenerationsWidget />
      </div>
    </ContentGenerationsProvider>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";
import Navbar from "@/components/Navbar";

/**
 * Visiteur sans compte parent exploitable devant l'espace parent. Seul le tunnel d'inscription
 * (/parent/subscription?new=true, pas encore de compte avant le paiement) s'affiche ; tout le reste renvoie vers la
 * connexion, ou vers l'écran « compte suspendu » quand un compte existe mais est banni.
 */
export default function ParentGuest({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // null = pas encore su (rendu serveur) : rien n'est affiché le temps de lire l'adresse.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    setOpen(window.location.pathname === "/parent/subscription" && new URLSearchParams(window.location.search).get("new") === "true");
  }, []);

  useEffect(() => {
    if (open !== false) return;
    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/auth/connexion");
        return;
      }
      const profile = await getMyProfile<{ status?: string; ban_reason?: string | null }>();
      if (cancelled) return;
      router.replace(profile && (profile.status === "inactive" || profile.ban_reason) ? "/auth/banned" : "/dashboard");
    })();
    return () => { cancelled = true; };
  }, [open, router]);

  if (!open) return null;
  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="pt-[64px]">{children}</main>
    </div>
  );
}

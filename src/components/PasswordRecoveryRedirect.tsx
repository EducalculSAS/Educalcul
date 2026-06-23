"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * Écouteur global : quand un lien de réinitialisation de mot de passe est ouvert,
 * le client Supabase lit le token dans l'URL et émet l'événement
 * "PASSWORD_RECOVERY". Supabase peut avoir redirigé n'importe où (souvent la
 * Site URL = l'accueil, si /auth/update-password n'est pas dans les Redirect
 * URLs). On capte l'événement et on envoie l'utilisateur vers la bonne page.
 */
export default function PasswordRecoveryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && pathname !== "/auth/update-password") {
        router.replace("/auth/update-password");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, pathname]);

  return null;
}

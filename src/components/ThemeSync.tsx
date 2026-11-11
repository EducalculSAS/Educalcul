"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSupabaseWhenSession } from "@/lib/supabaseLazy";
import { getMyProfile } from "@/lib/updateMyProfile";
import { applyTheme, isTheme, readStoredTheme, syncThemeToPath } from "@/lib/theme";
import { applySeason, isSeasonPreference, readStoredSeason, syncSeasonToPath } from "@/lib/season";

/**
 * Aligne le thème du navigateur sur la préférence du compte à la connexion
 * (un thème choisi sur le téléphone se retrouve sur l'ordinateur). Si le
 * compte n'a encore rien enregistré, le choix fait sur ce navigateur devient
 * sa préférence. Ne fait rien pour un visiteur déconnecté.
 */
export default function ThemeSync() {
  const pathname = usePathname();
  // Navigation sans rechargement : le thème suit la page (sombre seulement en espace connecté).
  useEffect(() => { syncThemeToPath(pathname); syncSeasonToPath(pathname); }, [pathname]);

  const supabase = useSupabaseWhenSession();
  useEffect(() => {
    if (!supabase) return; // visiteur sans session : rien à synchroniser
    let alive = true;
    const sync = async () => {
      try {
        // Lecture partagée avec la barre de navigation (une seule requête pour le profil).
        const me = await getMyProfile<{ role?: string; theme_preference?: string; season_preference?: string }>();
        if (!me || !alive) return;
        if (isTheme(me?.theme_preference)) {
          if (me.theme_preference !== readStoredTheme()) applyTheme(me.theme_preference);
        } else if (readStoredTheme() === "dark") {
          void fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme_preference: "dark" }) });
        }
        // Thème de saison : seul un admin le choisit. Les autres comptes suivent le calendrier (« auto »), même
        // s'ils avaient enregistré un choix quand le réglage leur était proposé.
        if (me?.role !== "admin") {
          if (readStoredSeason() !== "auto") applySeason("auto");
        } else if (isSeasonPreference(me?.season_preference)) {
          if (me.season_preference !== readStoredSeason()) applySeason(me.season_preference);
        } else if (readStoredSeason() !== "auto") {
          void fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ season_preference: readStoredSeason() }) });
        }
      } catch { /* hors ligne : on garde le thème local */ }
    };
    supabase.auth.getSession().then(({ data }) => { if (data.session) void sync(); });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") void sync(); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [supabase]);
  return null;
}

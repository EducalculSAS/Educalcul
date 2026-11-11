"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase chargé À LA DEMANDE dans les composants présents sur toutes les pages (barre de navigation, thème,
 * redirection de mot de passe…). Un simple visiteur n'a pas de session : inutile de lui faire télécharger le client
 * de connexion (environ 250 Ko) pour lire une page publique. Il n'est chargé que s'il y a une session dans ce
 * navigateur, ou si l'adresse porte un jeton de connexion (retour de Google, lien de réinitialisation).
 */

/** Y a-t-il une session possible ici ? (cookie de session Supabase, ou jeton dans l'adresse) */
export function mayHaveSession(): boolean {
  if (typeof document === "undefined") return false;
  if (document.cookie.split("; ").some((c) => c.startsWith("sb-"))) return true;
  const { hash, search } = window.location;
  return /access_token=|refresh_token=|type=recovery|error_description=/.test(hash) || /[?&](code|token_hash)=/.test(search);
}

export async function loadSupabase(): Promise<SupabaseClient> {
  return (await import("@/lib/supabaseClient")).supabase;
}

/**
 * Le client Supabase si une session est possible, sinon null (visiteur). Réévalué à chaque changement de page : après
 * une connexion, les composants du layout racine (qui ne sont pas remontés) le reçoivent à la navigation suivante.
 */
export function useSupabaseWhenSession(): SupabaseClient | null {
  const pathname = usePathname();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  useEffect(() => {
    if (client || !mayHaveSession()) return;
    let alive = true;
    void loadSupabase().then((c) => { if (alive) setClient(c); });
    return () => { alive = false; };
  }, [pathname, client]);
  return client;
}

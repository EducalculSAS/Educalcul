"use client";

import { useState, useEffect } from "react";
import { getClientCookie, setClientCookie, deleteClientCookie } from "@/lib/clientCookie";

/** Dossier courant persisté dans un cookie de session (pas de Web Storage) :
 * survit à un F5, effacé à la fermeture du navigateur.
 *
 * `initial` : valeur déjà lue côté serveur dans ce même cookie. Sans elle, le
 * rendu serveur (où `window` n'existe pas) partait toujours de la racine
 * alors que le navigateur rouvrait le dernier dossier — écart d'hydratation,
 * et un flash du mauvais contenu au chargement de la page. */
export function useSessionFolderId(key: string, initial?: number | null) {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(() => {
    if (initial !== undefined) return initial;
    if (typeof window === "undefined") return null;
    const v = getClientCookie(key);
    return v ? Number(v) : null;
  });

  useEffect(() => {
    if (currentFolderId === null) deleteClientCookie(key);
    else setClientCookie(key, String(currentFolderId));
  }, [key, currentFolderId]);

  return [currentFolderId, setCurrentFolderId] as const;
}

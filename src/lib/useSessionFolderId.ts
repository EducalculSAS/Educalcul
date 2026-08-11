"use client";

import { useState, useEffect } from "react";
import { getClientCookie, setClientCookie, deleteClientCookie } from "@/lib/clientCookie";

/** Dossier courant persisté dans un cookie de session (pas de Web Storage) :
 * survit à un F5, effacé à la fermeture du navigateur. */
export function useSessionFolderId(key: string) {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(() => {
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

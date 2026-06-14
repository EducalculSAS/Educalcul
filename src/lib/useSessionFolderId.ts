"use client";

import { useState, useEffect } from "react";

/** Dossier courant persisté dans sessionStorage : survit à un F5 mais pas à un nouvel onglet. */
export function useSessionFolderId(key: string) {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = sessionStorage.getItem(key);
    return v ? Number(v) : null;
  });

  useEffect(() => {
    if (currentFolderId === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(currentFolderId));
  }, [key, currentFolderId]);

  return [currentFolderId, setCurrentFolderId] as const;
}

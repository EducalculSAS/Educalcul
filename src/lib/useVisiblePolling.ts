"use client";

import { useEffect, useRef } from "react";

/**
 * Appelle `fn` toutes les `intervalMs` millisecondes, UNIQUEMENT quand
 * l'onglet est visible. En revenant sur un onglet resté caché plus longtemps
 * que l'intervalle, un appel part tout de suite (données à jour sans attendre).
 *
 * Tous les sondages du site passent par ici : un onglet oublié en arrière-plan
 * n'interroge plus le serveur (à 10 000 utilisateurs, la différence se compte
 * en centaines de requêtes par seconde).
 */
export function useVisiblePolling(fn: () => void, intervalMs: number, { immediate = false } = {}) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    let last = Date.now();
    const run = () => {
      last = Date.now();
      fnRef.current();
    };
    if (immediate) run();

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= intervalMs) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, immediate]);
}

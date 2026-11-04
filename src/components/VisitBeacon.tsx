"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PRIVATE = /^\/(api|admin|parent|child|dashboard|suivi|u|auth|logout)(\/|$)/;

/**
 * Signale une arrivée sur une page publique venant d'un autre site (moteur, assistant IA, réseau social…), une seule
 * fois par onglet. Rien n'est stocké côté navigateur au-delà de cette mémoire d'onglet ; le serveur ne garde qu'un
 * compteur par source et par page (voir /api/track/visit).
 */
export default function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || PRIVATE.test(pathname)) return;
    try {
      if (sessionStorage.getItem("edu-visit-counted")) return;
      sessionStorage.setItem("edu-visit-counted", "1");
    } catch { /* stockage indisponible : on compte quand même, une fois par chargement */ }
    const utm = new URLSearchParams(window.location.search).get("utm_source");
    const referrer = document.referrer;
    if (!referrer && !utm) return;
    void fetch("/api/track/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, referrer, utm }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}

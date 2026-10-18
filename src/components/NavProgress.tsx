"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Fine ligne de progression en haut de l'écran pendant qu'une page se charge. Il n'y a plus de squelette de chargement :
 * la page précédente reste affichée jusqu'à ce que la nouvelle soit prête, et cette ligne montre simplement que le clic
 * a bien été pris en compte. Elle n'apparaît qu'au-delà de 120 ms, donc jamais sur une navigation instantanée.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La nouvelle page est arrivée : on coupe.
  useEffect(() => {
    if (startTimer.current) clearTimeout(startTimer.current);
    if (stopTimer.current) clearTimeout(stopTimer.current);
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Même page (ancre, ou seulement des paramètres) : rien à attendre.
      if (url.pathname === window.location.pathname) return;
      if (startTimer.current) clearTimeout(startTimer.current);
      if (stopTimer.current) clearTimeout(stopTimer.current);
      startTimer.current = setTimeout(() => setActive(true), 120);
      // Filet : une navigation annulée ne laisse pas la ligne affichée indéfiniment.
      stopTimer.current = setTimeout(() => setActive(false), 15000);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      if (startTimer.current) clearTimeout(startTimer.current);
      if (stopTimer.current) clearTimeout(stopTimer.current);
    };
  }, []);

  return active ? <div className="nav-progress" role="progressbar" aria-label="Chargement de la page" /> : null;
}

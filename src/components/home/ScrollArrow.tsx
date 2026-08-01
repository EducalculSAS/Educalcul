"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/** Flèche de scroll fixe qui disparaît une fois la page défilée. Isolée en
 * client island pour que le reste de la landing reste rendu côté serveur. */
export default function ScrollArrow() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Lecture ponctuelle de scrollY au montage (cas d'un rechargement avec
    // ancre/restauration de scroll) : `window` n'existe pas côté serveur, ce
    // check ne peut donc pas se faire dans l'initialiseur de useState sans
    // provoquer un mismatch d'hydratation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScrolled(window.scrollY > 80);
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed bottom-8 left-1/2 z-30 pointer-events-none"
      style={{
        transform: "translateX(-50%)",
        opacity: scrolled ? 0 : 1,
        transition: "opacity 400ms ease, transform 400ms ease",
        marginTop: scrolled ? "12px" : "0px",
      }}
    >
      <ChevronDown
        className="w-6 h-6 animate-bounce-slow"
        style={{ color: "var(--greek-gold)", opacity: 0.55 }}
      />
    </div>
  );
}

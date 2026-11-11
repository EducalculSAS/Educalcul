"use client";

import { useState } from "react";
import Image from "next/image";

/** Icône Calia + bulle au survol. Isolée en client island : le reste du
 * bloc "Bento" (titres, texte) reste rendu côté serveur. */
export default function CaliaHover() {
  const [hover, setHover] = useState(false);

  return (
    <div className="relative inline-block mb-6">
      <div
        className="w-12 h-12 flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-110"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Le zoom est sur l'enveloppe, le verre (flou) sur l'élément intérieur : Safari coupe le flou d'un élément dont le transform change. */}
        <span className="calia-glass calia-glass-ring backdrop-blur-[32px] backdrop-saturate-[1.4] w-12 h-12 rounded-full flex items-center justify-center">
          <Image src="/logoAI.png" alt="Calia" width={40} height={40} className="w-8 h-8 object-contain" />
        </span>
      </div>
      <div
        className="absolute pointer-events-none"
        style={{
          left: 56,
          top: "50%",
          transform: `translateY(-50%) scale(${hover ? 1 : 0.88})`,
          opacity: hover ? 1 : 0,
          transformOrigin: "left center",
          transition: "opacity 180ms ease, transform 180ms ease",
        }}
      >
        <div
          className="calia-glass backdrop-blur-[32px] backdrop-saturate-[1.4] relative px-4 py-2.5 rounded-2xl whitespace-nowrap"
          style={{ color: "rgba(240,237,232,0.92)", fontSize: "0.8rem" }}
        >
          <span
            className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-3 h-3 rotate-45"
            style={{ background: "rgba(30,49,96,0.85)", borderLeft: "1px solid rgba(255,255,255,0.2)", borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          />
          <span style={{ color: "var(--greek-gold)", fontWeight: 600 }}>Calia</span> pose la question qui débloque.
        </div>
      </div>
    </div>
  );
}

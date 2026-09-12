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
        <Image src="/logoAI.png" alt="Calia" width={40} height={40} className="w-10 h-10 object-contain" />
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
          className="relative px-4 py-2.5 rounded-2xl whitespace-nowrap"
          style={{
            background: "linear-gradient(135deg, #1e3160 0%, #0f1e3a 100%)",
            border: "1px solid rgba(197,161,72,0.3)",
            color: "rgba(240,237,232,0.9)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            fontSize: "0.8rem",
          }}
        >
          <span
            className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-3 h-3 rotate-45"
            style={{ background: "#1e3160", borderLeft: "1px solid rgba(197,161,72,0.3)", borderBottom: "1px solid rgba(197,161,72,0.3)" }}
          />
          <span style={{ color: "var(--greek-gold)", fontWeight: 600 }}>Votre enfant</span> est entre de bonnes mains.
        </div>
      </div>
    </div>
  );
}

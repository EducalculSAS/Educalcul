import React from "react";
import Navbar from "@/components/Navbar";
import Image from "next/image";

const MATH_SYMBOLS = [
  { s: "∑", x: 6,   y: 10, z: 96,  d: 0,   t: 7.2  },
  { s: "π", x: 87,  y: 7,  z: 72,  d: 1.3, t: 8.5  },
  { s: "√", x: 12,  y: 62, z: 58,  d: 0.6, t: 9.1  },
  { s: "∫", x: 91,  y: 48, z: 104, d: 2.1, t: 7.4  },
  { s: "Δ", x: 43,  y: 14, z: 50,  d: 0.9, t: 10.2 },
  { s: "∞", x: 65,  y: 70, z: 66,  d: 1.8, t: 8.0  },
  { s: "α", x: 2,   y: 40, z: 44,  d: 2.7, t: 9.3  },
  { s: "×", x: 76,  y: 26, z: 54,  d: 0.4, t: 7.8  },
  { s: "θ", x: 50,  y: 78, z: 62,  d: 2.0, t: 8.8  },
  { s: "β", x: 28,  y: 53, z: 42,  d: 3.3, t: 10.5 },
  { s: "≠", x: 58,  y: 30, z: 46,  d: 1.1, t: 9.7  },
  { s: "φ", x: 74,  y: 82, z: 52,  d: 1.6, t: 8.4  },
  { s: "λ", x: 16,  y: 33, z: 48,  d: 3.0, t: 8.2  },
  { s: "²", x: 82,  y: 55, z: 60,  d: 2.4, t: 7.6  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--greek-blue)" }}>
      <Navbar />

      <div className="flex flex-1 pt-[64px]">
        {/* ── Panneau gauche — même style hero homepage ── */}
        <div
          className="hidden lg:flex flex-col justify-center px-16 relative overflow-hidden"
          style={{ width: "42%", borderRight: "1px solid rgba(197,161,72,0.12)" }}
        >
          {/* Même fond dégradé que homepage */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(15,30,58,0.6) 0%, rgba(15,30,58,0) 100%)" }} />

          {/* Blobs */}
          <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full blur-3xl" style={{ background: "rgba(197,161,72,0.12)" }} />
          <div className="absolute bottom-1/4 right-0 w-64 h-64 rounded-full blur-3xl" style={{ background: "rgba(15,30,58,0.4)" }} />

          {/* Symboles math flottants — mêmes opacités que la homepage */}
          {MATH_SYMBOLS.map((sym, i) => (
            <span
              key={i}
              className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{
                left: `${sym.x}%`,
                top: `${sym.y}%`,
                fontSize: `${sym.z}px`,
                opacity: 0.13,
                color: "var(--greek-gold)",
                fontFamily: "Georgia, serif",
                animationDuration: `${sym.t}s`,
                animationDelay: `${sym.d}s`,
              }}
            >
              {sym.s}
            </span>
          ))}

          {/* Texte */}
          <div className="relative z-10">
            {/* Logo Educalcul juste au-dessus du titre */}
            <div className="flex items-center gap-3 mb-6">
              <Image src="/logo.png" alt="Educalcul" width={52} height={30} className="h-8 w-auto object-contain" />
              <span
                className="font-bold text-xl"
                style={{ fontFamily: "var(--font-display)", color: "#f0ede8", letterSpacing: "0.05em" }}
              >
                Educalcul
              </span>
            </div>
            <h2
              className="font-bold mb-4 leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 3vw, 2.8rem)",
                color: "#f0ede8",
              }}
            >
              L'excellence<br />
              <span style={{ color: "var(--greek-gold)" }}>mathématique</span><br />
              à portée de main.
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Rejoignez des milliers de familles qui font<br />
              confiance à Educalcul pour progresser.
            </p>
          </div>
        </div>

        {/* ── Panneau droit — formulaire ── */}
        <div
          className="flex-1 flex items-center justify-center px-4 py-10 overflow-y-auto"
          style={{ background: "var(--greek-cream)" }}
        >
          {children}
        </div>
      </div>

    </div>
  );
}

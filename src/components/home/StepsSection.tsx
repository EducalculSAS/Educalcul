"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  { num: "01", title: "Créez votre espace", desc: "Créez un compte Educalcul en 2 minutes chrono." },
  { num: "02", title: "Choisissez votre plan", desc: "Bénéficiez de 7 jours d’essai offerts. Accès immédiat à tous les contenus." },
  { num: "03", title: "Votre enfant apprend", desc: "Cours structurés, exercices adaptés et quiz pour vérifier les connaissances." },
  { num: "04", title: "Suivez ses progrès", desc: "Tableau de bord détaillé pour mesurer sa progression" },
];

export default function StepsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="py-24 px-6" style={{ background: "var(--greek-cream)" }}>
      <div className="max-w-5xl mx-auto" ref={sectionRef}>
        <div
          className="mb-14"
          style={{ opacity: triggered ? 1 : 0, transform: triggered ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--greek-gold-text)" }}>Comment ça marche</p>
          <h2 className="font-[family-name:var(--font-display)] font-bold" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}>
            Simple à démarrer.
          </h2>
        </div>

        {/* Desktop: timeline horizontale */}
        <div className="hidden md:grid md:grid-cols-4 gap-0 relative">
          <div className="absolute top-7 left-[12.5%] right-[12.5%] h-px overflow-hidden">
            <div
              style={{
                height: "100%",
                background: `linear-gradient(90deg, var(--greek-gold), var(--greek-border))`,
                transform: triggered ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left center",
                transition: "transform 0.8s cubic-bezier(0.4,0,0.2,1) 0.55s",
              }}
            />
          </div>

          {STEPS.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center px-4"
              style={{
                opacity: triggered ? 1 : 0,
                transform: triggered ? "translateY(0)" : "translateY(28px)",
                transition: `opacity 0.55s ease ${0.3 + i * 0.13}s, transform 0.55s ease ${0.3 + i * 0.13}s`,
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-5 relative z-10 font-[family-name:var(--font-display)] font-bold text-lg"
                style={{
                  background: "var(--greek-cream)",
                  border: "2px solid var(--greek-border)",
                  color: "var(--greek-gold-text)",
                  transition: "background 250ms ease, border-color 250ms ease, transform 250ms ease, box-shadow 250ms ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.background = "var(--greek-blue)";
                  el.style.borderColor = "var(--greek-blue)";
                  el.style.transform = "scale(1.18)";
                  el.style.boxShadow = "0 8px 28px rgba(15,30,58,0.3)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.background = "var(--greek-cream)";
                  el.style.borderColor = "var(--greek-border)";
                  el.style.transform = "scale(1)";
                  el.style.boxShadow = "none";
                }}
              >
                {s.num}
              </div>
              <h3 className="font-[family-name:var(--font-display)] font-bold text-base mb-2" style={{ color: "var(--greek-blue)" }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile: cartes verticales avec ligne latérale animée */}
        <div className="md:hidden flex flex-col gap-0 relative">
          <div className="absolute left-5 top-6 bottom-16 w-px overflow-hidden">
            <div
              style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(180deg, var(--greek-gold), rgba(197,161,72,0.15))`,
                transform: triggered ? "scaleY(1)" : "scaleY(0)",
                transformOrigin: "top center",
                transition: "transform 1s cubic-bezier(0.4,0,0.2,1) 0.2s",
              }}
            />
          </div>

          {STEPS.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-4 pl-0 pb-6 last:pb-0"
              style={{
                opacity: triggered ? 1 : 0,
                transform: triggered ? "translateX(0)" : "translateX(-20px)",
                transition: `opacity 0.5s ease ${0.25 + i * 0.12}s, transform 0.5s ease ${0.25 + i * 0.12}s`,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-[family-name:var(--font-display)] font-bold text-sm relative z-10"
                style={{ background: "var(--greek-cream)", color: "var(--greek-gold-text)", border: "2px solid var(--greek-border)", minWidth: 40 }}
              >
                {s.num}
              </div>
              <div className="pt-0.5">
                <h3 className="font-[family-name:var(--font-display)] font-bold text-base mb-1" style={{ color: "var(--greek-blue)" }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

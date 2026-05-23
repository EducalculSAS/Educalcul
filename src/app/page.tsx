"use client";

/* eslint-disable @next/next/no-img-element */
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, LogIn, Users, TrendingUp, BookOpen, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

/* ─── Symboles math hero — plus nombreux et plus visibles ─── */
const SYM = [
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
  { s: "÷", x: 19,  y: 84, z: 38,  d: 2.9, t: 7.3  },
  { s: "φ", x: 74,  y: 82, z: 52,  d: 1.6, t: 8.4  },
  { s: "μ", x: 35,  y: 22, z: 44,  d: 0.7, t: 9.0  },
  { s: "²", x: 82,  y: 55, z: 60,  d: 2.4, t: 7.6  },
  { s: "³", x: 47,  y: 90, z: 38,  d: 1.2, t: 10.0 },
  { s: "λ", x: 16,  y: 33, z: 48,  d: 3.0, t: 8.2  },
  { s: "ω", x: 93,  y: 75, z: 56,  d: 0.3, t: 9.5  },
];

const BARS = [
  { label: "Fractions",  pct: 87, color: "var(--greek-gold)" },
  { label: "Géométrie", pct: 64, color: "#60a5fa" },
  { label: "Algèbre",   pct: 41, color: "#34d399" },
];

/* ─── Count-up ease-out ─── */
function useCountUp(target: number, duration = 1200, trigger = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [trigger, target, duration]);
  return val;
}

export default function Home() {
  const [epsiHover, setEpsiHover]     = useState(false);
  const [dashVisible, setDashVisible] = useState(false);
  const [bentoVisible, setBentoVisible] = useState(false);
  const [scrolled, setScrolled]       = useState(false);
  const dashRef  = useRef<HTMLDivElement>(null);
  const bentoRef = useRef<HTMLDivElement>(null);

  /* Count-up uniquement sur les pourcentages */
  const pct0 = useCountUp(87, 1300, dashVisible);
  const pct1 = useCountUp(64, 1100, dashVisible);
  const pct2 = useCountUp(41,  900, dashVisible);
  const pcts  = [pct0, pct1, pct2];

  /* Flèche scroll fixe — disparaît au scroll, initialisée à la position réelle */
  useEffect(() => {
    setScrolled(window.scrollY > 80);
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = dashRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setDashVisible(true); obs.disconnect(); } },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = bentoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setBentoVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0f1e3a" }}>
      <Navbar />

      {/* Flèche scroll — fixe, disparaît au scroll */}
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

      {/* ════════════════════════════════════════════════════════
          §1 — HERO
      ════════════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "100dvh", background: "#0f1e3a" }}
      >
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol" style={{
              left: `${cfg.x}%`, top: `${cfg.y}%`,
              fontSize: `${cfg.z}px`, fontFamily: "Georgia, serif",
              color: "var(--greek-gold)", opacity: 0.13,
              animationDuration: `${cfg.t}s`, animationDelay: `${cfg.d}s`,
            }}>{cfg.s}</span>
          ))}
        </div>

        <div className="absolute pointer-events-none" style={{
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(197,161,72,0.08) 0%, transparent 65%)",
          top: "50%", left: "50%", transform: "translate(-50%, -58%)",
        }} />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl">
          <img src="/logo.png" alt="Educalcul" className="mb-10 w-auto" style={{ height: 110 }} />

          <h1
            className="font-[family-name:var(--font-display)] font-bold leading-[1.02] tracking-tight mb-6"
            style={{ color: "#f0ede8", fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)" }}
          >
            Les maths<br />
            <span style={{ color: "var(--greek-gold)" }}>enfin maîtrisés</span>
          </h1>

          <p className="text-base leading-relaxed mb-10 max-w-lg" style={{ color: "rgba(240,237,232,0.48)" }}>
            La seule plateforme qui accompagne chaque élève, du CP à la Terminale,
            avec une méthode rigoureuse, une IA pédagogique et un suivi parental précis.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <Link
              href="/auth/inscription"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm transition-all duration-200 hover:-translate-y-[2px] active:scale-[0.98] font-[family-name:var(--font-display)]"
              style={{ background: "var(--greek-gold)", color: "#fff", boxShadow: "0 8px 32px rgba(197,161,72,0.32)" }}
            >
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/connexion"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-200 border hover:-translate-y-[1px] font-[family-name:var(--font-display)]"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(240,237,232,0.55)" }}
            >
              <LogIn className="w-4 h-4" /> Se connecter
            </Link>
          </div>

          <p className="text-sm italic" style={{ color: "rgba(197,161,72,0.55)", fontFamily: "Georgia, serif" }}>
            Parce que progresser, ça aussi, ça se calcule.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §2 — MANIFESTE
      ════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-4xl mx-auto">
          <blockquote
            className="font-[family-name:var(--font-display)] font-bold leading-tight"
            style={{ color: "var(--greek-blue)", fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)" }}
          >
            "Votre enfant ne manque pas de capacités.
            <br />
            <span style={{ color: "var(--greek-gold)" }}>Il manque d'une bonne méthode.</span>"
          </blockquote>
          <p className="mt-8 text-sm leading-relaxed max-w-xl" style={{ color: "var(--text-muted)" }}>
            Educalcul est construit sur un principe simple : chaque élève peut réussir en mathématiques si on lui donne les bons outils, au bon moment, de la bonne façon.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §3 — BENTO GRID
      ════════════════════════════════════════════════════════ */}
      <section className="pb-24 px-6" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-5xl mx-auto" ref={bentoRef}>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            {/* Bloc A — Cours */}
            <div className="rounded-3xl p-8 flex flex-col justify-between transition-all duration-700" style={{ background: "#fff", border: "1px solid var(--greek-border)", minHeight: 280, opacity: bentoVisible ? 1 : 0, transform: bentoVisible ? "translateY(0)" : "translateY(28px)", transitionDelay: "0ms" }}>
              <div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(15,30,58,0.06)" }}>
                  <BookOpen className="w-5 h-5" style={{ color: "var(--greek-blue)" }} />
                </div>
                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--greek-gold)" }}>
                  Cours & Exercices
                </div>
                <h3 className="font-[family-name:var(--font-display)] font-bold text-xl leading-snug mb-3" style={{ color: "var(--greek-blue)" }}>
                  Programme complet,<br />du CP à la Terminale
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Cours structurés, exercices progressifs, corrections détaillées. Aligné sur le programme officiel.
                </p>
              </div>
              <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--greek-gold)" }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--greek-gold)" }} />
                Tous niveaux
              </div>
            </div>

            {/* Bloc B — EpsiAI */}
            <div className="rounded-3xl p-8 flex flex-col justify-between relative overflow-visible transition-all duration-700" style={{ background: "var(--greek-blue)", minHeight: 280, opacity: bentoVisible ? 1 : 0, transform: bentoVisible ? "translateY(0)" : "translateY(28px)", transitionDelay: "120ms" }}>

              <div className="relative z-10">
                <div className="relative inline-block mb-6">
                  <div
                    className="w-12 h-12 flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-110"
                    onMouseEnter={() => setEpsiHover(true)}
                    onMouseLeave={() => setEpsiHover(false)}
                  >
                    <img src="/logoAI.png" alt="EpsiAI" className="w-10 h-10 object-contain" />
                  </div>
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: 56, top: "50%",
                      transform: `translateY(-50%) scale(${epsiHover ? 1 : 0.88})`,
                      opacity: epsiHover ? 1 : 0,
                      transformOrigin: "left center",
                      transition: "opacity 180ms ease, transform 180ms ease",
                    }}
                  >
                    <div className="relative px-4 py-2.5 rounded-2xl whitespace-nowrap" style={{
                      background: "linear-gradient(135deg, #1e3160 0%, #0f1e3a 100%)",
                      border: "1px solid rgba(197,161,72,0.3)",
                      color: "rgba(240,237,232,0.9)",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                      fontSize: "0.8rem",
                    }}>
                      <span className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-3 h-3 rotate-45" style={{ background: "#1e3160", borderLeft: "1px solid rgba(197,161,72,0.3)", borderBottom: "1px solid rgba(197,161,72,0.3)" }} />
                      <span style={{ color: "var(--greek-gold)", fontWeight: 600 }}>Votre enfant</span> est entre de bonnes mains.
                    </div>
                  </div>
                </div>

                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(197,161,72,0.7)" }}>IA Pédagogique</div>
                <h3 className="font-[family-name:var(--font-display)] font-bold text-xl leading-snug mb-3" style={{ color: "#f0ede8" }}>
                  EpsiAI guide,<br />sans donner la réponse
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(240,237,232,0.5)" }}>
                  Détecte les lacunes, adapte le rythme, encourage l'élève. Disponible 24h/24.
                </p>
              </div>
              <div className="mt-6 relative z-10 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--greek-gold)" }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--greek-gold)" }} />
                Disponible 24h/24
              </div>
            </div>
          </div>

          {/* Suivi Parents */}
          <div
            ref={dashRef}
            className="rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center transition-all duration-700"
            style={{ background: "var(--greek-blue)", border: "1px solid rgba(197,161,72,0.12)", opacity: bentoVisible ? 1 : 0, transform: bentoVisible ? "translateY(0)" : "translateY(28px)", transitionDelay: "240ms" }}
          >
            <div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(197,161,72,0.12)", border: "1px solid rgba(197,161,72,0.2)" }}>
                <Users className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />
              </div>
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(197,161,72,0.7)" }}>Suivi Parents</div>
              <h3 className="font-[family-name:var(--font-display)] font-bold text-2xl leading-snug mb-3" style={{ color: "#f0ede8" }}>
                Chaque progrès,<br />visible en temps réel
              </h3>
              <p className="text-sm leading-relaxed max-w-sm" style={{ color: "rgba(240,237,232,0.5)" }}>
                Tableau de bord parents avec progression par chapitre, taux de réussite et alertes personnalisées.
              </p>
            </div>

            <div className="rounded-2xl p-5" style={{ background: "#0d1829", border: "1px solid rgba(197,161,72,0.12)" }}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: "rgba(197,161,72,0.1)" }}>
                <div>
                  <p className="text-xs font-bold" style={{ color: "#f0ede8" }}>Emma · 5ème</p>
                  <p className="text-xs" style={{ color: "rgba(240,237,232,0.3)" }}>Cette semaine</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(197,161,72,0.12)", color: "var(--greek-gold)" }}>
                  <TrendingUp className="w-3 h-3" /> +12%
                </div>
              </div>

              {/* Barres — % animé en count-up, barre animée en largeur */}
              {BARS.map((p, idx) => (
                <div key={p.label} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: "rgba(240,237,232,0.5)" }}>{p.label}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: p.color }}>
                      {dashVisible ? pcts[idx] : 0}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: dashVisible ? `${p.pct}%` : "0%",
                        background: p.color,
                        opacity: 0.85,
                        transition: dashVisible ? "width 1400ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
                        transitionDelay: dashVisible ? "150ms" : "0ms",
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Stats — hauteur et slot supérieur fixe pour alignement parfait */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t" style={{ borderColor: "rgba(197,161,72,0.08)" }}>
                {/* Badges */}
                <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-1" style={{ background: "rgba(255,255,255,0.04)", height: 64 }}>
                  <div className="h-8 flex items-end justify-center pb-1">
                    <span className="font-[family-name:var(--font-display)] font-bold text-base leading-none" style={{ color: "var(--greek-gold)" }}>12</span>
                  </div>
                  <span className="text-[10px] leading-none" style={{ color: "rgba(240,237,232,0.3)" }}>Badges</span>
                </div>

                {/* Streak */}
                <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-1" style={{ background: "rgba(255,255,255,0.04)", height: 64 }}>
                  <div className="h-8 flex items-end justify-center">
                    <div className="relative w-10 h-10" style={{ marginBottom: -4 }}>
                      <img src="/Streaks.gif" alt="streak" className="absolute inset-0 w-full h-full object-contain" />
                      <span
                        className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-display)] font-bold z-10"
                        style={{ color: "#fff", fontSize: 11, textShadow: "0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8)", paddingTop: 10 }}
                      >7</span>
                    </div>
                  </div>
                  <span className="text-[10px] leading-none" style={{ color: "rgba(240,237,232,0.3)" }}>Streak</span>
                </div>

                {/* XP */}
                <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-1" style={{ background: "rgba(255,255,255,0.04)", height: 64 }}>
                  <div className="h-8 flex items-end justify-center pb-1">
                    <span className="font-[family-name:var(--font-display)] font-bold text-base leading-none" style={{ color: "var(--greek-gold)" }}>340</span>
                  </div>
                  <span className="text-[10px] leading-none" style={{ color: "rgba(240,237,232,0.3)" }}>XP</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §4 — COMMENT ÇA MARCHE (fond beige)
      ════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="font-[family-name:var(--font-display)] font-bold" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}>
              Simple à démarrer.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-7 left-[14%] right-[14%] h-px" style={{ background: "linear-gradient(90deg, transparent, var(--greek-border) 20%, var(--greek-border) 80%, transparent)" }} />
            {[
              { num: "01", title: "Créez votre compte",   desc: "Parent ou élève, inscription en 2 minutes." },
              { num: "02", title: "Choisissez un plan",   desc: "Offre adaptée à vos besoins." },
              { num: "03", title: "L'enfant apprend",     desc: "Cours, exercices, quiz et IA à portée de main." },
              { num: "04", title: "Suivez les résultats", desc: "Stats claires depuis votre espace parent." },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-5 relative z-10 font-[family-name:var(--font-display)] font-bold text-lg"
                  style={{
                    background: "var(--greek-cream)", border: "2px solid var(--greek-border)",
                    color: "var(--greek-gold)",
                    transition: "background 250ms ease, border-color 250ms ease, transform 250ms ease, box-shadow 250ms ease",
                    cursor: "default",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    el.style.background = "var(--greek-blue)";
                    el.style.borderColor = "var(--greek-blue)";
                    el.style.transform = "scale(1.18)";
                    el.style.boxShadow = "0 8px 28px rgba(15,30,58,0.3)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    el.style.background = "var(--greek-cream)";
                    el.style.borderColor = "var(--greek-border)";
                    el.style.transform = "scale(1)";
                    el.style.boxShadow = "none";
                  }}
                >
                  {s.num}
                </div>
                <h5 className="font-[family-name:var(--font-display)] font-bold text-base mb-2" style={{ color: "var(--greek-blue)" }}>{s.title}</h5>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §5 — CTA FINAL
      ════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6" style={{ background: "var(--greek-blue)" }}>
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-6" style={{ color: "#f0ede8", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
            Votre enfant mérite<br />
            <span style={{ color: "var(--greek-gold)" }}>le meilleur départ</span>
          </h2>
          <p className="text-base mb-10 max-w-md mx-auto leading-relaxed" style={{ color: "rgba(240,237,232,0.42)" }}>
            7 jours d&apos;essai gratuit, sans engagement, pas de paiement 
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/inscription"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm transition-all duration-200 hover:-translate-y-[2px] active:scale-[0.98] font-[family-name:var(--font-display)]"
              style={{ background: "var(--greek-gold)", color: "#fff", boxShadow: "0 8px 32px rgba(197,161,72,0.32)" }}
            >
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/offres"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm transition-all duration-200 border hover:-translate-y-[1px] font-[family-name:var(--font-display)]"
              style={{ borderColor: "rgba(197,161,72,0.22)", color: "rgba(240,237,232,0.55)" }}
            >
              Voir les offres
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

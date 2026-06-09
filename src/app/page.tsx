"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, LogIn, Users, TrendingUp, BookOpen, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
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

/* ── Types ── */
interface TpReview {
  id: string;
  title: string;
  text: string;
  rating: number;
  is_verified: boolean;
  name: string;
  country: string;
  total_reviews: number;
}

/* ── Trustpilot brand colors ── */
const TP_GREEN = "#00b67a";
const TP_GREY  = "#dcdce6";

/* ── Trustpilot star (rect avec étoile découpée, style officiel) ── */
function TpStar({ filled, size = 28 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="2" fill={filled ? TP_GREEN : TP_GREY} />
      <path
        d="M20 6l3.708 11.41H35.41l-9.527 6.924 3.708 11.41L20 28.82l-9.59 6.924 3.708-11.41L4.59 17.41H16.29L20 6z"
        fill="#fff"
      />
    </svg>
  );
}

/* ── Logo Trustpilot (étoile verte + texte) ── */
function TrustpilotLogo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="2" fill={TP_GREEN} />
        <path d="M20 6l3.708 11.41H35.41l-9.527 6.924 3.708 11.41L20 28.82l-9.59 6.924 3.708-11.41L4.59 17.41H16.29L20 6z" fill="#fff" />
      </svg>
      <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: size * 0.9, color: "#191919", letterSpacing: "-0.02em" }}>Trustpilot</span>
    </span>
  );
}

/* ── Étoiles rating (5 carrés verts/gris) ── */
function TpStars({ rating, size = 28 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <TpStar key={i} filled={i < Math.round(rating)} size={size} />
      ))}
    </div>
  );
}

/* ── Section Trustpilot complète ── */
function TestimonialsSection({ reviews }: { reviews: TpReview[] }) {
  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  return (
    <div>
      {/* Bandeau header style Trustpilot */}
      <div
        className="rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-6"
        style={{ background: "#fff", border: "1px solid rgba(197,161,72,0.22)", boxShadow: "0 2px 16px rgba(15,30,58,0.05)" }}
      >
        <div className="flex flex-col items-center sm:items-start gap-2">
          <TrustpilotLogo size={26} />
          {avgRating ? (
            <>
              <TpStars rating={avgRating} size={36} />
              <p className="text-sm font-bold" style={{ color: "#191919" }}>
                Note : <span style={{ color: TP_GREEN }}>{avgRating}</span>
                <span className="font-normal text-gray-400"> / 5 · {reviews.length} avis</span>
              </p>
            </>
          ) : (
            <>
              <TpStars rating={0} size={36} />
              <p className="text-sm text-gray-400">Soyez le premier à laisser un avis !</p>
            </>
          )}
        </div>
        <a
          href="https://fr.trustpilot.com/review/educalcul.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold px-5 py-2.5 rounded-full transition-all hover:-translate-y-[2px] hover:shadow-md active:scale-[0.98]"
          style={{ background: TP_GREEN, color: "#fff" }}
        >
          Laisser un avis
        </a>
      </div>

      {/* Grille des avis */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reviews.slice(0, 8).map((r, i) => (
            <div
              key={r.id}
              className={`rounded-xl p-5 flex flex-col gap-3${i >= 4 ? " hidden lg:flex" : ""}`}
              style={{ background: "#fff", border: "1px solid #e8e8e8", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            >
              <TpStars rating={r.rating} size={22} />
              {r.title && (
                <p className="text-sm font-bold leading-snug" style={{ color: "#191919" }}>{r.title}</p>
              )}
              <p className="text-sm leading-relaxed flex-1" style={{ color: "#555" }}>
                {r.text.length > 150 ? r.text.slice(0, 147) + "…" : r.text}
              </p>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: TP_GREEN }}
                >
                  {r.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "#191919" }}>{r.name}</p>
                  <p className="text-[10px]" style={{ color: "#999" }}>{r.total_reviews} avis</p>
                </div>
                {r.is_verified && (
                  <span className="ml-auto text-[10px] font-semibold flex-shrink-0" style={{ color: TP_GREEN }}>✓ Vérifié</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  { num: "01", title: "Créez votre espace",    desc: "Parent, lycéen autonome ou élève suivi — 2 minutes, sans carte bancaire requise." },
  { num: "02", title: "Choisissez votre plan",  desc: "7 jours d'essai gratuit sur tous les plans. Accès immédiat à tous les contenus." },
  { num: "03", title: "L'enfant apprend",        desc: "Cours structurés, exercices progressifs et EpsiAI qui guide sans donner la réponse." },
  { num: "04", title: "Vous pilotez",            desc: "Tableau de bord parent : progrès par chapitre, streaks et alertes hebdomadaires." },
];

function StepsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTriggered(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="py-24 px-6" style={{ background: "var(--greek-cream)" }}>
      <div className="max-w-5xl mx-auto" ref={sectionRef}>
        <div className="mb-14"
          style={{ opacity: triggered ? 1 : 0, transform: triggered ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--greek-gold)" }}>Comment ça marche</p>
          <h2 className="font-[family-name:var(--font-display)] font-bold" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}>
            Simple à démarrer.
          </h2>
        </div>

        {/* Desktop: timeline horizontale */}
        <div className="hidden md:grid md:grid-cols-4 gap-0 relative">
          {/* Ligne animée */}
          <div className="absolute top-7 left-[12.5%] right-[12.5%] h-px overflow-hidden">
            <div style={{
              height: "100%",
              background: `linear-gradient(90deg, var(--greek-gold), var(--greek-border))`,
              transform: triggered ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left center",
              transition: "transform 0.8s cubic-bezier(0.4,0,0.2,1) 0.55s",
            }} />
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

        {/* Mobile: cartes verticales avec ligne latérale animée */}
        <div className="md:hidden flex flex-col gap-0 relative">
          {/* Ligne verticale gauche */}
          <div className="absolute left-5 top-6 bottom-16 w-px overflow-hidden">
            <div style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(180deg, var(--greek-gold), rgba(197,161,72,0.15))`,
              transform: triggered ? "scaleY(1)" : "scaleY(0)",
              transformOrigin: "top center",
              transition: "transform 1s cubic-bezier(0.4,0,0.2,1) 0.2s",
            }} />
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
              {/* Cercle sur la ligne */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-[family-name:var(--font-display)] font-bold text-sm relative z-10"
                style={{ background: "var(--greek-cream)", color: "var(--greek-gold)", border: "2px solid var(--greek-border)", minWidth: 40 }}
              >
                {s.num}
              </div>
              <div className="pt-0.5">
                <h5 className="font-[family-name:var(--font-display)] font-bold text-base mb-1" style={{ color: "var(--greek-blue)" }}>{s.title}</h5>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [epsiHover, setEpsiHover]     = useState(false);
  const [dashVisible, setDashVisible] = useState(false);
  const [bentoVisible, setBentoVisible] = useState(false);
  const [photosVisible, setPhotosVisible] = useState(false);
  const [scrolled, setScrolled]       = useState(false);
  const [tpReviews, setTpReviews]         = useState<TpReview[]>([]);
  const stepsRef = useRef<HTMLDivElement>(null);
  const tpCardRef = useRef<HTMLDivElement>(null);
  const [tpCardVisible, setTpCardVisible] = useState(false);

  useEffect(() => {
    fetch("/api/trustpilot-reviews")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.reviews) && d.reviews.length > 0) setTpReviews(d.reviews); })
      .catch(() => {});
  }, []);
  const dashRef  = useRef<HTMLDivElement>(null);
  const bentoRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = photosRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setPhotosVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = tpCardRef.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight) { setTpCardVisible(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTpCardVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
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
        style={{ minHeight: "100dvh", background: "#0f1e3a", paddingTop: "var(--nav-h)" }}
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
          <Image src="/logo.png" alt="Educalcul" width={192} height={110} className="mb-10 w-auto" style={{ height: 110 }} priority />

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

          <div className="flex flex-col sm:flex-row gap-3">
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


          <p className="text-sm italic mt-6" style={{ color: "rgba(197,161,72,0.45)", fontFamily: "Georgia, serif" }}>
            Parce que progresser, ça aussi, ça se calcule.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §2 — MANIFESTE
      ════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-8 items-start">
            <div className="hidden sm:block w-1 rounded-full flex-shrink-0 mt-2" style={{ background: "var(--greek-gold)", height: 72, opacity: 0.6 }} />
            <div>
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
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §3 — BENTO GRID
      ════════════════════════════════════════════════════════ */}
      <section className="pt-4 pb-28 px-6" style={{ background: "var(--greek-cream)" }}>
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
                    <Image src="/logoAI.png" alt="EpsiAI" width={40} height={40} className="w-10 h-10 object-contain" />
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
                      <Image src="/Streaks.gif" alt="streak" fill className="object-contain" unoptimized />
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
          §3b — PHOTOS ENFANTS
      ════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 overflow-hidden" style={{ background: "var(--greek-cream)" }} ref={photosRef}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 max-w-lg">
            <h2 className="font-[family-name:var(--font-display)] font-bold leading-tight" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}>
              Des élèves qui comprennent,<br />
              <span style={{ color: "var(--greek-gold)" }}>enfin.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Photo 1 — grande */}
            <div
              className="group md:col-span-2 relative rounded-3xl overflow-hidden"
              style={{
                height: 420,
                opacity: photosVisible ? 1 : 0,
                transform: photosVisible ? "translateY(0) scale(1)" : "translateY(32px) scale(0.97)",
                transition: "opacity 700ms ease, transform 700ms ease",
                transitionDelay: "0ms",
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1588072432836-e10032774350?w=900&q=80&fit=crop"
                alt="Élève qui travaille et sourit"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,30,58,0.65) 0%, transparent 50%)" }} />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="text-white font-[family-name:var(--font-display)] font-bold text-lg leading-snug mb-1">
                  "Enfin, maman comprend mes devoirs !"
                </p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Théo · CE2 · Suivi avec son parent</p>
              </div>
            </div>

            {/* Colonne droite */}
            <div className="flex flex-col gap-4">
              {/* Photo 2 */}
              <div
                className="group relative rounded-3xl overflow-hidden"
                style={{
                  height: 200,
                  opacity: photosVisible ? 1 : 0,
                  transform: photosVisible ? "translateY(0)" : "translateY(32px)",
                  transition: "opacity 700ms ease, transform 700ms ease",
                  transitionDelay: "120ms",
                }}
              >
                <img
                  src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80&fit=crop"
                  alt="Enfants qui apprennent ensemble"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,30,58,0.5) 0%, transparent 60%)" }} />
                <div className="absolute bottom-4 left-4">
                  <p className="text-white text-sm font-semibold" style={{ fontFamily: "Cinzel, serif" }}>Apprendre avec plaisir</p>
                </div>
              </div>

              {/* Photo 3 */}
              <div
                className="group relative rounded-3xl overflow-hidden"
                style={{
                  height: 200,
                  opacity: photosVisible ? 1 : 0,
                  transform: photosVisible ? "translateY(0)" : "translateY(32px)",
                  transition: "opacity 700ms ease, transform 700ms ease",
                  transitionDelay: "240ms",
                }}
              >
                <img
                  src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80&fit=crop"
                  alt="Enfant qui réussit ses exercices"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,30,58,0.5) 0%, transparent 60%)" }} />
                <div className="absolute bottom-4 left-4">
                  <p className="text-white text-sm font-semibold" style={{ fontFamily: "Cinzel, serif" }}>Les maths au tableau</p>
                </div>
              </div>
            </div>
          </div>

          {/* Badge programme EN sous les photos */}
          <div
            className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl"
            style={{
              background: "#fff",
              border: "1px solid var(--greek-border)",
              opacity: photosVisible ? 1 : 0,
              transform: photosVisible ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 700ms ease, transform 700ms ease",
              transitionDelay: "360ms",
            }}
          >
            <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start">
              <Image src="/logo-men.svg" alt="Ministère de l'Éducation Nationale" width={180} height={180} className="w-auto object-contain flex-shrink-0" style={{ height: 180 }} unoptimized />
              <div className="w-px h-10 hidden sm:block" style={{ background: "var(--greek-border)" }} />
              <Image src="/eduscol.svg" alt="Eduscol" width={80} height={28} className="h-7 w-auto object-contain" unoptimized />
            </div>
            <div className="text-center sm:text-right">
              <p className="text-sm font-bold" style={{ color: "var(--greek-blue)" }}>
                100% aligné sur le programme officiel
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Du CP à la Terminale, toutes filières
              </p>
            </div>
            <Link
              href="/programmes"
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: "var(--greek-blue)", color: "#fff" }}
            >
              Voir les programmes <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §3c — TÉMOIGNAGES
      ════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--greek-gold)" }}>Avis clients</p>

            <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)]" style={{ color: "var(--greek-blue)" }}>
              Ce que disent nos familles
            </h2>
          </div>
          <div ref={tpCardRef} style={{ opacity: tpCardVisible ? 1 : 0, transform: tpCardVisible ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.6s, transform 0.6s" }}>
            <TestimonialsSection reviews={tpReviews} />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §4 — COMMENT ÇA MARCHE (fond beige)
      ════════════════════════════════════════════════════════ */}
      <StepsSection />

      {/* ════════════════════════════════════════════════════════
          §5 — CTA FINAL
      ════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6" style={{ background: "var(--greek-blue)" }}>
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-6" style={{ color: "#f0ede8", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
            Votre enfant mérite<br />
            <span style={{ color: "var(--greek-gold)" }}>le meilleur départ</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-4 mb-10 text-sm" style={{ color: "rgba(240,237,232,0.42)" }}>
            <span className="flex items-center gap-1.5"><span style={{ color: "var(--greek-gold)" }}>✓</span> 7 jours gratuits</span>
            <span className="flex items-center gap-1.5"><span style={{ color: "var(--greek-gold)" }}>✓</span> Sans carte bancaire</span>
            <span className="flex items-center gap-1.5"><span style={{ color: "var(--greek-gold)" }}>✓</span> Annulable à tout moment</span>
          </div>
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

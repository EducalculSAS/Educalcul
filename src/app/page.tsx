import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, LogIn, Users, BookOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import ScrollArrow from "@/components/home/ScrollArrow";
import FadeInSection from "@/components/home/FadeInSection";
import EpsiAIHover from "@/components/home/EpsiAIHover";
import AnimatedStatsCard from "@/components/home/AnimatedStatsCard";
import StepsSection from "@/components/home/StepsSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import { fetchTrustpilotReviews } from "@/lib/trustpilot";

// Cette page était auparavant un pur "use client" : rien n'était rendu côté
// serveur (page blanche jusqu'à l'hydratation), et les avis Trustpilot
// étaient chargés après montage (flash "0 avis" + aller-retour réseau en
// plus). Elle est maintenant un composant serveur ; seules les portions
// réellement interactives (animations déclenchées au scroll, survol, compteur
// animé) sont isolées dans de petits client islands sous
// src/components/home/.

/* ─── Symboles math hero — animation CSS pure, aucun état React requis ─── */
const SYM = [
  { s: "∑", x: 6, y: 10, z: 96, d: 0, t: 7.2 },
  { s: "π", x: 87, y: 7, z: 72, d: 1.3, t: 8.5 },
  { s: "√", x: 12, y: 62, z: 58, d: 0.6, t: 9.1 },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4 },
  { s: "Δ", x: 43, y: 14, z: 50, d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66, d: 1.8, t: 8.0 },
  { s: "α", x: 2, y: 40, z: 44, d: 2.7, t: 9.3 },
  { s: "×", x: 76, y: 26, z: 54, d: 0.4, t: 7.8 },
  { s: "θ", x: 50, y: 78, z: 62, d: 2.0, t: 8.8 },
  { s: "β", x: 28, y: 53, z: 42, d: 3.3, t: 10.5 },
  { s: "≠", x: 58, y: 30, z: 46, d: 1.1, t: 9.7 },
  { s: "÷", x: 19, y: 84, z: 38, d: 2.9, t: 7.3 },
  { s: "φ", x: 74, y: 82, z: 52, d: 1.6, t: 8.4 },
  { s: "μ", x: 35, y: 22, z: 44, d: 0.7, t: 9.0 },
  { s: "²", x: 82, y: 55, z: 60, d: 2.4, t: 7.6 },
  { s: "³", x: 47, y: 90, z: 38, d: 1.2, t: 10.0 },
  { s: "λ", x: 16, y: 33, z: 48, d: 3.0, t: 8.2 },
  { s: "ω", x: 93, y: 75, z: 56, d: 0.3, t: 9.5 },
];

export default async function Home() {
  const tpReviews = await fetchTrustpilotReviews();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0f1e3a" }}>
      <Navbar />

      <ScrollArrow />

      {/* ════════════════════════════════════════════════════════
          §1 — HERO
      ════════════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "100dvh", background: "#0f1e3a", paddingTop: "var(--nav-h)" }}
      >
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {SYM.map((cfg, i) => (
            <span
              key={i}
              className="absolute font-bold animate-float-symbol"
              style={{
                left: `${cfg.x}%`,
                top: `${cfg.y}%`,
                fontSize: `${cfg.z}px`,
                fontFamily: "Georgia, serif",
                color: "var(--greek-gold)",
                opacity: 0.13,
                animationDuration: `${cfg.t}s`,
                animationDelay: `${cfg.d}s`,
              }}
            >
              {cfg.s}
            </span>
          ))}
        </div>

        <div
          className="absolute pointer-events-none"
          style={{
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(197,161,72,0.08) 0%, transparent 65%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -58%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl">
          <Image src="/logo.png" alt="Educalcul" width={192} height={110} className="mb-10 w-auto" style={{ height: 110 }} priority />

          <h1
            className="font-[family-name:var(--font-display)] font-bold leading-[1.02] tracking-tight mb-6"
            style={{ color: "#f0ede8", fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)" }}
          >
            Les maths<br />
            <span style={{ color: "var(--greek-gold)" }}>enfin à portée de main</span>
          </h1>

          <p className="text-base leading-relaxed mb-10 max-w-lg" style={{ color: "rgba(240,237,232,0.48)" }}>
            Educalcul, la seule plateforme qui accompagne tous les élèves en mathématiques, du CP à la Terminale.
            <br />
            Pour votre enfant : du contenu de qualité accompagné d’une IA socratique, dans un environnement ludique.
            <br />
            Pour vous : un suivi parental précis pour observer ses progrès en toute sérénité.
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
            Educalcul, par amour des mathématiques.
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
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Bloc A — Cours */}
            <FadeInSection
              className="rounded-3xl p-8 flex flex-col justify-between"
              style={{ background: "#fff", border: "1px solid var(--greek-border)", minHeight: 280 }}
            >
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
            </FadeInSection>

            {/* Bloc B — EpsiAI */}
            <FadeInSection
              delayMs={120}
              className="rounded-3xl p-8 flex flex-col justify-between relative overflow-visible"
              style={{ background: "var(--greek-blue)", minHeight: 280 }}
            >
              <div className="relative z-10">
                <EpsiAIHover />
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
            </FadeInSection>
          </div>

          {/* Suivi Parents */}
          <FadeInSection
            delayMs={240}
            threshold={0.35}
            className="rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
            style={{ background: "var(--greek-blue)", border: "1px solid rgba(197,161,72,0.12)" }}
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
                Tableau de bord parents avec progression par chapitre, taux de réussite et notifications personnalisées.
              </p>
            </div>

            <AnimatedStatsCard />
          </FadeInSection>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          §3b — PHOTOS ENFANTS
      ════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 overflow-hidden" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 max-w-lg">
            <h2 className="font-[family-name:var(--font-display)] font-bold leading-tight" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.6rem, 3vw, 2.4rem)" }}>
              Des élèves qui comprennent,<br />
              <span style={{ color: "var(--greek-gold)" }}>enfin.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <FadeInSection className="group md:col-span-2 relative rounded-3xl overflow-hidden" style={{ height: 420 }} translateY={32}>
              <Image
                src="https://images.unsplash.com/photo-1588072432836-e10032774350?w=900&q=80&fit=crop"
                alt="Élève qui travaille et sourit"
                fill
                sizes="(max-width: 768px) 100vw, 66vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,30,58,0.65) 0%, transparent 50%)" }} />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="text-white font-[family-name:var(--font-display)] font-bold text-lg leading-snug mb-1">
                  "Enfin, maman comprend mes devoirs !"
                </p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Théo · CE2 · Suivi avec son parent</p>
              </div>
            </FadeInSection>

            <div className="flex flex-col gap-4">
              <FadeInSection className="group relative rounded-3xl overflow-hidden" style={{ height: 200 }} translateY={32} delayMs={120}>
                <Image
                  src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&q=80&fit=crop"
                  alt="Enfants qui apprennent ensemble"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,30,58,0.5) 0%, transparent 60%)" }} />
                <div className="absolute bottom-4 left-4">
                  <p className="text-white text-sm font-semibold" style={{ fontFamily: "Cinzel, serif" }}>Apprendre avec plaisir</p>
                </div>
              </FadeInSection>

              <FadeInSection className="group relative rounded-3xl overflow-hidden" style={{ height: 200 }} translateY={32} delayMs={240}>
                <Image
                  src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80&fit=crop"
                  alt="Enfant qui réussit ses exercices"
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,30,58,0.5) 0%, transparent 60%)" }} />
                <div className="absolute bottom-4 left-4">
                  <p className="text-white text-sm font-semibold" style={{ fontFamily: "Cinzel, serif" }}>Les maths au tableau</p>
                </div>
              </FadeInSection>
            </div>
          </div>

          {/* Badge programme EN sous les photos */}
          <FadeInSection
            translateY={16}
            delayMs={360}
            className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl"
            style={{ background: "#fff", border: "1px solid var(--greek-border)" }}
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
          </FadeInSection>
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
          <FadeInSection translateY={24} durationMs={600}>
            <TestimonialsSection reviews={tpReviews} />
          </FadeInSection>
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
            <span style={{ color: "var(--greek-gold)" }}>le meilleur.</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-4 mb-10 text-sm" style={{ color: "rgba(240,237,232,0.42)" }}>
            <span className="flex items-center gap-1.5"><span style={{ color: "var(--greek-gold)" }}>✓</span> Méthodologie adaptée</span>
            <span className="flex items-center gap-1.5"><span style={{ color: "var(--greek-gold)" }}>✓</span> 7 jours offerts</span>
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

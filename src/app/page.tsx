import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, LogIn, Users, BookOpen, Sparkles, GraduationCap, ShieldCheck, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import ScrollArrow from "@/components/home/ScrollArrow";
import Reveal, { RevealGroup, RevealItem } from "@/components/home/Reveal";
import FaqAccordionItem from "@/components/tarifs/TarifsFaqItem";
import HomePricingGrid from "@/components/home/HomePricingGrid";
import CaliaHover from "@/components/home/CaliaHover";
import CaliaChatPreview from "@/components/home/CaliaChatPreview";
import GlassButton from "@/components/ui/GlassButton";
import AnimatedStatsCard from "@/components/home/AnimatedStatsCard";
import StepsSection from "@/components/home/StepsSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import { fetchReviewsForHomepage } from "@/lib/manualReviews";
import { fetchReviewRatingOverride } from "@/lib/reviewRatingOverride";
import { fetchActivePlans } from "@/lib/plans";

// Page publique, quasi-statique (avis + tarifs) : ISR plutôt qu'un aller-retour
// Supabase à chaque visite. 5 min de décalage max après une modification
// admin, en échange d'un TTFB en cache pour tout le reste.
export const revalidate = 300;

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

const MINI_FAQ = [
  { q: "Combien coûte l'essai ?", a: "Rien. 7 jours d'accès complet, aucune carte bancaire requise pour commencer." },
  { q: "Puis-je résilier à tout moment ?", a: "Oui, sans engagement ni justification, directement depuis l'espace parent." },
  { q: "Le contenu suit-il le programme officiel ?", a: "Intégralement : chaque cours et exercice est aligné sur les programmes de l'Éducation Nationale, du CP à la Terminale." },
];

export default async function Home() {
  const [tpReviews, ratingOverride, allPlans] = await Promise.all([
    fetchReviewsForHomepage(),
    fetchReviewRatingOverride(),
    fetchActivePlans(),
  ]);

  // Chaque formule existe en plusieurs lignes (une par intervalle de
  // facturation) — un seul aperçu par formule distincte (tarif mensuel de
  // préférence), sinon l'aperçu tarifs affiche 3x la même formule.
  const plansByName = new Map<string, (typeof allPlans)[number]>();
  for (const p of allPlans) {
    const existing = plansByName.get(p.name);
    if (!existing || p.billing_interval === "month") plansByName.set(p.name, existing?.billing_interval === "month" ? existing : p);
  }
  const plans = Array.from(plansByName.values()).sort((a, b) => a.price - b.price);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-blue)" }}>
      <Navbar />
      <ScrollArrow />

      {/* ════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "100dvh", background: "var(--greek-blue)", paddingTop: "var(--nav-h)" }}
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

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl">
          <div className="hero-rise hero-rise-1 mb-6">
            <Image src="/logo.png" alt="Educalcul" width={190} height={108} className="w-auto object-contain" style={{ height: 100 }} priority unoptimized />
          </div>

          <h1
            className="font-[family-name:var(--font-display)] font-bold leading-[0.98] tracking-tight mb-8 hero-rise hero-rise-2 max-w-3xl"
            style={{ color: "#f0ede8", fontSize: "clamp(2.4rem, 5vw, 4rem)" }}
          >
            Les maths,<br />
            <span className="text-gradient-gold">enfin à portée de main</span>
          </h1>

          <p className="text-base leading-relaxed mb-12 max-w-lg hero-rise hero-rise-3" style={{ color: "rgba(240,237,232,0.55)" }}>
            Une IA socratique qui guide sans donner la réponse, un programme complet du CP à la Terminale,
            et un suivi parental limpide.<br />
            Educalcul accompagne toute la famille, pas seulement l'élève.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 hero-rise hero-rise-4">
            <GlassButton href="/auth/inscription" variant="gold" className="font-bold">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </GlassButton>
            <GlassButton href="/auth/connexion" variant="light" className="font-semibold">
              <LogIn className="w-4 h-4" /> Se connecter
            </GlassButton>
          </div>

          <p className="text-sm italic mt-10 hero-rise hero-rise-5" style={{ color: "rgba(197,161,72,0.45)", fontFamily: "Georgia, serif" }}>
            Educalcul, par amour des mathématiques.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          BANDEAU DE PREUVE — faits vérifiables, pas de chiffres inventés
      ════════════════════════════════════════════════════════ */}
      <section className="py-6 px-6" style={{ background: "var(--greek-cream)", borderBottom: "1px solid var(--greek-border)" }}>
        <Reveal y={12} className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--greek-blue)" }}>
            <GraduationCap className="w-4 h-4" style={{ color: "var(--greek-gold)" }} /> Du CP à la Terminale
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--greek-blue)" }}>
            <Sparkles className="w-4 h-4" style={{ color: "var(--greek-gold)" }} /> IA pédagogique 24h/24
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--greek-blue)" }}>
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--greek-gold)" }} /> 100% programme officiel
          </div>
          <div className="w-px h-5 hidden sm:block" style={{ background: "var(--greek-border)" }} />
          <div className="flex items-center gap-3">
            <Image src="/logo-men.svg" alt="Ministère de l'Éducation Nationale" width={200} height={200} className="w-auto object-contain" style={{ height: 88 }} unoptimized />
            <Image src="/eduscol.svg" alt="Eduscol" width={110} height={38} className="h-8 w-auto object-contain" unoptimized />
          </div>
        </Reveal>
      </section>

      {/* ════════════════════════════════════════════════════════
          GRAND ÉNONCÉ
      ════════════════════════════════════════════════════════ */}
      <section className="pt-44 pb-36 px-6" style={{ background: "var(--greek-cream)" }}>
        <Reveal className="max-w-4xl mx-auto text-center" y={44} scale={0.94} duration={1}>
          <blockquote
            className="font-[family-name:var(--font-display)] font-bold leading-[1.15]"
            style={{ fontSize: "clamp(2rem, 4.2vw, 3.4rem)" }}
          >
            <span style={{ color: "var(--greek-blue)" }}>Votre enfant ne manque pas de capacités.</span>
            <br />
            <span className="text-gradient-gold-dark">Il manque d'une bonne méthode.</span>
          </blockquote>
          <p className="mt-8 text-base leading-relaxed max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>
            Educalcul est construit sur un principe simple : chaque élève peut réussir en mathématiques si on lui donne les bons outils.
          </p>
        </Reveal>
      </section>

      {/* ════════════════════════════════════════════════════════
          VITRINE DES FONCTIONNALITÉS — rangées alternées
      ════════════════════════════════════════════════════════ */}
      <section className="pb-8 px-6" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-5xl mx-auto flex flex-col gap-28 md:gap-36">
          {/* Rangée A — Cours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            <Reveal y={36} scale={0.96}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "var(--greek-gold)" }}>
                <span className="w-6 h-px" style={{ background: "var(--greek-gold)" }} /> 1 · Cours & Exercices
              </div>
              <h3 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-4" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)", letterSpacing: "-0.01em" }}>
                Tout le programme,<br />aucune lacune oubliée
              </h3>
              <p className="text-base leading-relaxed max-w-md" style={{ color: "var(--text-muted)" }}>
                Cours structurés, exercices progressifs, corrections détaillées, construits chapitre par chapitre sur le programme officiel, du CP à la Terminale.
              </p>
            </Reveal>
            <Reveal y={36} scale={0.95} delay={0.1} className="rounded-3xl p-8 transition-transform duration-500 hover:-translate-y-1" style={{ background: "#fff", border: "1px solid var(--greek-border)", minHeight: 280 }}>
              <div className="h-full flex flex-col justify-center gap-3">
                {["Fractions et nombres décimaux", "Théorème de Pythagore", "Fonctions affines"].map((t, i) => (
                  <div key={t} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: i === 1 ? "rgba(197,161,72,0.08)" : "transparent", border: i === 1 ? "1px solid rgba(197,161,72,0.25)" : "1px solid transparent" }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: i <= 1 ? "var(--greek-gold)" : "var(--greek-border)" }} />
                    <span className="text-sm font-semibold" style={{ color: i <= 1 ? "var(--greek-blue)" : "var(--text-muted)" }}>{t}</span>
                    {i < 1 && <BookOpen className="w-4 h-4 ml-auto" style={{ color: "var(--greek-gold)" }} />}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Rangée B — Calia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            <Reveal y={36} scale={0.95} delay={0.1} className="rounded-3xl p-8 relative overflow-visible transition-transform duration-500 hover:-translate-y-1" style={{ background: "var(--greek-blue)", minHeight: 280 }}>
              <div className="relative z-10 h-full flex flex-col justify-center gap-4">
                <CaliaHover />

                <CaliaChatPreview />

                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold w-fit" style={{ color: "var(--greek-gold)" }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--greek-gold)" }} />
                  Disponible 24h/24
                </div>
              </div>
            </Reveal>
            <Reveal y={36} scale={0.95}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "var(--greek-gold)" }}>
                <span className="w-6 h-px" style={{ background: "var(--greek-gold)" }} /> 2 · IA Pédagogique
              </div>
              <h3 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-4" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)", letterSpacing: "-0.01em" }}>
                Un tuteur IA qui pose<br />les bonnes questions
              </h3>
              <p className="text-base leading-relaxed max-w-md" style={{ color: "var(--text-muted)" }}>
                Jamais la réponse tout de suite : Calia repère où ça bloque et guide l'élève jusqu'au déclic, avec la méthode socratique. Disponible 24h/24.
              </p>
            </Reveal>
          </div>

          {/* Rangée C — Suivi Parents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            <Reveal y={36} scale={0.96}>
              <div className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "var(--greek-gold)" }}>
                <span className="w-6 h-px" style={{ background: "var(--greek-gold)" }} /> 3 · Suivi Parents
              </div>
              <h3 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-4" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)", letterSpacing: "-0.01em" }}>
                Vous savez enfin<br />où il en est vraiment
              </h3>
              <p className="text-base leading-relaxed max-w-md" style={{ color: "var(--text-muted)" }}>
                Progression par chapitre, taux de réussite, temps passé : un tableau de bord clair, pas un bulletin de plus à décoder.
              </p>
            </Reveal>
            <Reveal y={36} scale={0.95} delay={0.1}>
              <AnimatedStatsCard />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          APERÇU TARIFS
      ════════════════════════════════════════════════════════ */}
      {plans.length > 0 && (
        <section className="pt-28 pb-16 px-6" style={{ background: "var(--greek-cream)" }}>
          <div className="max-w-5xl mx-auto">
            <Reveal className="text-center mb-14" y={20}>
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--greek-gold)" }}>Tarifs</p>
              <h2 className="font-[family-name:var(--font-display)] font-bold" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)", letterSpacing: "-0.01em" }}>
                Une formule pour chaque famille
              </h2>
            </Reveal>
            <HomePricingGrid plans={plans} />
            <Reveal y={12} delay={0.2} className="text-center mt-10">
              <Link href="/tarifs" className="text-sm font-bold underline underline-offset-4" style={{ color: "var(--greek-blue)" }}>
                Comparer toutes les formules
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          TRUSTPILOT — badge compact uniquement
      ════════════════════════════════════════════════════════ */}
      <section className="pb-24 px-6" style={{ background: "var(--greek-cream)" }}>
        <Reveal y={16} className="max-w-5xl mx-auto flex justify-center">
          <TestimonialsSection reviews={tpReviews} ratingOverride={ratingOverride} compact />
        </Reveal>
      </section>

      {/* ════════════════════════════════════════════════════════
          COMMENT ÇA MARCHE
      ════════════════════════════════════════════════════════ */}
      <StepsSection />

      {/* ════════════════════════════════════════════════════════
          QUESTIONS FRÉQUENTES
      ════════════════════════════════════════════════════════ */}
      <section className="pt-24 pb-36 px-6" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-10" y={20}>
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "var(--greek-gold)" }}>Questions fréquentes</p>
            <h2 className="font-[family-name:var(--font-display)] font-bold" style={{ color: "var(--greek-blue)", fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)", letterSpacing: "-0.01em" }}>
              Encore quelques doutes ?
            </h2>
          </Reveal>
          <RevealGroup className="flex flex-col gap-3" stagger={0.08}>
            {MINI_FAQ.map((f) => (
              <RevealItem key={f.q}>
                <FaqAccordionItem question={f.q} answer={f.a} />
              </RevealItem>
            ))}
          </RevealGroup>
          <Reveal y={12} delay={0.15} className="text-center mt-8">
            <GlassButton href="/faq" variant="outline" size="sm">
              Voir toutes les questions
            </GlassButton>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          CTA FINAL
      ════════════════════════════════════════════════════════ */}
      <section className="relative py-36 px-6 overflow-hidden" style={{ background: "var(--greek-blue)" }}>
        <Reveal className="relative z-10 text-center max-w-2xl mx-auto" y={36} scale={0.95}>
          <h2
            className="font-[family-name:var(--font-display)] font-bold leading-[1.1] mb-6"
            style={{ color: "#f0ede8", fontSize: "clamp(2.1rem, 4.2vw, 3.2rem)" }}
          >
            Votre enfant mérite<br />
            <span className="text-gradient-gold">le meilleur.</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-4 mb-10 text-sm" style={{ color: "rgba(240,237,232,0.42)" }}>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "var(--greek-gold)" }} aria-hidden="true" /> Méthodologie adaptée</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "var(--greek-gold)" }} aria-hidden="true" /> 7 jours offerts</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4" style={{ color: "var(--greek-gold)" }} aria-hidden="true" /> Annulable à tout moment</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <GlassButton href="/auth/inscription" variant="gold" className="font-bold">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </GlassButton>
            <GlassButton href="/offres" variant="light" className="font-semibold">
              Voir les offres
            </GlassButton>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}

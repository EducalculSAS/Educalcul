import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  BookOpen,
  Trophy,
  Users,
  ShieldCheck,
  BarChart3,
  ArrowRight,
  Check,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import FadeInSection from "@/components/home/FadeInSection";
import OffresDemo from "@/components/offres/OffresDemo";
import { DEMO_COURSE, DEMO_COURSE_PYTHAGORE, DEMO_EXERCISE, DEMO_QUIZ } from "@/lib/demoContent";
import { stripAnswers as stripExerciseAnswers } from "@/lib/exerciseContent";
import { stripAnswers as stripQuizAnswers } from "@/lib/quizContent";
import GlassButton from "@/components/ui/GlassButton";

// Page publique statique : ISR pour servir depuis le cache plutôt que de
// re-render à chaque visite.
export const revalidate = 300;

const SYM = [
  { s: "∑", x: 6, y: 10, z: 96, d: 0, t: 7.2 },
  { s: "π", x: 87, y: 7, z: 72, d: 1.3, t: 8.5 },
  { s: "√", x: 12, y: 62, z: 58, d: 0.6, t: 9.1 },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4 },
  { s: "Δ", x: 43, y: 14, z: 50, d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66, d: 1.8, t: 8.0 },
  { s: "α", x: 2, y: 40, z: 44, d: 2.7, t: 9.3 },
  { s: "×", x: 76, y: 26, z: 54, d: 0.4, t: 7.8 },
];

const PILLARS = [
  {
    icon: BookOpen,
    title: "Apprendre",
    subtitle: "Du CP à la Terminale, toutes filières",
    items: [
      "Cours structurés par chapitre, alignés sur le programme EN",
      "Exercices progressifs avec corrections détaillées",
      "Quiz pour valider chaque notion avant de passer à la suite",
      "Contenu mis à jour chaque année",
    ],
  },
  {
    icon: Trophy,
    title: "Progresser",
    subtitle: "Motivation durable, résultats mesurés",
    items: [
      "Badges et niveaux pour rester motivé",
      "Tableau de bord parent en temps réel",
      "Rapport hebdomadaire par email",
      "Alertes sur les chapitres à retravailler",
    ],
  },
  {
    icon: ShieldCheck,
    title: "En confiance",
    subtitle: "Sécurisé, sans pub, sans distraction",
    items: [
      "Aucune publicité",
      "Conforme RGPD, données protégées",
      "Jusqu'à 5 enfants avec un seul compte parent",
      "Accessible sur tous les appareils",
    ],
  },
];

export default function Offres() {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: "var(--greek-blue)" }}
    >
      <Navbar />
      <main className="flex-grow pt-[64px]">
        {/* ── HERO — layout split, aligné à gauche ── */}
        <section
          className="relative overflow-hidden py-32"
          style={{ background: "var(--greek-blue)" }}
        >
          {SYM.map((cfg, i) => (
            <span
              key={i}
              className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{
                left: `${cfg.x}%`,
                top: `${cfg.y}%`,
                fontSize: `${cfg.z}px`,
                fontFamily: "Georgia,serif",
                color: "var(--greek-gold)",
                opacity: 0.1,
                animationDuration: `${cfg.t}s`,
                animationDelay: `${cfg.d}s`,
              }}
            >
              {cfg.s}
            </span>
          ))}
          <div className="relative container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-5"
                  style={{ color: "rgba(197,161,72,0.85)" }}
                >
                  Plateforme de mathématiques
                </p>
                <h1
                  className="font-[family-name:var(--font-display)] font-bold leading-tight mb-6 text-white"
                  style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)" }}
                >
                  Tout ce qu&apos;il faut
                  <br />
                  <span style={{ color: "var(--greek-gold)" }}>
                    pour maîtriser les maths
                  </span>
                </h1>
                <p
                  className="text-base leading-relaxed mb-8"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Cours, exercices, IA pédagogique et suivi parental, réunis
                  dans une seule plateforme, du CP à la Terminale.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <GlassButton
                    href="/auth/inscription"
                    variant="gold"
                    className="font-[family-name:var(--font-display)] font-bold text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      Commencer gratuitement <ArrowRight className="w-4 h-4" />
                    </span>
                  </GlassButton>
                  <GlassButton
                    href="/tarifs"
                    variant="light"
                    className="font-[family-name:var(--font-display)] font-semibold text-sm"
                  >
                    Voir les tarifs
                  </GlassButton>
                </div>
              </div>
              {/* Carte récap droite */}
              <div className="hidden md:flex flex-col gap-3">
                {[
                  {
                    icon: <BookOpen className="w-4 h-4" />,
                    text: "Cours du CP à la Terminale",
                  },
                  {
                    icon: (
                      <Image
                        src="/logoAI.png"
                        alt=""
                        width={16}
                        height={16}
                        className="w-4 h-4 object-contain"
                      />
                    ),
                    text: "Calia : IA pédagogique",
                  },
                  {
                    icon: <BarChart3 className="w-4 h-4" />,
                    text: "Suivi parental en temps réel",
                  },
                  {
                    icon: <Users className="w-4 h-4" />,
                    text: "Jusqu'à 5 enfants par compte",
                  },
                  {
                    icon: <ShieldCheck className="w-4 h-4" />,
                    text: "Sans pub · RGPD · 100% sécurisé",
                  },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <span style={{ color: "var(--greek-gold)" }}>
                      {row.icon}
                    </span>
                    <span
                      className="text-sm"
                      style={{ color: "rgba(240,237,232,0.7)" }}
                    >
                      {row.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── ESSAYER SANS COMPTE : un vrai cours, un vrai exercice, un vrai quiz ── */}
        <section id="essayer" className="py-24" style={{ background: "var(--greek-cream)" }}>
          <div className="container mx-auto px-6 max-w-5xl">
            <FadeInSection>
              <div className="text-center mb-10">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--greek-gold-text)" }}>
                  Essayez sans compte
                </span>
                <h2
                  className="font-[family-name:var(--font-display)] font-bold leading-tight mt-3 mb-4"
                  style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", color: "var(--greek-blue)" }}
                >
                  Un cours, un exercice, un quiz : <span style={{ color: "var(--greek-gold-text)" }}>comme dans l&apos;espace élève.</span>
                </h2>
                <p className="text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: "var(--text-muted)" }}>
                  Deux cours (fractions en 6e, Pythagore en 4e), un exercice à réponses écrites commentées et un quiz. Rien n&apos;est enregistré.
                  {" "}Voir aussi <Link href="/programmes/6eme" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>le programme de maths de 6e</Link>
                  {" "}et <Link href="/programmes" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>les programmes de tous les niveaux</Link>.
                </p>
              </div>
              <OffresDemo
                courses={[{ label: "Les fractions (6e)", course: DEMO_COURSE }, { label: "Pythagore (4e)", course: DEMO_COURSE_PYTHAGORE }]}
                exercise={stripExerciseAnswers(DEMO_EXERCISE)}
                quiz={stripQuizAnswers(DEMO_QUIZ)}
              />
            </FadeInSection>
          </div>
        </section>

        {/* ── CALIA — EN VEDETTE ── */}
        <section className="py-24" style={{ background: "var(--greek-cream)" }}>
          <div className="container mx-auto px-6 max-w-5xl">
            <FadeInSection className="text-center max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Image src="/logoAI.png" alt="Calia" width={40} height={40} className="w-10 h-10 object-contain" />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--greek-gold-text)" }}>
                  La feature qui change tout
                </span>
              </div>
              <h2 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-5" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", color: "var(--greek-blue)" }}>
                Calia enseigne, <br />
                <span style={{ color: "var(--greek-gold-text)" }}>elle ne donne pas les réponses.</span>
              </h2>
              <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
                Calia est le tuteur IA d&apos;Educalcul. Elle suit la méthode socratique : plutôt que de corriger à la place de
                l&apos;élève, elle lui pose la question qui débloque. L&apos;élève arrive lui-même à la solution, et c&apos;est ce qui
                ancre vraiment la compréhension.
              </p>
              <p className="text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Elle s&apos;adapte au niveau de chaque élève, du CP à la Terminale, et reste disponible le soir comme le week-end,
                quand personne d&apos;autre ne l&apos;est.
              </p>
            </FadeInSection>

            <FadeInSection delayMs={120} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
              {[
                { t: "Pendant les exercices", d: "Une bulle d'aide : l'élève explique où il bloque, Calia l'aide à avancer." },
                { t: "En mode classe", d: "Une séance vocale au tableau, avec un résumé à la fin." },
                { t: "Pour les devoirs", d: "L'élève photographie son exercice, Calia l'aide à le résoudre lui-même." },
                { t: "Pour les parents", d: "Une analyse de la progression, depuis l'espace parent." },
              ].map((f) => (
                <div key={f.t} className="rounded-2xl p-5 text-left" style={{ background: "#fff", border: "1px solid var(--greek-border)" }}>
                  <p className="font-bold text-sm mb-1" style={{ color: "var(--greek-blue)" }}>{f.t}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.d}</p>
                </div>
              ))}
            </FadeInSection>

            <div className="flex justify-center mt-10">
              <GlassButton href="/calia-tuteur-ia-maths" variant="navy">
                Tout savoir sur Calia <ArrowRight className="w-4 h-4" />
              </GlassButton>
            </div>
          </div>
        </section>

        {/* ── 3 PILIERS ── */}
        <section className="py-24" style={{ background: "var(--greek-cream)" }}>
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-16">
              <h2
                className="font-[family-name:var(--font-display)] font-bold text-4xl mb-4"
                style={{ color: "var(--greek-blue)" }}
              >
                Une plateforme complète
              </h2>
              <p
                className="text-sm max-w-lg mx-auto"
                style={{ color: "rgba(15,30,58,0.68)" }}
              >
                Chaque fonctionnalité est pensée pour un objectif précis :
                apprendre mieux, progresser durablement, en toute confiance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PILLARS.map((p, i) => (
                <FadeInSection
                  key={i}
                  delayMs={i * 100}
                  className="rounded-2xl p-7 flex flex-col gap-5"
                  style={{
                    background: "#fff",
                    border: "1px solid var(--greek-border)",
                    boxShadow: "0 2px 16px rgba(15,30,58,0.05)",
                  }}
                >
                  <div>
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                      style={{
                        background: "rgba(197,161,72,0.1)",
                        border: "1px solid rgba(197,161,72,0.18)",
                      }}
                    >
                      <p.icon
                        className="w-6 h-6"
                        style={{ color: "var(--greek-gold)" }}
                      />
                    </div>
                    <h3
                      className="font-[family-name:var(--font-display)] font-bold text-xl mb-1"
                      style={{ color: "var(--greek-blue)" }}
                    >
                      {p.title}
                    </h3>
                    <p
                      className="text-xs font-semibold mb-4"
                      style={{ color: "var(--greek-gold-text)" }}
                    >
                      {p.subtitle}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {p.items.map((item, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2.5 text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span
                          className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(197,161,72,0.1)" }}
                        >
                          <Check
                            className="w-2.5 h-2.5"
                            style={{ color: "var(--greek-gold)" }}
                          />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </FadeInSection>
              ))}
            </div>

            {/* Multi-enfants highlight */}
            <FadeInSection
              className="mt-6 flex flex-col sm:flex-row items-center gap-5 p-6 rounded-2xl"
              style={{
                background: "var(--greek-blue)",
                border: "1px solid rgba(197,161,72,0.12)",
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(197,161,72,0.12)",
                  border: "1px solid rgba(197,161,72,0.2)",
                }}
              >
                <Users
                  className="w-6 h-6"
                  style={{ color: "var(--greek-gold)" }}
                />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-[family-name:var(--font-display)] font-bold text-white text-sm">
                  Plusieurs enfants, un seul abonnement
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  Gérez jusqu&apos;à 5 profils enfants depuis un espace parent
                  unique. Chacun à son rythme, son niveau, ses statistiques.
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <BarChart3
                  className="w-4 h-4"
                  style={{ color: "var(--greek-gold)" }}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: "var(--greek-gold)" }}
                >
                  Suivi individuel
                </span>
              </div>
            </FadeInSection>
          </div>
        </section>

        {/* ── GARANTIES (les avis sont sur la page À propos) ── */}
        <section className="py-24" style={{ background: "var(--greek-cream)" }}>
          <div className="container mx-auto px-6 max-w-5xl">
            {/* Garanties */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: ShieldCheck, text: "Essai 7 jours, sans carte bancaire" },
                { icon: Check, text: "Sans engagement, résiliable à tout moment" },
                { icon: BookOpen, text: "Contenu aligné sur le programme officiel" },
              ].map((g, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{ background: "#fff", border: "1px solid var(--greek-border)" }}
                >
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(197,161,72,0.1)", color: "var(--greek-gold)" }}
                  >
                    <g.icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--greek-blue)" }}>
                    {g.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section
          className="py-24 text-center"
          style={{ background: "var(--greek-blue)" }}
        >
          <div className="container mx-auto px-6 max-w-2xl">
            <h2
              className="font-[family-name:var(--font-display)] font-bold leading-tight mb-4 text-white"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)" }}
            >
              Prêt à commencer ?
            </h2>
            <p
              className="text-sm mb-8"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              7 jours d&apos;essai gratuit, sans engagement, sans carte
              bancaire.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <GlassButton
                href="/auth/inscription"
                variant="gold"
                className="font-[family-name:var(--font-display)] font-bold text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  Commencer gratuitement <ArrowRight className="w-4 h-4" />
                </span>
              </GlassButton>
              <GlassButton
                href="/tarifs"
                variant="light"
                className="font-[family-name:var(--font-display)] font-semibold text-sm"
              >
                Comparer les formules
              </GlassButton>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

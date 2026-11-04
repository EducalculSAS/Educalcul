import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Code2, Heart, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlassButton from "@/components/ui/GlassButton";
import PublicHero from "@/components/seo/PublicHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import FadeInSection from "@/components/home/FadeInSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import { fetchReviewsForHomepage } from "@/lib/manualReviews";
import { fetchReviewRatingOverride } from "@/lib/reviewRatingOverride";

const BASE = "https://educalcul.com";
const TITLE = "À propos d'Educalcul : qui sommes-nous ?";
const DESCRIPTION = "Educalcul est né de deux étudiants passionnés de mathématiques, Ruben et Alexandre, qui veulent rendre les maths accessibles à chaque élève, du CP à la Terminale.";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Educalcul` },
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/a-propos` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BASE}/a-propos` },
};

const CARD = "bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]";

const TEAM = [
  {
    name: "Ruben Combe-Tamain",
    role: "Co-fondateur · conception et développement de la plateforme",
    school: "Étudiant en école d'ingénieurs",
    icon: Code2,
    text: "Ruben a conçu et développé Educalcul : le site, l'espace élève, l'espace parent et Calia. Il veut un outil aussi agréable qu'efficace, qui donne envie de revenir faire des maths.",
  },
  {
    name: "Alexandre Tamain-Glose",
    role: "Co-fondateur · contenus et pédagogie",
    school: "Étudiant en école de commerce",
    icon: BookOpen,
    text: "Alexandre pilote l'ensemble des contenus : cours, exercices et quiz, niveau par niveau, en suivant les programmes officiels. Il veille à ce que chaque notion soit expliquée clairement.",
  },
];

export default async function AProposPage() {
  const [reviews, ratingOverride] = await Promise.all([fetchReviewsForHomepage(), fetchReviewRatingOverride()]);
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-cream)" }}>
      <Navbar />
      <main className="flex flex-col flex-1">
        <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "À propos", href: "/a-propos" }]} />
        <PublicHero
          eyebrow="À propos"
          title="Deux étudiants passionnés de maths"
          intro="Educalcul est né d'une conviction simple : chaque élève peut réussir en mathématiques s'il a la bonne méthode et quelqu'un pour le guider au bon moment."
        />

        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <Heart className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Notre histoire</h2>
            </div>
            <div className="text-sm text-gray-600 leading-relaxed space-y-3 mt-4">
              <p>
                Nous sommes deux étudiants, passionnés de mathématiques depuis toujours. Nous avons vu autour de nous des élèves
                bloqués non pas par manque de capacités, mais faute d&apos;explications adaptées ou d&apos;aide au moment où ils en avaient besoin.
              </p>
              <p>
                Nous avons donc créé Educalcul : des cours clairs, des exercices corrigés, des quiz, un suivi pour les parents, et Calia,
                un tuteur IA qui guide l&apos;élève sans lui donner la réponse. Le tout du CP à la Terminale, en suivant les programmes officiels.
              </p>
              <p>
                Educalcul est un projet jeune, que nous construisons avec les retours des familles qui l&apos;utilisent.
                Une idée, une remarque ? <Link href="/contact" className="font-semibold text-[var(--greek-gold-text)] hover:underline">Écrivez-nous</Link>.
              </p>
            </div>
          </section>

          <section aria-label="L'équipe" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TEAM.map((m) => (
              <div key={m.name} className={CARD}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[var(--greek-blue)]">
                    <m.icon className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-[var(--greek-blue)]">{m.name}</h2>
                    <p className="text-xs font-semibold text-[var(--greek-gold-text)]">{m.school}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-2">{m.role}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{m.text}</p>
              </div>
            ))}
          </section>

          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <Star className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Ils nous font confiance</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">Ce que les familles disent d&apos;Educalcul.</p>
            <FadeInSection>
              <TestimonialsSection reviews={reviews} ratingOverride={ratingOverride} />
            </FadeInSection>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <GlassButton href="/methode-pedagogique" variant="outline">Notre méthode pédagogique</GlassButton>
            <GlassButton href="/auth/inscription" variant="navy">Essayer gratuitement 7 jours <ArrowRight className="w-4 h-4" /></GlassButton>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

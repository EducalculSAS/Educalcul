import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Code2, GraduationCap, Mail, Sparkles, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlassButton from "@/components/ui/GlassButton";
import { FeatureCard, HeroRows, PublicCta, PublicHero, PublicPage, PublicSection } from "@/components/public/PublicPage";
import QuickFacts from "@/components/seo/QuickFacts";
import JsonLd from "@/components/JsonLd";
import { CONTACT_EMAIL, FOUNDERS, ORG_ID, ORG_REF, SEO_UPDATED, SITE_URL } from "@/lib/seo/site";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import FadeInSection from "@/components/home/FadeInSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import { fetchReviewsForHomepage } from "@/lib/manualReviews";
import { fetchReviewRatingOverride } from "@/lib/reviewRatingOverride";
import { socialMeta } from "@/lib/seo/meta";

const BASE = "https://educalcul.com";
const TITLE = "À propos d'Educalcul : qui sommes-nous ?";
const DESCRIPTION = "Educalcul est né de deux étudiants passionnés de mathématiques, Ruben et Alexandre, qui veulent rendre les maths accessibles à chaque élève, du CP à la Terminale.";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Educalcul` },
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/a-propos` },
  ...socialMeta({ title: TITLE, description: DESCRIPTION, path: "/a-propos" }),
};

const TEAM = [
  {
    name: "Ruben Combe-Tamain",
    role: "Co-fondateur · conception et développement de la plateforme",
    school: "Étudiant en école d'ingénieurs",
    icon: Code2,
    text: "Ruben a conçu et développé Educalcul : le site, l'espace élève, l'espace parent et Calia. Il veut un outil aussi agréable qu'efficace, qui donne envie de revenir faire des maths.",
  },
  {
    name: "Alexandre Tamain-Gloz",
    role: "Co-fondateur · contenus et pédagogie",
    school: "Étudiant en école de commerce",
    icon: BookOpen,
    text: "Alexandre pilote l'ensemble des contenus : cours, exercices et quiz, niveau par niveau, en suivant les programmes officiels. Il veille à ce que chaque notion soit expliquée clairement.",
  },
];

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: TITLE,
  description: DESCRIPTION,
  url: `${BASE}/a-propos`,
  inLanguage: "fr-FR",
  dateModified: SEO_UPDATED,
  about: ORG_REF,
  mainEntity: {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Educalcul",
    url: SITE_URL,
    email: CONTACT_EMAIL,
    description: "Plateforme française d'apprentissage des mathématiques du CP à la Terminale : cours, exercices corrigés, quiz, tuteur IA Calia et suivi pour les parents.",
    founder: FOUNDERS.map((f) => ({ "@type": "Person", name: f.name, jobTitle: f.jobTitle })),
  },
};

export default async function AProposPage() {
  const [reviews, ratingOverride] = await Promise.all([fetchReviewsForHomepage(), fetchReviewRatingOverride()]);
  return (
    <PublicPage>
      <Navbar />
      <main className="flex-grow pt-[64px]">
        <JsonLd data={aboutSchema} />
        <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "À propos", href: "/a-propos" }]} />
        <PublicHero
          eyebrow="À propos"
          title="Deux étudiants"
          highlight="passionnés de maths"
          intro="Educalcul est né d'une conviction simple : chaque élève peut réussir en mathématiques s'il a la bonne méthode et quelqu'un pour le guider au bon moment."
          actions={
            <>
              <GlassButton href="/auth/inscription" variant="gold" className="font-[family-name:var(--font-display)] font-bold text-sm">
                <span className="inline-flex items-center gap-2">Commencer gratuitement <ArrowRight className="w-4 h-4" /></span>
              </GlassButton>
              <GlassButton href="/methode-pedagogique" variant="light" className="font-[family-name:var(--font-display)] font-semibold text-sm">Notre méthode</GlassButton>
            </>
          }
          aside={
            <HeroRows rows={[
              { icon: <Users className="w-4 h-4" />, text: `Fondé par ${FOUNDERS.map((f) => f.name).join(" et ")}` },
              { icon: <GraduationCap className="w-4 h-4" />, text: "Du CP à la Terminale, d'après les programmes officiels" },
              { icon: <Sparkles className="w-4 h-4" />, text: "Calia, un tuteur IA qui guide sans donner la réponse" },
              { icon: <Mail className="w-4 h-4" />, text: CONTACT_EMAIL },
            ]} />
          }
        />

        <PublicSection tight>
          <QuickFacts
            title="Educalcul en bref"
            facts={[
              { label: "Qu'est-ce qu'Educalcul ?", value: "Une plateforme française pour apprendre, comprendre, s'entraîner et progresser en mathématiques, du CP à la Terminale." },
              { label: "Pour qui ?", value: "Les élèves du primaire, du collège et du lycée, et leurs parents, qui suivent la progression depuis un espace dédié." },
              { label: "Ce qu'on y trouve", value: "Des cours, des exercices corrigés, des quiz, Calia (un tuteur IA qui guide sans donner la réponse) et un suivi pour les parents." },
              { label: "Programmes", value: "Ceux de l'Éducation nationale, niveau par niveau." },
              { label: "Fondateurs", value: FOUNDERS.map((f) => f.name).join(" et ") },
              { label: "Essai", value: "7 jours gratuits, sans engagement." },
              { label: "Contact", value: <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[var(--greek-gold-text)] hover:underline">{CONTACT_EMAIL}</a> },
            ]}
          />
        </PublicSection>

        <PublicSection eyebrow="Notre histoire" title="Des explications adaptées," highlight="au bon moment.">
          <FadeInSection className="max-w-2xl mx-auto text-center space-y-4 text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
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
              Une idée, une remarque ? <Link href="/contact" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>Écrivez-nous</Link>.
            </p>
          </FadeInSection>
        </PublicSection>

        <PublicSection eyebrow="L'équipe" title="Qui sommes-nous ?">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TEAM.map((m, i) => (
              <FeatureCard key={m.name} icon={<m.icon className="w-6 h-6" />} title={m.name} subtitle={`${m.role} · ${m.school}`} delayMs={i * 100}>{m.text}</FeatureCard>
            ))}
          </div>
        </PublicSection>

        <PublicSection eyebrow="Avis" title="Ils nous font confiance" intro="Ce que les familles disent d'Educalcul.">
          <FadeInSection>
            <TestimonialsSection reviews={reviews} ratingOverride={ratingOverride} />
          </FadeInSection>
        </PublicSection>

        <PublicCta secondary={{ href: "/offres", label: "Découvrir nos offres" }} />
      </main>
      <Footer />
    </PublicPage>
  );
}

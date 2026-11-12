import Emblem3D from "@/components/Emblem3D";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Repeat, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlassButton from "@/components/ui/GlassButton";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import QuickFacts from "@/components/seo/QuickFacts";
import JsonLd from "@/components/JsonLd";
import FadeInSection from "@/components/home/FadeInSection";
import { FeatureCard, HeroRows, PUBLIC_CARD, PublicCta, PublicHero, PublicPage, PublicSection } from "@/components/public/PublicPage";
import { ORG_REF, SEO_UPDATED } from "@/lib/seo/site";
import { socialMeta } from "@/lib/seo/meta";

const BASE = "https://educalcul.com";
const TITLE = "Méthode pédagogique Educalcul : comprendre plutôt que recopier";
const DESCRIPTION = "Comment Educalcul fait progresser en maths : cours courts, entraînement progressif, correction expliquée, révisions espacées et une IA, Calia, qui guide par questions sans donner la réponse.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/methode-pedagogique` },
  ...socialMeta({ title: TITLE, description: DESCRIPTION, path: "/methode-pedagogique" }),
};

const STEPS = [
  { icon: BookOpen, title: "Comprendre", subtitle: "Étape 1", text: "Un cours court et clair par notion : une définition, des exemples, les pièges à éviter. Pas de pavé à lire, l'essentiel." },
  { icon: Target, title: "S'entraîner", subtitle: "Étape 2", text: "Des exercices du plus simple au plus exigeant. Chaque réponse est corrigée tout de suite, avec l'explication de l'erreur." },
  { icon: Repeat, title: "Retenir", subtitle: "Étape 3", text: "Des quiz courts et des révisions : une notion ratée revient plus tard, jusqu'à ce qu'elle soit acquise." },
  { icon: Compass, title: "Se situer", subtitle: "Étape 4", text: "Une checklist « je sais faire » à la fin des cours, des objectifs du jour et une progression visible." },
];

const PRINCIPLES = [
  { title: "Le programme officiel, rien que le programme", text: "Chaque contenu est rattaché à un niveau et à une notion des programmes de l'Éducation nationale. L'élève travaille ce qu'on attend de lui en classe." },
  { title: "L'erreur fait partie de l'apprentissage", text: "Une erreur n'est pas une sanction : c'est une information. La correction explique pourquoi la réponse ne marche pas et comment s'y prendre." },
  { title: "La régularité plutôt que la quantité", text: "Dix à vingt minutes par jour valent mieux qu'une longue séance la veille du contrôle. Les séries et les objectifs du jour encouragent ce rythme." },
  { title: "La motivation compte", text: "Badges, contours, titres et mini-jeux : la progression se voit et se fête, sans détourner des maths." },
];

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  description: DESCRIPTION,
  url: `${BASE}/methode-pedagogique`,
  mainEntityOfPage: `${BASE}/methode-pedagogique`,
  inLanguage: "fr-FR",
  datePublished: "2026-11-04",
  dateModified: SEO_UPDATED,
  author: ORG_REF,
  publisher: ORG_REF,
};

export default function MethodePage() {
  return (
    <PublicPage>
      <Navbar />
      <main className="flex-grow pt-[64px]">
        <JsonLd data={articleSchema} />
        <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "Méthode pédagogique", href: "/methode-pedagogique" }]} />
        <PublicHero
          eyebrow="Méthode pédagogique"
          title="Comprendre"
          highlight="plutôt que recopier"
          intro="Un élève progresse quand il trouve lui-même, avec la bonne aide au bon moment. Tout Educalcul est construit autour de cette idée."
          actions={
            <>
              <GlassButton href="/auth/inscription" variant="gold" className="font-[family-name:var(--font-display)] font-bold text-sm">
                <span className="inline-flex items-center gap-2">Commencer gratuitement <ArrowRight className="w-4 h-4" /></span>
              </GlassButton>
              <GlassButton href="/programmes" variant="light" className="font-[family-name:var(--font-display)] font-semibold text-sm">Voir les programmes</GlassButton>
            </>
          }
          aside={<HeroRows rows={STEPS.map((s, i) => ({ icon: <s.icon className="w-4 h-4" />, text: <><strong className="font-semibold text-white/85">{i + 1}. {s.title}</strong> · {s.text.split(".")[0]}</> }))} />}
        />

        <PublicSection tight>
          <QuickFacts
            facts={[
              { label: "L'idée", value: "Un élève progresse quand il trouve lui-même, avec la bonne aide au bon moment." },
              { label: "Le parcours", value: "Comprendre (cours courts), s'entraîner (exercices corrigés), retenir (quiz et révisions), se situer (objectifs et checklist)." },
              { label: "Le rôle de l'IA", value: "Calia pose des questions et donne des indices adaptés à l'erreur ; elle ne donne pas la réponse et ne fait pas le devoir à la place de l'élève." },
              { label: "Les programmes", value: "Chaque contenu est rattaché à un niveau et à une notion des programmes de l'Éducation nationale." },
              { label: "Le suivi", value: "Les parents voient l'activité, les scores et les notions à retravailler." },
            ]}
          />
        </PublicSection>

        <PublicSection eyebrow="Le parcours" title="Quatre temps" highlight="pour chaque notion." intro="Du CP à la Terminale, la même méthode, adaptée au niveau de chaque élève.">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <FeatureCard key={s.title} icon={<s.icon className="w-6 h-6" />} title={s.title} subtitle={s.subtitle} delayMs={i * 80}>{s.text}</FeatureCard>
            ))}
          </div>
        </PublicSection>

        <PublicSection eyebrow="L'IA au service de la méthode" title="Une aide disponible," highlight="jamais une réponse toute faite.">
          <FadeInSection className="max-w-2xl mx-auto text-center space-y-4 text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
            <p>
              L&apos;intelligence artificielle change la façon d&apos;apprendre : nous l&apos;utilisons pour ce qu&apos;elle fait de mieux,
              être disponible et patiente, à tout moment, pour chaque élève.
            </p>
            <p>
              Mais une IA qui donne les réponses n&apos;apprend rien à personne. Calia, notre tuteur IA, suit la méthode socratique :
              elle pose la question qui débloque, propose un indice adapté à l&apos;erreur, réexplique autrement si besoin, et laisse
              l&apos;élève trouver. Elle ne fait jamais un devoir à sa place.
            </p>
            <div className="flex justify-center pt-4">
              <GlassButton href="/calia-tuteur-ia-maths" variant="navy">Découvrir Calia <ArrowRight className="w-4 h-4" /></GlassButton>
            </div>
          </FadeInSection>
        </PublicSection>

        <PublicSection eyebrow="Nos principes" title="Ce qui guide" highlight="chaque contenu.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRINCIPLES.map((p, i) => (
              <FadeInSection key={p.title} delayMs={i * 80} className={PUBLIC_CARD}>
                <h3 className="font-[family-name:var(--font-display)] font-bold text-lg mb-2" style={{ color: "var(--greek-blue)" }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{p.text}</p>
              </FadeInSection>
            ))}
          </div>

          {/* Les parents : même bandeau que « Plusieurs enfants, un seul abonnement » sur Offres. */}
          <FadeInSection className="mt-6 flex flex-col sm:flex-row items-center gap-5 p-6 rounded-2xl" style={{ background: "var(--greek-blue)", border: "1px solid rgba(197,161,72,0.12)" }}>
            <Emblem3D kind="family" size={56} float={false} onDark className="flex-shrink-0" />
            <div className="flex-1 text-center sm:text-left">
              <p className="font-[family-name:var(--font-display)] font-bold text-white text-sm">Les parents, partenaires de la méthode</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                Le parent voit l&apos;activité, les scores et les notions à retravailler, règle des objectifs et des heures de repos, et
                peut imprimer un bulletin, sans avoir à refaire le cours. <Link href="/tarifs" className="font-semibold hover:underline" style={{ color: "var(--greek-gold)" }}>Voir les formules</Link>
              </p>
            </div>
          </FadeInSection>
        </PublicSection>

        <PublicCta secondary={{ href: "/programmes", label: "Voir les programmes" }} />
      </main>
      <Footer />
    </PublicPage>
  );
}

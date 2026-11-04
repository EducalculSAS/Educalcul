import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Brain, Compass, MessageCircle, Repeat, Sparkles, Target, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlassButton from "@/components/ui/GlassButton";
import PublicHero from "@/components/seo/PublicHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";

const BASE = "https://educalcul.com";
const TITLE = "Méthode pédagogique Educalcul : comprendre plutôt que recopier";
const DESCRIPTION = "Comment Educalcul fait progresser en maths : cours courts, entraînement progressif, correction expliquée, révisions espacées et une IA, Calia, qui guide par questions sans donner la réponse.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/methode-pedagogique` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${BASE}/methode-pedagogique` },
};

const CARD = "bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]";

const STEPS = [
  { icon: BookOpen, title: "1. Comprendre", text: "Un cours court et clair par notion : une définition, des exemples, les pièges à éviter. Pas de pavé à lire, l'essentiel." },
  { icon: Target, title: "2. S'entraîner", text: "Des exercices du plus simple au plus exigeant. Chaque réponse est corrigée tout de suite, avec l'explication de l'erreur." },
  { icon: Repeat, title: "3. Retenir", text: "Des quiz courts et des révisions : une notion ratée revient plus tard, jusqu'à ce qu'elle soit acquise." },
  { icon: Compass, title: "4. Se situer", text: "Une checklist « je sais faire » à la fin des cours, des objectifs du jour et une progression visible." },
];

const PRINCIPLES = [
  { title: "Le programme officiel, rien que le programme", text: "Chaque contenu est rattaché à un niveau et à une notion des programmes de l'Éducation nationale. L'élève travaille ce qu'on attend de lui en classe." },
  { title: "L'erreur fait partie de l'apprentissage", text: "Une erreur n'est pas une sanction : c'est une information. La correction explique pourquoi la réponse ne marche pas et comment s'y prendre." },
  { title: "La régularité plutôt que la quantité", text: "Dix à vingt minutes par jour valent mieux qu'une longue séance la veille du contrôle. Les séries et les objectifs du jour encouragent ce rythme." },
  { title: "La motivation compte", text: "Badges, contours, titres et mini-jeux : la progression se voit et se fête, sans détourner des maths." },
];

export default function MethodePage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-cream)" }}>
      <Navbar />
      <main className="flex flex-col flex-1">
        <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "Méthode pédagogique", href: "/methode-pedagogique" }]} />
        <PublicHero
          back={{ href: "/", label: "Retour à l'accueil" }}
          eyebrow="Méthode pédagogique"
          title="Comprendre plutôt que recopier"
          intro="Notre méthode tient en une idée : un élève progresse quand il trouve lui-même, avec la bonne aide au bon moment. Tout Educalcul est construit autour de ça."
        />

        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <Brain className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Un parcours en quatre temps</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">Pour chaque notion, du CP à la Terminale.</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STEPS.map((s) => (
                <li key={s.title} className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-5">
                  <s.icon className="w-5 h-5 text-[var(--greek-gold)] mb-2" aria-hidden="true" />
                  <h3 className="font-bold text-[var(--greek-blue)] mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <Sparkles className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">L&apos;IA, au service de la méthode</h2>
            </div>
            <div className="text-sm text-gray-600 leading-relaxed space-y-3 mt-4">
              <p>
                L&apos;intelligence artificielle change la façon d&apos;apprendre : c&apos;est une nouvelle ère, et nous avons choisi de l&apos;utiliser
                pour ce qu&apos;elle fait de mieux, être disponible et patiente, à tout moment, pour chaque élève.
              </p>
              <p>
                Mais une IA qui donne les réponses n&apos;apprend rien à personne. Calia, notre tuteur IA, suit la méthode socratique :
                elle pose la question qui débloque, propose un indice adapté à l&apos;erreur, réexplique autrement si besoin, et laisse
                l&apos;élève trouver. Elle ne fait jamais un devoir à sa place.
              </p>
              <p>
                <Link href="/calia-tuteur-ia-maths" className="font-semibold text-[var(--greek-gold-text)] hover:underline inline-flex items-center gap-1">
                  Tout savoir sur Calia <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </p>
            </div>
          </section>

          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <MessageCircle className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Nos principes</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="rounded-2xl border border-[rgba(197,161,72,0.25)] p-5">
                  <h3 className="font-bold text-[var(--greek-blue)] mb-1">{p.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{p.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <Users className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Les parents, partenaires de la méthode</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mt-4">
              Le parent voit l&apos;activité, les scores et les notions à retravailler, règle des objectifs et des heures de repos,
              et peut imprimer un bulletin. Il sait où en est son enfant sans avoir à refaire le cours.
            </p>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <GlassButton href="/programmes" variant="outline">Voir les programmes</GlassButton>
            <GlassButton href="/auth/inscription" variant="navy">Essayer gratuitement 7 jours <ArrowRight className="w-4 h-4" /></GlassButton>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

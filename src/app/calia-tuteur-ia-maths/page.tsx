import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, GraduationCap, HelpCircle, MessageCircle, ShieldCheck, Sparkles, Users, XCircle, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlassButton from "@/components/ui/GlassButton";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import PublicHero from "@/components/seo/PublicHero";
import SeoFaq from "@/components/seo/SeoFaq";
import CaliaChatDemo from "@/components/offres/CaliaChatDemo";
import QuickFacts from "@/components/seo/QuickFacts";
import { socialMeta } from "@/lib/seo/meta";

const BASE = "https://educalcul.com";
const TITLE = "Calia : tuteur IA pour apprendre les mathématiques";
const DESCRIPTION = "Calia, le tuteur IA d'Educalcul, aide l'élève en maths du CP à la Terminale par questions et indices, sans donner la réponse : aide pendant les exercices, classe vocale, aide aux devoirs par photo.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/calia-tuteur-ia-maths` },
  ...socialMeta({ title: TITLE, description: DESCRIPTION, path: "/calia-tuteur-ia-maths" }),
};

const CARD = "bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]";

const FEATURES = [
  { icon: MessageCircle, title: "Une aide pendant les cours et exercices", text: "Une bulle d'aide reste à portée de main : l'élève explique où il bloque, Calia l'aide à avancer." },
  { icon: GraduationCap, title: "Le mode classe", text: "Une séance vocale avec un tableau : Calia explique, l'élève répond et peut dessiner sa démarche, puis reçoit un résumé." },
  { icon: Camera, title: "L'aide aux devoirs par photo", text: "L'élève photographie son exercice ; Calia le lit et l'aide à le résoudre lui-même, étape par étape." },
  { icon: Users, title: "Un bilan pour les parents", text: "Le parent peut obtenir une analyse de la progression de son enfant depuis son espace." },
];

const DOES = [
  "Pose des questions pour faire avancer le raisonnement",
  "Donne un indice adapté à l'erreur de l'élève",
  "Réexplique une notion autrement si besoin",
  "S'adapte au niveau de l'élève, du CP à la Terminale",
];
const DOES_NOT = [
  "Donner directement la réponse d'un exercice",
  "Faire un devoir à la place de l'élève",
  "Juger ou décourager l'élève",
];

const FAQ = [
  { q: "Calia donne-t-elle les réponses ?", a: "Non. Calia suit une méthode socratique : elle pose des questions et donne des indices pour que l'élève trouve la solution lui-même. C'est ce qui permet de savoir refaire seul ensuite." },
  { q: "Pour quels niveaux Calia fonctionne-t-elle ?", a: "Pour tous les niveaux d'Educalcul, du CP à la Terminale. Elle tient compte du niveau de l'élève dans ses explications." },
  { q: "Calia remplace-t-elle un professeur ?", a: "Non. Calia est une aide pour s'entraîner et débloquer une difficulté entre deux cours ; elle complète le travail de la classe." },
  { q: "Toutes les fonctions de Calia sont-elles incluses ?", a: "Les fonctions disponibles dépendent de la formule choisie : le détail est sur la page Tarifs. L'essai gratuit de 7 jours permet de tester." },
  { q: "Les parents peuvent-ils suivre ce que fait leur enfant ?", a: "Oui, l'espace parent montre l'activité et les résultats, et peut proposer une analyse de la progression." },
];

export default function CaliaPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-cream)" }}>
      <Navbar />
      <main className="flex flex-col flex-1">
        <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "Calia", href: "/calia-tuteur-ia-maths" }]} />
        <PublicHero
          back={{ href: "/", label: "Retour à l'accueil" }}
          eyebrow="Tuteur IA de mathématiques"
          title="Calia, le tuteur IA qui fait réfléchir en maths"
          intro={<>Calia accompagne l&apos;élève du CP à la Terminale. Plutôt que de donner la réponse, elle pose les bonnes questions pour qu&apos;il comprenne et sache refaire seul.</>}
        >
          <GlassButton href="/auth/inscription" variant="gold" className="font-bold">
            Essayer gratuitement 7 jours <ArrowRight className="w-4 h-4" />
          </GlassButton>
          <GlassButton href="#essayer-calia" variant="light" className="font-semibold">Parler à Calia</GlassButton>
        </PublicHero>

        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
          <QuickFacts
            title="Calia en bref"
            facts={[
              { label: "Qu'est-ce que Calia ?", value: "Le tuteur IA d'Educalcul pour les mathématiques, du CP à la Terminale." },
              { label: "Comment aide-t-elle ?", value: "Par la méthode socratique : elle pose des questions et donne des indices pour que l'élève trouve la solution lui-même." },
              { label: "Que fait-elle ?", value: "Aide pendant les cours et exercices, séance vocale en mode classe, aide aux devoirs à partir d'une photo, et analyse de progression pour les parents." },
              { label: "Que ne fait-elle pas ?", value: "Donner directement la réponse d'un exercice ou faire un devoir à la place de l'élève." },
              { label: "Tarif", value: "Les fonctions disponibles dépendent de la formule (voir la page Tarifs). 7 jours d'essai gratuits, sans carte bancaire." },
            ]}
          />
          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <Sparkles className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Ce que Calia fait pour l&apos;élève</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">Quatre façons d&apos;être aidé, toujours avec la même règle : comprendre plutôt que recopier.</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-5">
                  <f.icon className="w-5 h-5 text-[var(--greek-gold)] mb-2" aria-hidden="true" />
                  <h3 className="font-bold text-[var(--greek-blue)] mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Une méthode socratique</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">Calia guide le raisonnement ; c&apos;est l&apos;élève qui trouve.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-green-800 mb-3">Calia…</h3>
                <ul className="space-y-2">
                  {DOES.map((d) => <li key={d} className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-700" aria-hidden="true" />{d}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-red-800 mb-3">Calia ne va pas…</h3>
                <ul className="space-y-2">
                  {DOES_NOT.map((d) => <li key={d} className="flex items-start gap-2 text-sm text-gray-700"><XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />{d}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <section id="essayer-calia" className={`${CARD} scroll-mt-24 text-center`}>
            <div className="flex items-center justify-center gap-3 mb-1">
              <MessageCircle className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Essayer Calia sans compte</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">Pose une question de maths : Calia te répond comme dans l&apos;espace élève (nombre de messages limité).</p>
            <div className="flex justify-center">
              <CaliaChatDemo />
            </div>
          </section>

          <section className={CARD}>
            <div className="flex items-center gap-3 mb-1">
              <HelpCircle className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Questions fréquentes sur Calia</h2>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Voir aussi <Link href="/programmes" className="font-semibold text-[var(--greek-gold-text)] hover:underline">les programmes par niveau</Link> et <Link href="/tarifs" className="font-semibold text-[var(--greek-gold-text)] hover:underline">les tarifs</Link>.
            </p>
            <SeoFaq items={FAQ} />
          </section>
        </div>

        <section className="py-16 px-6" style={{ background: "var(--greek-blue)" }}>
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl mb-4 text-white">Apprendre les maths avec Calia</h2>
            <p className="text-sm mb-8 text-white/60">7 jours gratuits, sans carte bancaire et sans engagement.</p>
            <GlassButton href="/auth/inscription" variant="gold">Créer un compte <ArrowRight size={16} /></GlassButton>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

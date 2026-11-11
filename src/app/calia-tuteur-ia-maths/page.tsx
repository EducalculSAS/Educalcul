import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Camera, CheckCircle, GraduationCap, MessageCircle, ShieldCheck, Users, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlassButton from "@/components/ui/GlassButton";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import SeoFaq from "@/components/seo/SeoFaq";
import CaliaChatDemo from "@/components/offres/CaliaChatDemo";
import QuickFacts from "@/components/seo/QuickFacts";
import FadeInSection from "@/components/home/FadeInSection";
import { FeatureCard, HeroRows, PUBLIC_CARD, PublicCta, PublicHero, PublicPage, PublicSection } from "@/components/public/PublicPage";
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

const FEATURES = [
  { icon: MessageCircle, title: "Pendant les exercices", subtitle: "Une bulle d'aide toujours là", text: "L'élève explique où il bloque, Calia l'aide à avancer, sans faire à sa place." },
  { icon: GraduationCap, title: "Le mode classe", subtitle: "Une séance vocale au tableau", text: "Calia explique, l'élève répond et peut dessiner sa démarche, puis reçoit un résumé." },
  { icon: Camera, title: "Les devoirs par photo", subtitle: "Son propre exercice", text: "L'élève photographie son exercice ; Calia le lit et l'aide à le résoudre lui-même, étape par étape." },
  { icon: Users, title: "Pour les parents", subtitle: "Un bilan de progression", text: "Le parent peut obtenir une analyse de la progression de son enfant depuis son espace." },
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
    <PublicPage>
      <Navbar />
      <main className="flex-grow pt-[64px]">
        <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "Calia", href: "/calia-tuteur-ia-maths" }]} />
        <PublicHero
          eyebrow="Tuteur IA de mathématiques"
          title="Calia"
          intro="Calia accompagne l'élève du CP à la Terminale. Plutôt que de donner la réponse, elle pose les bonnes questions pour qu'il comprenne et sache refaire seul."
          actions={
            <>
              <GlassButton href="/auth/inscription" variant="gold" className="font-[family-name:var(--font-display)] font-bold text-sm">
                <span className="inline-flex items-center gap-2">Essayer gratuitement <ArrowRight className="w-4 h-4" /></span>
              </GlassButton>
              <GlassButton href="#essayer-calia" variant="light" className="font-[family-name:var(--font-display)] font-semibold text-sm">Parler à Calia</GlassButton>
            </>
          }
          aside={
            <HeroRows rows={[
              { icon: <Image src="/logoAI.png" alt="" width={16} height={16} className="w-4 h-4 object-contain" />, text: "Méthode socratique : des questions, pas des réponses" },
              { icon: <MessageCircle className="w-4 h-4" />, text: "Aide pendant les cours et les exercices" },
              { icon: <GraduationCap className="w-4 h-4" />, text: "Mode classe vocal, au tableau" },
              { icon: <Camera className="w-4 h-4" />, text: "Aide aux devoirs à partir d'une photo" },
              { icon: <Users className="w-4 h-4" />, text: "Bilan de progression pour les parents" },
            ]} />
          }
        />

        <PublicSection tight>
          <QuickFacts
            title="Calia en bref"
            facts={[
              { label: "Qu'est-ce que Calia ?", value: "Le tuteur IA d'Educalcul pour les mathématiques, du CP à la Terminale." },
              { label: "Comment aide-t-elle ?", value: "Par la méthode socratique : elle pose des questions et donne des indices pour que l'élève trouve la solution lui-même." },
              { label: "Que fait-elle ?", value: "Aide pendant les cours et exercices, séance vocale en mode classe, aide aux devoirs à partir d'une photo, et analyse de progression pour les parents." },
              { label: "Que ne fait-elle pas ?", value: "Donner directement la réponse d'un exercice ou faire un devoir à la place de l'élève." },
              { label: "Tarif", value: "Les fonctions disponibles dépendent de la formule (voir la page Tarifs). 7 jours d'essai gratuits, sans engagement." },
            ]}
          />
        </PublicSection>

        <PublicSection eyebrow="Ce que fait Calia" title="Quatre façons d'être aidé," highlight="une seule règle." intro="Comprendre plutôt que recopier : c'est l'élève qui trouve, Calia l'y amène.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} icon={<f.icon className="w-6 h-6" />} title={f.title} subtitle={f.subtitle} delayMs={i * 80}>{f.text}</FeatureCard>
            ))}
          </div>
        </PublicSection>

        <PublicSection eyebrow="Méthode socratique" title="Calia guide," highlight="l'élève trouve.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FadeInSection className={PUBLIC_CARD}>
              <h3 className="font-[family-name:var(--font-display)] font-bold text-xl mb-4 flex items-center gap-2" style={{ color: "var(--greek-blue)" }}>
                <ShieldCheck className="w-5 h-5 text-green-700" aria-hidden="true" /> Calia…
              </h3>
              <ul className="space-y-2.5">
                {DOES.map((d) => <li key={d} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}><CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-700" aria-hidden="true" />{d}</li>)}
              </ul>
            </FadeInSection>
            <FadeInSection delayMs={100} className={PUBLIC_CARD}>
              <h3 className="font-[family-name:var(--font-display)] font-bold text-xl mb-4 flex items-center gap-2" style={{ color: "var(--greek-blue)" }}>
                <XCircle className="w-5 h-5 text-red-600" aria-hidden="true" /> Calia ne va pas…
              </h3>
              <ul className="space-y-2.5">
                {DOES_NOT.map((d) => <li key={d} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}><XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />{d}</li>)}
              </ul>
            </FadeInSection>
          </div>
        </PublicSection>

        <PublicSection id="essayer-calia" eyebrow="Essayez sans compte" title="Pose une question" highlight="à Calia." intro="Elle te répond comme dans l'espace élève (nombre de messages limité).">
          <div className="flex justify-center"><CaliaChatDemo /></div>
        </PublicSection>

        <PublicSection eyebrow="Questions fréquentes" title="Tout savoir sur Calia">
          <div className="max-w-3xl mx-auto">
            <SeoFaq items={FAQ} />
            <p className="text-sm text-center mt-6" style={{ color: "var(--text-muted)" }}>
              Voir aussi <Link href="/programmes" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>les programmes par niveau</Link> et <Link href="/tarifs" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>les tarifs</Link>.
            </p>
          </div>
        </PublicSection>

        <PublicCta title="Apprendre les maths avec Calia" secondary={{ href: "/tarifs", label: "Comparer les formules" }} />
      </main>
      <Footer />
    </PublicPage>
  );
}

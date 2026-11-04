import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Brain, CheckCircle, ExternalLink, GraduationCap, HelpCircle, PenLine, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlassButton from "@/components/ui/GlassButton";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import PublicHero from "@/components/seo/PublicHero";
import SeoFaq from "@/components/seo/SeoFaq";
import MiniExercise from "@/components/seo/MiniExercise";
import JsonLd from "@/components/JsonLd";
import HowWeHelp from "@/components/seo/HowWeHelp";
import QuickFacts from "@/components/seo/QuickFacts";
import { ORG_ID, SEO_UPDATED } from "@/lib/seo/site";
import { LEVEL_BY_SLUG, LEVEL_PAGES, CYCLE_LABEL, chapterCount, neighbours } from "@/lib/seo/levels";
import { PDF_LINKS } from "@/lib/programmePdfLinks";

const BASE = "https://educalcul.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return LEVEL_PAGES.map((l) => ({ niveau: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ niveau: string }> }): Promise<Metadata> {
  const { niveau } = await params;
  const level = LEVEL_BY_SLUG[niveau];
  if (!level) return {};
  const url = `${BASE}/programmes/${level.slug}`;
  return {
    title: { absolute: level.title },
    description: level.description,
    alternates: { canonical: url },
    openGraph: { title: level.title, description: level.description, url, type: "article" },
  };
}

const CARD = "bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]";

function SectionTitle({ icon: Icon, children }: { icon: typeof BookOpen; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <Icon className="w-5 h-5 text-[var(--greek-gold)]" aria-hidden="true" />
      <h2 className="text-xl font-bold text-[var(--greek-blue)]">{children}</h2>
    </div>
  );
}


export default async function LevelProgrammePage({ params }: { params: Promise<{ niveau: string }> }) {
  const { niveau } = await params;
  const level = LEVEL_BY_SLUG[niveau];
  if (!level) notFound();
  const { prev, next } = neighbours(level.slug);
  const pdfs = PDF_LINKS[level.appLevel] ?? [];
  const url = `${BASE}/programmes/${level.slug}`;
  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: level.h1,
    description: level.description,
    url,
    inLanguage: "fr-FR",
    isPartOf: { "@type": "WebSite", name: "Educalcul", url: BASE },
    about: { "@type": "Thing", name: `Mathématiques ${level.name}` },
    educationalLevel: level.name,
    dateModified: SEO_UPDATED,
  };
  // Cours (schema.org/Course) : décrit ce qui est visible sur la page, sans prix ni avis inventés.
  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `Mathématiques en ${level.name}`,
    description: level.description,
    url,
    inLanguage: "fr-FR",
    educationalLevel: level.name,
    about: level.domains.map((d) => d.name),
    teaches: level.skills,
    provider: { "@id": ORG_ID },
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-cream)" }}>
      <JsonLd data={pageSchema} />
      <JsonLd data={courseSchema} />
      <Navbar />
      <main className="flex flex-col flex-1">
        {/* En-tête */}
        <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "Programmes", href: "/programmes" }, { name: level.name, href: `/programmes/${level.slug}` }]} />
        <PublicHero
          back={{ href: "/programmes", label: "Tous les programmes" }}
          eyebrow={<>{CYCLE_LABEL[level.cycle]} · {level.cycleLabel}</>}
          title={level.h1}
          intro={level.intro}
        >
          <GlassButton href="/auth/inscription" variant="gold" className="font-bold">
            Essayer gratuitement 7 jours <ArrowRight className="w-4 h-4" />
          </GlassButton>
          <GlassButton href="#exercice" variant="light" className="font-semibold">
            Faire un exercice de {level.short}
          </GlassButton>
        </PublicHero>

        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
          <QuickFacts
            title={`Maths en ${level.short} en bref`}
            facts={[
              { label: "Niveau", value: `${level.name} (${CYCLE_LABEL[level.cycle].toLowerCase()}, ${level.cycleLabel.toLowerCase()})` },
              { label: "Au programme", value: `${chapterCount(level)} notions en ${level.domains.length} domaines : ${level.domains.map((d) => d.name.toLowerCase()).join(", ")}.` },
              { label: "Texte de référence", value: "Programme de l'Éducation nationale publié sur Éduscol." },
              { label: "Sur Educalcul", value: "Des cours, des exercices corrigés, des quiz et Calia, le tuteur IA qui guide sans donner la réponse." },
              { label: "Essai", value: "7 jours gratuits, sans carte bancaire et sans engagement." },
            ]}
          />
          {/* Programme */}
          <section className={CARD} aria-labelledby="au-programme">
            <SectionTitle icon={GraduationCap}><span id="au-programme">Au programme de maths en {level.name}</span></SectionTitle>
            <p className="text-sm text-gray-500 mb-6">{chapterCount(level)} notions réparties en {level.domains.length} domaines, d&apos;après le programme officiel de l&apos;Éducation nationale.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {level.domains.map((d) => (
                <div key={d.name} className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-5">
                  <h3 className="font-bold text-[var(--greek-blue)] mb-3">{d.name}</h3>
                  <ul className="space-y-2">
                    {d.chapters.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[var(--greek-gold)]" aria-hidden="true" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {pdfs.length > 0 && (
              <p className="text-sm text-gray-500 mt-5">
                Texte officiel :{" "}
                {pdfs.map((p, i) => (
                  <span key={p.url}>
                    {i > 0 && " · "}
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--greek-gold-text)] hover:underline inline-flex items-center gap-1">
                      {p.label} (Éduscol) <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </span>
                ))}
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Compétences */}
            <section className={CARD}>
              <SectionTitle icon={Brain}>Compétences travaillées</SectionTitle>
              <p className="text-sm text-gray-500 mb-5">Ce que l&apos;élève de {level.short} apprend à faire.</p>
              <ul className="space-y-3">
                {level.skills.map((s) => (
                  <li key={s} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--greek-gold)] shrink-0" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ul>
            </section>

            {/* Mini-exercice */}
            <section id="exercice" className={`${CARD} scroll-mt-24`}>
              <SectionTitle icon={PenLine}>Un exercice de {level.short} à essayer</SectionTitle>
              <p className="text-sm text-gray-500 mb-5">Sans compte : choisis ta réponse, la correction s&apos;affiche tout de suite.</p>
              <MiniExercise exercise={level.exercise} />
            </section>
          </div>

          {/* Accompagnement */}
          <section className={CARD}>
            <SectionTitle icon={Sparkles}>Comment Educalcul accompagne l&apos;élève de {level.short}</SectionTitle>
            <p className="text-sm text-gray-500 mb-6">Une même méthode du CP à la Terminale, adaptée au niveau de chaque élève.</p>
            <HowWeHelp />
            <p className="text-sm text-gray-600 mt-5">
              Voir <Link href="/offres#essayer" className="font-semibold text-[var(--greek-gold-text)] hover:underline">un exemple de cours, d&apos;exercice et de quiz</Link>,
              {" "}découvrir <Link href="/calia-tuteur-ia-maths" className="font-semibold text-[var(--greek-gold-text)] hover:underline">Calia, le tuteur IA</Link>
              {" "}ou comparer <Link href="/tarifs" className="font-semibold text-[var(--greek-gold-text)] hover:underline">les tarifs</Link>.
            </p>
          </section>

          {/* FAQ */}
          <section className={CARD}>
            <SectionTitle icon={HelpCircle}>Questions fréquentes sur les maths en {level.short}</SectionTitle>
            <p className="text-sm text-gray-500 mb-5">D&apos;autres réponses dans la <Link href="/faq" className="font-semibold text-[var(--greek-gold-text)] hover:underline">FAQ complète</Link>.</p>
            <SeoFaq items={level.faq} />
          </section>

          {/* Niveaux voisins */}
          <nav aria-label="Autres niveaux" className="flex flex-col sm:flex-row gap-3 justify-between">
            {prev ? (
              <GlassButton href={`/programmes/${prev.slug}`} variant="outline">
                <ArrowLeft className="w-4 h-4" /> Programme de {prev.short}
              </GlassButton>
            ) : <span />}
            <GlassButton href="/programmes" variant="outline">Tous les niveaux</GlassButton>
            {next ? (
              <GlassButton href={`/programmes/${next.slug}`} variant="outline">
                Programme de {next.short} <ArrowRight className="w-4 h-4" />
              </GlassButton>
            ) : <span />}
          </nav>
        </div>

        {/* Appel à l'action */}
        <section className="py-16 px-6" style={{ background: "var(--greek-blue)" }}>
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl mb-4 text-white">Travailler le programme de {level.short} avec Educalcul</h2>
            <p className="text-sm mb-8 text-white/60">7 jours gratuits, sans carte bancaire et sans engagement.</p>
            <GlassButton href="/auth/inscription" variant="gold">
              Créer un compte <ArrowRight size={16} />
            </GlassButton>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

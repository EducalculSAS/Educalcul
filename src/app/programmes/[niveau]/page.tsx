import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Brain, Check, ExternalLink, GraduationCap, PenLine } from "lucide-react";
import FadeInSection from "@/components/home/FadeInSection";
import { HeroRows, PUBLIC_CARD, PublicCta, PublicHero, PublicPage, PublicSection } from "@/components/public/PublicPage";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlassButton from "@/components/ui/GlassButton";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import SeoFaq from "@/components/seo/SeoFaq";
import MiniExercise from "@/components/seo/MiniExercise";
import JsonLd from "@/components/JsonLd";
import HowWeHelp from "@/components/seo/HowWeHelp";
import QuickFacts from "@/components/seo/QuickFacts";
import { ORG_REF, SEO_UPDATED } from "@/lib/seo/site";
import { LEVEL_BY_SLUG, LEVEL_PAGES, CYCLE_LABEL, chapterCount, neighbours } from "@/lib/seo/levels";
import { PDF_LINKS } from "@/lib/programmePdfLinks";
import { socialMeta } from "@/lib/seo/meta";

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
    ...socialMeta({ title: level.title, description: level.description, path: `/programmes/${level.slug}`, type: "article" }),
  };
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
    provider: ORG_REF,
  };

  return (
    <PublicPage>
      <JsonLd data={pageSchema} />
      <JsonLd data={courseSchema} />
      <Navbar />
      <main className="flex-grow pt-[64px]">
        <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "Programmes", href: "/programmes" }, { name: level.name, href: `/programmes/${level.slug}` }]} />
        <PublicHero
          eyebrow={<>{CYCLE_LABEL[level.cycle]} · {level.cycleLabel}</>}
          title={level.h1}
          intro={level.intro}
          actions={
            <>
              <GlassButton href="/auth/inscription" variant="gold" className="font-[family-name:var(--font-display)] font-bold text-sm">
                <span className="inline-flex items-center gap-2">Essayer gratuitement <ArrowRight className="w-4 h-4" /></span>
              </GlassButton>
              <GlassButton href="#exercice" variant="light" className="font-[family-name:var(--font-display)] font-semibold text-sm">
                Faire un exercice de {level.short}
              </GlassButton>
            </>
          }
          aside={
            <HeroRows rows={level.domains.map((d) => ({
              icon: <GraduationCap className="w-4 h-4" />,
              text: <><strong className="font-semibold text-white/85">{d.name}</strong> · {d.chapters.length} notion{d.chapters.length > 1 ? "s" : ""}</>,
            }))} />
          }
        />

        <PublicSection tight>
          <QuickFacts
            title={`Maths en ${level.short} en bref`}
            facts={[
              { label: "Niveau", value: `${level.name} (${CYCLE_LABEL[level.cycle].toLowerCase()}, ${level.cycleLabel.toLowerCase()})` },
              { label: "Au programme", value: `${chapterCount(level)} notions en ${level.domains.length} domaines : ${level.domains.map((d) => d.name.toLowerCase()).join(", ")}.` },
              { label: "Texte de référence", value: "Programme de l'Éducation nationale publié sur Éduscol." },
              { label: "Sur Educalcul", value: "Des cours, des exercices corrigés, des quiz et Calia, le tuteur IA qui guide sans donner la réponse." },
              { label: "Essai", value: "7 jours gratuits, sans engagement." },
            ]}
          />
        </PublicSection>

        <PublicSection
          id="au-programme"
          eyebrow="Au programme"
          title={`Les maths en ${level.name}`}
          intro={`${chapterCount(level)} notions réparties en ${level.domains.length} domaines, d'après le programme officiel de l'Éducation nationale.`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {level.domains.map((d, i) => (
              <FadeInSection key={d.name} delayMs={i * 80} className={PUBLIC_CARD}>
                <h3 className="font-[family-name:var(--font-display)] font-bold text-xl mb-4" style={{ color: "var(--greek-blue)" }}>{d.name}</h3>
                <ul className="flex flex-col gap-2.5">
                  {d.chapters.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                      <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(197,161,72,0.1)" }}>
                        <Check className="w-2.5 h-2.5" style={{ color: "var(--greek-gold)" }} />
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </FadeInSection>
            ))}
          </div>
          {pdfs.length > 0 && (
            <p className="text-sm text-center mt-8" style={{ color: "var(--text-muted)" }}>
              Texte officiel :{" "}
              {pdfs.map((p, i) => (
                <span key={p.url}>
                  {i > 0 && " · "}
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline inline-flex items-center gap-1" style={{ color: "var(--greek-gold-text)" }}>
                    {p.label} (Éduscol) <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </span>
              ))}
            </p>
          )}
        </PublicSection>

        <PublicSection eyebrow="S'entraîner" title={`Ce que l'élève de ${level.short} apprend à faire`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FadeInSection className={PUBLIC_CARD}>
              <h3 className="font-[family-name:var(--font-display)] font-bold text-xl mb-4 flex items-center gap-2" style={{ color: "var(--greek-blue)" }}>
                <Brain className="w-5 h-5" style={{ color: "var(--greek-gold)" }} aria-hidden="true" /> Compétences travaillées
              </h3>
              <ul className="flex flex-col gap-2.5">
                {level.skills.map((sk) => (
                  <li key={sk} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: "var(--greek-gold)" }} aria-hidden="true" />
                    {sk}
                  </li>
                ))}
              </ul>
            </FadeInSection>
            <FadeInSection delayMs={100} className={`${PUBLIC_CARD} scroll-mt-24`}>
              <div id="exercice" className="scroll-mt-24" />
              <h3 className="font-[family-name:var(--font-display)] font-bold text-xl mb-1 flex items-center gap-2" style={{ color: "var(--greek-blue)" }}>
                <PenLine className="w-5 h-5" style={{ color: "var(--greek-gold)" }} aria-hidden="true" /> Un exercice de {level.short} à essayer
              </h3>
              <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>Sans compte : choisis ta réponse, la correction s&apos;affiche tout de suite.</p>
              <MiniExercise exercise={level.exercise} />
            </FadeInSection>
          </div>
        </PublicSection>

        <PublicSection eyebrow="Avec Educalcul" title={`Comment nous accompagnons l'élève de ${level.short}`} intro="Une même méthode du CP à la Terminale, adaptée au niveau de chaque élève.">
          <HowWeHelp />
          <p className="text-sm text-center mt-8" style={{ color: "var(--text-muted)" }}>
            Voir <Link href="/offres#essayer" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>un exemple de cours, d&apos;exercice et de quiz</Link>,
            {" "}découvrir <Link href="/calia-tuteur-ia-maths" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>Calia</Link>
            {" "}ou comparer <Link href="/tarifs" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>les tarifs</Link>.
          </p>
        </PublicSection>

        <PublicSection eyebrow="Questions fréquentes" title={`Les maths en ${level.short}`}>
          <div className="max-w-3xl mx-auto">
            <SeoFaq items={level.faq} />
            <p className="text-sm text-center mt-6" style={{ color: "var(--text-muted)" }}>
              D&apos;autres réponses dans la <Link href="/faq" className="font-semibold hover:underline" style={{ color: "var(--greek-gold-text)" }}>FAQ complète</Link>.
            </p>
          </div>
          {/* Niveaux voisins (pas de retour vers une page principale). */}
          <nav aria-label="Niveaux voisins" className="flex flex-col sm:flex-row gap-3 justify-between max-w-3xl mx-auto mt-12">
            {prev ? (
              <GlassButton href={`/programmes/${prev.slug}`} variant="outline">
                <ArrowLeft className="w-4 h-4" /> Programme de {prev.short}
              </GlassButton>
            ) : <span />}
            {next ? (
              <GlassButton href={`/programmes/${next.slug}`} variant="outline">
                Programme de {next.short} <ArrowRight className="w-4 h-4" />
              </GlassButton>
            ) : <span />}
          </nav>
        </PublicSection>

        <PublicCta title={`Travailler le programme de ${level.short}`} secondary={{ href: "/tarifs", label: "Comparer les formules" }} />
      </main>
      <Footer />
    </PublicPage>
  );
}

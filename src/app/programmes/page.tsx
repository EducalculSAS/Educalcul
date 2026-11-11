import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import { BookOpen, GraduationCap } from "lucide-react";
import { HeroRows, PublicCta, PublicHero, PublicPage } from "@/components/public/PublicPage";
import FadeInSection from "@/components/home/FadeInSection";
import LevelPicker from "@/components/programmes/LevelPicker";
import LevelGroupsList from "@/components/programmes/LevelGroupsList";
import { fetchProgrammePdfs } from "@/lib/programmePdfs";
import { LEVEL_PAGES } from "@/lib/seo/levels";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import SeoFaq from "@/components/seo/SeoFaq";


const HUB_FAQ = [
  { q: "Les contenus d'Educalcul suivent-ils les programmes officiels ?", a: "Oui, chaque contenu est rattaché à un niveau et à une notion des programmes de l'Éducation nationale publiés sur Éduscol." },
  { q: "Comment choisir le bon niveau ?", a: "La classe de l'enfant (et son option au lycée : spécialité, maths expertes ou complémentaires) est choisie à la création de son compte ; il voit ensuite les contenus de son niveau." },
  { q: "Peut-on revoir les notions d'une année précédente ?", a: "Oui, les pages de chaque niveau restent consultables et Calia peut réexpliquer une notion ancienne qui bloque." },
  { q: "Combien coûte Educalcul ?", a: "Les formules sont détaillées sur la page Tarifs. L'essai est gratuit pendant 7 jours, sans engagement." },
];

// Page publique quasi-statique (PDFs édités en admin) : ISR au lieu d'un
// aller-retour Supabase à chaque visite.
export const revalidate = 300;


export default async function ProgrammesPage() {
  const dbPdfs = await fetchProgrammePdfs();

  return (
    <PublicPage>
      <Navbar />
      <main className="flex-grow pt-[64px]">
      {/* Accès direct à chaque niveau, présent dans le HTML même quand les cartes ci-dessous sont repliées (lecteurs d'écran, moteurs de recherche). */}
      <nav aria-label="Programme de maths par niveau" className="sr-only">
        <ul>
          {LEVEL_PAGES.map((l) => (
            <li key={l.slug}><Link href={`/programmes/${l.slug}`}>Programme de maths en {l.name}</Link></li>
          ))}
        </ul>
      </nav>

      <Breadcrumbs hidden items={[{ name: "Accueil", href: "/" }, { name: "Programmes", href: "/programmes" }]} />
      <PublicHero
        eyebrow="Programmes officiels"
        title="Les maths"
        highlight="du CP à la Terminale"
        intro="Pour chaque niveau : les notions au programme, les compétences travaillées et un exercice à essayer, d'après les textes de l'Éducation nationale."
        actions={<LevelPicker align="start" />}
        aside={
          <HeroRows rows={[
            { icon: <GraduationCap className="w-4 h-4" />, text: <><strong className="font-semibold text-white/85">Primaire</strong> · CP, CE1, CE2, CM1, CM2</> },
            { icon: <GraduationCap className="w-4 h-4" />, text: <><strong className="font-semibold text-white/85">Collège</strong> · 6e, 5e, 4e, 3e</> },
            { icon: <GraduationCap className="w-4 h-4" />, text: <><strong className="font-semibold text-white/85">Lycée</strong> · Seconde, Première, Terminale</> },
            { icon: <BookOpen className="w-4 h-4" />, text: "D'après les programmes publiés sur Éduscol" },
          ]} />
        }
      />

      {/* Contenu programmes */}
      <section className="py-16 px-6" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-3xl mx-auto space-y-12">
          {/* Logos officiels + texte */}
          <FadeInSection translateY={24} durationMs={600} className="flex flex-col items-center text-center gap-5">
            <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
              <Image src="/logo-men.svg" alt="Ministère de l'Éducation Nationale" width={180} height={180} className="w-auto object-contain flex-shrink-0" style={{ height: 180 }} unoptimized />
              <div className="hidden sm:block w-px h-12" style={{ background: "var(--greek-border)" }} />
              <Image src="/eduscol.svg" alt="Eduscol" width={110} height={36} className="h-9 w-auto object-contain" unoptimized />
            </div>
            <div className="max-w-xl">
              <p className="font-bold text-base leading-relaxed" style={{ fontFamily: "var(--font-display)", color: "var(--greek-blue)" }}>
                Les programmes officiels comme référence
              </p>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Les contenus d&apos;Educalcul sont élaborés à partir des programmes publiés par le Ministère de l&apos;Éducation Nationale et référencés sur Éduscol.
              </p>
            </div>
          </FadeInSection>

          <LevelGroupsList dbPdfs={dbPdfs} />

          <div>
            <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl text-[var(--greek-blue)] text-center mb-6">Questions fréquentes</h2>
            <SeoFaq items={HUB_FAQ} />
          </div>
        </div>
      </section>

      <PublicCta text="Inscrivez-vous en 2 minutes et accédez à tous les contenus alignés sur ces programmes." secondary={{ href: "/tarifs", label: "Comparer les formules" }} />

      </main>

      <Footer />
    </PublicPage>
  );
}

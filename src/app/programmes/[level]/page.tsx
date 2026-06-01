"use client";

import { notFound } from "next/navigation";
import { PROGRAMMES_NATIONAUX } from "@/lib/programmes-nationaux";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, ChevronRight } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { use } from "react";

function renderNotion(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, math) => {
    try { return katex.renderToString(math, { throwOnError: false, displayMode: false }); }
    catch { return math; }
  });
}

const LEVEL_LABELS: Record<string, string> = {
  cp: "CP", ce1: "CE1", ce2: "CE2", cm1: "CM1", cm2: "CM2",
  "6eme": "6ème", "5eme": "5ème", "4eme": "4ème", "3eme": "3ème",
  "2nde": "Seconde",
  "1ere-generale": "Première Générale", "1ere-generale-maths": "Première — Spé Maths",
  "1ere-sti2d": "Première STI2D", "1ere-stmg": "Première STMG",
  "1ere-st2s": "Première ST2S", "1ere-stl": "Première STL",
  "1ere-std2a": "Première STD2A", "1ere-sthr": "Première STHR",
  "terminale-generale": "Terminale Générale", "terminale-generale-maths": "Terminale — Spé Maths",
  "terminale-generale-expertes": "Terminale — Maths Expertes",
  "terminale-generale-complementaires": "Terminale — Maths Complémentaires",
  "terminale-sti2d": "Terminale STI2D", "terminale-stmg": "Terminale STMG",
  "terminale-st2s": "Terminale ST2S", "terminale-stl": "Terminale STL",
};

const GROUP_COLOR: Record<string, string> = {
  cp: "#22c55e", ce1: "#22c55e", ce2: "#22c55e", cm1: "#22c55e", cm2: "#22c55e",
  "6eme": "#60a5fa", "5eme": "#60a5fa", "4eme": "#60a5fa", "3eme": "#60a5fa",
};

const ORDERED_LEVELS = [
  "cp","ce1","ce2","cm1","cm2",
  "6eme","5eme","4eme","3eme",
  "2nde",
  "1ere-generale","1ere-generale-maths","1ere-sti2d","1ere-stmg","1ere-st2s","1ere-stl","1ere-std2a","1ere-sthr",
  "terminale-generale","terminale-generale-maths","terminale-generale-expertes",
  "terminale-generale-complementaires","terminale-sti2d","terminale-stmg","terminale-st2s","terminale-stl",
];

const PDF_LINKS: Record<string, { label: string; url: string }> = {
  cp: { label: "Programme Cycle 2 (CP-CE1-CE2)", url: "https://eduscol.education.gouv.fr/document/17415/download" },
  ce1: { label: "Programme Cycle 2 (CP-CE1-CE2)", url: "https://eduscol.education.gouv.fr/document/17415/download" },
  ce2: { label: "Programme Cycle 2 (CP-CE1-CE2)", url: "https://eduscol.education.gouv.fr/document/17415/download" },
  cm1: { label: "Programme Cycle 3 (CM1-CM2-6e)", url: "https://eduscol.education.gouv.fr/document/17416/download" },
  cm2: { label: "Programme Cycle 3 (CM1-CM2-6e)", url: "https://eduscol.education.gouv.fr/document/17416/download" },
  "6eme": { label: "Programme Cycle 3 (CM1-CM2-6e)", url: "https://eduscol.education.gouv.fr/document/17416/download" },
  "5eme": { label: "Programme Cycle 4 (5e-4e-3e)", url: "https://eduscol.education.gouv.fr/document/17418/download" },
  "4eme": { label: "Programme Cycle 4 (5e-4e-3e)", url: "https://eduscol.education.gouv.fr/document/17418/download" },
  "3eme": { label: "Programme Cycle 4 (5e-4e-3e)", url: "https://eduscol.education.gouv.fr/document/17418/download" },
  "2nde": { label: "Programme Seconde GT", url: "https://eduscol.education.gouv.fr/document/18358/download" },
  "1ere-generale-maths": { label: "Programme Première — Maths (spé)", url: "https://eduscol.education.gouv.fr/document/18360/download" },
  "1ere-generale": { label: "Programme Première Générale", url: "https://eduscol.education.gouv.fr/document/18360/download" },
  "terminale-generale-maths": { label: "Programme Terminale — Maths (spé)", url: "https://eduscol.education.gouv.fr/document/18361/download" },
  "terminale-generale-expertes": { label: "Programme Maths Expertes", url: "https://eduscol.education.gouv.fr/document/18362/download" },
};

export default function ProgrammeLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = use(params);
  const prog = PROGRAMMES_NATIONAUX.find(p => p.level === level);
  if (!prog) notFound();

  const label = LEVEL_LABELS[level] ?? prog.label;
  const color = GROUP_COLOR[level] ?? "var(--greek-gold)";
  const pdf = PDF_LINKS[level];

  const idx = ORDERED_LEVELS.indexOf(level);
  const prevLevel = idx > 0 ? ORDERED_LEVELS[idx - 1] : null;
  const nextLevel = idx < ORDERED_LEVELS.length - 1 ? ORDERED_LEVELS[idx + 1] : null;

  // JSON-LD schemas
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://educalcul.com" },
      { "@type": "ListItem", position: 2, name: "Programmes", item: "https://educalcul.com/programmes" },
      { "@type": "ListItem", position: 3, name: label, item: `https://educalcul.com/programmes/${level}` },
    ],
  };

  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `Mathématiques — ${label}`,
    description: `Programme officiel de mathématiques pour le niveau ${label}, conforme aux référentiels de l'Éducation Nationale.`,
    provider: { "@type": "Organization", name: "Educalcul", url: "https://educalcul.com" },
    educationalLevel: label,
    inLanguage: "fr",
    url: `https://educalcul.com/programmes/${level}`,
    hasCourseInstance: prog.themes.map(t => ({
      "@type": "CourseInstance",
      name: t.titre,
      courseMode: "online",
    })),
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-cream)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseSchema) }} />
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white pt-[calc(var(--nav-h)+3rem)] pb-16">
        <div className="relative container mx-auto px-6 max-w-3xl">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/programmes" className="hover:text-white transition-colors">Programmes</Link>
            <ChevronRight className="w-3 h-3" />
            <span style={{ color: color }}>{label}</span>
          </nav>

          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
            Mathématiques · {label}
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Programme de maths<br />
            <span style={{ color }}>en {label}</span>
          </h1>
          <p className="text-white/55 text-lg leading-relaxed">
            Programme officiel publié par le Ministère de l'Éducation Nationale — référencé sur Éduscol.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="py-12 px-6">
        <div className="max-w-3xl mx-auto">

          {/* Logos */}
          <div className="flex items-center gap-6 mb-10 p-5 rounded-2xl"
            style={{ background: "#fff", border: "1px solid var(--greek-border)" }}>
            <Image src="/logo-men.svg" alt="Ministère de l'Éducation Nationale" width={80} height={80}
              className="w-auto object-contain flex-shrink-0" style={{ height: 80 }} unoptimized />
            <div className="w-px h-10" style={{ background: "var(--greek-border)" }} />
            <Image src="/eduscol.svg" alt="Eduscol" width={80} height={26}
              className="w-auto object-contain flex-shrink-0" style={{ height: 26 }} unoptimized />
            <div className="flex-1 text-right">
              <p className="text-xs font-semibold" style={{ color: "var(--greek-blue)" }}>100% conforme</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Référentiels officiels EN</p>
            </div>
          </div>

          {/* Themes */}
          <div className="space-y-6">
            {prog.themes.map((theme, i) => (
              <div key={i} className="rounded-2xl overflow-hidden"
                style={{ background: "#fff", border: `1px solid ${color}30` }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: `${color}20`, background: `${color}08` }}>
                  <h2 className="font-[family-name:var(--font-display)] font-bold text-sm uppercase tracking-widest"
                    style={{ color }}>
                    {theme.titre}
                  </h2>
                </div>
                <ul className="px-6 py-5 space-y-2">
                  {theme.notions.map((n, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span dangerouslySetInnerHTML={{ __html: renderNotion(n) }} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* PDF officiel */}
          {pdf && (
            <div className="mt-8 flex items-center gap-4 p-5 rounded-2xl"
              style={{ background: "rgba(197,161,72,0.06)", border: "1px solid rgba(197,161,72,0.2)" }}>
              <BookOpen className="w-5 h-5 flex-shrink-0" style={{ color: "var(--greek-gold)" }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--greek-blue)" }}>Programme officiel (PDF)</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pdf.label}</p>
              </div>
              <a href={pdf.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                style={{ background: "var(--greek-blue)", color: "#fff" }}>
                Télécharger <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Nav prev/next */}
          <div className="mt-10 flex justify-between gap-4">
            {prevLevel ? (
              <Link href={`/programmes/${prevLevel}`}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ background: "#fff", border: "1px solid var(--greek-border)", color: "var(--greek-blue)" }}>
                <ArrowLeft className="w-4 h-4" /> {LEVEL_LABELS[prevLevel] ?? prevLevel}
              </Link>
            ) : <div />}
            {nextLevel ? (
              <Link href={`/programmes/${nextLevel}`}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 ml-auto"
                style={{ background: "#fff", border: "1px solid var(--greek-border)", color: "var(--greek-blue)" }}>
                {LEVEL_LABELS[nextLevel] ?? nextLevel} <ArrowRight className="w-4 h-4" />
              </Link>
            ) : <div />}
          </div>

          {/* CTA */}
          <div className="mt-10 text-center p-10 rounded-2xl"
            style={{ background: "var(--greek-blue)" }}>
            <h3 className="font-[family-name:var(--font-display)] font-bold text-xl text-white mb-3">
              Travailler le programme {label} avec Educalcul
            </h3>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Cours structurés, exercices progressifs et EpsiAI pour maîtriser chaque notion.
            </p>
            <Link href="/auth/inscription"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 font-[family-name:var(--font-display)]"
              style={{ background: "var(--greek-gold)", color: "#fff", boxShadow: "0 8px 28px rgba(197,161,72,0.3)" }}>
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

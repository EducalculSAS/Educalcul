import type { Metadata } from "next";
import { PROGRAMMES_NATIONAUX } from "@/lib/programmes-nationaux";
import { notFound } from "next/navigation";

const LEVEL_META: Record<string, { title: string; description: string; group: string }> = {
  cp:    { title: "Cours et Programme de Maths CP",    description: "Programme officiel de mathématiques au CP (Cours Préparatoire) : nombres, calculs, géométrie et mesures. Conforme au programme de l'Éducation Nationale.", group: "Primaire" },
  ce1:   { title: "Cours et Programme de Maths CE1",   description: "Programme de mathématiques au CE1 : numération jusqu'à 100, addition, soustraction, géométrie plane. Aligné sur le programme EN.", group: "Primaire" },
  ce2:   { title: "Cours et Programme de Maths CE2",   description: "Programme de mathématiques au CE2 : multiplication, division, fractions simples, mesures de longueur et de masse. Conforme à l'Éducation Nationale.", group: "Primaire" },
  cm1:   { title: "Cours et Programme de Maths CM1",   description: "Programme de mathématiques au CM1 : fractions, décimaux, périmètre, aire, angles. Exercices progressifs conformes au programme officiel.", group: "Primaire" },
  cm2:   { title: "Cours et Programme de Maths CM2",   description: "Programme de mathématiques au CM2 : proportionnalité, fractions, géométrie dans l'espace, statistiques. Préparation au collège.", group: "Primaire" },
  "6eme": { title: "Cours et Programme de Maths 6ème",  description: "Programme de mathématiques en 6ème : nombres entiers et décimaux, fractions, géométrie, statistiques. Conforme au programme du collège.", group: "Collège" },
  "5eme": { title: "Cours et Programme de Maths 5ème",  description: "Programme de mathématiques en 5ème : nombres relatifs, calcul littéral, Pythagore, probabilités. Aligné sur le programme officiel.", group: "Collège" },
  "4eme": { title: "Cours et Programme de Maths 4ème",  description: "Programme de mathématiques en 4ème : équations, développement, factorisation, théorème de Thalès, trigonométrie.", group: "Collège" },
  "3eme": { title: "Cours et Programme de Maths 3ème",  description: "Programme de mathématiques en 3ème : préparation au Brevet. Fonctions, systèmes d'équations, statistiques, géométrie dans l'espace.", group: "Collège" },
  "2nde": { title: "Cours et Programme de Maths Seconde", description: "Programme de mathématiques en Seconde générale et technologique : fonctions, algèbre, géométrie, statistiques et probabilités.", group: "Lycée" },
  "1ere-generale": { title: "Programme de Maths Première Générale", description: "Programme de mathématiques de Première Générale : dérivation, suites, géométrie dans l'espace, probabilités conditionnelles.", group: "Lycée" },
  "1ere-generale-maths": { title: "Programme Maths Spécialité Première", description: "Programme de la spécialité Mathématiques en Première Générale : suites, dérivation, géométrie repérée, probabilités.", group: "Lycée" },
  "1ere-sti2d": { title: "Programme de Maths Première STI2D",  description: "Programme de mathématiques de Première STI2D : fonctions, trigonométrie, suites, statistiques appliquées.", group: "Lycée" },
  "1ere-stmg": { title: "Programme de Maths Première STMG",   description: "Programme de mathématiques en Première STMG : fonctions, statistiques, probabilités et financier.", group: "Lycée" },
  "1ere-st2s": { title: "Programme de Maths Première ST2S",   description: "Programme de mathématiques de Première ST2S : statistiques, probabilités, fonctions appliquées au domaine de la santé.", group: "Lycée" },
  "1ere-stl":  { title: "Programme de Maths Première STL",    description: "Programme de mathématiques de Première STL : fonctions, vecteurs, statistiques et probabilités.", group: "Lycée" },
  "1ere-std2a":{ title: "Programme de Maths Première STD2A",  description: "Programme de mathématiques de Première STD2A : fonctions, transformations, statistiques.", group: "Lycée" },
  "1ere-sthr": { title: "Programme de Maths Première STHR",   description: "Programme de mathématiques de Première STHR : statistiques, probabilités et fonctions appliquées.", group: "Lycée" },
  "terminale-generale": { title: "Programme de Maths Terminale Générale", description: "Programme de mathématiques de Terminale Générale : préparation au Baccalauréat. Intégrales, limites, probabilités, géométrie.", group: "Lycée" },
  "terminale-generale-maths": { title: "Programme Maths Spécialité Terminale", description: "Programme de la spécialité Mathématiques en Terminale : calcul différentiel, intégral, algèbre, dénombrement, préparation au Bac.", group: "Lycée" },
  "terminale-generale-expertes": { title: "Programme Maths Expertes Terminale", description: "Programme de la spécialité Mathématiques Expertes en Terminale : arithmétique, matrices, graphes, algèbre avancée.", group: "Lycée" },
  "terminale-generale-complementaires": { title: "Programme Maths Complémentaires Terminale", description: "Programme de Mathématiques Complémentaires en Terminale : statistiques, probabilités, calcul approfondi.", group: "Lycée" },
  "terminale-sti2d": { title: "Programme de Maths Terminale STI2D",  description: "Programme de mathématiques de Terminale STI2D : intégrales, équations différentielles, statistiques appliquées à l'ingénierie.", group: "Lycée" },
  "terminale-stmg": { title: "Programme de Maths Terminale STMG",   description: "Programme de mathématiques de Terminale STMG : statistiques, probabilités, suites financières, préparation au Bac.", group: "Lycée" },
  "terminale-st2s": { title: "Programme de Maths Terminale ST2S",   description: "Programme de mathématiques de Terminale ST2S : statistiques inférentielles, probabilités et modélisation santé-social.", group: "Lycée" },
  "terminale-stl":  { title: "Programme de Maths Terminale STL",    description: "Programme de mathématiques de Terminale STL : fonctions, statistiques et probabilités adaptés aux sciences du laboratoire.", group: "Lycée" },
};

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }): Promise<Metadata> {
  const { level } = await params;
  const meta = LEVEL_META[level];
  const prog = PROGRAMMES_NATIONAUX.find(p => p.level === level);
  if (!meta || !prog) return { title: "Programme introuvable" };

  const canonical = `https://educalcul.com/programmes/${level}`;
  return {
    title: `${meta.title} | Educalcul`,
    description: meta.description,
    alternates: {
      canonical,
      languages: {
        "fr-FR": canonical, "fr-BE": canonical,
        "fr-CH": canonical, "fr-CA": canonical,
      },
    },
    openGraph: {
      title: `${meta.title} | Educalcul`,
      description: meta.description,
      url: canonical,
      type: "article",
    },
    keywords: [
      `programme maths ${prog.label}`,
      `cours mathématiques ${prog.label}`,
      `exercices maths ${prog.label}`,
      `programme officiel ${meta.group}`,
      "Éducation Nationale",
      "Éduscol",
    ],
  };
}

export default function LevelLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { generateStructuredContent } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { grade_level, subject, additional_info, page_count } = data;

    if (!grade_level || !subject) {
      return NextResponse.json({ success: false, message: "Le niveau et le sujet sont requis" }, { status: 400 });
    }

    const nbChapitres = page_count ? parseInt(page_count) : 4;

    const systemMessage = `Tu es un expert pédagogue en mathématiques pour Educalcul, une plateforme éducative française.
Ta mission : créer un cours magistral COMPLET, RIGOUREUX et APPROFONDI, comme un manuel scolaire de référence.

═══ EXIGENCES DE LONGUEUR (NON NÉGOCIABLES) ═══
• Chaque leçon doit contenir MINIMUM 600 mots, idéalement 800-1200 mots.
• Chaque chapitre doit avoir AU MOINS 3 leçons.
• Chaque leçon doit inclure : théorie complète, exemples détaillés étape par étape, contre-exemples, erreurs fréquentes, exercices d'application résolus.
• duration = temps réel en minutes (jamais moins de 25 min par leçon).

═══ STRUCTURE D'UNE LEÇON MODÈLE ═══
1. Introduction et contexte (pourquoi ce concept est important)
2. Définition(s) formelle(s) avec explications accessibles
3. Propriétés et théorèmes avec démonstrations ou justifications
4. Exemples progressifs (simple → complexe) avec TOUTES les étapes de calcul
5. Contre-exemples et pièges courants à éviter
6. Méthode de résolution pas à pas (comme un tutoriel)
7. Exercices d'application résolus (au moins 2)
8. Points-clés à retenir (résumé en bullets)

═══ FORMAT HTML + LATEX ═══
• HTML : <h3>, <h4>, <p>, <ul>/<li>, <strong>, <em>, <blockquote>, <table>
• LaTeX OBLIGATOIRE pour toutes les formules mathématiques.
• Inline : $formule$ — Bloc : $$formule$$
• DOUBLE-ÉCHAPPE les backslashes JSON : \\\\frac{a}{b} → donne \\frac{a}{b} dans le rendu
• Exemples CORRECTS : "$$ \\\\frac{1}{2} $$", "$x^2 + y^2 = r^2$"

═══ QUALITÉ PÉDAGOGIQUE ═══
• Adapte le vocabulaire et la complexité au niveau scolaire indiqué.
• Commence TOUJOURS par relier le nouveau concept à ce que l'élève connaît déjà.
• Utilise des analogies concrètes et des situations de la vie réelle.
• Varie les formulations pour maintenir l'attention.
• Indique clairement les prérequis de chaque leçon.

═══ JSON STRICT ═══
Réponds UNIQUEMENT avec le JSON ci-dessous, sans texte avant ni après.
Double-échappe tous les backslashes LaTeX.

{
  "title": "Titre complet et précis du cours",
  "description": "Description pédagogique détaillée (3-4 phrases)",
  "chapters": [
    {
      "title": "Titre du chapitre",
      "lessons": [
        {
          "title": "Titre précis de la leçon",
          "type": "text",
          "content": "Contenu HTML très riche (600-1200 mots minimum)",
          "duration": 35
        }
      ]
    }
  ]
}`;

    const userMessage = `Crée un cours de mathématiques COMPLET et DÉTAILLÉ sur "${subject}" pour le niveau ${grade_level}.
Nombre de chapitres : ${nbChapitres} (chacun avec 3 à 4 leçons de 600-1200 mots minimum).
${additional_info ? `Instructions spécifiques : ${additional_info}` : ""}
Chaque leçon doit être un vrai cours magistral, pas un résumé. Un élève doit pouvoir passer 30 à 45 minutes sur chaque leçon.`;

    let courseData;
    try {
      courseData = await generateStructuredContent(userMessage, systemMessage, 0.65);
    } catch (error: any) {
      console.error("❌ Erreur génération cours IA:", error.message);
      return NextResponse.json({ success: false, message: `Erreur de génération: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, course: courseData });
  } catch (error: any) {
    console.error("Erreur cours IA:", error);
    return NextResponse.json({ success: false, message: error.message || "Erreur interne" }, { status: 500 });
  }
}

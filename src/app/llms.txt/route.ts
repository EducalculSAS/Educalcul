import { LEVEL_PAGES } from "@/lib/seo/levels";
import { CONTACT_EMAIL, FOUNDERS, LEGAL_NAME, LEGAL_STATUS, SEO_UPDATED, SITE_URL } from "@/lib/seo/site";

/**
 * Présentation d'Educalcul en texte brut pour les assistants IA (convention llms.txt). Aucune garantie d'être cité :
 * c'est simplement un résumé fidèle et à jour, généré depuis les mêmes données que les pages (jamais écrit à la main).
 */
export const dynamic = "force-static";

export function GET() {
  const lines = [
    "# Educalcul",
    "",
    "> Educalcul est une plateforme française pour apprendre, comprendre, s'entraîner et progresser en mathématiques, du CP à la Terminale. Elle propose des cours, des exercices corrigés, des quiz, Calia (un tuteur IA qui guide l'élève par questions sans donner la réponse) et un espace de suivi pour les parents. Les contenus suivent les programmes de l'Éducation nationale.",
    "",
    `- Site : ${SITE_URL}`,
    `- Fondateurs : ${FOUNDERS.map((f) => `${f.name} (${f.jobTitle.toLowerCase()})`).join(" ; ")}`,
    `- Contact : ${CONTACT_EMAIL}`,
    "- Essai : 7 jours gratuits, sans carte bancaire et sans engagement",
    `- Mis à jour : ${SEO_UPDATED}`,
    "",
    "## Pages principales",
    "",
    `- [Offres](${SITE_URL}/offres) : ce que comprend la plateforme, avec un cours, un exercice et un quiz à essayer sans compte`,
    `- [Calia, le tuteur IA](${SITE_URL}/calia-tuteur-ia-maths) : comment Calia aide l'élève, ce qu'elle fait et ne fait pas`,
    `- [Méthode pédagogique](${SITE_URL}/methode-pedagogique) : comprendre, s'entraîner, retenir, se situer`,
    `- [Programmes](${SITE_URL}/programmes) : le programme de maths de chaque niveau`,
    `- [Tarifs](${SITE_URL}/tarifs) : les formules Gratuit (Découverte), Solo et Family et leur contenu`,
    `- [À propos](${SITE_URL}/a-propos) : qui a créé Educalcul et pourquoi`,
    `- [FAQ](${SITE_URL}/faq) : questions fréquentes`,
    `- [Contact](${SITE_URL}/contact) : ${CONTACT_EMAIL}`,
    "",
    "## Informations légales",
    "",
    `- [Mentions légales](${SITE_URL}/mentions-legales)`,
    `- [Politique de confidentialité](${SITE_URL}/politique-confidentialite)`,
    `- [CGU](${SITE_URL}/cgu) et [CGV](${SITE_URL}/cgv)`,
    "",
    `Educalcul est édité par ${LEGAL_NAME}, ${LEGAL_STATUS}.`,
    "",
    "## Programme de maths par niveau",
    "",
    ...LEVEL_PAGES.map((l) => `- [${l.name}](${SITE_URL}/programmes/${l.slug}) : ${l.card}`),
    "",
    "## À savoir",
    "",
    "- Les espaces élève, parent et administrateur sont privés et ne doivent pas être cités.",
    "- Les fonctions disponibles (Calia, rapports, difficulté des exercices) dépendent de la formule ; le détail est sur la page Tarifs.",
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

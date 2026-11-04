import { MetadataRoute } from "next";

/**
 * Qui peut lire quoi. Les pages publiques sont ouvertes à tous les robots, y compris ceux des assistants IA, pour
 * qu'Educalcul puisse être trouvé et cité ; les espaces connectés et l'API restent fermés (et protégés par connexion,
 * pas seulement par ce fichier).
 *  - Robots de RECHERCHE et d'assistants (affichent des liens vers le site) : OAI-SearchBot et ChatGPT-User (OpenAI),
 *    PerplexityBot et Perplexity-User, Claude-SearchBot et Claude-User (Anthropic), Googlebot, Bingbot.
 *  - Robots d'ENTRAÎNEMENT : GPTBot (OpenAI), ClaudeBot (Anthropic), Google-Extended (Gemini), Applebot-Extended. Ils ne
 *    voient que les pages publiques ci-dessus ; les retirer de la liste TRAINING_BOTS suffit à les refuser.
 */
const PRIVATE = ["/parent/", "/child/", "/admin/", "/api/", "/dashboard", "/suivi/"];

const SEARCH_BOTS = ["Googlebot", "Bingbot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "Claude-SearchBot", "Claude-User"];
const TRAINING_BOTS = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: SEARCH_BOTS, allow: "/", disallow: PRIVATE },
      { userAgent: TRAINING_BOTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: "https://educalcul.com/sitemap.xml",
    host: "https://educalcul.com",
  };
}

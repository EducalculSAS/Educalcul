/**
 * D'où viennent les visiteurs des pages publiques : moteurs de recherche, assistants IA (ChatGPT, Perplexity, Copilot,
 * Gemini, Claude), réseaux sociaux ou autres sites. Sert à mesurer la visibilité auprès des IA (GEO).
 * Seule la CATÉGORIE (ou le nom du site référent) est comptée, jamais d'information sur la personne.
 */
export const AI_SOURCES = ["chatgpt", "perplexity", "copilot", "gemini", "claude"] as const;

const HOST_RULES: [RegExp, string][] = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/(^|\.)copilot\.microsoft\.com$/, "copilot"],
  [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/, "gemini"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)(duckduckgo\.com|ecosia\.org|qwant\.com)$/, "autre-moteur"],
  [/(^|\.)(facebook\.com|instagram\.com|youtube\.com|t\.co|twitter\.com|x\.com|linkedin\.com|tiktok\.com|pinterest\.[a-z]+|reddit\.com)$/, "reseaux"],
];

const UTM_RULES: Record<string, string> = {
  "chatgpt.com": "chatgpt", chatgpt: "chatgpt", openai: "chatgpt",
  perplexity: "perplexity", "perplexity.ai": "perplexity",
  copilot: "copilot", "copilot.microsoft.com": "copilot",
  gemini: "gemini", claude: "claude", "claude.ai": "claude",
};

/** Catégorie de la source, ou null quand la visite est interne (même site) ou sans origine connue. */
export function classifySource(referrer: string | null | undefined, utmSource: string | null | undefined, ownHosts: string[]): string | null {
  const utm = (utmSource || "").trim().toLowerCase().slice(0, 60);
  if (utm && UTM_RULES[utm]) return UTM_RULES[utm];
  let host = "";
  try { host = referrer ? new URL(referrer).hostname.toLowerCase() : ""; } catch { host = ""; }
  if (host && ownHosts.some((h) => host === h || host.endsWith("." + h))) return null;
  if (host) {
    for (const [re, name] of HOST_RULES) if (re.test(host)) return name;
    return `autre:${host.replace(/^www\./, "").slice(0, 34)}`;
  }
  return utm ? `utm:${utm.slice(0, 34)}` : null;
}

const PRIVATE_PREFIXES = ["/api", "/admin", "/parent", "/child", "/dashboard", "/suivi", "/u/", "/auth", "/logout"];

/** Chemin public à compter (sans paramètres), ou null pour tout ce qui est privé ou invalide. */
export function trackablePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (path.length > 200 || /[\s<>"']/.test(path)) return null;
  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/"))) return null;
  return path;
}

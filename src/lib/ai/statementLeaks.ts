/**
 * Énoncés qui trahissent la réponse : un paragraphe de démarche (« Vérification : … », « On calcule … ») glissé dans
 * l'énoncé, ou la réponse attendue écrite telle quelle (« … = 210 € »). La démarche appartient à la correction.
 */

const LEAK_START = /^\s*(?:v[ée]rification|v[ée]rifions|on (?:cherche|calcule|v[ée]rifie|trouve|obtient)|calcul(?:ons)?\s*:|solution\s*:|r[ée]ponse\s*:|correction\s*:|d[ée]monstration\s*:)/i;

const plain = (html: string) =>
  html
    .replace(/<figure[\s\S]*?<\/figure>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Retire les paragraphes de démarche d'un énoncé (HTML en <p> ou texte en lignes). */
export function stripStatementLeaks(html: string): { html: string; removed: string[] } {
  const removed: string[] = [];
  if (/<p[\s>]/i.test(html)) {
    const out = html.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (whole, inner: string) => {
      const text = plain(inner);
      if (LEAK_START.test(text)) { removed.push(text.slice(0, 80)); return ""; }
      return whole;
    });
    return { html: out, removed };
  }
  const lines = html.split("\n");
  const kept = lines.filter((line) => {
    const text = plain(line);
    if (text && LEAK_START.test(text)) { removed.push(text.slice(0, 80)); return false; }
    return true;
  });
  return { html: kept.join("\n"), removed };
}

const normAnswer = (s: string) =>
  s
    .replace(/\$|\\[a-z]+|[{}]/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*([,.])\s*/g, "$1")
    .trim()
    .toLowerCase();

/** La réponse attendue figure-t-elle déjà dans l'énoncé, comme résultat (« = 210 », « est 0,24 ») ? */
export function answerShownInStatement(html: string, answer: unknown): boolean {
  if (typeof answer !== "string") return false;
  const a = normAnswer(answer);
  // Réponses trop courtes ou non numériques : impossible de conclure sans faux positifs.
  if (a.length < 2 || !/\d/.test(a) || a.length > 25) return false;
  const text = normAnswer(plain(html));
  const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:=|≈|est (?:bien |donc |de |égal à )?)\\s*${escaped}(?![0-9])`).test(text);
}

/**
 * Correction des réponses ÉCRITES de la démonstration (page Offres).
 *
 * Aucune IA n'est appelée : la réponse est comparée à la solution (valeur de la fraction, forme simplifiée quand
 * c'est demandé) et le retour est rédigé à l'avance, dans le ton de Calia, pour montrer à quoi ressemble une
 * correction commentée. Rien ne part vers un modèle et rien n'est enregistré.
 */

interface DemoRule {
  /** Valeur attendue. */
  value: number;
  /** La réponse doit être une fraction irréductible (exercice « simplifie »). */
  irreducible?: boolean;
  right: string;
  /** Bonne valeur, mais pas sous la forme demandée. */
  form?: string;
  wrong: string;
}

const RULES: Record<string, DemoRule> = {
  "demo-b-1": {
    value: 5 / 12,
    right: "Exactement : la tablette est partagée en 12 carrés égaux (le dénominateur) et Léa en mange 5 (le numérateur).",
    wrong: "Pas tout à fait. Demande-toi d'abord : en combien de parts égales la tablette est-elle partagée ? Ce nombre va en bas de la fraction.",
  },
  "demo-b-2": {
    value: 9,
    right: "Bravo ! Pour passer de 4 à 12, on multiplie par 3 : on fait donc pareil en haut, 3 × 3 = 9.",
    wrong: "Regarde les dénominateurs : par combien faut-il multiplier 4 pour obtenir 12 ? Fais la même chose avec le numérateur.",
  },
  "demo-b-3": {
    value: 3 / 4,
    irreducible: true,
    right: "Parfait : 6 et 8 sont tous les deux divisibles par 2, et 3/4 ne se simplifie plus.",
    form: "C'est bien la même valeur, mais on peut encore simplifier : cherche un nombre qui divise à la fois le numérateur et le dénominateur.",
    wrong: "Pas encore. Cherche un nombre qui divise à la fois 6 et 8, puis divise le haut et le bas par ce nombre.",
  },
  "demo-b-4": {
    value: 3 / 4,
    right: "Juste ! Avec le même dénominateur, on additionne seulement les numérateurs : 1 + 2 = 3.",
    wrong: "Attention : quand les dénominateurs sont égaux, on ne les additionne pas. Additionne seulement les numérateurs.",
  },
};

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** Lit « 5/12 », « \frac{5}{12} », « 0,75 », « 9 »… → { value, num, den } (num/den seulement pour une fraction). */
export function parseDemoAnswer(raw: unknown): { value: number; num?: number; den?: number } | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw)
    .replace(/\$/g, "")
    .replace(/\\left|\\right|\\,|\\;|\\!|\s/g, "")
    .replace(/\\d?frac\{(-?\d+)\}\{(-?\d+)\}/g, "$1/$2")
    .replace(/^\{(.*)\}$/, "$1")
    .replace(",", ".");
  const frac = s.match(/^(-?\d+)\/(-?\d+)$/);
  if (frac) {
    const num = Number(frac[1]), den = Number(frac[2]);
    if (den === 0) return null;
    return { value: num / den, num, den };
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return { value: Number(s) };
  return null;
}

export function isDemoWrittenBlock(blockId: string): boolean {
  return blockId in RULES;
}

/** Corrige une réponse écrite de la démo ; le retour commence par « Calia : ». */
export function gradeDemoWritten(blockId: string, answer: unknown, maxPoints: number) {
  const rule = RULES[blockId];
  const parsed = parseDemoAnswer(answer);
  const sameValue = !!rule && !!parsed && Math.abs(parsed.value - rule.value) < 1e-9;
  const simplified = !rule?.irreducible || (parsed?.num !== undefined && parsed.den !== undefined && gcd(parsed.num, parsed.den) === 1);
  const ok = sameValue && simplified;
  const text = !rule ? "Je n'ai pas compris ta réponse." : ok ? rule.right : sameValue && rule.form ? rule.form : parsed ? rule.wrong : "Écris un nombre ou une fraction (par exemple 3/4), puis valide.";
  return { score: ok ? maxPoints : 0, max_score: maxPoints, is_correct: ok, feedback: `Calia : ${text}` };
}

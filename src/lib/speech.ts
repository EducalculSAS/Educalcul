/**
 * Texte « à dire » : transforme un énoncé (HTML + formules $...$) en phrases lisibles à voix haute en français.
 * Fonctions pures, utilisées par ReadAloudButton (synthèse vocale du navigateur, gratuite, instantanée).
 */

const SYMBOLS: [RegExp, string][] = [
  [/\\times|\\cdot/g, " fois "],
  [/\\div/g, " divisé par "],
  [/\\pm/g, " plus ou moins "],
  [/\\leq?|\\leqslant/g, " inférieur ou égal à "],
  [/\\geq?|\\geqslant/g, " supérieur ou égal à "],
  [/\\neq/g, " différent de "],
  [/\\approx/g, " environ égal à "],
  [/\\to|\\rightarrow/g, " tend vers "],
  [/\\Rightarrow/g, " donc "],
  [/\\infty/g, " l'infini "],
  [/\\pi/g, " pi "],
  [/\\alpha/g, " alpha "],
  [/\\beta/g, " bêta "],
  [/\\theta/g, " thêta "],
  [/\\Delta/g, " delta "],
  [/\\in\b/g, " appartient à "],
  [/\\cup/g, " union "],
  [/\\cap/g, " inter "],
  [/\\emptyset/g, " ensemble vide "],
  [/\\%/g, " pour cent "],
  [/\\degree|°/g, " degrés "],
  [/\\lim/g, " limite "],
  [/\\int/g, " intégrale "],
  [/\\sum/g, " somme "],
  [/\\ln/g, " logarithme népérien "],
  [/\\exp/g, " exponentielle "],
  [/\\sin/g, " sinus "],
  [/\\cos/g, " cosinus "],
  [/\\tan/g, " tangente "],
];

function replaceBraced(src: string, command: string, build: (arg: string) => string): string {
  const re = new RegExp(`\\\\${command}\\s*\\{([^{}]*)\\}`, "g");
  let out = src;
  let previous = "";
  while (out !== previous) {
    previous = out;
    out = out.replace(re, (_, a) => build(a));
  }
  return out;
}

/** Une formule LaTeX, dite à voix haute. */
export function mathToSpeech(latex: string): string {
  let s = latex;
  s = s.replace(/\\left|\\right|\\,|\\;|\\!|\\quad/g, " ");
  s = s.replace(/\{,\}/g, " virgule ").replace(/(\d),(\d)/g, "$1 virgule $2");
  // Fractions (imbriquées : on répète jusqu'à ce qu'il n'en reste plus).
  for (let i = 0; i < 4; i++) s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, " $1 sur $2 ");
  s = replaceBraced(s, "sqrt", (a) => ` racine de ${a} `);
  s = replaceBraced(s, "overrightarrow", (a) => ` vecteur ${a} `);
  s = replaceBraced(s, "vec", (a) => ` vecteur ${a} `);
  s = replaceBraced(s, "widehat", (a) => ` angle ${a} `);
  s = replaceBraced(s, "overline", (a) => ` ${a} barre `);
  s = replaceBraced(s, "text", (a) => ` ${a} `);
  s = replaceBraced(s, "mathrm", (a) => ` ${a} `);
  s = replaceBraced(s, "mathbb", (a) => ` ${a} `);
  s = s.replace(/\^\{?2\}?/g, " au carré ").replace(/\^\{?3\}?/g, " au cube ").replace(/\^\{([^{}]*)\}/g, " puissance $1 ").replace(/\^(\w)/g, " puissance $1 ");
  s = s.replace(/_\{([^{}]*)\}/g, " indice $1 ").replace(/_(\w)/g, " indice $1 ");
  for (const [re, word] of SYMBOLS) s = s.replace(re, word);
  s = s.replace(/=/g, " égale ").replace(/\+/g, " plus ").replace(/(\s|^)-(?=\s*\d|\s*[a-z(])/gi, "$1 moins ").replace(/</g, " inférieur à ").replace(/>/g, " supérieur à ");
  s = s.replace(/\\[a-zA-Z]+/g, " ").replace(/[{}]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "et", "&lt;": "inférieur à", "&gt;": "supérieur à", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

/** Énoncé (HTML, formules entre $...$ ou \(...\)) -> texte à lire à voix haute. */
export function speakableText(input: string): string {
  let s = String(input ?? "");
  s = s.replace(/<figure[\s\S]*?<\/figure>/gi, " (voir la figure) ").replace(/<table[\s\S]*?<\/table>/gi, " (voir le tableau) ");
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => ` ${mathToSpeech(m)} `).replace(/\$([^$]+)\$/g, (_, m) => ` ${mathToSpeech(m)} `);
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => ` ${mathToSpeech(m)} `).replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => ` ${mathToSpeech(m)} `);
  s = s.replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, ". ").replace(/<[^>]+>/g, " ");
  s = s.replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? " ");
  s = s.replace(/\{\{\d+\}\}|⟦\d+⟧|▢|…{2,}|\.{4,}|_{3,}/g, " blanc ");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\s=\s/g, " égale ").replace(/\s\+\s/g, " plus ").replace(/\s[−-]\s/g, " moins ");
  return s.replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").replace(/\.\s*\./g, ".").trim();
}

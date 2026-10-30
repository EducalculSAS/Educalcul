/**
 * Nettoyage du HTML sur le SERVEUR (rendu initial des pages, où DOMPurify n'a pas de navigateur).
 *
 * Avant, ce repli retirait seulement « <script> », les attributs « on... » précédés d'une espace et « javascript: » : un contenu comme
 * « <img/src=x/onerror=...> » passait, et il s'exécutait dès l'arrivée de la page, avant même que React ne la reprenne. Le contenu
 * des cours, exercices et quiz vient d'administrateurs ET de modèles d'IA (donc, indirectement, de textes ou de photos non maîtrisés).
 *
 * Ici, c'est une LISTE DE TAGS ET D'ATTRIBUTS AUTORISÉS : tout le reste est retiré. Les formules (KaTeX : span, svg, MathML) et les
 * figures du site passent telles quelles (voir le test d'identité sur du HTML KaTeX).
 */

const HTML_TAGS = "a abbr article aside b bdi bdo blockquote br caption cite code col colgroup dd del details dfn div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img ins kbd li main mark nav ol p pre q rp rt ruby s samp section small span strike strong sub summary sup table tbody td tfoot th thead time tr u ul var wbr";
const SVG_TAGS = "svg g path line polyline polygon rect circle ellipse text tspan defs clipPath mask marker title desc";
const MATHML_TAGS = "math semantics annotation mrow mi mo mn ms mtext mspace msup msub msubsup mfrac msqrt mroot mover munder munderover mstyle mpadded mphantom menclose mtable mtr mtd mlabeledtr maction merror mmultiscripts mprescripts none";

const ALLOWED_TAGS = new Set([...HTML_TAGS.split(" "), ...SVG_TAGS.split(" "), ...MATHML_TAGS.split(" ")].map((t) => t.toLowerCase()));

const ALLOWED_ATTRS = new Set(
  (
    "class style id title role lang dir width height alt colspan rowspan scope span start type value open datetime cite " +
    "href src target rel xmlns viewbox preserveaspectratio d x y x1 y1 x2 y2 cx cy r rx ry points transform " +
    "fill stroke opacity display focusable encoding mathvariant mathsize mathcolor mathbackground displaystyle scriptlevel " +
    "columnalign rowalign columnspacing rowspacing columnlines rowlines frame framespacing align equalrows equalcolumns " +
    "stretchy fence separator symmetric lspace rspace minsize maxsize accent accentunder linethickness depth voffset " +
    "form notation actiontype selection side movablelimits largeop bevelled numalign denomalign " +
    "text-anchor dominant-baseline clip-path mask xlink:href xml:space"
  ).split(" "),
);
const ALLOWED_ATTR_PREFIXES = ["data-", "aria-", "stroke-", "fill-", "font-", "marker-"];

const TAGS_TO_DROP_WITH_CONTENT = /<\s*(script|style|iframe|object|embed|noscript|template|textarea)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

// Caractères de contrôle, espaces et caractères invisibles (U+0000-0020, U+007F-009F, U+200B-200F, U+2028-2029, U+FEFF), écrits en échappements ASCII.
const INVISIBLE_CHARS = new RegExp("[\\u0000-\\u0020\\u007f-\\u009f\\u200b-\\u200f\\u2028\\u2029\\ufeff]", "g");

/** Entités numériques et caractères de contrôle retirés avant de juger une adresse (« java&#x73;cript: », « java\tscript: »). */
function normalizeUrl(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (_m, d: string) => String.fromCodePoint(Math.min(parseInt(d, 10), 0x10ffff)))
    .replace(/&(colon|tab|newline);?/gi, (_m, n: string) => (n.toLowerCase() === "colon" ? ":" : ""))
    .replace(INVISIBLE_CHARS, "")
    .toLowerCase();
}

function isSafeUrl(value: string, attr: string, tag: string): boolean {
  const url = normalizeUrl(value);
  if (url === "" || url.startsWith("#") || url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) return true;
  if (/^(https?:|mailto:|tel:)/.test(url)) return true;
  // Image intégrée : seulement pour <img src>, et seulement un vrai format d'image (jamais data:text/html ni data:image/svg+xml).
  if (tag === "img" && attr === "src" && /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]*$/.test(url)) return true;
  // Pas de schéma du tout (« page.html », « ?a=1 »).
  return !/^[a-z][a-z0-9+.-]*:/.test(url);
}

function isSafeStyle(value: string): boolean {
  const v = normalizeUrl(value);
  return !/(expression\(|url\(|@import|behavior:|-moz-binding|javascript:|vbscript:|<|>)/.test(v);
}

function escapeAttr(value: string): string {
  return value.replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const ATTR_PATTERN = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function cleanTag(closing: boolean, rawName: string, rawAttrs: string, selfClosing: boolean): string {
  const name = rawName.toLowerCase();
  if (!ALLOWED_TAGS.has(name)) return "";
  // La casse d'origine est conservée : en SVG, « viewBox » et « clipPath » en dépendent.
  if (closing) return `</${rawName}>`;
  const kept: string[] = [];
  for (const match of rawAttrs.matchAll(ATTR_PATTERN)) {
    const attr = match[1].toLowerCase();
    const attrName = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (attr.startsWith("on")) continue;
    if (!ALLOWED_ATTRS.has(attr) && !ALLOWED_ATTR_PREFIXES.some((p) => attr.startsWith(p))) continue;
    if ((attr === "href" || attr === "src" || attr === "xlink:href") && !isSafeUrl(value, attr, name)) continue;
    if (attr === "style" && !isSafeStyle(value)) continue;
    // Un lien qui s'ouvre dans un autre onglet ne doit pas pouvoir piloter la page d'origine.
    kept.push(match[2] === undefined && match[3] === undefined && match[4] === undefined ? attrName : `${attrName}="${escapeAttr(value)}"`);
  }
  if (name === "a" && kept.some((a) => a.startsWith("target="))) {
    if (!kept.some((a) => a.startsWith("rel="))) kept.push('rel="noopener noreferrer"');
  }
  // « <path ... /> » : en SVG la barre finale referme l'élément (sans elle, les éléments suivants se retrouvent dedans).
  return `<${rawName}${kept.length ? ` ${kept.join(" ")}` : ""}${selfClosing ? "/" : ""}>`;
}

/** HTML quelconque → HTML ne contenant que des tags et attributs autorisés. */
export function sanitizeHtmlServer(html: string): string {
  let input = String(html ?? "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  // Le contenu de <script>, <style>, <iframe>... n'a rien à faire dans la page : retiré avec ses balises.
  input = input.replace(TAGS_TO_DROP_WITH_CONTENT, "");
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g;
  let out = "";
  let last = 0;
  for (const match of input.matchAll(tag)) {
    out += escapeText(input.slice(last, match.index));
    out += cleanTag(match[1] === "/", match[2], match[3], match[0].endsWith("/>"));
    last = (match.index ?? 0) + match[0].length;
  }
  out += escapeText(input.slice(last));
  return out;
}

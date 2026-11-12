/**
 * Filtre AVANT publication du forum (sujets, réponses, modifications). Des élèves mineurs y écrivent : un message
 * est refusé s'il contient des coordonnées personnelles (e-mail, téléphone, lien, pseudo de réseau social, adresse),
 * une invitation à se retrouver ailleurs, ou une insulte. L'auteur voit pourquoi et peut corriger son message. Le
 * signalement après coup et la modération restent en place : ce filtre arrête le plus courant, pas tout.
 */

/** Texte ramené à une forme comparable : minuscules, sans accents, chiffres-lettres usuels remis en lettres. */
function flatten(text: string): string {
  return text
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[0@4]/g, (c) => (c === "0" ? "o" : "a"))
    .replace(/[1|]/g, "i").replace(/(?<=[a-z])!(?=[a-z])/g, "i") // un « ! » en fin de phrase reste de la ponctuation
    .replace(/3/g, "e").replace(/[$5]/g, "s").replace(/7/g, "t");
}

/** Lettres répétées ramenées à une seule (« nigggggaa » → « niga », « connnard » → « conard ») : sert à comparer mot à mot. */
const squeeze = (s: string) => s.replace(/(.)\1+/g, "$1");

const INSULTS = [
  "connard", "connasse", "conard", "conasse", "con", "conne", "salope", "salaud", "pute", "putain", "encule", "enculer",
  "batard", "batarde", "fdp", "ntm", "tg", "ta gueule", "nique", "niquer", "merde", "debile", "abruti", "abrutie", "cretin",
  "cretine", "idiot", "idiote", "imbecile", "tocard", "bouffon", "bouffonne", "pd", "pede", "tapette", "gouine",
  "negre", "bougnoule", "youpin", "sale arabe", "sale noir", "sale juif", "sale blanc", "grosse vache", "gros porc",
  "suicide toi", "va mourir", "creve", "bite", "couille", "chatte", "cul", "sexe", "porno", "nude", "nudes",
  "nigga", "niga", "nigger", "negro", "negresse", "bamboula", "bicot", "chinetoque", "raton", "feuj", "youtre",
  "tarlouze", "tafiole", "pedale", "travelo", "trisomique", "mongol", "mongolien", "attarde", "handicape de merde",
  "pouffiasse", "petasse", "grognasse", "trainee", "catin", "fils de pute", "nique ta mere", "ta mere la pute", "va te faire foutre",
  "branleur", "branleuse", "trou du cul", "trouduc", "couillon", "chier", "chiant", "bordel", "zob", "teub", "queue", "sucer", "suce",
  "fuck", "fucking", "shit", "bitch", "asshole", "dick", "pussy", "whore", "slut", "cunt", "faggot", "kys",
];
/** Lettres isolées séparées pour passer le filtre (« c.o.n.n.a.r.d », « s a l o p e ») : on les recolle. */
const unspace = (s: string) => s.replace(/(?<![a-z])(?:[a-z][\s._*\-]+){2,}[a-z](?![a-z])/g, (m) => m.replace(/[\s._*\-]+/g, ""));
const pattern = (words: string[]) => new RegExp(`(^|[^a-z])(${words.map((w) => w.replace(/ /g, "\\s+")).join("|")})s?($|[^a-z])`);
const INSULT_RE = pattern(INSULTS);
/** Les mêmes mots, lettres doublées retirées : comparés au texte lui aussi « resserré ». */
// « niger » (forme resserrée de l'insulte) est aussi un pays : il est traité à part, avec ses lettres étirées.
const INSULT_SQUEEZED_RE = pattern([...new Set(INSULTS.map(squeeze))].filter((w) => w !== "niger"));
const STRETCHED_RE = /(^|[^a-z])n+i+g{2,}(a+|e+r+)s?($|[^a-z])/;

/** Un mot interdit s'y trouve-t-il, écrit normalement, avec des lettres étirées ou des séparateurs entre les lettres ? */
function hasInsult(flat: string): boolean {
  const found = (t: string) => INSULT_RE.test(t) || STRETCHED_RE.test(t) || INSULT_SQUEEZED_RE.test(squeeze(t));
  if (found(flat)) return true;
  const glued = unspace(flat);
  return glued !== flat && found(glued);
}

const EMAIL_RE = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\barobase\b)\s*[a-z0-9.-]+\s*(\.|\bpoint\b)\s*[a-z]{2,}/i;
const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]{2,}\.(com|fr|net|org|io|gg|me|tv|app|xyz|be|ch|co)\b/i;
/** Numéro de téléphone français (06 12 34 56 78, +33 6…, 0612345678) ou toute suite de 9 chiffres et plus. */
const PHONE_RE = /(\+33|0033|\b0)\s*[1-9](?:[\s.-]*\d{2}){4}\b|\b\d[\d\s.-]{8,}\d\b/;
const SOCIAL_RE = /\b(snap(chat)?|insta(gram)?|tik\s?tok|discord|whatsapp|telegram|messenger|facebook|skype|twitch|kik)\b/i;
const HANDLE_RE = /(^|\s)@[a-z0-9._]{3,}/i;
const MEETUP_RE = /\b(ajoute[- ]moi|add me|viens en (prive|mp|dm)|en (mp|dm)\b|mon (numero|num|tel|06|07)|ton (numero|num|tel|06|07|adresse)|j'habite|mon adresse|on se voit|rejoins[- ]moi)/i;

export type ForumFilterIssue = "contact" | "insulte";

/** null si le texte peut être publié, sinon la raison du refus. */
export function forumTextIssue(text: string): ForumFilterIssue | null {
  if (!text) return null;
  const flat = flatten(text);
  if (EMAIL_RE.test(text) || URL_RE.test(text) || PHONE_RE.test(text) || SOCIAL_RE.test(flat) || HANDLE_RE.test(text) || MEETUP_RE.test(flat)) return "contact";
  if (hasInsult(flat)) return "insulte";
  return null;
}

export const FORUM_FILTER_MESSAGE: Record<ForumFilterIssue, string> = {
  contact: "Pour la sécurité de tous, on ne partage pas de coordonnées ici : pas d'e-mail, de numéro, de lien ni de pseudo d'un autre réseau. Retire-les pour publier.",
  insulte: "Ce message contient des mots qui ne respectent pas les règles du forum. Reformule-le pour publier.",
};

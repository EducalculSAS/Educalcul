/**
 * Dates affichées dans les pages rendues d'abord côté serveur : même texte partout.
 * `toLocaleDateString("fr-FR", { month: "short", hour… })` ne donne pas le même texte selon le moteur (Node côté serveur,
 * Safari ou Chrome côté navigateur : « 05 nov., 13:38 » ou « 05 nov. à 13:38 »), ce qui provoque une erreur
 * d'hydratation React (#418). Ici, seuls des chiffres sont lus du moteur ; les mois sont écrits en dur.
 */
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris", day: "numeric", month: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
});

function parisParts(date: Date) {
  const get = (type: string) => Number(partsFormatter.formatToParts(date).find((p) => p.type === type)?.value ?? NaN);
  return { day: get("day"), month: get("month"), hour: get("hour"), minute: get("minute") };
}

/** « 05 nov. » ou, avec `time`, « 05 nov. 13:38 » (heure de Paris). `pad` : jour sur 2 chiffres. */
export function formatParisDayMonth(value: string | number | Date, { time = false, pad = true }: { time?: boolean; pad?: boolean } = {}): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const { day, month, hour, minute } = parisParts(date);
  const two = (n: number) => String(n).padStart(2, "0");
  const base = `${pad ? two(day) : day} ${MONTHS[month - 1]}`;
  return time ? `${base} ${two(hour)}:${two(minute)}` : base;
}

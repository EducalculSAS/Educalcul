import "server-only";

/**
 * Vacances scolaires officielles, lues sur l'open data du ministère
 * (data.education.gouv.fr, jeu « fr-en-calendrier-scolaire »). Sert à l'import
 * en un clic depuis l'admin : plus besoin de saisir chaque zone à la main.
 *
 * Particularités du jeu de données :
 * - une ligne par académie : on regroupe par zone et on garde la variante
 *   majoritaire (quelques académies ont des dates propres) ;
 * - start_date = minuit (heure de Paris) du premier jour de vacances,
 *   end_date = minuit du jour de reprise → le dernier jour est la veille ;
 *   pour un « pont », les deux dates sont égales et désignent le jour chômé ;
 * - les lignes « Enseignants » sont ignorées (on garde élèves / « - »).
 */

const DATASET =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

const ZONE_MAP: Record<string, string> = {
  "Zone A": "A",
  "Zone B": "B",
  "Zone C": "C",
  Corse: "corse",
  Guadeloupe: "guadeloupe",
  Guyane: "guyane",
  Martinique: "martinique",
  Mayotte: "mayotte",
  "Nouvelle Calédonie": "nouvelle_caledonie",
  "Nouvelle-Calédonie": "nouvelle_caledonie",
  Polynésie: "polynesie",
  Réunion: "reunion",
};

export interface OfficialHoliday {
  import_key: string;
  zone: string;
  title: string;
  start_date: string;
  end_date: string;
}

/** Date calendaire à Paris d'un horodatage ISO du jeu de données. */
function parisDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function isSchoolYear(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{4}$/.test(value)) return false;
  const [a, b] = value.split("-").map(Number);
  return b === a + 1 && a >= 2020 && a <= 2040;
}

export async function fetchOfficialHolidays(schoolYear: string): Promise<OfficialHoliday[]> {
  if (!isSchoolYear(schoolYear)) throw new Error("Année scolaire invalide");
  const params = new URLSearchParams({
    select: "description,population,zones,start_date,end_date,count(*) as n",
    group_by: "description,population,zones,start_date,end_date",
    where: `annee_scolaire="${schoolYear}"`,
    limit: "100",
  });
  const res = await fetch(`${DATASET}?${params}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error("Le calendrier officiel est momentanément indisponible");
  const json = (await res.json()) as {
    results?: { description: string; population: string; zones: string; start_date: string; end_date: string; n: number }[];
  };

  // Variante majoritaire par (zone, intitulé).
  const best = new Map<string, { title: string; zone: string; start: string; end: string; n: number }>();
  for (const r of json.results ?? []) {
    const zone = ZONE_MAP[r.zones?.trim()];
    if (!zone || r.population === "Enseignants" || !r.start_date || !r.end_date) continue;
    const title = r.description.trim();
    const key = `${zone}|${title}`;
    const prev = best.get(key);
    if (!prev || r.n > prev.n) best.set(key, { title, zone, start: r.start_date, end: r.end_date, n: r.n });
  }

  return [...best.values()]
    .map(({ title, zone, start, end }) => {
      const first = parisDay(start);
      const back = parisDay(end);
      const last = back > first ? previousDay(back) : first;
      return {
        import_key: `officiel:${schoolYear}:${zone}:${title.toLowerCase()}`,
        zone,
        title,
        start_date: first,
        end_date: last,
      };
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.zone.localeCompare(b.zone));
}

/**
 * Thème du site (saisonnier), indépendant du mode clair/sombre : Noël, Pâques, Coupe du monde, Halloween… Il change les
 * couleurs d'accent, la couleur principale des boutons et ajoute une animation légère (flocons, œufs, ballons, chauves-souris).
 * « Automatique » suit le calendrier. Mémorisé dans le navigateur (appliqué avant le premier affichage, voir
 * SEASON_INIT_SCRIPT) et sur le compte (users.season_preference). Couleurs dans globals.css (html[data-season]).
 */
export const SEASONS = ["classique", "noel", "paques", "foot", "halloween"] as const;
export type Season = (typeof SEASONS)[number];
export type SeasonPreference = Season | "auto";
export const SEASON_KEY = "educalcul-season";

export const SEASON_LABEL: Record<SeasonPreference, string> = {
  auto: "Automatique",
  classique: "Classique",
  noel: "Noël",
  paques: "Pâques",
  foot: "Coupe du monde",
  halloween: "Halloween",
};
export const SEASON_HINT: Record<SeasonPreference, string> = {
  auto: "Suit le calendrier : Noël en décembre, Pâques, la Coupe du monde, Halloween…",
  classique: "Les couleurs habituelles d'Educalcul, sans animation de saison.",
  noel: "Flocons de neige, rouge et vert sapin.",
  paques: "Œufs et pétales, couleurs pastel.",
  foot: "Ballons et vert pelouse, pour les grandes compétitions.",
  halloween: "Chauves-souris, orange citrouille et violet nuit.",
};

/**
 * Le thème de saison ne concerne que les espaces connectés (parent, élève, admin), comme le mode sombre : les pages
 * publiques (accueil, offres, tarifs, programmes, Calia, À propos…) gardent toujours les couleurs habituelles
 * d'Educalcul, sans animation, quel que soit le choix de la personne.
 */
const SEASON_PREFIXES = ["/parent", "/child", "/admin", "/dashboard"] as const;
export const isSeasonPath = (pathname: string | null | undefined) =>
  !!pathname && SEASON_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

export const isSeasonPreference = (v: unknown): v is SeasonPreference => v === "auto" || (SEASONS as readonly string[]).includes(v as string);

/**
 * Saison du calendrier pour une date (fonction AUTONOME : elle est aussi recopiée telle quelle dans le script
 * d'initialisation, d'où l'absence de dépendance).
 */
export function seasonForDate(d: Date): Season {
  const y = d.getFullYear();
  const day = (m: number, dd: number) => new Date(y, m - 1, dd).getTime();
  const t = new Date(y, d.getMonth(), d.getDate()).getTime();
  // Noël : 1er décembre → 6 janvier (Épiphanie)
  if (t >= day(12, 1) || t <= day(1, 6)) return "noel";
  // Pâques (algorithme de Meeus) : de 7 jours avant à 7 jours après
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), dayOfMonth = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = day(month, dayOfMonth), week = 7 * 86400000;
  if (t >= easter - week && t <= easter + week) return "paques";
  // Grandes compétitions de football (Coupe du monde, Euro)
  const foot: [string, string][] = [["2026-06-11", "2026-07-19"], ["2028-06-09", "2028-07-09"], ["2030-06-08", "2030-07-21"]];
  for (const [from, to] of foot) {
    const [fy, fm, fd] = from.split("-").map(Number), [ty, tm, td] = to.split("-").map(Number);
    if (t >= new Date(fy, fm - 1, fd).getTime() && t <= new Date(ty, tm - 1, td).getTime()) return "foot";
  }
  // Halloween : 20 octobre → 2 novembre
  if (t >= day(10, 20) && t <= day(11, 2)) return "halloween";
  return "classique";
}

export const resolveSeason = (pref: SeasonPreference, now: Date = new Date()): Season => (pref === "auto" ? seasonForDate(now) : pref);

export function readStoredSeason(): SeasonPreference {
  try {
    const v = localStorage.getItem(SEASON_KEY);
    return isSeasonPreference(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

/** Thème réellement affiché sur cette page : la préférence, mais seulement dans les espaces connectés. */
export function syncSeasonToPath(pathname: string = window.location.pathname) {
  const s = isSeasonPath(pathname) ? resolveSeason(readStoredSeason()) : "classique";
  if (s === "classique") document.documentElement.removeAttribute("data-season");
  else document.documentElement.setAttribute("data-season", s);
  window.dispatchEvent(new CustomEvent("educalcul:season", { detail: s }));
}

/** Mémorise le choix dans ce navigateur puis l'applique à la page courante. */
export function applySeason(pref: SeasonPreference) {
  try { localStorage.setItem(SEASON_KEY, pref); } catch { /* navigation privée */ }
  syncSeasonToPath();
}

/** Script d'initialisation (boot-script) : applique le thème mémorisé avant le premier affichage. */
export const SEASON_INIT_SCRIPT = `try{if(/^\\/(parent|child|admin|dashboard)(\\/|$)/.test(location.pathname)){var sp=localStorage.getItem("${SEASON_KEY}")||"auto";var sf=${seasonForDate.toString()};var ss=sp==="auto"?sf(new Date()):sp;if(ss&&ss!=="classique"&&/^(noel|paques|foot|halloween)$/.test(ss))document.documentElement.setAttribute("data-season",ss)}}catch(e){}`;

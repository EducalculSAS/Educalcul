// Périodes de facturation des formules : un seul endroit qui sait ce que « trimestriel » ou « 2 mois » veut dire
// (durée en mois, suffixe de prix, récurrence Stripe, jours d'abonnement). Aucun accès base : importable côté client
// comme côté serveur.
//
// Une période est identifiée par `billing_interval` dans `subscription_plans` :
// - les quatre historiques : month (1), quarter (3), semester (6), year (12) ;
// - une durée libre : `m<N>` pour N mois (m2 = bimestriel, m18 = 18 mois…), la durée se lit dans l'identifiant,
//   donc aucun autre champ n'est nécessaire ;
// - one_time : paiement unique (jamais un onglet de période).

export interface BillingPeriod {
  id: string;
  label: string;
  months: number;
}

export const MAX_PERIOD_MONTHS = 36; // plafond Stripe : 3 ans

const BUILT_IN: Record<string, { months: number; label: string; suffix: string }> = {
  month: { months: 1, label: "Mensuel", suffix: "/mois" },
  quarter: { months: 3, label: "Trimestriel", suffix: "/trimestre" },
  semester: { months: 6, label: "Semestriel", suffix: "/semestre" },
  year: { months: 12, label: "Annuel", suffix: "/an" },
};

export const DEFAULT_PERIODS: BillingPeriod[] = Object.entries(BUILT_IN).map(([id, p]) => ({ id, label: p.label, months: p.months }));

export const ONE_TIME = "one_time";

/** Durée en mois d'une période (null pour le paiement unique ou un identifiant inconnu). */
export function monthsOfPeriod(id: string | null | undefined): number | null {
  if (!id) return 1;
  if (BUILT_IN[id]) return BUILT_IN[id].months;
  const m = /^m(\d{1,3})$/.exec(id);
  if (m) {
    const n = Number(m[1]);
    return n >= 1 && n <= MAX_PERIOD_MONTHS ? n : null;
  }
  return null;
}

/** Identifiant pour une durée en mois : réutilise les noms historiques (3 → quarter…), sinon `m<N>`. */
export function periodIdForMonths(months: number): string {
  const n = Math.round(months);
  const builtIn = Object.entries(BUILT_IN).find(([, p]) => p.months === n);
  return builtIn ? builtIn[0] : `m${n}`;
}

export function isValidPeriodId(id: string): boolean {
  return monthsOfPeriod(id) !== null && id !== ONE_TIME;
}

/** Nom par défaut : « Mensuel », « Trimestriel »… ou « 2 mois », « 18 mois ». */
export function defaultPeriodLabel(id: string): string {
  if (id === ONE_TIME) return "Paiement unique";
  if (BUILT_IN[id]) return BUILT_IN[id].label;
  const n = monthsOfPeriod(id);
  return n ? `${n} mois` : id;
}

/** Suffixe affiché après un prix : « /mois », « /trimestre », « /2 mois »… */
export function periodSuffix(id: string | null | undefined): string {
  if (!id) return "/mois";
  if (id === ONE_TIME) return "";
  if (BUILT_IN[id]) return BUILT_IN[id].suffix;
  const n = monthsOfPeriod(id);
  return n ? `/${n} mois` : "/mois";
}

/** « mois », « trimestre », « an », « 2 mois », « à vie » : pour « 9 € / mois » dans les tableaux d'admin. */
export function periodUnit(id: string | null | undefined): string {
  if (id === ONE_TIME) return "à vie";
  return periodSuffix(id).replace(/^\//, "");
}

/** Récurrence Stripe : un multiple de 12 mois est facturé « par année », le reste « par mois ». */
export function recurringFor(id: string | null | undefined): { interval: "month" | "year"; interval_count: number } {
  const months = monthsOfPeriod(id) ?? 1;
  if (months % 12 === 0) return { interval: "year", interval_count: months / 12 };
  return { interval: "month", interval_count: months };
}

/** Durée approximative en jours (accès offert, réparation manuelle d'un abonnement). */
export function periodDays(id: string | null | undefined): number {
  if (id === ONE_TIME) return 36500;
  const months = monthsOfPeriod(id) ?? 1;
  if (months === 12) return 365;
  if (months === 6) return 182;
  return months * 30;
}

/** Tri : durée croissante, le paiement unique en dernier. */
export function comparePeriods(a: string, b: string): number {
  const ma = monthsOfPeriod(a) ?? Infinity;
  const mb = monthsOfPeriod(b) ?? Infinity;
  return ma - mb;
}

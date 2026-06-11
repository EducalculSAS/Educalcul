// Vacances scolaires françaises (Zone C) — années 2025-2026 et 2026-2027
// Source: dates officielles du ministère de l'Éducation nationale.
// Utilisées comme événements virtuels (non stockés en base) sur le calendrier.

export interface SchoolHoliday {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD (inclus)
  end_date: string;   // YYYY-MM-DD (inclus)
}

export const SCHOOL_HOLIDAYS: SchoolHoliday[] = [
  // 2025-2026
  { id: "toussaint-2025", title: "Vacances de la Toussaint", start_date: "2025-10-18", end_date: "2025-11-02" },
  { id: "noel-2025", title: "Vacances de Noël", start_date: "2025-12-20", end_date: "2026-01-04" },
  { id: "hiver-2026", title: "Vacances d'hiver", start_date: "2026-02-21", end_date: "2026-03-08" },
  { id: "printemps-2026", title: "Vacances de printemps", start_date: "2026-04-18", end_date: "2026-05-03" },
  { id: "ete-2026", title: "Vacances d'été", start_date: "2026-07-04", end_date: "2026-08-31" },
  // 2026-2027
  { id: "toussaint-2026", title: "Vacances de la Toussaint", start_date: "2026-10-17", end_date: "2026-11-01" },
  { id: "noel-2026", title: "Vacances de Noël", start_date: "2026-12-19", end_date: "2027-01-03" },
];

// Renvoie les vacances qui chevauchent l'intervalle [from, to] (dates ISO yyyy-mm-dd)
export function getHolidaysInRange(from: string, to: string): SchoolHoliday[] {
  return SCHOOL_HOLIDAYS.filter(h => h.start_date <= to && h.end_date >= from);
}

/**
 * Domaines (« Algèbre », « Géométrie »...) proposés pour classer les cours et guider la génération.
 * La liste est modifiable par l'admin (table app_settings, clé « subject_areas ») ; sans valeur enregistrée, ces défauts s'appliquent.
 */
export const DEFAULT_SUBJECT_AREAS = ["Algèbre", "Géométrie", "Statistiques", "Arithmétique", "Fonctions", "Probabilités", "Mesures", "Logique"];

export const SUBJECT_AREAS_KEY = "subject_areas";
const MAX_AREAS = 40;
const MAX_LENGTH = 40;

/** Nettoie une liste de domaines : texte seul, espaces rognés, sans doublon (casse ignorée), bornée ; défauts si vide. */
export function normalizeSubjectAreas(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "string") continue;
      const name = item.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= MAX_AREAS) break;
    }
  }
  return out.length > 0 ? out : [...DEFAULT_SUBJECT_AREAS];
}

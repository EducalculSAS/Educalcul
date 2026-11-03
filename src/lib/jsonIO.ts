/** Export an item as a downloadable JSON file */

/** Contenu importé depuis un fichier JSON (cours, exercice ou quiz exporté, ou rédigé à la main). Tous les champs sont facultatifs : le fichier n'est jamais de confiance. */
export interface ImportedContent {
  _type?: string;
  id?: string | number;
  title?: string;
  description?: string;
  course_id?: string | number;
  folder_id?: string | number;
  time_limit_minutes?: number;
  time_limit?: number;
  min_score_percent?: number;
  difficulty_level?: string;
  type?: string;
  level?: string;
  grading_type?: "auto" | "ai" | "manual";
  max_attempts?: number;
  status?: "published" | "draft" | "archived";
  estimated_time?: number;
  subject?: string;
  thumbnail_url?: string;
  content_json?: unknown;
  [key: string]: unknown;
}
export function exportAsJSON(data: object, type: string, title: string) {
  const payload = { _type: type, _version: "1", _exported_at: new Date().toISOString(), ...data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}_${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Read a JSON file from an <input type="file"> change event and return parsed data */
export function importFromJSONFile(file: File): Promise<ImportedContent> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch {
        reject(new Error("Fichier JSON invalide"));
      }
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsText(file);
  });
}

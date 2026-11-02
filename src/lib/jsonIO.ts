/** Export an item as a downloadable JSON file */
import type { Loose } from "@/types/loose";
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
export function importFromJSONFile(file: File): Promise<Loose> {
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

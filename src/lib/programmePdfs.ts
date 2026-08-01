import { supabaseAdmin } from "@/lib/supabaseClient";

export interface DbProgrammePdf {
  file_url: string;
  file_name: string;
}

/**
 * Partagé entre la route /api/programmes et la page /programmes (rendu
 * serveur) : évite un aller-retour client vers notre propre API pour
 * récupérer des PDF qui ne changent presque jamais.
 */
export async function fetchProgrammePdfs(): Promise<Record<string, DbProgrammePdf>> {
  const { data, error } = await supabaseAdmin
    .from("programme_pdfs")
    .select("*")
    .order("level");
  if (error || !data) return {};

  const map: Record<string, DbProgrammePdf> = {};
  for (const row of data) {
    if (row?.level) {
      map[row.level] = { file_url: row.file_url, file_name: row.file_name };
    }
  }
  return map;
}

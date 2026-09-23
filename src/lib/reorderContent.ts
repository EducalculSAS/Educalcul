import "server-only";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * Enregistre l'ordre d'éléments d'un même dossier (exercices ou quiz), tel
 * que l'admin l'a arrangé : display_order = (rang + 1) × 10, l'écart laissant
 * la place d'insérer un élément sans tout renuméroter.
 */
export async function reorderInFolder(table: "exercises" | "quizzes", ids: unknown): Promise<{ error: string; status: number } | { ok: true; count: number }> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) return { error: "orderedIds invalide", status: 400 };
  const clean = ids.map(String);
  if (clean.some((id) => !/^\d{1,12}$/.test(id)) || new Set(clean).size !== clean.length) {
    return { error: "orderedIds invalide", status: 400 };
  }
  const { data: rows, error } = await supabaseAdmin.from(table).select("id, folder_id").in("id", clean);
  if (error) throw error;
  if (!rows || rows.length !== clean.length) return { error: "Élément introuvable", status: 404 };
  if (new Set(rows.map((r) => r.folder_id ?? "root")).size > 1) {
    return { error: "Les éléments doivent appartenir au même dossier", status: 400 };
  }
  const results = await Promise.all(
    clean.map((id, i) => supabaseAdmin.from(table).update({ display_order: (i + 1) * 10 }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
  return { ok: true, count: clean.length };
}

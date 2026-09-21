import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { folderTable, pickFolderFields } from "@/lib/contentFolders";

const SELECT = "id, name, parent_id, status, color, icon, grade_level, display_order, is_system";

/** Liste PLATE de tous les dossiers du type demandé — le client filtre par
 * parent, construit le fil d'Ariane et les compteurs localement (petits
 * volumes). Remplace les 2 requêtes `supabase.from()` du composant admin. */
export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    if (!(await requireRole(req, ["admin"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const table = folderTable((await params).type);
    if (!table) return NextResponse.json({ error: "Type inconnu" }, { status: 404 });

    // Plafond par défaut de 1000 lignes Supabase/PostgREST (voir
    // src/app/admin/exercises/page.tsx) : exercise_folders/quiz_folders
    // avoisinent déjà les 773 lignes (16 racines + 1 sous-dossier par cours)
    // suite à l'import de masse — pagination par précaution avant que ça ne
    // dépasse silencieusement 1000.
    const pageSize = 1000;
    const data: any[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data: page, error } = await supabaseAdmin
        .from(table)
        .select(SELECT)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      data.push(...(page ?? []));
      if (!page || page.length < pageSize) break;
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    if (!(await requireRole(req, ["admin"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const table = folderTable((await params).type);
    if (!table) return NextResponse.json({ error: "Type inconnu" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const fields = pickFolderFields(body);
    if (typeof fields.name !== "string" || !fields.name.trim()) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }
    fields.name = fields.name.trim();

    const { data, error } = await supabaseAdmin.from(table).insert(fields).select(SELECT).single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

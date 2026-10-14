import { NextResponse } from "next/server";
import { invalidateCatalog } from "@/lib/catalogCache";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { folderTable, pickFolderFields, isSelfOrDescendant } from "@/lib/contentFolders";

const SELECT = "id, name, parent_id, status, color, icon, grade_level, display_order, is_system";

export async function PATCH(req: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    if (!(await requireRole(req, ["admin"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { type, id } = await params;
    const table = folderTable(type);
    if (!table) return NextResponse.json({ error: "Type inconnu" }, { status: 404 });
    const folderId = Number(id);
    if (!Number.isFinite(folderId)) return NextResponse.json({ error: "id invalide" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const fields = pickFolderFields(body);
    if ("name" in fields) {
      if (typeof fields.name !== "string" || !fields.name.trim()) {
        return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
      }
      fields.name = fields.name.trim();
    }

    // Déplacement : refuser un cycle (dossier dans lui-même ou un descendant).
    if ("parent_id" in fields) {
      const target = fields.parent_id === null ? null : Number(fields.parent_id);
      if (target !== null && !Number.isFinite(target)) {
        return NextResponse.json({ error: "parent_id invalide" }, { status: 400 });
      }
      if (target === folderId || (target !== null && await isSelfOrDescendant(table, folderId, target))) {
        return NextResponse.json({ error: "Déplacement impossible : cycle de dossiers." }, { status: 409 });
      }
      fields.parent_id = target;
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from(table).update(fields).eq("id", folderId).select(SELECT).single();
    if (error) throw error;
    invalidateCatalog();
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  try {
    if (!(await requireRole(req, ["admin"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { type, id } = await params;
    const table = folderTable(type);
    if (!table) return NextResponse.json({ error: "Type inconnu" }, { status: 404 });

    const { error } = await supabaseAdmin.from(table).delete().eq("id", Number(id));
    if (error) throw error;
    invalidateCatalog();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

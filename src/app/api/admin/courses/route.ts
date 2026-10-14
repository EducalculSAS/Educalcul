import { supabaseAdmin } from "@/lib/supabaseClient";
import { applyFolderFilter, parseFolderParam } from "@/lib/adminFolderFilter";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { invalidateCatalog } from "@/lib/catalogCache";

export async function GET(request: Request) {
  try {
    // Défense en profondeur (le proxy l'exige déjà) : cette lecture n'avait
    // AUCUNE vérification propre, et renvoie tout le contenu non publié.
    if (!(await requireRole(request, ["admin"]))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const folder = parseFolderParam(searchParams.get("folder"));
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    }

    // Liste : pas de content_json (potentiellement volumineux) — chaque
    // carte n'affiche que ces champs ; le contenu complet est rechargé à la
    // demande (édition/aperçu/export) via ?id=.
    //
    // Même plafond par défaut de 1000 lignes que /api/admin/exercises (voir
    // son commentaire) — courses est encore sous ce seuil aujourd'hui, mais
    // on pagine par précaution.
    const pageSize = 1000;
    const data: unknown[] = [];
    for (let from = 0; ; from += pageSize) {
      let query = supabaseAdmin
        .from("courses")
        .select("id, title, description, subject, level, thumbnail_url, status, folder_id, estimated_time, chapter_order, created_at, updated_at")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      query = applyFolderFilter(query, folder);

      const { data: page, error } = await query;

      if (error) {
        return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
      }

      data.push(...(page ?? []));
      if (!page || page.length < pageSize) break;
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error fetching courses:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      title,
      description,
      subject,
      level,
      status,
      thumbnail_url,
      folder_id,
      content_json,
      estimated_time,
    } = body;

    const { data, error } = await supabaseAdmin
      .from("courses")
      .insert({
        title,
        description,
        subject,
        level: level || "6eme",
        status: status || "draft",
        thumbnail_url,
        folder_id: folder_id || null,
        content_json: content_json || [],
        estimated_time: estimated_time ?? 15,
        is_published: status === "published",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    invalidateCatalog();

    await auditLog({
      action: data.status === "published" ? AuditAction.CONTENT_PUBLISHED : AuditAction.CONTENT_CREATED,
      adminId: admin.id,
      targetType: "course",
      targetId: String(data.id),
      details: { title: data.title, status: data.status },
    }, request);

    return NextResponse.json({ success: true, course: data });
  } catch (error: unknown) {
    console.error("Error creating course:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      id,
      title,
      description,
      subject,
      level,
      status,
      thumbnail_url,
      folder_id,
      content_json,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 }
      );
    }

    // Build a partial update: only include fields whose keys are present in the body.
    // This prevents a folder move ({ id, folder_id }) from wiping title/content/etc.
    const updatePayload: Record<string, unknown> = {};
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    if (has("title")) updatePayload.title = title;
    if (has("description")) updatePayload.description = description;
    if (has("subject")) updatePayload.subject = subject;
    if (has("level")) updatePayload.level = level;
    if (has("status")) {
      updatePayload.status = status;
      updatePayload.is_published = status === "published";
    }
    if (has("thumbnail_url")) updatePayload.thumbnail_url = thumbnail_url;
    if (has("folder_id")) updatePayload.folder_id = folder_id || null;
    if (has("estimated_time")) updatePayload.estimated_time = body.estimated_time ?? 15;
    if (has("content_json")) updatePayload.content_json = content_json || [];

    const { data, error } = await supabaseAdmin
      .from("courses")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    invalidateCatalog();

    await auditLog({
      action: has("status") && status === "published" ? AuditAction.CONTENT_PUBLISHED : AuditAction.CONTENT_UPDATED,
      adminId: admin.id,
      targetType: "course",
      targetId: String(id),
      details: { title: data.title, status: data.status, updatedFields: Object.keys(updatePayload) },
    }, request);

    return NextResponse.json({ success: true, course: data });
  } catch (error: unknown) {
    console.error("Error updating course:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
    const admin = await requireRole(request, ["admin"]);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("courses")
      .select("title")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("courses").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    invalidateCatalog();

    await auditLog({
      action: AuditAction.CONTENT_DELETED,
      adminId: admin.id,
      targetType: "course",
      targetId: id,
      details: { title: existing?.title ?? null },
    }, request);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(error)) }, { status: 500 });
  }
}

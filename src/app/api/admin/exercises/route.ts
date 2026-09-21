import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, requireRole } from "@/lib/apiAuth";
import { auditLog, AuditAction } from "@/lib/auditLog";
import { stripAnswers, fillEmptyContentJson } from "@/lib/exerciseContent";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const id = searchParams.get("id");
    const courseId = searchParams.get("course_id");
    const me = await getAuthenticatedUser(request);
    const isAdmin = me?.role === "admin";

    if (id) {
      let { data, error } = await supabaseAdmin
        .from("exercises")
        .select(`
          id, title, description, question,
          difficulty_level, type, level, status,
          folder_id, course_id, content_json,
          points_reward, max_attempts, time_limit,
          created_at, updated_at,
          courses (title, subject, level),
          exercise_folders (name, color)
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching single exercise:", error);
        return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
      }
      
      if (!data) {
        return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
      }
      
      const filledData = fillEmptyContentJson(data);

      return NextResponse.json(isAdmin ? filledData : stripAnswers(filledData));
    }

    // Liste : pas de content_json (potentiellement volumineux) — chaque
    // carte n'affiche que ces champs ; le contenu complet est rechargé à la
    // demande (édition/aperçu/export) via ?id=.
    //
    // Supabase/PostgREST plafonne un .select() à 1000 lignes par défaut : la
    // table exercises l'a largement dépassé (~6800 lignes), donc sans
    // pagination cette route ne renvoyait que les 1000 lignes les plus
    // récentes et la plupart des dossiers apparaissaient vides ou avec 1
    // seul exercice dans l'admin (bug constaté et corrigé le 2026-09-21,
    // voir aussi src/app/admin/exercises/page.tsx pour le même correctif
    // côté chargement initial de la page).
    const pageSize = 1000;
    const data: any[] = [];
    for (let from = 0; ; from += pageSize) {
      let query = supabaseAdmin
        .from("exercises")
        .select(
          `
          id, title, description, question,
          difficulty_level, type, level, status,
          folder_id, course_id,
          points_reward, max_attempts, time_limit,
          created_at, updated_at,
          courses (title, subject, level),
          exercise_folders (name, color)
        `
        )
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      if (courseId && courseId !== "all") {
        query = query.eq("course_id", courseId);
      }

      const { data: page, error } = await query;

      if (error) {
        console.error("Error fetching exercises:", error);
        return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
      }

      data.push(...(page ?? []));
      if (!page || page.length < pageSize) break;
    }

    // La liste n'inclut plus content_json (voir select ci-dessus) : pas de
    // fillEmptyContentJson ici, ça injecterait un faux contenu de repli sur
    // des lignes où le champ est simplement absent, pas vide.
    return NextResponse.json(isAdmin ? data : data.map(stripAnswers));
  } catch (error: any) {
    console.error("Error fetching exercises:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
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
      course_id,
      difficulty_level,
      type,
      level,
      status,
      folder_id,
      thumbnail_url,
      content_json,
      time_limit,
      max_attempts,
      estimated_time,
    } = body;

    // If content_json is empty or not provided, create a sensible default based on exercise type
    let finalContentJson = content_json || [];
    if (!finalContentJson || finalContentJson.length === 0) {
      // Create a default page with appropriate block based on exercise type
      let defaultBlock: any = {
        id: "block-1",
        type: "text",
        content: description || title || "Énoncé non spécifié",
      };

      // Add type-specific defaults
      if (type === "single_choice" || type === "multiple_choice") {
        defaultBlock = {
          id: "block-1",
          type: type === "multiple_choice" ? "multiple_choice" : "single_choice",
          content: description || title || "Question",
          options: [
            { id: "opt-1", text: "Réponse A" },
            { id: "opt-2", text: "Réponse B" },
            { id: "opt-3", text: "Réponse C" },
          ],
          correctAnswer: "opt-1",
        };
      } else if (type === "true_false") {
        defaultBlock = {
          id: "block-1",
          type: "true_false",
          statement: description || title || "Énoncé du vrai/faux",
          correctAnswer: true,
        };
      } else if (type === "text_input") {
        defaultBlock = {
          id: "block-1",
          type: "text_input",
          label: description || title || "Répondez à la question",
          placeholder: "Votre réponse",
          expectedAnswer: "",
        };
      }

      finalContentJson = [
        {
          id: "page-1",
          blocks: [defaultBlock],
        },
      ];
      console.log("✅ Created default content_json for type:", {
        title,
        type,
        hasDescription: !!description,
      });
    } else {
      console.log("✅ Using provided content_json:", {
        title,
        type,
        pagesCount: finalContentJson.length,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("exercises")
      .insert({
        title,
        question: description,
        course_id,
        difficulty_level,
        type,
        level: level || "6eme",
        status: status || "draft",
        is_published: status === "published" || status === "active",
        folder_id: folder_id || null,
        thumbnail_url,
        content_json: finalContentJson,
        time_limit: time_limit || null,
        max_attempts: max_attempts || null,
        estimated_time: estimated_time ?? 15,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    await auditLog({
      action: data.is_published ? AuditAction.CONTENT_PUBLISHED : AuditAction.CONTENT_CREATED,
      adminId: admin.id,
      targetType: "exercise",
      targetId: String(data.id),
      details: { title: data.title, status: data.status },
    }, request);

    return NextResponse.json({ success: true, exercise: data });
  } catch (error: any) {
    console.error("Error creating exercise:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
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
      course_id,
      difficulty_level,
      type,
      level,
      status,
      folder_id,
      thumbnail_url,
      content_json,
      time_limit,
      max_attempts,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Exercise ID is required" },
        { status: 400 }
      );
    }

    // Partial update: if content_json key was not sent at all (e.g. drag & drop move
    // that only sends id + folder_id), we must NOT touch the stored content.
    const hasContentKey = Object.prototype.hasOwnProperty.call(body, "content_json");

    // If content_json is explicitly provided but empty, create a default structure based on type
    let finalContentJson = content_json;
    if (hasContentKey && (!finalContentJson || (Array.isArray(finalContentJson) && finalContentJson.length === 0))) {
      // Create appropriate default block based on exercise type
      let defaultBlock: any = {
        id: "block-1",
        type: "text",
        content: description || title || "Énoncé non spécifié",
      };

      if (type === "single_choice" || type === "multiple_choice") {
        defaultBlock = {
          id: "block-1",
          type: type === "multiple_choice" ? "multiple_choice" : "single_choice",
          content: description || title || "Question",
          options: [
            { id: "opt-1", text: "Réponse A" },
            { id: "opt-2", text: "Réponse B" },
            { id: "opt-3", text: "Réponse C" },
          ],
          correctAnswer: "opt-1",
        };
      } else if (type === "true_false") {
        defaultBlock = {
          id: "block-1",
          type: "true_false",
          statement: description || title || "Énoncé du vrai/faux",
          correctAnswer: true,
        };
      } else if (type === "text_input") {
        defaultBlock = {
          id: "block-1",
          type: "text_input",
          label: description || title || "Répondez à la question",
          placeholder: "Votre réponse",
          expectedAnswer: "",
        };
      }

      finalContentJson = [
        {
          id: "page-1",
          blocks: [defaultBlock],
        },
      ];
      console.log("✅ Created default content_json from description (UPDATE):", {
        title,
        type,
        hasDescription: !!description,
      });
    }

    // Build a partial update: only include fields whose keys are present in the body.
    // This prevents a folder move ({ id, folder_id }) from wiping title/content/etc.
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    if (has("title")) updatePayload.title = title;
    if (has("description")) updatePayload.question = description;
    if (has("course_id")) updatePayload.course_id = course_id || null;
    if (has("difficulty_level")) updatePayload.difficulty_level = difficulty_level;
    if (has("type")) updatePayload.type = type;
    if (has("level")) updatePayload.level = level;
    if (has("status")) {
      updatePayload.status = status;
      updatePayload.is_published = status === "published" || status === "active";
    }
    if (has("folder_id")) updatePayload.folder_id = folder_id || null;
    if (has("thumbnail_url")) updatePayload.thumbnail_url = thumbnail_url;
    if (hasContentKey) updatePayload.content_json = finalContentJson;
    if (has("time_limit")) updatePayload.time_limit = time_limit || null;
    if (has("time_limit_minutes")) updatePayload.time_limit_minutes = body.time_limit_minutes || null;
    if (has("estimated_time")) updatePayload.estimated_time = body.estimated_time ?? 15;
    if (has("min_score_percent")) updatePayload.min_score_percent = body.min_score_percent || null;
    if (has("max_attempts")) updatePayload.max_attempts = max_attempts || null;

    const { data, error } = await supabaseAdmin
      .from("exercises")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    await auditLog({
      action: has("status") && data.is_published ? AuditAction.CONTENT_PUBLISHED : AuditAction.CONTENT_UPDATED,
      adminId: admin.id,
      targetType: "exercise",
      targetId: String(id),
      details: { title: data.title, status: data.status, updatedFields: Object.keys(updatePayload) },
    }, request);

    return NextResponse.json({ success: true, exercise: data });
  } catch (error: any) {
    console.error("Error updating exercise:", error);
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
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
        { error: "Exercise ID is required" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("exercises")
      .select("title")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("exercises")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    await auditLog({
      action: AuditAction.CONTENT_DELETED,
      adminId: admin.id,
      targetType: "exercise",
      targetId: id,
      details: { title: existing?.title ?? null },
    }, request);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

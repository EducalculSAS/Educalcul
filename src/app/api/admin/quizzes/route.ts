import { NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/safeError";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getAuthenticatedUser, requireRole } from "@/lib/apiAuth";
import { auditLog, AuditAction } from "@/lib/auditLog";

// Retire les champs qui révèlent la réponse correcte avant de renvoyer un quiz
// à un lecteur non-admin (élève) : content_json contient correctAnswer/explanation
// en clair pour chaque question, nécessaires uniquement à la correction serveur.
function stripAnswers(quiz: any) {
  if (!quiz?.content_json || !Array.isArray(quiz.content_json)) return quiz;
  return {
    ...quiz,
    content_json: quiz.content_json.map((q: any) => {
      const { correctAnswer, explanation, ...safe } = q;
      return safe;
    }),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const id = searchParams.get("id");
    const courseId = searchParams.get("course_id");
    const me = await getAuthenticatedUser(request);
    const isAdmin = me?.role === "admin";

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("quizzes")
        .select(`
          *,
          courses (title),
          quiz_folders (name, color)
        `)
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
      }
      return NextResponse.json(isAdmin ? data : stripAnswers(data));
    }

    let query = supabaseAdmin
      .from("quizzes")
      .select(
        `
        *,
        courses (title),
        quiz_folders (name, color)
      `
      )
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (courseId && courseId !== "all") {
      query = query.eq("course_id", courseId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    return NextResponse.json(isAdmin ? data : (data || []).map(stripAnswers));
  } catch (error: any) {
    console.error("Error fetching quizzes:", error);
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
      time_limit_minutes,
      status,
      folder_id,
      thumbnail_filename,
      content_json,
      type,
      difficulty_level,
      level,
      max_attempts,
      grading_type,
      estimated_time,
    } = body;

    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .insert({
        title,
        description, // or question?
        course_id,
        time_limit_minutes,
        status: status || "draft",
        folder_id: folder_id || null,
        thumbnail_filename,
        content_json,
        type: type || "standard",
        level: level || "6eme",
        difficulty_level: difficulty_level || "medium",
        max_attempts: max_attempts || 0,
        grading_type: grading_type || "auto",
        estimated_time: estimated_time ?? 15,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    await auditLog({
      action: data.status === "published" ? AuditAction.CONTENT_PUBLISHED : AuditAction.CONTENT_CREATED,
      adminId: admin.id,
      targetType: "quiz",
      targetId: String(data.id),
      details: { title: data.title, status: data.status },
    }, request);

    return NextResponse.json({ success: true, quiz: data });
  } catch (error: any) {
    console.error("Error creating quiz:", error);
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
      time_limit_minutes,
      status,
      folder_id,
      thumbnail_filename,
      content_json,
      type,
      difficulty_level,
      level,
      max_attempts,
      grading_type,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Quiz ID is required" },
        { status: 400 }
      );
    }

    // Build a partial update: only include fields whose keys are present in the body.
    // This prevents a folder move ({ id, folder_id }) from wiping title/content/etc.
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
    if (has("title")) updatePayload.title = title;
    if (has("description")) updatePayload.description = description;
    if (has("course_id")) updatePayload.course_id = course_id || null;
    if (has("time_limit_minutes")) updatePayload.time_limit_minutes = time_limit_minutes;
    if (has("min_score_percent")) updatePayload.min_score_percent = body.min_score_percent || null;
    if (has("status")) updatePayload.status = status;
    if (has("folder_id")) updatePayload.folder_id = folder_id || null;
    if (has("thumbnail_filename")) updatePayload.thumbnail_filename = thumbnail_filename;
    if (has("content_json")) updatePayload.content_json = content_json;
    if (has("type")) updatePayload.type = type;
    if (has("difficulty_level")) updatePayload.difficulty_level = difficulty_level;
    if (has("level")) updatePayload.level = level;
    if (has("estimated_time")) updatePayload.estimated_time = body.estimated_time ?? 15;
    if (has("max_attempts")) updatePayload.max_attempts = max_attempts;
    if (has("grading_type")) updatePayload.grading_type = grading_type;

    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    await auditLog({
      action: has("status") && status === "published" ? AuditAction.CONTENT_PUBLISHED : AuditAction.CONTENT_UPDATED,
      adminId: admin.id,
      targetType: "quiz",
      targetId: String(id),
      details: { title: data.title, status: data.status, updatedFields: Object.keys(updatePayload) },
    }, request);

    return NextResponse.json({ success: true, quiz: data });
  } catch (error: any) {
    console.error("Error updating quiz:", error);
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
        { error: "Quiz ID is required" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("quizzes")
      .select("title")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("quizzes").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 400 });
    }

    await auditLog({
      action: AuditAction.CONTENT_DELETED,
      adminId: admin.id,
      targetType: "quiz",
      targetId: id,
      details: { title: existing?.title ?? null },
    }, request);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  }
}

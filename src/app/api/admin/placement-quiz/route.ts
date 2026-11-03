import { readJsonBody } from "@/lib/apiJson";
import type { Loose } from "@/types/loose";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage } from "@/lib/safeError";

/** Gestion admin des questions du QCM de placement (onboarding eleve), par
 * niveau scolaire — voir ChildOnboarding.tsx pour la consommation cote eleve. */
export async function GET(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("placement_quiz_questions")
    .select("*")
    .order("grade_level")
    .order("sort_order");
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json(data || []);
}

function validateQuestionBody(body: Loose): { question: string; options: string[]; correct_index: number; grade_level: string; notion: string } | null {
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const options = Array.isArray(body.options) ? body.options.map((o: unknown) => String(o).trim()) : [];
  const correct_index = Number(body.correct_index);
  const grade_level = typeof body.grade_level === "string" ? body.grade_level.trim() : "";
  const notion = typeof body.notion === "string" ? body.notion.trim() : "";
  if (!question || !grade_level || !notion) return null;
  if (options.length < 2 || options.some((o: string) => !o)) return null;
  if (!Number.isInteger(correct_index) || correct_index < 0 || correct_index >= options.length) return null;
  return { question, options, correct_index, grade_level, notion };
}

export async function POST(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJsonBody(req);
  const valid = validateQuestionBody(body);
  if (!valid) return NextResponse.json({ error: "Question invalide (texte, 2+ options, bonne reponse valide, niveau et notion requis)" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("placement_quiz_questions")
    .select("sort_order")
    .eq("grade_level", valid.grade_level)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (existing?.sort_order ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from("placement_quiz_questions")
    .insert({ ...valid, sort_order })
    .select()
    .single();
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJsonBody(req);
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const valid = validateQuestionBody(body);
  if (!valid) return NextResponse.json({ error: "Question invalide (texte, 2+ options, bonne reponse valide, niveau et notion requis)" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("placement_quiz_questions")
    .update({ ...valid, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { error } = await supabaseAdmin.from("placement_quiz_questions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json({ success: true });
}

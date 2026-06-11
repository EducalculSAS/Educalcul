import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { chatWithAI } from "@/lib/llm";

// POST: parent asks AI to suggest a revision schedule for a child, based on weak subjects
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, childId } = body;

    if (!userId || !childId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: requester } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("auth_id", userId)
      .maybeSingle();
    if (!requester || requester.role !== "parent") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const childIdNum = Number(childId);
    const { data: child } = await supabaseAdmin
      .from("users")
      .select("id, first_name, grade_level")
      .eq("id", childIdNum)
      .eq("parent_id", requester.id)
      .maybeSingle();
    if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

    const { data: exerciseAttempts } = await supabaseAdmin
      .from("user_exercise_attempts")
      .select("is_correct, exercise:exercises(subject, title)")
      .eq("user_id", childIdNum)
      .order("created_at", { ascending: false })
      .limit(100);

    const subjectStats: Record<string, { correct: number; total: number }> = {};
    for (const a of exerciseAttempts || []) {
      const exercise = Array.isArray(a.exercise) ? a.exercise[0] : a.exercise;
      const subject = exercise?.subject || exercise?.title;
      if (!subject) continue;
      if (!subjectStats[subject]) subjectStats[subject] = { correct: 0, total: 0 };
      subjectStats[subject].total++;
      if (a.is_correct) subjectStats[subject].correct++;
    }

    const weakSubjects = Object.entries(subjectStats)
      .map(([subject, s]) => ({ subject, rate: s.correct / s.total, total: s.total }))
      .filter(s => s.total >= 3)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3);

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `Tu es un assistant pédagogique qui crée des programmes de révision pour un élève de niveau ${child.grade_level || "collège/lycée"}.
Réponds UNIQUEMENT avec un JSON valide, sans texte autour, au format :
{"events":[{"title":"...","description":"...","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD ou null"}]}
Propose entre 3 et 6 séances de révision réparties sur les 2 prochaines semaines, à partir du ${today}, ciblant en priorité les sujets faibles fournis. Les titres doivent être courts (ex: "Révision : Fractions").`;

    const userPrompt = `Sujets où l'élève a le plus de difficultés (taux de réussite) :
${weakSubjects.length > 0 ? weakSubjects.map(s => `- ${s.subject} : ${Math.round(s.rate * 100)}% de réussite sur ${s.total} exercices`).join("\n") : "Aucune donnée précise disponible, propose un programme de révision générale équilibré."}

Génère le programme de révision au format JSON demandé.`;

    const aiResponse = await chatWithAI(
      [{ role: "user", content: userPrompt }],
      systemPrompt,
      0.5,
      1000
    );

    let parsed: { events: { title: string; description?: string; start_date: string; end_date?: string | null }[] };
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
    } catch {
      return NextResponse.json({ error: "Réponse IA invalide" }, { status: 502 });
    }

    const toInsert = (parsed.events || []).map(e => ({
      owner_id: childIdNum,
      created_by: requester.id,
      created_by_role: "parent",
      title: e.title,
      description: e.description || null,
      event_type: "revision",
      start_date: e.start_date,
      end_date: e.end_date || null,
      all_day: true,
      visible_to_child: true,
    }));

    if (toInsert.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .insert(toInsert)
      .select();
    if (error) throw error;

    return NextResponse.json({ events: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createLlmStartGate } from "@/lib/ai/runtime";
import { courseChapterSchema } from "@/lib/ai/schemas";
import {
  STRUCTURED_MATH_OUTPUT_RULES,
  RICH_TEXT_SCHEMA_PROMPT,
  COURSE_BLOCK_SCHEMA_PROMPT,
  normalizeStructuredCourseChapter,
} from "@/lib/ai/structuredContent";
import { normalizeStructuredCoursePedagogy } from "@/lib/ai/pedagogy";
import { sanitizeStructuredResources } from "@/lib/ai/qualityGuard";
import { compileStructuredCourseChapter } from "@/lib/ai/compiler";

export const maxDuration = 800;

// Import du catalogue éditorial complet (catalogue_educalcul_2026_2027.txt,
// 902 micro-cours) : même principe de chaîne auto-entretenue que
// course-queue-advance, mais UN SEUL appel IA par micro-cours (pas le pipeline
// lourd blueprint+rédacteurs+relecteurs — hors sujet pour 120 à 900 mots).
const MAX_ATTEMPTS = 2;
const STALE_RUNNING_MINUTES = 8;
const SELF_URL = "https://educalcul.com/api/cron/catalogue-advance";

async function recoverStale() {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000).toISOString();
  const { data: stale } = await supabaseAdmin
    .from("catalogue_import_queue")
    .select("id, attempts")
    .eq("status", "running")
    .lt("updated_at", cutoff);

  for (const row of stale || []) {
    const nextAttempts = row.attempts + 1;
    await supabaseAdmin
      .from("catalogue_import_queue")
      .update({
        status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts: nextAttempts,
        last_error: "Génération interrompue : le processus serveur s'est arrêté avant la fin.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}

async function claimNext() {
  await recoverStale();
  const { data: candidate } = await supabaseAdmin
    .from("catalogue_import_queue")
    .select("id")
    .or(`status.eq.pending,and(status.eq.failed,attempts.lt.${MAX_ATTEMPTS})`)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!candidate) return null;

  const { data: claimed } = await supabaseAdmin
    .from("catalogue_import_queue")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .neq("status", "running")
    .select("*")
    .maybeSingle();
  return claimed;
}

async function advanceQueue() {
  try {
    await fetch(SELF_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
  } catch (err) {
    console.error("[catalogue-advance] Échec de l'auto-relance:", err);
  }
}

function parseLengthGuidance(text: string | null): { min: number; max: number } {
  const match = (text || "").match(/(\d+)\D+(\d+)/);
  if (!match) return { min: 200, max: 400 };
  return { min: Number(match[1]), max: Number(match[2]) };
}

const LESSON_TYPE_INSTRUCTIONS: Record<string, string> = {
  Découvrir:
    "Type de leçon : DÉCOUVRIR. Introduis la notion, le vocabulaire essentiel et une première représentation ou situation concrète. Objectif très clair en une phrase (« À la fin de ce cours, tu sauras... »), une courte introduction (pourquoi cette notion existe), une explication principale, un exemple guidé, et une toute petite vérification finale (QCM, vrai/faux, calcul ou mini-question). Termine par 2 à 5 éléments « À retenir ».",
  Comprendre:
    "Type de leçon : COMPRENDRE. Explique le sens mathématique de la notion avec un exemple guidé et une justification accessible. Objectif clair, définition si nécessaire, règle/propriété si elle appartient réellement au programme du niveau, exemple(s) guidé(s), une remarque « Attention » si une erreur est fréquente, une petite vérification finale, puis 2 à 5 éléments « À retenir ».",
  Méthode:
    "Type de leçon : MÉTHODE. Donne une procédure courte, ordonnée et réutilisable (étapes numérotées incluant une étape de vérification) pour traiter les exercices courants sur cette notion. Objectif clair, méthode en étapes, un exemple guidé qui applique la méthode, une petite vérification finale, puis 2 à 5 éléments « À retenir ».",
  Bilan:
    "Type de leçon : BILAN DU THÈME. N'introduis AUCUNE notion nouvelle. Reprends et récapitule : les définitions importantes, les règles/propriétés/formules, les méthodes, les erreurs fréquentes, quelques exemples courts, les liens entre les différents chapitres du thème, et termine par une checklist finale « Je sais faire » (liste). Ce cours peut être environ 30 à 50% plus long qu'un micro-cours normal du même niveau.",
};

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await claimNext();
  if (!item) {
    console.log("[catalogue-advance] File vide, rien à faire.");
    return NextResponse.json({ done: true });
  }

  process.env.MISTRAL_MODEL = "labs-leanstral-1-5";

  after(async () => {
    try {
      const { min, max } = parseLengthGuidance(item.length_guidance);
      const adjustedMax = item.is_theme_summary ? Math.round(max * 1.45) : max;
      const adjustedMin = item.is_theme_summary ? Math.round(min * 1.3) : min;
      const durationPerLesson = item.is_theme_summary ? 20 : 12;

      const systemPrompt = `Tu es un professeur de mathématiques de l'Éducation nationale française qui rédige un micro-cours pour Educalcul.
${STRUCTURED_MATH_OUTPUT_RULES}
${RICH_TEXT_SCHEMA_PROMPT}
${COURSE_BLOCK_SCHEMA_PROMPT}

═══ RÈGLES ÉDITORIALES DU MICRO-COURS ═══
• Niveau : ${item.level_name} (${item.program_version || "programme en vigueur 2026-2027"}).
• Ton pédagogique imposé pour ce niveau : ${item.tone || "clair et adapté à l'âge"}.
• Longueur cible pour CE micro-cours : entre ${adjustedMin} et ${adjustedMax} mots de texte utile (hors JSON). Ne remplis jamais artificiellement pour atteindre cette longueur ; une notion claire prime sur une longueur imposée, mais reste dans cette fourchette.
• ${LESSON_TYPE_INSTRUCTIONS[item.lesson_type] || LESSON_TYPE_INSTRUCTIONS.Découvrir}
• Ce micro-cours appartient au thème « ${item.theme_name} »${item.chapter_name ? ` et plus précisément au chapitre « ${item.chapter_name} »` : ""}. Reste STRICTEMENT dans le périmètre de ce chapitre/thème pour ce niveau : n'introduis jamais une notion prévue à un autre niveau ou dans un autre chapitre du même thème.
• Reste rigoureusement conforme au programme officiel français de ce niveau pour l'année scolaire 2026-2027. Un cours de ce niveau doit rester à CE niveau, ni plus simple ni plus avancé.
• Rédige entièrement en français, vocabulaire de l'Éducation nationale (numérateur/dénominateur, image/antécédent, coefficient directeur, fonction affine, etc. selon pertinence).
• Vérifie que tous les calculs et exemples numériques sont exacts et cohérents (unités correctes, résultat qui correspond réellement à la question posée).
• 1 seule leçon dans "lessons", avec exactement 1 exercice de vérification immédiate (type short_answer, très court : QCM formulé en texte, vrai/faux, calcul ou mini-question).
• Interdits stricts : TODO, Lorem ipsum, contenu vide, texte répété artificiellement, notion hors-programme pour ce niveau.`;

      const userPrompt = `Rédige ce micro-cours :
Titre : ${item.title}
Mini-description éditoriale : ${item.mini_description || ""}
${item.chapter_focus ? `Focus du chapitre : ${item.chapter_focus}` : ""}
${item.chapter_description ? `Description du chapitre : ${item.chapter_description}` : ""}
Le champ "title" du chapitre JSON doit être exactement : "${item.chapter_name || item.theme_name}".
Le champ "title" de la leçon JSON doit être exactement : "${item.title}".`;

      const contract = courseChapterSchema({
        lessonCount: 1,
        includeExercises: true,
        minExercises: 1,
        maxExercises: 1,
      });

      const generate = createLlmStartGate(4000, async () => false);
      const maxTokens = Math.min(6000, Math.max(1800, Math.round(adjustedMax * 3.2) + 1200));

      const raw = await generate(userPrompt, systemPrompt, contract, 0.7, maxTokens, false);

      let chapter = normalizeStructuredCoursePedagogy(
        normalizeStructuredCourseChapter(raw, {
          expectedLessonCount: 1,
          durationPerLesson,
          includeExercises: true,
          maxExercisesPerLesson: 1,
        }),
      );
      chapter.title = item.chapter_name || item.theme_name;
      if (chapter.lessons[0]) chapter.lessons[0].title = item.title;

      const sanitized = sanitizeStructuredResources(chapter);
      chapter = normalizeStructuredCoursePedagogy(sanitized.value);

      if (!chapter.lessons[0] || chapter.lessons[0].blocks.length === 0) {
        throw new Error("Leçon vide après normalisation.");
      }

      const compiled = compileStructuredCourseChapter(chapter, {
        chapterIndex: 0,
        durationPerLesson,
      });

      const { data: course, error: upsertError } = await supabaseAdmin
        .from("courses")
        .upsert(
          {
            slug: item.slug,
            title: item.title,
            description: item.mini_description,
            level: item.grade_level,
            subject: item.theme_name,
            folder_id: item.folder_id,
            status: "draft",
            content_json: [compiled],
            estimated_time: durationPerLesson,
            chapter_name: item.chapter_name,
            theme_order: item.theme_order,
            chapter_order: item.chapter_order,
            lesson_order: item.lesson_order,
            is_theme_summary: item.is_theme_summary,
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single();

      if (upsertError || !course) {
        throw new Error(upsertError?.message || "upsert échoué");
      }

      await supabaseAdmin
        .from("catalogue_import_queue")
        .update({ status: "done", course_id: course.id, last_error: null, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } catch (err) {
      console.error("[catalogue-advance] Échec:", err);
      await supabaseAdmin
        .from("catalogue_import_queue")
        .update({ status: "failed", last_error: String((err as Error)?.message || err), updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } finally {
      await advanceQueue();
    }
  });

  return NextResponse.json(
    { started: item.id, slug: item.slug, title: item.title },
    { status: 202 },
  );
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

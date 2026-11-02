import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { createLlmStartGate } from "@/lib/ai/runtime";
import type { JsonSchemaContract } from "@/lib/ai/schemas";

export const maxDuration = 800;

// Étape de planification par chapitre : au lieu d'une micro-leçon par entrée
// du catalogue (trop court / trop répétitif — retour utilisateur direct après
// relecture du lot CP), un appel IA par chapitre (360 au total) déplie le
// squelette d'origine du catalogue (source_lessons) en une liste plus fournie
// de petites leçons, avec un nombre variable selon l'importance du sujet
// (ex: "nombres et numération" ou "addition" reçoivent plus de leçons qu'un
// sujet secondaire). Le résultat alimente catalogue_import_queue, qui garde
// ensuite le même pipeline de génération de contenu (catalogue-advance).
const MAX_ATTEMPTS = 2;
const STALE_RUNNING_MINUTES = 8;
const SELF_URL = "https://educalcul.com/api/cron/catalogue-plan-advance";

const PLAN_SCHEMA: JsonSchemaContract = {
  name: "educalcul_chapter_lesson_plan",
  description: "Plan de micro-leçons pour un chapitre du catalogue Educalcul",
  schema: {
    type: "object",
    properties: {
      lessons: {
        type: "array",
        minItems: 3,
        maxItems: 14,
        items: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 3, maxLength: 120 },
            focus: { type: "string", minLength: 3, maxLength: 300 },
            role: {
              type: "string",
              enum: ["decouverte", "explication", "demonstration", "visualisation", "exercices"],
            },
            is_number_intro: { type: "boolean" },
          },
          required: ["title", "focus", "role", "is_number_intro"],
          additionalProperties: false,
        },
      },
    },
    required: ["lessons"],
    additionalProperties: false,
  },
};

async function recoverStale() {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000).toISOString();
  const { data: stale } = await supabaseAdmin
    .from("catalogue_chapter_plan")
    .select("id, attempts")
    .eq("status", "running")
    .lt("updated_at", cutoff);

  for (const row of stale || []) {
    const nextAttempts = row.attempts + 1;
    await supabaseAdmin
      .from("catalogue_chapter_plan")
      .update({
        status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts: nextAttempts,
        last_error: "Planification interrompue : le processus serveur s'est arrêté avant la fin.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}

async function claimNext() {
  await recoverStale();
  const { data: candidate } = await supabaseAdmin
    .from("catalogue_chapter_plan")
    .select("id")
    .or(`status.eq.pending,and(status.eq.failed,attempts.lt.${MAX_ATTEMPTS})`)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!candidate) return null;

  const { data: claimed } = await supabaseAdmin
    .from("catalogue_chapter_plan")
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
    console.error("[catalogue-plan-advance] Échec de l'auto-relance:", err);
  }
}

function slugifyFragment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "lecon";
}

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
    console.info("[catalogue-plan-advance] File vide, rien à faire.");
    return NextResponse.json({ done: true });
  }

  process.env.MISTRAL_MODEL = "labs-leanstral-1-5-1";

  after(async () => {
    try {
      const sourceLessons = Array.isArray(item.source_lessons) ? item.source_lessons : [];
      const sourceList = sourceLessons
        .map((l: { title?: string; lesson_type?: string; mini_description?: string }, i: number) =>
          `${i + 1}. [${l.lesson_type || "?"}] ${l.title || ""} : ${l.mini_description || ""}`,
        )
        .join("\n");

      const systemPrompt = `Tu es un ingénieur pédagogique qui planifie la structure d'un chapitre de mathématiques pour Educalcul (niveau ${item.level_name}, ${item.program_version || "programme 2026-2027"}).
Philosophie : beaucoup de PETITES micro-leçons ciblées plutôt que peu de leçons longues. Chaque micro-leçon doit rester courte et se concentrer sur UNE seule chose précise.
Le nombre de leçons à produire pour ce chapitre N'EST PAS fixe : adapte-le à l'importance réelle du sujet pour ce niveau. Un chapitre central et fondateur (ex: les nombres et la numération, l'addition, la soustraction) mérite significativement PLUS de leçons qu'un chapitre secondaire, car il doit être expliqué, démontré, visualisé ET surtout beaucoup exercé, c'est la pratique qui compte le plus.
Pour chaque chapitre, prévois un vrai parcours complet : au moins une leçon de découverte, plusieurs leçons d'explication/démonstration qui couvrent chaque sous-notion du squelette ci-dessous sans en oublier aucune, au moins une leçon de visualisation concrète si le sujet s'y prête, et SURTOUT plusieurs leçons dédiées uniquement à l'entraînement (role "exercices"), ce sont les leçons les plus importantes du chapitre. RÈGLE STRICTE : au moins un quart des leçons produites (arrondi au supérieur, jamais moins de 2 dès que le chapitre a plus de 4 leçons) doivent avoir le role "exercices", répartis pour faire pratiquer chaque sous-notion vue dans les leçons d'explication, pas une seule leçon d'entraînement générale en fin de chapitre.
Le champ "is_number_intro" doit être true UNIQUEMENT pour une leçon de niveau CP qui apprend explicitement à lire/écrire/reconnaître des chiffres ou des nombres (ex: "Découvrir le chiffre 3"), false sinon.
Chaque titre doit être spécifique et parlant (jamais générique type "Leçon 1" ou une simple recopie du nom du chapitre).`;

      const userPrompt = `Thème : ${item.theme_name}
Chapitre : ${item.chapter_name}
${item.chapter_description ? `Description du chapitre : ${item.chapter_description}` : ""}
${item.chapter_focus ? `Focus du chapitre : ${item.chapter_focus}` : ""}

Squelette de leçons du catalogue d'origine pour ce chapitre (à couvrir intégralement, mais en développant beaucoup plus en détail, n'hésite pas à multiplier les petites leçons si le sujet est important) :
${sourceList || "(aucun squelette fourni)"}

Produis le plan de micro-leçons pour ce chapitre.`;

      const generate = createLlmStartGate(4000, async () => false);
      const raw = await generate(userPrompt, systemPrompt, PLAN_SCHEMA, 0.6, 6000, false);
      const lessons = Array.isArray((raw as { lessons?: unknown[] })?.lessons)
        ? (raw as { lessons: Array<{ title: string; focus: string; role: string; is_number_intro: boolean }> }).lessons
        : [];

      if (lessons.length < 2) {
        throw new Error("Plan de leçons vide ou insuffisant après génération.");
      }

      const ROLE_EXERCISES: Record<string, { min: number; max: number }> = {
        exercices: { min: 3, max: 5 },
        decouverte: { min: 1, max: 2 },
        explication: { min: 1, max: 2 },
        demonstration: { min: 1, max: 2 },
        visualisation: { min: 1, max: 2 },
      };

      const rows = lessons.slice(0, 14).map((lesson, index) => {
        const role = ROLE_EXERCISES[lesson.role] ? lesson.role : "explication";
        const exCfg = ROLE_EXERCISES[role];
        const localOrder = index + 1;
        const slug = `${item.grade_level}-t${item.theme_order}c${item.chapter_order}-l${String(localOrder).padStart(2, "0")}-${slugifyFragment(lesson.title)}`;
        return {
          slug,
          folder_id: item.folder_id,
          grade_level: item.grade_level,
          level_name: item.level_name,
          program_version: item.program_version,
          tone: item.tone,
          length_guidance: item.length_guidance,
          theme_name: item.theme_name,
          theme_order: item.theme_order,
          chapter_name: item.chapter_name,
          chapter_order: item.chapter_order,
          chapter_focus: item.chapter_focus,
          chapter_description: item.chapter_description,
          lesson_order: localOrder,
          lesson_type: role === "exercices" ? "Méthode" : "Comprendre",
          lesson_role: role,
          title: lesson.title.slice(0, 150),
          mini_description: lesson.focus.slice(0, 300),
          is_theme_summary: false,
          is_number_intro: Boolean(lesson.is_number_intro) && item.grade_level === "cp",
          min_exercises: exCfg.min,
          max_exercises: exCfg.max,
          status: "pending",
        };
      });

      const { error: insertError } = await supabaseAdmin.from("catalogue_import_queue").upsert(rows, { onConflict: "slug" });
      if (insertError) {
        throw new Error(insertError.message);
      }

      await supabaseAdmin
        .from("catalogue_chapter_plan")
        .update({
          status: "done",
          planned_lessons: rows.map((r) => ({ title: r.title, role: r.lesson_role })),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    } catch (err) {
      console.error("[catalogue-plan-advance] Échec:", err);
      const nextAttempts = item.attempts + 1;
      await supabaseAdmin
        .from("catalogue_chapter_plan")
        .update({
          status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts: nextAttempts,
          last_error: String((err as Error)?.message || err),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    } finally {
      await advanceQueue();
    }
  });

  return NextResponse.json({ started: item.id, chapter: item.chapter_name }, { status: 202 });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

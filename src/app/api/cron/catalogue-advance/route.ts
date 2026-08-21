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
import { searchCommonsImage } from "@/lib/ai/commonsImages";

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

const ROLE_INSTRUCTIONS: Record<string, string> = {
  decouverte:
    "Rôle de cette micro-leçon : DÉCOUVERTE. Introduis uniquement cette petite notion précise (pas tout le chapitre), avec le vocabulaire essentiel et une situation concrète. Objectif clair en une phrase, courte mise en situation, explication, exemple guidé, petite vérification finale, puis 2 à 4 éléments « À retenir ».",
  explication:
    "Rôle de cette micro-leçon : EXPLICATION. Explique en profondeur cette notion précise avec définition si utile, exemple(s) guidé(s), et une remarque « Attention » si une erreur est fréquente sur CE point précis. Ne déborde pas sur les autres notions du chapitre, elles ont leurs propres leçons. Termine par 2 à 4 éléments « À retenir ».",
  demonstration:
    "Rôle de cette micro-leçon : DÉMONSTRATION. Montre pas à pas, avec un exemple concret détaillé (ou plusieurs si utile), comment on applique/obtient ce résultat précis. Utilise le bloc \"steps\" si la démonstration a 3 étapes ou plus. Termine par 2 à 4 éléments « À retenir ».",
  visualisation:
    "Rôle de cette micro-leçon : VISUALISATION. Rends cette notion concrète visuellement (bloc base_ten_blocks pour la numération, figure, tableau, ou photo réelle libre de droits si pertinent) et commente ce que montre la représentation. Termine par une petite vérification finale.",
  exercices:
    "Rôle de cette micro-leçon : ENTRAÎNEMENT. C'est la leçon la plus importante du chapitre : une très courte reprise du point clé (2-3 phrases maximum), puis PLUSIEURS exercices variés et corrigés (type short_answer) qui font vraiment pratiquer cette notion précise, du plus simple au plus difficile. Chaque exercice doit avoir une explication de correction claire.",
};

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
      // L'utilisateur a demandé "environ le double" des longueurs indicatives
      // du catalogue d'origine (retour après relecture du lot CP en admin :
      // cours jugés trop courts / pas assez explicatifs). On double d'abord
      // la fourchette catalogue, puis on applique le bonus bilan par-dessus.
      const doubledMin = Math.round(min * 2);
      const doubledMax = Math.round(max * 2);
      // Le multiplicateur bilan a été réduit (1.45→1.2, 1.3→1.15) : cumulé
      // au doublement de longueur + 2-3 exercices minimum, les bilans
      // dépassaient systématiquement les 180s de la requête Mistral (modèle
      // gratuit "labs", pas un problème de budget de tokens mais de temps
      // de génération réel — observé en prod sur tous les bilans CP).
      const adjustedMax = item.is_theme_summary ? Math.round(doubledMax * 1.2) : doubledMax;
      const adjustedMin = item.is_theme_summary ? Math.round(doubledMin * 1.15) : doubledMin;
      const durationPerLesson = item.is_theme_summary ? 20 : 12;
      const minExercises = item.min_exercises || (item.is_theme_summary ? 2 : 1);
      const maxExercises = item.max_exercises || (item.is_theme_summary ? 3 : 2);
      const roleInstruction = item.is_theme_summary
        ? LESSON_TYPE_INSTRUCTIONS.Bilan
        : ROLE_INSTRUCTIONS[item.lesson_role] || LESSON_TYPE_INSTRUCTIONS[item.lesson_type] || LESSON_TYPE_INSTRUCTIONS.Découvrir;
      const numberWordsInstruction = item.is_number_intro
        ? `\n• Cette leçon apprend un/des chiffres ou nombres à un enfant de CP qui ne sait pas encore lire les chiffres seuls : écris systématiquement le nombre en toutes lettres suivi du chiffre entre parenthèses la première fois qu'il apparaît dans une phrase (ex: "trois (3) pommes"), puis tu peux utiliser le chiffre seul ensuite dans la même phrase/exemple.`
        : "";

      const systemPrompt = `Tu es un professeur de mathématiques de l'Éducation nationale française qui rédige un micro-cours pour Educalcul.
${STRUCTURED_MATH_OUTPUT_RULES}
${RICH_TEXT_SCHEMA_PROMPT}
${COURSE_BLOCK_SCHEMA_PROMPT}

═══ RÈGLES ÉDITORIALES DU MICRO-COURS ═══
• Niveau : ${item.level_name} (${item.program_version || "programme en vigueur 2026-2027"}).
• Ton pédagogique imposé pour ce niveau : ${item.tone || "clair et adapté à l'âge"}.
• Longueur cible pour CE micro-cours : entre ${adjustedMin} et ${adjustedMax} mots de texte utile (hors JSON). Ne remplis jamais artificiellement pour atteindre cette longueur ; une notion claire prime sur une longueur imposée, mais reste dans cette fourchette.
• ${roleInstruction}
• Ce micro-cours appartient au thème « ${item.theme_name} »${item.chapter_name ? ` et plus précisément au chapitre « ${item.chapter_name} »` : ""}. Reste STRICTEMENT dans le périmètre de CETTE micro-leçon précise (voir sujet éditorial ci-dessous) : n'aborde pas les autres sous-notions du chapitre, elles ont leurs propres leçons dédiées, et n'introduis jamais une notion prévue à un autre niveau.
• Reste rigoureusement conforme au programme officiel français de ce niveau pour l'année scolaire 2026-2027. Un cours de ce niveau doit rester à CE niveau, ni plus simple ni plus avancé.
• Rédige entièrement en français, vocabulaire de l'Éducation nationale (numérateur/dénominateur, image/antécédent, coefficient directeur, fonction affine, etc. selon pertinence).
• Vérifie que tous les calculs et exemples numériques sont exacts et cohérents (unités correctes, résultat qui correspond réellement à la question posée).
• 1 seule leçon dans "lessons", avec entre ${minExercises} et ${maxExercises} exercices de vérification (type short_answer, courts : QCM formulé en texte, vrai/faux, calcul ou mini-question), chacun avec une explication de correction.${numberWordsInstruction}
• Interdits stricts : TODO, Lorem ipsum, contenu vide, texte répété artificiellement, notion hors-programme pour ce niveau.`;

      const userPrompt = item.is_theme_summary
        ? `Rédige ce micro-cours :
Titre : ${item.title}
Mini-description éditoriale : ${item.mini_description || ""}
${item.chapter_focus ? `Focus du chapitre : ${item.chapter_focus}` : ""}
${item.chapter_description ? `Description du chapitre : ${item.chapter_description}` : ""}
Le champ "title" du chapitre JSON doit être exactement : "${item.chapter_name || item.theme_name}".
Le champ "title" de la leçon JSON doit être exactement : "${item.title}".`
        : `Rédige ce micro-cours :
Sujet éditorial (fil conducteur du catalogue, à ne pas recopier tel quel) : ${item.title}
Mini-description éditoriale : ${item.mini_description || ""}
${item.chapter_focus ? `Focus du chapitre : ${item.chapter_focus}` : ""}
${item.chapter_description ? `Description du chapitre : ${item.chapter_description}` : ""}
Le champ "title" du chapitre JSON doit être exactement : "${item.chapter_name || item.theme_name}".
Le champ "title" de la leçon JSON doit être un titre spécifique et parlant qui reflète précisément CE que cette leçon enseigne concrètement (pas une simple reprise du type "Découvrir —"/"Comprendre —"/"Méthode —" suivi du nom du chapitre, et pas non plus une recopie littérale du sujet éditorial ci-dessus) : un élève doit comprendre en le lisant ce qu'il va apprendre dans CETTE leçon précisément, en quelques mots clairs.`;

      const contract = courseChapterSchema({
        lessonCount: 1,
        includeExercises: true,
        minExercises,
        maxExercises,
      });

      const generate = createLlmStartGate(4000, async () => false);
      // Le JSON structuré (parts text/math, blocs, exercice) pèse beaucoup
      // plus lourd que le texte utile qu'il transporte — la formule
      // précédente (maxTokens=1904 pour un CP à 220 mots) tronquait
      // systématiquement la réponse avant la fin (observé en prod : échec
      // sur 100% des tentatives). Plancher et facteur alignés sur celui du
      // pipeline lourd (courseGeneration.ts, ~2.45 caractères/token, plus la
      // marge JSON) plutôt que sur le nombre de mots utiles seul.
      // + budget supplémentaire par exercice au-delà du premier : les leçons
      // "exercices" (jusqu'à 5 exercices corrigés) tronquaient sinon avant
      // la fin du tableau exercises (observé en prod : cp-l023).
      const maxTokens = Math.min(26000, Math.max(9000, Math.round(adjustedMax * 13) + 2000 + (maxExercises - 1) * 900));

      const raw = await generate(userPrompt, systemPrompt, contract, 0.7, maxTokens, false);

      let chapter = normalizeStructuredCoursePedagogy(
        normalizeStructuredCourseChapter(raw, {
          expectedLessonCount: 1,
          durationPerLesson,
          includeExercises: true,
          maxExercisesPerLesson: maxExercises,
        }),
      );
      chapter.title = item.chapter_name || item.theme_name;
      // Pour un bilan, on garde le titre imposé "Bilan du thème — X" pour la
      // cohérence de la validation/affichage. Pour les autres leçons, on
      // laisse le titre spécifique rédigé par l'IA (demandé explicitement
      // dans userPrompt) au lieu d'écraser avec le titre générique du
      // catalogue ("Découvrir — X" répété sur toutes les leçons du chapitre).
      if (chapter.lessons[0] && item.is_theme_summary) {
        chapter.lessons[0].title = item.title;
      }

      const sanitized = sanitizeStructuredResources(chapter);
      chapter = normalizeStructuredCoursePedagogy(sanitized.value);

      if (!chapter.lessons[0] || chapter.lessons[0].blocks.length === 0) {
        throw new Error("Leçon vide après normalisation.");
      }
      if (chapter.lessons[0].exercises.length < minExercises) {
        // Symptôme observé en prod sur cp-l008 : une réponse IA tronquée en
        // fin de génération (le tableau "exercises" arrive après "blocks"
        // dans le JSON) produit un chapitre avec des blocs valides mais
        // aucun exercice, ou moins que le minimum demandé. On refuse ce
        // résultat plutôt que de l'enregistrer silencieusement : l'item
        // repart en pending et sera régénéré.
        throw new Error(
          `Seulement ${chapter.lessons[0].exercises.length} exercice(s) après normalisation, minimum ${minExercises} attendu (réponse IA probablement tronquée).`,
        );
      }

      // Résolution des blocs "image" : l'IA ne fournit qu'une requête de
      // recherche + une légende, jamais d'URL. On cherche une vraie photo
      // libre de droits sur Wikimedia Commons pour chaque bloc image avant
      // compilation ; si rien de pertinent n'est trouvé, le bloc reste sans
      // url et le compilateur ne rend rien pour lui (pas d'image cassée).
      for (const lesson of chapter.lessons) {
        for (const block of lesson.blocks) {
          if (block.type === "image" && !block.url) {
            const found = await searchCommonsImage(block.query);
            if (found) {
              block.url = found.url;
              block.attribution = found.attribution;
            }
          }
        }
      }

      const compiled = compileStructuredCourseChapter(chapter, {
        chapterIndex: 0,
        durationPerLesson,
      });

      const finalTitle = item.is_theme_summary
        ? item.title
        : compiled.lessons[0]?.title?.trim() || item.title;

      // Un "cours" au sens de l'utilisateur regroupe PLUSIEURS chapitres,
      // chacun avec PLUSIEURS leçons — pas une leçon isolée par cours (retour
      // utilisateur direct après relecture : "je veux dans un cours,
      // plusieurs leçon dans un chapitre voir plusieurs chapitre"). On
      // fusionne donc chaque micro-leçon générée dans le cours partagé de son
      // thème (1 cours par thème, comme les 113 dossiers-thème existants),
      // via une fonction Postgres qui fait la fusion atomiquement (verrou de
      // ligne) pour éviter toute perte d'écriture entre leçons concurrentes
      // du même thème.
      const lessonForMerge = compiled.lessons[0];
      if (!lessonForMerge) {
        throw new Error("Leçon compilée manquante.");
      }
      lessonForMerge.id = item.slug;
      lessonForMerge.title = finalTitle;

      const courseSlug = `${item.grade_level}-t${item.theme_order}`;
      const chapterKey = item.is_theme_summary ? "bilan" : `c${item.chapter_order}`;
      const chapterTitle = item.is_theme_summary ? "Bilan du thème" : item.chapter_name || item.theme_name;
      const chapterOrder = item.is_theme_summary ? 9999 : item.chapter_order;

      const { data: courseId, error: mergeError } = await supabaseAdmin.rpc("merge_catalogue_lesson", {
        p_slug: courseSlug,
        p_title: item.theme_name,
        p_folder_id: item.folder_id,
        p_level: item.grade_level,
        p_subject: item.theme_name,
        p_chapter_key: chapterKey,
        p_chapter_title: chapterTitle,
        p_chapter_order: chapterOrder,
        p_lesson: lessonForMerge,
      });

      if (mergeError || !courseId) {
        throw new Error(mergeError?.message || "fusion du cours échouée");
      }

      await supabaseAdmin
        .from("catalogue_import_queue")
        .update({ status: "done", course_id: courseId, last_error: null, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } catch (err) {
      console.error("[catalogue-advance] Échec:", err);
      // attempts doit être incrémenté ici aussi (pas seulement dans
      // recoverStale), sinon un item qui échoue directement (ex: réponse IA
      // tronquée) reste indéfiniment à attempts=0 < MAX_ATTEMPTS et se fait
      // reclaimer en boucle par claimNext() sans jamais laisser la chaîne
      // avancer vers l'item suivant — observé en prod (36 tentatives sur le
      // même cp-l001 sans progresser).
      const nextAttempts = item.attempts + 1;
      await supabaseAdmin
        .from("catalogue_import_queue")
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

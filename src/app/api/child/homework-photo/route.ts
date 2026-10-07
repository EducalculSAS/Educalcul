import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { checkAIAccess } from "@/lib/checkSubscription";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { extractExerciseFromImage, runInteractive } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage } from "@/lib/safeError";

export const maxDuration = 60;

const MAX_IMAGE_CHARS = 6 * 1024 * 1024; // le navigateur réduit déjà la photo (~1 Mo)
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Aide aux devoirs par photo : l'élève photographie son exercice, on le lit (vision) et Calia l'aide ensuite à le
 * résoudre lui-même, pas à pas, sans lui donner la réponse (voir le mode « homework » de /api/child/ai-tutor).
 */
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Ta session a expiré : reconnecte-toi." }, { status: 401 });
    if (me.role !== "child") return NextResponse.json({ error: "Réservé aux élèves." }, { status: 403 });

    const cfg = RATE_LIMITS["ai:tutor"];
    const [rl, access] = await Promise.all([rateLimitWithBackoff(`ai:homework:${me.authId}`, 12, cfg.windowMs), checkAIAccess(me.authId)]);
    if (!rl.allowed) return NextResponse.json({ error: "Tu as envoyé beaucoup de photos : réessaie dans quelques minutes." }, { status: 429 });
    if (!access.allowed) return NextResponse.json({ error: access.reason || "Cette fonction demande un abonnement avec l'IA." }, { status: 403 });

    const { image } = await req.json().catch(() => ({}));
    if (typeof image !== "string" || image.length > MAX_IMAGE_CHARS || !DATA_URL.test(image)) {
      return NextResponse.json({ error: "Image invalide : envoie une photo JPEG, PNG ou WebP." }, { status: 400 });
    }

    supabaseAdmin.from("user_ai_interactions").insert({ user_id: me.id, feature_type: "homework_photo" }).then(undefined, () => {});

    const result = await runInteractive(() => extractExerciseFromImage(image));
    const figure = result.hasFigure && result.figureDescription ? `\n[Figure sur la photo : ${result.figureDescription}]` : "";
    return NextResponse.json({ title: result.title, statement: `${result.statement.replace(/▢/g, "…")}${figure}`.slice(0, 4000) });
  } catch (error) {
    return NextResponse.json({ error: sanitizeErrorMessage(error instanceof Error ? error.message : "Impossible de lire la photo.") }, { status: 500 });
  }
}

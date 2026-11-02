import { getClientIp } from "@/lib/apiAuth";
import { requireRole } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { extractExerciseFromImage } from "@/lib/llm";
import { sanitizeErrorMessage } from "@/lib/safeError";

export const maxDuration = 120;

// Taille maximale de l'image (en base64, ~6 Mo de fichier).
const MAX_DATA_URL_LENGTH = 8_500_000;

/**
 * Lit un exercice photographié et renvoie sa transcription, que l'admin relit
 * puis envoie à la génération (POST /api/admin/ai/exercise avec `sourceExercise`).
 */
export async function POST(request: Request) {
  const admin = await requireRole(request, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request);
  const config = RATE_LIMITS["ai:admin"];
  const rl = await rateLimitWithBackoff(`ai:admin:${ip}`, config.maxAttempts, config.windowMs);
  if (!rl.allowed) {
    return Response.json({ error: "Trop de générations IA, réessaie dans quelques minutes." }, { status: 429 });
  }

  const { imageDataUrl } = await request.json().catch(() => ({}));
  if (typeof imageDataUrl !== "string" || !/^data:image\/(png|jpe?g|webp);base64,/.test(imageDataUrl)) {
    return Response.json({ error: "Image requise (PNG, JPEG ou WebP)." }, { status: 400 });
  }
  if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
    return Response.json({ error: "Image trop lourde (6 Mo maximum)." }, { status: 413 });
  }

  try {
    return Response.json(await extractExerciseFromImage(imageDataUrl));
  } catch (err) {
    return Response.json(
      { error: sanitizeErrorMessage(err instanceof Error ? err.message : "Lecture impossible.") },
      { status: 500 },
    );
  }
}

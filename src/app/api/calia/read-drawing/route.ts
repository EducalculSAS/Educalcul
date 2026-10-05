import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { hasCaliaClasseAccess } from "@/lib/checkSubscription";
import { describeDrawing, runInteractive } from "@/lib/llm";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// Lecture (pas de notation) d'un dessin fait par l'eleve au tableau de
// "Calia en classe" — reserve au plan Family, comme le reste de la fonctionnalite.
export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await hasCaliaClasseAccess(me.authId))) {
      return NextResponse.json({ error: "Calia en classe necessite le plan Family." }, { status: 403 });
    }

    const cfg = RATE_LIMITS["calia:read-drawing"];
    const rl = await rateLimitWithBackoff(`calia:read-drawing:${me.authId}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) return NextResponse.json({ error: "Trop de dessins, reessaie plus tard." }, { status: 429 });

    const { imageDataUrl, context } = await req.json();
    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image")) {
      return NextResponse.json({ error: "imageDataUrl est requis" }, { status: 400 });
    }

    const description = await runInteractive(() => describeDrawing(imageDataUrl, typeof context === "string" ? context : ""));
    return NextResponse.json({ description });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

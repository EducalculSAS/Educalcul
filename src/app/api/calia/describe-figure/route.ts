import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { hasCaliaClasseAccess } from "@/lib/checkSubscription";
import { describeCourseFigure, runInteractive } from "@/lib/llm";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// « Vision » de Calia en classe : décrit une figure du cours (image envoyée par
// le navigateur) pour qu'elle sache quoi pointer, sans que l'élève ait à agir.
// Réservé au plan Family, comme le reste de la fonctionnalité.
const MAX_DATA_URL_LENGTH = 3_000_000;

export async function POST(req: Request) {
  try {
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await hasCaliaClasseAccess(me.authId))) {
      return NextResponse.json({ error: "Calia en classe necessite le plan Family." }, { status: 403 });
    }

    const cfg = RATE_LIMITS["calia:read-drawing"];
    const rl = await rateLimitWithBackoff(`calia:describe-figure:${me.authId}`, cfg.maxAttempts * 3, cfg.windowMs);
    if (!rl.allowed) return NextResponse.json({ error: "Trop de figures, reessaie plus tard." }, { status: 429 });

    const { imageDataUrl, caption } = await req.json().catch(() => ({}));
    if (typeof imageDataUrl !== "string" || !/^data:image\/(png|jpe?g|webp);base64,/.test(imageDataUrl)) {
      return NextResponse.json({ error: "imageDataUrl est requis" }, { status: 400 });
    }
    if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
      return NextResponse.json({ error: "Image trop lourde" }, { status: 413 });
    }

    const description = await runInteractive(() =>
      describeCourseFigure(imageDataUrl, typeof caption === "string" ? caption.slice(0, 300) : ""),
    );
    return NextResponse.json({ description });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

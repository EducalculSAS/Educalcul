import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";
import { describeDrawing } from "@/lib/llm";

// Lecture (pas de notation) d'un dessin fait par l'eleve au tableau de
// "Calia en classe" — reserve aux admins, comme le reste de la fonctionnalite.
export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["admin"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { imageDataUrl, context } = await req.json();
    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image")) {
      return NextResponse.json({ error: "imageDataUrl est requis" }, { status: 400 });
    }

    const description = await describeDrawing(imageDataUrl, typeof context === "string" ? context : "");
    return NextResponse.json({ description });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

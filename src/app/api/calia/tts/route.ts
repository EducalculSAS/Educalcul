import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";

// Voix naturelle open source (Kyutai Pocket-TTS, modele francais) hebergee
// sur un petit service Render (calia-tts-service/) — reserve aux admins pour
// l'instant, comme le reste de "Calia en classe" (CaliaSceneDemo.tsx).
export async function POST(req: Request) {
  try {
    const me = await requireRole(req, ["admin"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "text est requis" }, { status: 400 });
    }

    const ttsUrl = process.env.CALIA_TTS_URL;
    const secret = process.env.CALIA_TTS_SECRET;
    if (!ttsUrl || !secret) {
      return NextResponse.json({ error: "Service vocal non configure" }, { status: 503 });
    }

    const upstream = await fetch(`${ttsUrl}/speak`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ text: text.trim().slice(0, 400) }),
      signal: AbortSignal.timeout(20000),
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Service vocal indisponible (${upstream.status})` }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: { "Content-Type": "audio/wav" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

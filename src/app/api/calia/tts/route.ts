import { NextResponse } from "next/server";
import { requireRole } from "@/lib/apiAuth";

// Voix naturelle pour "Calia en classe" — Azure Speech (voix neurale
// fr-FR-VivienneMultilingualNeural), region France Central (RGPD, DPA),
// tier gratuit F0 (500k caracteres/mois). Pas open source (contrainte
// relachee au profit du realisme + zero infra a gerer, decision Ruben) —
// reserve aux admins pour l'instant, comme le reste de "Calia en classe".
const VOICE = "fr-FR-VivienneMultilingualNeural";

// Le jeton Azure reste valide ~10 min — le mettre en cache evite un aller-
// retour reseau complet (auth) avant CHAQUE phrase prononcee, sur l'instance
// de fonction reutilisee entre appels chauds.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAzureToken(key: string, region: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const tokenRes = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key, "Content-Length": "0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenRes.ok) throw new Error(`Authentification vocale echouee (${tokenRes.status})`);
  const value = await tokenRes.text();
  cachedToken = { value, expiresAt: Date.now() + 9 * 60 * 1000 };
  return value;
}

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// GET (pas POST) : permet au client de pointer directement un <audio> dessus
// et de streamer/jouer au fur et a mesure, au lieu d'attendre tout le blob.
export async function GET(req: Request) {
  try {
    const me = await requireRole(req, ["admin"]);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const text = new URL(req.url).searchParams.get("text");
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "text est requis" }, { status: 400 });
    }

    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) {
      return NextResponse.json({ error: "Service vocal non configure" }, { status: 503 });
    }

    const token = await getAzureToken(key, region);

    const ssml = `<speak version='1.0' xml:lang='fr-FR'><voice xml:lang='fr-FR' xml:gender='Female' name='${VOICE}'>${escapeSsml(text.trim().slice(0, 400))}</voice></speak>`;

    const upstream = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
        "User-Agent": "educalcul-calia",
      },
      body: ssml,
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Service vocal indisponible (${upstream.status})` }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

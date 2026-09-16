import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { hasCaliaClasseAccess } from "@/lib/checkSubscription";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

// Voix naturelle pour "Calia en classe" — Azure Speech, region France
// Central (RGPD, DPA), tier gratuit F0 (500k caracteres/mois). Pas open
// source (contrainte relachee au profit du realisme + zero infra a gerer,
// decision Ruben) — reserve au plan Family (calia_classe), voir
// hasCaliaClasseAccess. Liste blanche (jamais le parametre client tel quel
// dans le SSML) : evite l'injection XML et les noms de voix invalides.
const DEFAULT_VOICE = "fr-FR-VivienneMultilingualNeural";
const ALLOWED_VOICES: Record<string, "Female" | "Male"> = {
  "fr-FR-VivienneMultilingualNeural": "Female",
  "fr-FR-DeniseNeural": "Female",
  "fr-FR-HenriNeural": "Male",
};

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
    const me = await getAuthenticatedUser(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await hasCaliaClasseAccess(me.authId))) {
      return NextResponse.json({ error: "Calia en classe necessite le plan Family." }, { status: 403 });
    }

    const cfg = RATE_LIMITS["calia:tts"];
    const rl = await rateLimitWithBackoff(`calia:tts:${me.authId}`, cfg.maxAttempts, cfg.windowMs);
    if (!rl.allowed) return NextResponse.json({ error: "Trop de demandes vocales, reessaie plus tard." }, { status: 429 });

    const params = new URL(req.url).searchParams;
    const text = params.get("text");
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "text est requis" }, { status: 400 });
    }
    const requestedVoice = params.get("voice") || "";
    const voiceGender = ALLOWED_VOICES[requestedVoice];
    const voiceName = voiceGender ? requestedVoice : DEFAULT_VOICE;

    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) {
      return NextResponse.json({ error: "Service vocal non configure" }, { status: 503 });
    }

    const token = await getAzureToken(key, region);

    const ssml = `<speak version='1.0' xml:lang='fr-FR'><voice xml:lang='fr-FR' xml:gender='${voiceGender || "Female"}' name='${voiceName}'>${escapeSsml(text.trim().slice(0, 400))}</voice></speak>`;

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

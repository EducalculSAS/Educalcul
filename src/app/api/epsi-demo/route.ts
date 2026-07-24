import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { chatWithAI } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

const DEMO_COOKIE = "epsi_demo_id";

// Identifiant de démo stable par navigateur (cookie httpOnly). On ne se base plus
// sur l'IP : celle-ci change (4G, autre lieu) et est partagée (NAT) ou falsifiable
// via X-Forwarded-For, ce qui bloquait des utilisateurs légitimes ou laissait
// contourner la limite. Le cookie suit l'appareil quel que soit le réseau.
function readDemoId(req: NextRequest): string | null {
  const id = req.cookies.get(DEMO_COOKIE)?.value;
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function attachDemoId(res: NextResponse, id: string) {
  res.cookies.set(DEMO_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

const SYSTEM_PROMPT = `Tu es EpsiAI, assistant de mathematiques de la plateforme Educalcul (CP a la Terminale).
Tu utilises la methode socratique : tu poses des questions et donnes des indices.

INTERDICTIONS ABSOLUES - si tu violes une seule de ces regles tu echoues :
- Ne donne JAMAIS la reponse, ni directement, ni entre parentheses, ni "par exemple", ni sous forme de correction, ni entre asterisques
- Ne revele JAMAIS le resultat final, meme partiellement
- Ne commence JAMAIS par "Okay", "Bien sur", "Je suis EpsiAI"
- Pas d'emojis, pas de tirets longs, pas de markdown

REGLES :
- Reponds en francais, en 1 a 2 phrases maximum
- Verifie toujours si la reponse de l'eleve est mathematiquement correcte avant de repondre
- Si l'eleve a bon : dis "Exact." ou "Tres bien." puis pose une variante du meme type, un peu plus difficile
- Si l'eleve a faux : ne dis jamais "Presque" ni "Exact" — demande-lui de reverifier une etape precise
- Ne dis JAMAIS "Presque" si la reponse est correcte
- Si hors maths ou incomprehensible : pose un exercice concret adapte au niveau primaire
- Adapte-toi au niveau sans le demander

EXEMPLES CORRECTS :
- "fais une fraction" -> "Simplifie 18/24. Quel nombre divise a la fois 18 et 24 ?"
- "7 reste 5" (bonne reponse a 47/6) -> "Exact. Essaie maintenant 53 divise par 6, meme methode."
- "je sais pas" -> "Regarde 2x + 5 = 11 : que fais-tu en premier pour isoler x ?"

EXEMPLE INTERDIT :
- "Exact, donc 47 = 6 x 7 + 5, essaie 53..." <- interdit, tu as revele la reponse`;

/** Supprime les blocs de raisonnement interne que certains modèles laissent dans leur réponse */
function cleanReply(text: string): string {
  text = text.replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, "");
  text = text.replace(/```thinking[\s\S]*?```/gi, "");

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const reasoningStarts = /^(okay|wait|let me|i need|the user|first|so |hmm|alright|now |actually|but |since |looking|in this|based on|note:|remember|my role)/i;
  const cleanLines: string[] = [];
  let foundReal = false;
  for (const line of lines) {
    if (!foundReal && reasoningStarts.test(line)) continue;
    foundReal = true;
    cleanLines.push(line);
  }

  const result = (cleanLines.length > 0 ? cleanLines : lines).join(" ").trim();
  return result || text.trim();
}

const DEMO_LIMIT = 3;

export async function GET(req: NextRequest) {
  const id = readDemoId(req);
  let count = 0;
  if (id) {
    const { data } = await supabaseAdmin
      .from("epsi_demo_usage")
      .select("count")
      .eq("ip", id)
      .maybeSingle();
    count = data?.count ?? 0;
  }
  const res = NextResponse.json({ count, remaining: DEMO_LIMIT - count, limitReached: count >= DEMO_LIMIT });
  // Émet l'identifiant dès la première visite pour qu'il soit stable ensuite.
  return attachDemoId(res, id ?? randomUUID());
}

export async function POST(req: NextRequest) {
  try {
    // Garde-fou grossier par IP : empêche un script d'effacer son cookie en
    // boucle pour contourner indéfiniment la limite de 3 messages/navigateur.
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const ipConfig = RATE_LIMITS["epsi:demo"];
    const ipLimit = await rateLimitWithBackoff(`epsi:demo:${ip}`, ipConfig.maxAttempts, ipConfig.windowMs);
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: "demo_limit" }, { status: 429 });
    }

    const id = readDemoId(req) ?? randomUUID();

    // Compteur par navigateur (clé = cookie), enregistré dans Supabase.
    const { data: existing } = await supabaseAdmin
      .from("epsi_demo_usage")
      .select("count")
      .eq("ip", id)
      .maybeSingle();

    if (existing && existing.count >= DEMO_LIMIT) {
      return attachDemoId(NextResponse.json({ error: "demo_limit" }, { status: 403 }), id);
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return attachDemoId(NextResponse.json({ error: "Messages requis" }, { status: 400 }), id);
    }

    const raw = await chatWithAI(messages, SYSTEM_PROMPT, 0.7, 200);
    const reply = cleanReply(raw);
    const newCount = (existing?.count ?? 0) + 1;

    // Upsert : insert ou incrémente le compteur
    await supabaseAdmin.from("epsi_demo_usage").upsert({ ip: id, count: newCount });

    const limitReached = newCount >= DEMO_LIMIT;

    return attachDemoId(NextResponse.json({ reply, limitReached }), id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[epsi-demo]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

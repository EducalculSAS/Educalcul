import { NextRequest, NextResponse } from "next/server";
import { chatWithAI } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";

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

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

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
  const ip = getIP(req);
  const { data } = await supabaseAdmin
    .from("epsi_demo_usage")
    .select("count")
    .eq("ip", ip)
    .maybeSingle();
  const count = data?.count ?? 0;
  return NextResponse.json({ count, remaining: DEMO_LIMIT - count, limitReached: count >= DEMO_LIMIT });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);

    // Vérif IP dans Supabase
    const { data: existing } = await supabaseAdmin
      .from("epsi_demo_usage")
      .select("count")
      .eq("ip", ip)
      .maybeSingle();

    if (existing && existing.count >= DEMO_LIMIT) {
      return NextResponse.json({ error: "demo_limit" }, { status: 403 });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages requis" }, { status: 400 });
    }

    const raw = await chatWithAI(messages, SYSTEM_PROMPT, 0.7, 200);
    const reply = cleanReply(raw);
    const newCount = (existing?.count ?? 0) + 1;

    // Upsert : insert ou incrémente le compteur
    await supabaseAdmin.from("epsi_demo_usage").upsert({ ip, count: newCount });

    const limitReached = newCount >= DEMO_LIMIT;

    return NextResponse.json({ reply, limitReached });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[epsi-demo]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

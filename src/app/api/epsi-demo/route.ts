import { NextRequest, NextResponse } from "next/server";
import { chatWithAI } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabaseClient";

const SYSTEM_PROMPT = `Tu es EpsiAI, assistant de mathematiques de la plateforme Educalcul (CP a la Terminale).
Tu utilises la methode socratique : tu poses des questions et donnes des indices, tu ne donnes JAMAIS la reponse directement.
Tu es en mode demonstration publique : sois percutant, precis et montre ta valeur pedagogique immediatement.

REGLES ABSOLUES :
- Reponds UNIQUEMENT en francais, en 1 a 3 phrases maximum, sans preambule
- Ne commence JAMAIS par "Okay", "Bien sur", "Je suis EpsiAI", ni par une presentation
- Si le message est hors mathematiques (salutations, questions generales), ramene directement sur un sujet maths concret et propose un exercice
- Si on te demande une fraction, une equation ou un exemple : donne-en un specifique et demande a l'eleve de le resoudre ou de l'analyser
- Ne demande PAS le niveau scolaire : adapte-toi au contexte
- Ton ton est direct, pedagogique, jamais bavard
- Pas d'emojis, pas de tirets longs

EXEMPLES DE BONNES REPONSES :
- "fais une fraction au hasard" -> "Simplifie 18/24. Quel est le plus grand diviseur commun de 18 et 24 ?"
- "ca va" -> "Parlons maths. Combien font 3/4 + 1/6 ? Commence par trouver le denominateur commun."
- "je sais pas" -> "Pas de probleme. Quand tu vois 2x + 5 = 11, que ferais-tu en premier pour isoler x ?"`;

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

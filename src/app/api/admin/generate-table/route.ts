import { NextRequest } from "next/server";
import { generateStructuredContent } from "@/lib/llm";
import { requireRole } from "@/lib/apiAuth";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";

export async function POST(req: NextRequest) {
  // Défense en profondeur : proxy.ts protège déjà /api/admin/*, mais on revérifie ici au cas où.
  const admin = await requireRole(req, ["admin"]);
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const config = RATE_LIMITS["ai:admin"];
  const rate = await rateLimitWithBackoff(`ai:admin:${ip}`, config.maxAttempts, config.windowMs);
  if (!rate.allowed) {
    return Response.json({ error: "Trop de générations IA, réessaie dans quelques minutes." }, { status: 429 });
  }

  const { description, type, level } = await req.json();

  if (!description) {
    return Response.json({ error: "Description manquante" }, { status: 400 });
  }

  const typeHint =
    type === "sign"
      ? `C'est un tableau de signes. La première colonne contient "x" puis les lignes pour chaque expression/facteur, la dernière ligne est le signe du résultat. Utilise "+", "-", "0" et "‖" (double barre) pour les valeurs interdites, et des flèches si besoin.`
      : type === "variation"
      ? `C'est un tableau de variations. La première ligne est "x" avec les bornes et valeurs remarquables, la ligne suivante "f'(x)" si pertinent (signe), la dernière ligne "f(x)" avec les flèches "↗" (croissant) et "↘" (décroissant) entre les valeurs.`
      : `C'est un tableau de valeurs classique (ex: x et f(x)).`;

  const systemPrompt = `Tu es un professeur de mathématiques pour le niveau "${level || "Lycée"}". Tu génères des tableaux mathématiques (HTML) à partir d'une description.
${typeHint}
Réponds UNIQUEMENT avec un JSON de la forme :
{"headers": ["...", "..."], "rows": [["...", "..."], ["...", "..."]]}
Chaque sous-tableau de "rows" doit avoir le même nombre de colonnes que "headers". Utilise des symboles mathématiques unicode (↗, ↘, ∞, ‖, etc.) directement dans le texte des cellules.`;

  try {
    const result = (await generateStructuredContent(description, systemPrompt, 0.4)) as any;
    const headers = Array.isArray(result?.headers) ? result.headers.map(String) : [];
    const rows = Array.isArray(result?.rows)
      ? result.rows.map((r: any) => (Array.isArray(r) ? r.map(String) : []))
      : [];
    if (!headers.length || !rows.length) {
      throw new Error("Réponse IA invalide");
    }
    return Response.json({ headers, rows });
  } catch (e: unknown) {
    console.error("❌ Erreur génération tableau IA:", e);
    return Response.json({ error: sanitizeErrorMessage(errMessage(e) || "Erreur de génération") }, { status: 500 });
  }
}

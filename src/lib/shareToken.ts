import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { getUserData, setUserData } from "@/lib/userData";

/**
 * Lien de suivi en lecture seule (second adulte, répétiteur) : un jeton signé qui désigne un enfant, valable 30 jours.
 * Le parent peut le révoquer à tout moment : le jeton contient un numéro de version, qu'on incrémente pour tous les
 * anciens liens. Aucune donnée n'est stockée côté serveur hormis ce numéro.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const secret = () => `share:${process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "educalcul-dev-secret"}`;
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

interface ShareState {
  version: number;
}

export async function createShareToken(childId: number): Promise<{ token: string; expiresAt: string }> {
  const { version } = await getUserData<ShareState>(childId, "share", { version: 1 });
  const exp = Date.now() + TTL_MS;
  const payload = Buffer.from(JSON.stringify({ c: childId, v: version, e: exp })).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

/** Rend tous les liens déjà partagés inutilisables. */
export async function revokeShareTokens(childId: number): Promise<void> {
  const { version } = await getUserData<ShareState>(childId, "share", { version: 1 });
  await setUserData(childId, "share", { version: version + 1 });
}

/** Identifiant de l'enfant si le jeton est authentique, non expiré et non révoqué, sinon null. */
export async function verifyShareToken(token: string): Promise<number | null> {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { c: number; v: number; e: number };
    if (!Number.isInteger(data.c) || data.e < Date.now()) return null;
    const { version } = await getUserData<ShareState>(data.c, "share", { version: 1 });
    return data.v === version ? data.c : null;
  } catch {
    return null;
  }
}

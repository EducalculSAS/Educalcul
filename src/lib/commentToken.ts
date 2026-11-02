import { serverSecret } from "@/lib/serverSecret";
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Jeton opaque pour le « mini commentaire » de l'IA : la correction répond tout de suite (verdict + réponse de base) et
 * l'IA commente une seconde plus tard. Le client n'a jamais la bonne réponse : le jeton la transporte chiffrée (AES-GCM,
 * clé dérivée du secret serveur, durée de vie courte), sans rien stocker côté serveur.
 */
const TTL_MS = 10 * 60 * 1000;

export interface CommentPayload {
  question: string;
  correct: string;
  student: string;
  explanation?: string;
  level: string;
}

function key(): Buffer {
  const secret = serverSecret();
  return createHash("sha256").update(`mini-comment:${secret}`).digest();
}

export function sealComment(payload: CommentPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ ...payload, exp: Date.now() + TTL_MS }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function openComment(token: string): CommentPayload | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const data = JSON.parse(text) as CommentPayload & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { question: data.question, correct: data.correct, student: data.student, explanation: data.explanation, level: data.level };
  } catch {
    return null;
  }
}

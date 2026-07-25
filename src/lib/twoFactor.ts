import { createHash, randomInt, randomUUID } from "crypto";

/** Durée de validité d'une session 2FA vérifiée sur cet appareil. */
export const TWO_FACTOR_SESSION_TTL_MS = {
  admin: 4 * 60 * 60 * 1000,        // 4h — ré-vérification fréquente pour les comptes admin
  default: 30 * 24 * 60 * 60 * 1000, // 30 jours — "se souvenir de cet appareil" pour parent/enfant
};

export function generateTwoFactorCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashTwoFactorValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateTwoFactorSessionToken(): string {
  return randomUUID();
}

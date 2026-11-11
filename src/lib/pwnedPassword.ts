import "server-only";
import { createHash } from "crypto";

/**
 * Mot de passe déjà paru dans une fuite de données ? Vérification auprès de « Have I Been Pwned » par k-anonymat :
 * seuls les 5 premiers caractères de l'empreinte SHA-1 partent chez eux, jamais le mot de passe ni son empreinte
 * complète. Le service est gratuit et sans clé. S'il ne répond pas (2,5 s), on laisse passer : la règle de longueur
 * et de composition (validatePassword) reste appliquée.
 */
export const PWNED_MESSAGE = "Ce mot de passe figure dans une fuite de données connue : choisissez-en un autre.";

export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const suffix = sha1.slice(5);
    for (const line of (await res.text()).split("\n")) {
      const [hash, count] = line.trim().split(":");
      if (hash === suffix) return Number(count) > 0;
    }
    return false;
  } catch {
    return false;
  }
}

const COUNTRY_NAMES: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  LU: "Luxembourg",
  CA: "Canada",
  MA: "Maroc",
  TN: "Tunisie",
  DZ: "Algérie",
  SN: "Sénégal",
  CI: "Côte d'Ivoire",
  CM: "Cameroun",
  GB: "Royaume-Uni",
  DE: "Allemagne",
  ES: "Espagne",
  IT: "Italie",
  PT: "Portugal",
  US: "États-Unis",
  BR: "Brésil",
  MX: "Mexique",
  JP: "Japon",
  CN: "Chine",
  IN: "Inde",
  AU: "Australie",
  NL: "Pays-Bas",
  PL: "Pologne",
  RU: "Russie",
  TR: "Turquie",
};

function isPrivateIp(ip: string): boolean {
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.1, ::1
  return /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|::1)/.test(ip);
}

export function getClientIp(request: Pick<Request, "headers">): string | null {
  // Posé par Vercel lui-même : le navigateur ne peut pas le falsifier.
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For can include multiple IPs: client, proxy1, proxy2, ...
    // We want the real client IP, which is usually the LAST public IP before private proxies.
    // If all are private, fall back to the first (rare edge case of internal-only setup).
    const ips = forwarded.split(",").map((ip) => ip.trim());

    // Find the last public IP in the chain
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!isPrivateIp(ips[i])) {
        return ips[i];
      }
    }

    // All are private; return the first (most likely the real client in internal setups)
    return ips[0] || null;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export interface IpGeo {
  ip: string | null;
  available: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
}

/**
 * Localisation approximative (ville, pays) d'une connexion.
 *
 * Elle vient UNIQUEMENT des en-têtes que l'hébergeur (Vercel) ajoute à chaque
 * requête : aucune adresse IP n'est envoyée à un service tiers (avant, elle
 * partait vers ipinfo.io / ip-api.com, ce qui ajoutait des sous-traitants et un
 * transfert de données hors UE). En local, ces en-têtes n'existent pas : la
 * localisation est alors « indisponible » plutôt qu'inventée.
 */
export async function getIpGeo(request: Request): Promise<IpGeo> {
  const h = request.headers;
  const ip = getClientIp(request);

  const lat = parseFloat(h.get("x-vercel-ip-latitude") ?? "");
  const lng = parseFloat(h.get("x-vercel-ip-longitude") ?? "");
  const countryCode = h.get("x-vercel-ip-country") ?? "";
  const cityRaw = h.get("x-vercel-ip-city") ?? "";
  if (!countryCode && !cityRaw && !Number.isFinite(lat)) return { ip, available: false };

  let city: string | undefined;
  try {
    city = cityRaw ? decodeURIComponent(cityRaw) : undefined;
  } catch {
    city = cityRaw || undefined;
  }
  return {
    ip,
    available: true,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
    city,
    country: (COUNTRY_NAMES[countryCode] ?? countryCode) || undefined,
  };
}

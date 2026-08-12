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

export function getClientIp(request: Request): string | null {
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

export async function getIpGeo(request: Request): Promise<IpGeo> {
  const h = request.headers;
  const ip = getClientIp(request);
  const isLocal = !ip || ip === "127.0.0.1" || ip === "::1";

  // 1. IPinfo (plus précis, si un token est configuré)
  const ipinfoToken = process.env.IPINFO_TOKEN;
  if (ipinfoToken && !isLocal) {
    try {
      const geo = await fetch(
        `https://ipinfo.io/${ip}/json?token=${ipinfoToken}`,
        {
          signal: AbortSignal.timeout(4000),
          headers: { Accept: "application/json" },
        },
      ).then((r) => r.json());
      if (geo?.loc) {
        const [lat, lng] = String(geo.loc).split(",").map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return {
            ip,
            available: true,
            latitude: lat,
            longitude: lng,
            city: geo.city || undefined,
            country: (COUNTRY_NAMES[geo.country] ?? geo.country) || undefined,
          };
        }
      }
    } catch {
      // tombe sur les sources suivantes
    }
  }

  // 2. Vercel headers (exact, gratuit, prioritaire si dispo)
  const vercelLat = h.get("x-vercel-ip-latitude");
  const vercelLng = h.get("x-vercel-ip-longitude");
  if (vercelLat && vercelLng) {
    const countryCode = h.get("x-vercel-ip-country") ?? "";
    const cityRaw = h.get("x-vercel-ip-city") ?? "";
    return {
      ip,
      available: true,
      latitude: parseFloat(vercelLat),
      longitude: parseFloat(vercelLng),
      city: cityRaw ? decodeURIComponent(cityRaw) : undefined,
      country: (COUNTRY_NAMES[countryCode] ?? countryCode) || undefined,
    };
  }

  // 3. IP géoloc côté serveur (OVH, AWS, DigitalOcean, etc.)
  // Essayer même pour les IPs locales (fallback) en cas de développement
  try {
    const geoIp = ip && !isLocal ? ip : "8.8.8.8";
    const geo = await fetch(
      `http://ip-api.com/json/${geoIp}?fields=status,lat,lon,city,country,countryCode&lang=fr`,
      { signal: AbortSignal.timeout(4000) },
    ).then((r) => r.json());

    if (geo.status !== "success") {
      return { ip, available: false };
    }

    return {
      ip,
      available: true,
      latitude: geo.lat,
      longitude: geo.lon,
      city: geo.city || undefined,
      country: geo.country || undefined,
    };
  } catch {
    return { ip, available: false };
  }
}

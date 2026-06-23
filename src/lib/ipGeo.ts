const COUNTRY_NAMES: Record<string, string> = {
  FR:"France",BE:"Belgique",CH:"Suisse",LU:"Luxembourg",CA:"Canada",MA:"Maroc",
  TN:"Tunisie",DZ:"Algérie",SN:"Sénégal",CI:"Côte d'Ivoire",CM:"Cameroun",
  GB:"Royaume-Uni",DE:"Allemagne",ES:"Espagne",IT:"Italie",PT:"Portugal",
  US:"États-Unis",BR:"Brésil",MX:"Mexique",JP:"Japon",CN:"Chine",IN:"Inde",
  AU:"Australie",NL:"Pays-Bas",PL:"Pologne",RU:"Russie",TR:"Turquie",
};

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
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
        { signal: AbortSignal.timeout(4000), headers: { Accept: "application/json" } }
      ).then(r => r.json());
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
    const cityRaw     = h.get("x-vercel-ip-city") ?? "";
    return {
      ip,
      available: true,
      latitude:  parseFloat(vercelLat),
      longitude: parseFloat(vercelLng),
      city:      cityRaw ? decodeURIComponent(cityRaw) : undefined,
      country:   (COUNTRY_NAMES[countryCode] ?? countryCode) || undefined,
    };
  }

  // 3. IP géoloc côté serveur (OVH, AWS, DigitalOcean, etc.)
  if (isLocal) {
    return { ip, available: false };
  }

  try {
    const geo = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country,countryCode&lang=fr`,
      { signal: AbortSignal.timeout(4000) }
    ).then(r => r.json());

    if (geo.status !== "success") {
      return { ip, available: false };
    }

    return {
      ip,
      available: true,
      latitude:  geo.lat,
      longitude: geo.lon,
      city:      geo.city || undefined,
      country:   geo.country || undefined,
    };
  } catch {
    return { ip, available: false };
  }
}

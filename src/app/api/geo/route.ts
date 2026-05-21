import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COUNTRY_NAMES: Record<string, string> = {
  FR:"France",BE:"Belgique",CH:"Suisse",LU:"Luxembourg",CA:"Canada",MA:"Maroc",
  TN:"Tunisie",DZ:"Algérie",SN:"Sénégal",CI:"Côte d'Ivoire",CM:"Cameroun",
  GB:"Royaume-Uni",DE:"Allemagne",ES:"Espagne",IT:"Italie",PT:"Portugal",
  US:"États-Unis",BR:"Brésil",MX:"Mexique",JP:"Japon",CN:"Chine",IN:"Inde",
  AU:"Australie",NL:"Pays-Bas",PL:"Pologne",RU:"Russie",TR:"Turquie",
};

function getClientIp(request: Request): string | null {
  // Standard forwarded headers (Nginx, Apache, CDN, OVH, etc.)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

export async function GET(request: Request) {
  const h = request.headers;

  // ── 1. Vercel headers (exact, gratuit, prioritaire si dispo) ──────────────
  const vercelLat = h.get("x-vercel-ip-latitude");
  const vercelLng = h.get("x-vercel-ip-longitude");
  if (vercelLat && vercelLng) {
    const countryCode = h.get("x-vercel-ip-country") ?? "";
    const cityRaw     = h.get("x-vercel-ip-city") ?? "";
    return NextResponse.json({
      available: true,
      source:    "vercel",
      latitude:  parseFloat(vercelLat),
      longitude: parseFloat(vercelLng),
      city:      cityRaw ? decodeURIComponent(cityRaw) : undefined,
      country:   (COUNTRY_NAMES[countryCode] ?? countryCode) || undefined,
    });
  }

  // ── 2. IP géoloc côté serveur (OVH, AWS, DigitalOcean, etc.) ─────────────
  // Appel serveur → serveur : pas de popup, fonctionne sur n'importe quel hébergeur
  const ip = getClientIp(request);
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
    // Localhost / dev local : pas de géoloc disponible
    return NextResponse.json({ available: false, source: "dev" });
  }

  try {
    // ip-api.com — gratuit, sans clé, 45 req/min en HTTP (appel serveur → pas de problème HTTPS)
    const geo = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country,countryCode&lang=fr`,
      { signal: AbortSignal.timeout(4000) }
    ).then(r => r.json());

    if (geo.status !== "success") {
      return NextResponse.json({ available: false, source: "ip-api-fail" });
    }

    return NextResponse.json({
      available: true,
      source:    "ip-api",
      latitude:  geo.lat,
      longitude: geo.lon,
      city:      geo.city || undefined,
      country:   geo.country || undefined,
    });
  } catch {
    return NextResponse.json({ available: false, source: "error" });
  }
}

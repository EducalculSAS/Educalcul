import { readJsonBody } from "@/lib/apiJson";
import { NextRequest, NextResponse } from "next/server";
import { LEVEL_PAGES } from "@/lib/seo/levels";

const BASE = "https://educalcul.com";
const INDEXNOW_KEY = "57b16f79fd93430f85bf765bae399dd6";

// Toutes les pages publiques à signaler : les mêmes que le sitemap (pages de niveau lues dans LEVEL_PAGES, jamais une
// liste recopiée à la main, qui finissait par pointer vers des adresses disparues).
const ALL_URLS = [
  BASE,
  ...["/offres", "/tarifs", "/programmes", "/calia-tuteur-ia-maths", "/methode-pedagogique", "/a-propos", "/faq", "/contact", "/auth/inscription"].map((p) => `${BASE}${p}`),
  ...LEVEL_PAGES.map((l) => `${BASE}/programmes/${l.slug}`),
];

// Engines supporting IndexNow
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",        // Bing, DuckDuckGo, Yahoo, Qwant, Ecosia
  "https://yandex.com/indexnow",               // Yandex
  "https://search.seznam.cz/indexnow",         // Seznam
];

async function submitToIndexNow(urls: string[]) {
  const body = {
    host: "educalcul.com",
    key: INDEXNOW_KEY,
    keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  const results = await Promise.allSettled(
    INDEXNOW_ENDPOINTS.map(endpoint =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      })
    )
  );

  return results.map((r, i) => ({
    endpoint: INDEXNOW_ENDPOINTS[i],
    status: r.status === "fulfilled" ? r.value.status : "error",
    ok: r.status === "fulfilled" && r.value.ok,
  }));
}

// POST — submit specific URLs (called on deploy or content update)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-indexnow-secret");
  if (!process.env.INDEXNOW_SECRET || secret !== process.env.INDEXNOW_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(req);
  const urls: string[] = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === "string") : ALL_URLS;

  const results = await submitToIndexNow(urls);
  return NextResponse.json({ submitted: urls.length, results });
}

// GET — verify key (IndexNow spec: key must be accessible at /[key].txt)
export async function GET() {
  return NextResponse.json({
    key: INDEXNOW_KEY,
    keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
    urls: ALL_URLS.length,
    engines: INDEXNOW_ENDPOINTS,
  });
}

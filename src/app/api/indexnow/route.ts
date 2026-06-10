import { NextRequest, NextResponse } from "next/server";

const BASE = "https://educalcul.com";
const INDEXNOW_KEY = "57b16f79fd93430f85bf765bae399dd6";

// All public URLs to notify
const ALL_URLS = [
  BASE,
  `${BASE}/offres`,
  `${BASE}/tarifs`,
  `${BASE}/programmes`,
  `${BASE}/faq`,
  `${BASE}/contact`,
  `${BASE}/auth/inscription`,
  // Programme level pages
  ...["cp","ce1","ce2","cm1","cm2",
      "6eme","5eme","4eme","3eme",
      "2nde",
      "1ere-generale","1ere-generale-maths",
      "terminale-generale","terminale-generale-maths","terminale-generale-expertes",
      "terminale-generale-complementaires",
  ].map(l => `${BASE}/programmes/${l}`),
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
  if (secret !== process.env.INDEXNOW_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const urls: string[] = body.urls ?? ALL_URLS;

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

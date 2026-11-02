import { NextRequest, NextResponse } from "next/server";

const SITEMAP = "https://educalcul.com/sitemap.xml";

// Ping endpoints — submit sitemap to all major search engines
const PING_URLS = [
  // Google
  `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`,
  // Bing (covers DuckDuckGo, Yahoo, Qwant, Ecosia)
  `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`,
  // Yandex
  `https://blogs.yandex.ru/pings/?status=200&url=${encodeURIComponent(SITEMAP)}`,
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-ping-secret");
  if (!process.env.INDEXNOW_SECRET || secret !== process.env.INDEXNOW_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled(
    PING_URLS.map(url => fetch(url, { method: "GET" }))
  );

  const summary = results.map((r, i) => ({
    url: PING_URLS[i].split("?")[0],
    ok: r.status === "fulfilled" && (r.value.ok || r.value.status === 200),
    status: r.status === "fulfilled" ? r.value.status : "error",
  }));

  return NextResponse.json({ sitemap: SITEMAP, results: summary });
}

export async function GET() {
  return NextResponse.json({ sitemap: SITEMAP, engines: PING_URLS.map(u => u.split("?")[0]) });
}

export interface TrustpilotReview {
  id: string;
  title: string;
  text: string;
  rating: number;
  is_verified: boolean;
  published_at: string;
  name: string;
  country: string;
  total_reviews: number;
}

interface RawTrustpilotReview {
  review_id?: unknown;
  title?: unknown;
  text?: unknown;
  rating?: unknown;
  is_verified?: unknown;
  published_at_date?: unknown;
  reviewer?: {
    name?: unknown;
    country_code?: unknown;
    total_reviews?: unknown;
  };
}

type ApiResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; detail: string };

const API_BASE = "https://trustpilot-scraper-api.omkar.cloud/trustpilot";
const CACHE_SECONDS = 21_600;
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_RATING = 4;
const MAX_REVIEWS = 8;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

function candidateDomains(configuredDomain: string): string[] {
  const normalized = normalizeDomain(configuredDomain);
  if (!normalized) return [];

  const withoutWww = normalized.replace(/^www\./, "");
  return Array.from(new Set([normalized, withoutWww, `www.${withoutWww}`]));
}

function rawReviewsFromPayload(data: unknown): RawTrustpilotReview[] {
  if (Array.isArray(data)) return data as RawTrustpilotReview[];

  const record = asRecord(data);
  if (!record) return [];

  if (Array.isArray(record.reviews)) {
    return record.reviews as RawTrustpilotReview[];
  }

  // Le point d'accès « company details » expose les derniers avis sous
  // initial_reviews. Il sert de repli lorsque l'API paginée renvoie 400/404.
  if (Array.isArray(record.initial_reviews)) {
    return record.initial_reviews as RawTrustpilotReview[];
  }

  return [];
}

function normalizeReviews(data: unknown): TrustpilotReview[] {
  return rawReviewsFromPayload(data)
    .map((review): TrustpilotReview | null => {
      const rating = Number(review.rating);
      const id = cleanString(review.review_id);
      const text = cleanString(review.text);

      if (!id || !text || !Number.isFinite(rating) || rating < MIN_RATING) {
        return null;
      }

      const reviewer = asRecord(review.reviewer);
      const totalReviews = Number(reviewer?.total_reviews);

      return {
        id,
        title: cleanString(review.title, "Avis client"),
        text,
        rating,
        is_verified: review.is_verified === true,
        published_at: cleanString(review.published_at_date),
        name: cleanString(reviewer?.name, "Anonyme"),
        country: cleanString(reviewer?.country_code),
        total_reviews:
          Number.isFinite(totalReviews) && totalReviews > 0
            ? Math.trunc(totalReviews)
            : 1,
      };
    })
    .filter((review): review is TrustpilotReview => review !== null)
    .slice(0, MAX_REVIEWS);
}

async function callTrustpilot(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<ApiResult> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "API-Key": apiKey,
      },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 500);
      return { ok: false, status: response.status, detail };
    }

    return { ok: true, data: (await response.json()) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, detail: message };
  }
}

/**
 * Récupère les avis Trustpilot sans faire échouer la page d'accueil.
 *
 * Un 400/404 est traité comme « profil absent ou domaine non reconnu » :
 * l'application affiche simplement zéro avis. Pour les autres statuts, le
 * détail de l'API est journalisé afin de distinguer clé invalide, quota ou
 * panne amont.
 */
export async function fetchTrustpilotReviews(): Promise<TrustpilotReview[]> {
  const apiKey = process.env.TRUSTPILOT_SCRAPER_API_KEY?.trim();
  if (!apiKey || apiKey === "YOUR_API_KEY_HERE") return [];

  const configuredDomain =
    process.env.TRUSTPILOT_COMPANY_DOMAIN?.trim() || "educalcul.com";
  const domains = candidateDomains(configuredDomain);
  let lastExpectedMiss = "";

  for (const domain of domains) {
    // Requête minimale : seuls les paramètres requis sont envoyés. Le filtrage
    // 4/5 étoiles est fait localement pour éviter qu'un paramètre optionnel
    // incompatible ne transforme la page d'accueil en erreur 400.
    const reviewsResult = await callTrustpilot(
      "/companies/reviews",
      { domain, page: "1" },
      apiKey,
    );

    if (reviewsResult.ok) {
      return normalizeReviews(reviewsResult.data);
    }

    if (reviewsResult.status !== 400 && reviewsResult.status !== 404) {
      console.error(
        `[trustpilot-reviews] API error ${reviewsResult.status || "network"}: ${reviewsResult.detail || "réponse vide"}`,
      );
      return [];
    }

    lastExpectedMiss = reviewsResult.detail;

    // Repli documenté : « company details » contient initial_reviews.
    const detailsResult = await callTrustpilot(
      "/companies/details",
      { domain },
      apiKey,
    );

    if (detailsResult.ok) {
      return normalizeReviews(detailsResult.data);
    }

    if (detailsResult.status !== 400 && detailsResult.status !== 404) {
      console.error(
        `[trustpilot-reviews] API details error ${detailsResult.status || "network"}: ${detailsResult.detail || "réponse vide"}`,
      );
      return [];
    }

    lastExpectedMiss = detailsResult.detail || lastExpectedMiss;
  }

  // Un profil Trustpilot absent n'est pas une erreur applicative. On évite donc
  // un log « error » à chaque rendu de la page d'accueil.
  console.info(
    `[trustpilot-reviews] Aucun profil exploitable pour ${domains.join(", ")}${lastExpectedMiss ? ` (${lastExpectedMiss})` : ""}.`,
  );
  return [];
}

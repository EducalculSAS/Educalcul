import type { ReviewCardData } from "@/lib/manualReviews";
import { Check } from "lucide-react";
import type { ReviewRatingOverride } from "@/lib/reviewRatingOverride";

const TP_GREEN = "#00b67a";
const TP_GREY = "#dcdce6";

/** Échelle officielle Trustpilot (TrustScore) : 5 paliers, chacun avec sa
 * propre couleur ET son propre libellé — jamais juste "Excellent" partout,
 * sinon un 3,7 (palier "Très bien") s'affiche comme un 4,8 (palier
 * "Excellent"), ce qui ne correspond plus à la vraie fiche Trustpilot. */
function ratingColor(rating: number): string {
  if (rating >= 4.5) return "#00b67a"; // Excellent
  if (rating >= 4.0) return "#73cf11"; // Très bien
  if (rating >= 3.0) return "#ffce00"; // Moyen — ex: 3,7 (vérifié sur la vraie fiche Trustpilot)
  if (rating >= 2.0) return "#ff8622"; // Médiocre
  return "#ff3722"; // Mauvais
}

function ratingLabel(rating: number): string {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 4.0) return "Très bien";
  if (rating >= 3.0) return "Moyen";
  if (rating >= 2.0) return "Médiocre";
  return "Mauvais";
}

function TpStar({ filled, color, size = 28 }: { filled: boolean; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="2" fill={filled ? color : TP_GREY} />
      <path
        d="M20 6l3.708 11.41H35.41l-9.527 6.924 3.708 11.41L20 28.82l-9.59 6.924 3.708-11.41L4.59 17.41H16.29L20 6z"
        fill="#fff"
      />
    </svg>
  );
}

function TrustpilotLogo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="2" fill={TP_GREEN} />
        <path d="M20 6l3.708 11.41H35.41l-9.527 6.924 3.708 11.41L20 28.82l-9.59 6.924 3.708-11.41L4.59 17.41H16.29L20 6z" fill="#fff" />
      </svg>
      <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: size * 0.9, color: "#191919", letterSpacing: "-0.02em" }}>Trustpilot</span>
    </span>
  );
}

function TpStars({ rating, size = 28 }: { rating: number; size?: number }) {
  const color = ratingColor(rating);
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <TpStar key={i} filled={i < Math.round(rating)} color={color} size={size} />
      ))}
    </div>
  );
}

/** Rendu entièrement côté serveur : les avis sont récupérés au moment du
 * rendu de la page (voir src/lib/manualReviews.ts), plus besoin d'un fetch
 * client après montage (ça évitait un aller-retour + un flash "0 avis"). */
export default function TestimonialsSection({
  reviews,
  ratingOverride,
  compact = false,
}: {
  reviews: ReviewCardData[];
  ratingOverride?: ReviewRatingOverride;
  /** Badge Trustpilot seul, une ligne, sans la grille d'avis individuels. */
  compact?: boolean;
}) {
  const computedRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  const useOverride = ratingOverride?.enabled;
  const avgRating = useOverride ? ratingOverride!.rating : computedRating;
  const displayCount = useOverride ? ratingOverride!.count : reviews.length;
  const badgeColor = avgRating ? ratingColor(avgRating) : TP_GREEN;

  if (compact) {
    const label = ratingLabel(avgRating ?? 5);
    return (
      // Le survol (transform) et le flou (backdrop-blur) doivent rester sur
      // deux éléments distincts : les combiner sur le même casse le rendu du
      // flou pendant l'animation (bug WebKit connu, voir GlassButton.tsx).
      <a
        href="https://fr.trustpilot.com/review/educalcul.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block transition-transform duration-300 hover:-translate-y-[2px]"
      >
        <span
          className="inline-flex flex-wrap items-center justify-center gap-4 px-9 py-6 rounded-3xl backdrop-blur-[24px] backdrop-saturate-[1.4]"
          style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(197,161,72,0.22)", boxShadow: "0 4px 24px rgba(15,30,58,0.06)" }}
        >
          <span className="text-lg font-bold" style={{ color: "#191919" }}>{label}</span>
          <TpStars rating={avgRating ?? 5} size={30} />
          {avgRating !== null && (
            <span className="text-base" style={{ color: "#666" }}>{displayCount.toLocaleString("fr-FR")} avis sur</span>
          )}
          <TrustpilotLogo size={26} />
        </span>
      </a>
    );
  }

  return (
    <div>
      <div
        className="rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-[24px] backdrop-saturate-[1.4]"
        style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(197,161,72,0.22)", boxShadow: "0 2px 16px rgba(15,30,58,0.05)" }}
      >
        <div className="flex flex-col items-center sm:items-start gap-2">
          <TrustpilotLogo size={26} />
          {avgRating ? (
            <>
              <TpStars rating={avgRating} size={36} />
              <p className="text-sm font-bold" style={{ color: "#191919" }}>
                Note : <span style={{ color: badgeColor }}>{avgRating}</span>
                <span className="font-normal text-gray-400"> / 5 · {displayCount} avis</span>
              </p>
            </>
          ) : (
            <>
              <TpStars rating={0} size={36} />
              <p className="text-sm text-gray-400">Soyez le premier à laisser un avis !</p>
            </>
          )}
        </div>
        <a
          href="https://fr.trustpilot.com/review/educalcul.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block transition-transform duration-300 hover:-translate-y-[2px] active:scale-[0.98]"
        >
          <span
            className="block text-sm font-bold px-5 py-2.5 rounded-full backdrop-blur-[24px] backdrop-saturate-[1.4] transition-shadow hover:shadow-md"
            style={{ background: "rgba(0,182,122,0.9)", color: "#fff" }}
          >
            Laisser un avis
          </span>
        </a>
      </div>

      {reviews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reviews.slice(0, 8).map((r, i) => (
            <div
              key={r.id}
              className={`rounded-xl p-5 flex flex-col gap-3${i >= 4 ? " hidden lg:flex" : ""}`}
              data-keep-light style={{ background: "#fff", border: "1px solid #e8e8e8", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            >
              <TpStars rating={r.rating} size={22} />
              {r.title && (
                <p className="text-sm font-bold leading-snug" style={{ color: "#191919" }}>{r.title}</p>
              )}
              <p className="text-sm leading-relaxed flex-1" style={{ color: "#555" }}>
                {r.text.length > 150 ? r.text.slice(0, 147) + "…" : r.text}
              </p>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: ratingColor(r.rating) }}
                >
                  {r.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "#191919" }}>{r.name}</p>
                  <p className="text-[10px]" style={{ color: "#999" }}>{r.total_reviews} avis</p>
                </div>
                {r.is_verified && (
                  <span className="ml-auto text-[10px] font-semibold flex-shrink-0" style={{ color: TP_GREEN }}><Check className="w-3.5 h-3.5 inline -mt-0.5" aria-hidden="true" /> Vérifié</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

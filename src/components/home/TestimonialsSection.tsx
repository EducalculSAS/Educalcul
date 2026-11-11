import type { ReviewCardData } from "@/lib/manualReviews";
import { Check } from "lucide-react";
import type { ReviewRatingOverride } from "@/lib/reviewRatingOverride";

const TP_GREEN = "#00b67a";
const TP_GREY = "#dcdce6";

const STAR_PATH = "M20 6l3.708 11.41H35.41l-9.527 6.924 3.708 11.41L20 28.82l-9.59 6.924 3.708-11.41L4.59 17.41H16.29L20 6z";
const fr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Tuile d'étoile Trustpilot : carré vert, étoile blanche. `fill` de 0 à 1 : une demi-étoile est verte à gauche, grise à droite. */
function TpStar({ fill, size = 28, id }: { fill: number; size?: number; id: string }) {
  const pct = Math.max(0, Math.min(1, fill)) * 100;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {pct > 0 && pct < 100 && (
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset={`${pct}%`} stopColor={TP_GREEN} />
            <stop offset={`${pct}%`} stopColor={TP_GREY} />
          </linearGradient>
        </defs>
      )}
      <rect width="40" height="40" fill={pct >= 100 ? TP_GREEN : pct <= 0 ? TP_GREY : `url(#${id})`} />
      <path d={STAR_PATH} fill="#fff" />
    </svg>
  );
}

/** Logo Trustpilot : l'étoile verte à facette sombre, suivie du nom. */
function TrustpilotLogo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 .6l2.72 8.37h8.8l-7.12 5.17 2.72 8.37L12 17.34l-7.12 5.17 2.72-8.37L.48 8.97h8.8z" fill={TP_GREEN} />
        <path d="M17.02 16.03l-.62-1.89L12 17.34z" fill="#005128" />
      </svg>
      <span style={{ fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700, fontSize: size * 0.9, color: "#191919", letterSpacing: "-0.02em" }}>Trustpilot</span>
    </span>
  );
}

/** Cinq tuiles vertes, remplies à la demi-étoile près comme sur la fiche Trustpilot (3,7 → trois étoiles et demie). */
function TpStars({ rating, size = 28 }: { rating: number; size?: number }) {
  const shown = Math.round(rating * 2) / 2;
  const uid = `tp${String(rating).replace(/\D/g, "")}s${size}`;
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`${fr(rating)} sur 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <TpStar key={i} fill={shown - i} size={size} id={`${uid}-${i}`} />
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

  if (compact) {
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
          <TrustpilotLogo size={26} />
          <TpStars rating={avgRating ?? 0} size={30} />
          {avgRating !== null ? (
            <span className="text-base" style={{ color: "#191919" }}>
              <strong style={{ color: "#007a52" }}>{fr(avgRating)} sur 5</strong>
              <span style={{ color: "#555" }}> · {displayCount.toLocaleString("fr-FR")} avis</span>
            </span>
          ) : (
            <span className="text-base" style={{ color: "#555" }}>Donnez votre avis</span>
          )}
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
                <span style={{ color: "#007a52" }}>{fr(avgRating)} sur 5</span>
                <span className="font-normal" style={{ color: "#555" }}> · {displayCount} avis</span>
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
                  style={{ background: TP_GREEN }}
                >
                  {r.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "#191919" }}>{r.name}</p>
                  <p className="text-[10px]" style={{ color: "#6b6b6b" }}>{r.total_reviews} avis</p>
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

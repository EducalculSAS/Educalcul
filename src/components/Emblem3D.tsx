import { useId } from "react";

/**
 * Illustrations en relief (dans l'esprit de la flamme de série et des contours d'avatar) pour les écrans qui n'avaient
 * qu'une icône plate et pâle : listes vides, accueil du tutoriel, écran de repos. Entièrement vectorielles (nettes à
 * toutes les tailles, aucun fichier image) : volume donné par une tranche plus sombre sous chaque forme, des dégradés,
 * un reflet et une ombre au sol. L'objet flotte doucement ; l'animation s'arrête hors écran, pendant le défilement et
 * si « réduire les animations » est activé (classe `emblem3d`, voir AnimationGovernor et globals.css).
 */
export type EmblemKind = "trophy" | "book" | "calculator" | "family" | "mail" | "compass" | "moon";

interface Props {
  kind: EmblemKind;
  /** Côté en pixels (carré). */
  size?: number;
  className?: string;
}

export default function Emblem3D({ kind, size = 96, className = "" }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = (n: string) => `url(#${id}${n})`;
  return (
    <span className={`inline-block align-middle ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 96 96" width={size} height={size} className="block overflow-visible">
        <defs>
          <linearGradient id={`${id}gold`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8e3a0" /><stop offset="0.5" stopColor="#dcb650" /><stop offset="1" stopColor="#a8842c" />
          </linearGradient>
          <linearGradient id={`${id}goldDark`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b08a30" /><stop offset="1" stopColor="#7c5f1a" />
          </linearGradient>
          <linearGradient id={`${id}navy`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a5288" /><stop offset="1" stopColor="#0f1e3a" />
          </linearGradient>
          <linearGradient id={`${id}navyDark`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f1e3a" /><stop offset="1" stopColor="#060d1c" />
          </linearGradient>
          <linearGradient id={`${id}cream`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#ead9b4" />
          </linearGradient>
          <radialGradient id={`${id}ball`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fff3c9" /><stop offset="0.45" stopColor="#dcb650" /><stop offset="1" stopColor="#8a6a1e" />
          </radialGradient>
          <radialGradient id={`${id}ballNavy`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#7d95c9" /><stop offset="0.5" stopColor="#2a3f6b" /><stop offset="1" stopColor="#0b1730" />
          </radialGradient>
          <radialGradient id={`${id}ground`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#0f1e3a" stopOpacity="0.28" /><stop offset="1" stopColor="#0f1e3a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ombre au sol : elle reste immobile pendant que l'objet flotte. */}
        <ellipse cx="48" cy="88" rx="26" ry="5" fill={g("ground")} />

        <g className="emblem3d">
          {kind === "trophy" && (
            <>
              {/* anses */}
              <path d="M27 24 C12 24 12 46 30 48" fill="none" stroke={g("goldDark")} strokeWidth="5" strokeLinecap="round" />
              <path d="M69 24 C84 24 84 46 66 48" fill="none" stroke={g("goldDark")} strokeWidth="5" strokeLinecap="round" />
              {/* pied et socle */}
              <rect x="43" y="54" width="10" height="14" rx="2" fill={g("goldDark")} />
              <rect x="30" y="70" width="36" height="12" rx="3" fill={g("navyDark")} />
              <rect x="30" y="67" width="36" height="12" rx="3" fill={g("navy")} />
              <rect x="38" y="70.5" width="20" height="5" rx="1.5" fill={g("gold")} />
              {/* coupe : tranche sombre puis face */}
              <path d="M25 19 H71 C71 44 62 59 48 59 C34 59 25 44 25 19 Z" fill={g("goldDark")} />
              <path d="M25 16 H71 C71 41 62 56 48 56 C34 56 25 41 25 16 Z" fill={g("gold")} />
              <ellipse cx="48" cy="16" rx="23" ry="4.5" fill="#fff0bf" />
              <ellipse cx="48" cy="16.6" rx="18" ry="2.8" fill="#b08a30" opacity="0.55" />
              {/* reflet et étoile */}
              <path d="M32 22 C32 36 36 46 42 51" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M48 26 L51.2 33 L58.8 33.8 L53.1 38.9 L54.8 46.4 L48 42.5 L41.2 46.4 L42.9 38.9 L37.2 33.8 L44.8 33 Z" fill="#fff6d6" opacity="0.92" />
            </>
          )}

          {kind === "book" && (
            <>
              {/* couverture (tranche) */}
              <path d="M8 34 L48 42 L88 34 V72 L48 80 L8 72 Z" fill={g("navyDark")} />
              <path d="M8 30 L48 38 L88 30 V68 L48 76 L8 68 Z" fill={g("navy")} />
              {/* pages */}
              <path d="M12 26 C24 20 38 22 48 30 V70 C38 62 24 60 12 66 Z" fill={g("cream")} />
              <path d="M84 26 C72 20 58 22 48 30 V70 C58 62 72 60 84 66 Z" fill={g("cream")} />
              <path d="M48 30 V70" stroke="#c9b27c" strokeWidth="1.5" />
              <path d="M48 30 C44 27 41 25.5 38 24.6 V63.4 C41 64.4 44 66.4 48 70 Z" fill="#0f1e3a" opacity="0.08" />
              {/* lignes de texte */}
              <g stroke="#b9a36c" strokeWidth="2" strokeLinecap="round" opacity="0.75">
                <path d="M19 33 C26 30 34 31 41 35" /><path d="M19 41 C26 38 34 39 41 43" /><path d="M19 49 C26 46 34 47 41 51" />
                <path d="M55 35 C62 31 70 30 77 33" /><path d="M55 43 C62 39 70 38 77 41" /><path d="M55 51 C62 47 70 46 77 49" />
              </g>
              {/* marque-page */}
              <path d="M64 22 V44 L68.5 39.5 L73 44 V22.6 C70 21.8 67 21.6 64 22 Z" fill={g("gold")} />
            </>
          )}

          {kind === "calculator" && (
            <>
              <rect x="24" y="13" width="48" height="70" rx="9" fill={g("navyDark")} />
              <rect x="24" y="9" width="48" height="70" rx="9" fill={g("navy")} />
              <rect x="30" y="16" width="36" height="16" rx="4" fill="#0b1730" />
              <rect x="31.5" y="17.5" width="33" height="13" rx="3" fill="#dff3e4" />
              <path d="M34 20.5 H48" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
              <path d="M52 27 H61" stroke="#0f1e3a" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
              {/* touches : tranche sombre + face */}
              {[0, 1, 2].map((r) => [0, 1, 2].map((c) => {
                const gold = c === 2;
                const x = 30.5 + c * 12.5, y = 38 + r * 12.5;
                return (
                  <g key={`${r}-${c}`}>
                    <rect x={x} y={y + 2} width="10" height="9" rx="2.5" fill={gold ? g("goldDark") : "#b9a36c"} />
                    <rect x={x} y={y} width="10" height="9" rx="2.5" fill={gold ? g("gold") : g("cream")} />
                  </g>
                );
              }))}
              <path d="M28 14 C28 12 29 11 31 11 H50" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
            </>
          )}

          {kind === "family" && (
            <>
              {/* adulte bleu */}
              <path d="M12 82 C12 60 20 50 30 50 C40 50 48 60 48 82 Z" fill={g("navyDark")} />
              <path d="M12 79 C12 57 20 47 30 47 C40 47 48 57 48 79 Z" fill={g("navy")} />
              <circle cx="30" cy="31" r="13" fill={g("ballNavy")} />
              {/* adulte doré */}
              <path d="M48 82 C48 60 56 50 66 50 C76 50 84 60 84 82 Z" fill={g("goldDark")} />
              <path d="M48 79 C48 57 56 47 66 47 C76 47 84 57 84 79 Z" fill={g("gold")} />
              <circle cx="66" cy="31" r="13" fill={g("ball")} />
              {/* enfant, devant */}
              <path d="M33 84 C33 69 39 62 48 62 C57 62 63 69 63 84 Z" fill="#c9b27c" />
              <path d="M33 81 C33 66 39 59 48 59 C57 59 63 66 63 81 Z" fill={g("cream")} />
              <circle cx="48" cy="48" r="9.5" fill={g("cream")} stroke="#c9b27c" strokeWidth="1" />
              <ellipse cx="44.5" cy="44.5" rx="3" ry="2" fill="#fff" opacity="0.9" />
            </>
          )}

          {kind === "mail" && (
            <>
              <rect x="12" y="29" width="72" height="50" rx="7" fill="#c9b27c" />
              <rect x="12" y="25" width="72" height="50" rx="7" fill={g("cream")} />
              <path d="M14 72 L40 50 M82 72 L56 50" stroke="#c9b27c" strokeWidth="2" strokeLinecap="round" />
              {/* rabat */}
              <path d="M14 28 C14 26.5 15.5 25 18 25 H78 C80.5 25 82 26.5 82 28 L52 54 C49.5 56 46.5 56 44 54 Z" fill={g("goldDark")} />
              <path d="M14 26 C14 25.4 15 25 18 25 H78 C81 25 82 25.4 82 26 L52 51 C49.5 53 46.5 53 44 51 Z" fill={g("gold")} />
              <path d="M22 28 H58" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
              {/* cachet */}
              <circle cx="48" cy="52" r="8" fill={g("navyDark")} />
              <circle cx="48" cy="50.5" r="8" fill={g("ballNavy")} />
              <path d="M44.5 50.5 L47 53 L52 47.5" fill="none" stroke="#f8e3a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {kind === "compass" && (
            <>
              <circle cx="48" cy="50" r="33" fill={g("goldDark")} />
              <circle cx="48" cy="46" r="33" fill={g("gold")} />
              <circle cx="48" cy="46" r="26" fill={g("navyDark")} />
              <circle cx="48" cy="46" r="24.5" fill={g("ballNavy")} />
              {/* graduations */}
              <g stroke="#f8e3a0" strokeWidth="2" strokeLinecap="round" opacity="0.85">
                <path d="M48 25 V29" /><path d="M48 63 V67" /><path d="M27 46 H31" /><path d="M65 46 H69" />
              </g>
              {/* aiguille */}
              <path d="M60 34 L52.5 50.5 L43.5 41.5 Z" fill={g("gold")} />
              <path d="M36 58 L43.5 41.5 L52.5 50.5 Z" fill={g("cream")} />
              <circle cx="48" cy="46" r="3.2" fill="#0f1e3a" stroke="#f8e3a0" strokeWidth="1.2" />
              {/* reflet du verre */}
              <path d="M30 36 C34 28 41 24 48 23.5" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
              <path d="M22 30 C28 20 38 14.5 48 14" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}

          {kind === "moon" && (
            <>
              <path d="M62 16 C40 17 26 32 26 50 C26 68 40 82 58 82 C68 82 76 78 82 71 C64 73 48 61 48 42 C48 31 53 22 62 16 Z" fill={g("goldDark")} transform="translate(0 3)" />
              <path d="M62 16 C40 17 26 32 26 50 C26 68 40 82 58 82 C68 82 76 78 82 71 C64 73 48 61 48 42 C48 31 53 22 62 16 Z" fill={g("ball")} />
              <path d="M34 40 C36 31 42 25 49 22" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
              <path d="M72 24 L73.8 29.2 L79 31 L73.8 32.8 L72 38 L70.2 32.8 L65 31 L70.2 29.2 Z" fill="#fff3c9" />
              <path d="M84 46 L85.1 49.4 L88.5 50.5 L85.1 51.6 L84 55 L82.9 51.6 L79.5 50.5 L82.9 49.4 Z" fill="#fff3c9" opacity="0.85" />
              <circle cx="62" cy="48" r="1.6" fill="#fff3c9" opacity="0.8" />
            </>
          )}
        </g>
      </svg>
    </span>
  );
}

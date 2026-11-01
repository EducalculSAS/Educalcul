import { avatarUrl, ADMIN_AVATAR } from "@/lib/avatarUrl";

/**
 * LE rendu d'avatar du site — forum, classements, profils, espace parent,
 * admin : partout le même, pour qu'un utilisateur soit reconnaissable d'un
 * écran à l'autre.
 *
 * - Forme : carré aux coins très arrondis (celle de la fiche utilisateur
 *   admin), fond navy léger, initiales en navy quand il n'y a pas d'avatar.
 * - Contour : TOUJOURS présent. Le contour équipé (badge, abonnement, admin)
 *   s'affiche animé ; sans contour équipé, un fin trait doré.
 * - Image : vignette WebP de l'avatar préréglé (~4 Ko), jamais le portrait
 *   d'origine (~850 Ko).
 *
 * Composant sans état ni effet : utilisable tel quel dans un Server Component.
 */

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE: Record<AvatarSize, number> = { xs: 28, sm: 36, md: 44, lg: 64, xl: 88, "2xl": 112 };

interface Ring {
  /** Épaisseur du contour (px) et trait fixe pour « aucun ». */
  width: number;
  /** Nombre d'étincelles qui font le tour de l'avatar (0 = aucune). */
  sparks: number;
}

/**
 * Contour par clé `equipped_border` (voir BORDER_STYLES dans badgeStyles.ts). Les couleurs, vitesses et le halo sont dans
 * globals.css (`.ring-fx[data-ring="…"]`) : bande de dégradé qui tourne, halo qui respire, étincelles qui courent sur le contour,
 * dans l'esprit de la flamme de série (plusieurs couches, vivant), au lieu d'un simple trait qui change de couleur.
 */
const RINGS: Record<string, Ring> = {
  none:     { width: 1.5, sparks: 0 },
  bronze:   { width: 2,   sparks: 1 },
  silver:   { width: 2,   sparks: 1 },
  gold:     { width: 2.5, sparks: 2 },
  diamond:  { width: 2.5, sparks: 3 },
  premium:  { width: 2.5, sparks: 2 },
  famille:  { width: 2.5, sparks: 1 },
  flamme:   { width: 3,   sparks: 3 },
  pro:      { width: 2.5, sparks: 2 },
  elite:    { width: 3,   sparks: 3 },
  mathador: { width: 2.5, sparks: 2 },
  admin:    { width: 3,   sparks: 3 },
};

/** "border-admin" (ancien format du profil admin) → "admin". */
export function normalizeBorderKey(key: string | null | undefined): string {
  const k = (key || "none").replace(/^border-/, "");
  return k in RINGS ? k : "none";
}

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface Props {
  avatar?: string | null;
  equippedBorder?: string | null;
  name: string;
  size?: AvatarSize;
  /** Pastille verte « en ligne ». */
  online?: boolean;
  className?: string;
  /** Lisible par les lecteurs d'écran ; vide si le nom est déjà écrit à côté. */
  label?: string;
}

export default function AvatarWithBorder({
  avatar, equippedBorder, name, size = "sm", online = false, className = "", label,
}: Props) {
  const av = SIZE[size];
  const ring = RINGS[normalizeBorderKey(equippedBorder)];
  const url = avatarUrl(avatar);
  const isLogo = url === ADMIN_AVATAR;

  // Espace réservé autour de l'image pour le contour (+ sa lueur animée).
  const gap = Math.max(2, Math.round(av * 0.05));
  const total = av + (ring.width + gap) * 2;
  const radius = Math.round(av * 0.28);
  const ringRadius = radius + gap + ring.width / 2;

  return (
    <span
      className={`relative inline-block shrink-0 align-middle ${className}`}
      style={{ width: total, height: total }}
      role="img"
      aria-label={label ?? name ?? "Avatar"}
    >
      <span
        className="absolute overflow-hidden flex items-center justify-center font-bold select-none"
        style={{
          inset: ring.width + gap,
          borderRadius: radius,
          background: isLogo ? "#fff" : "rgba(15,30,58,0.08)",
          color: "var(--greek-blue)",
          fontSize: Math.round(av * 0.36),
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette statique de 4 Ko, déjà optimisée
          <img
            src={url}
            alt=""
            width={av}
            height={av}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={isLogo ? "w-full h-full object-contain p-[14%]" : "w-full h-full object-cover"}
          />
        ) : (
          initialsOf(name)
        )}
      </span>

      <span
        className="ring-fx"
        data-ring={normalizeBorderKey(equippedBorder)}
        aria-hidden="true"
        style={{ borderRadius: ringRadius + ring.width / 2, ["--rw" as string]: `${ring.width}px`, ["--spark" as string]: `${Math.max(2, Math.round(total * 0.045))}px` }}
      >
        <i className="ring-fx-glow" />
        <i className="ring-fx-band" />
        {size !== "xs" && ring.sparks > 0 && (
          <span className="ring-fx-path" style={{ inset: ring.width / 2, borderRadius: ringRadius, ["--rr" as string]: `${ringRadius}px` }}>
            {Array.from({ length: ring.sparks }, (_, i) => (
              <b key={i} className="ring-fx-spark" style={{ animationDelay: `${-(i * 100) / ring.sparks}%`, animationDuration: `calc(var(--ring-dur, 4s) * ${1.6 + i * 0.25})` }} />
            ))}
          </span>
        )}
      </span>

      {online && (
        <span
          className="absolute rounded-full bg-green-500 border-2 border-white"
          style={{ width: Math.max(9, av * 0.24), height: Math.max(9, av * 0.24), right: 0, bottom: 0 }}
          aria-label="En ligne"
        />
      )}
    </span>
  );
}

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
  stroke: string;
  width: number;
  /** Classe d'animation du trait (globals.css, `.border-anim-*`). */
  anim?: string;
}

/** Contour par clé `equipped_border` (voir BORDER_STYLES dans badgeStyles.ts). */
const RINGS: Record<string, Ring> = {
  none:     { stroke: "rgba(197,161,72,0.55)", width: 1.5 },
  bronze:   { stroke: "#cd7f32", width: 2,   anim: "border-anim-bronze" },
  silver:   { stroke: "#b0b8c8", width: 2,   anim: "border-anim-silver" },
  gold:     { stroke: "#ffd700", width: 2.5, anim: "border-anim-gold" },
  diamond:  { stroke: "#22d3ee", width: 2.5, anim: "border-anim-diamond" },
  premium:  { stroke: "#a855f7", width: 2.5, anim: "border-anim-premium" },
  famille:  { stroke: "#14b8a6", width: 2.5 },
  flamme:   { stroke: "#f97316", width: 3,   anim: "border-anim-flame" },
  pro:      { stroke: "#f59e0b", width: 2.5, anim: "border-anim-pro" },
  elite:    { stroke: "#7c3aed", width: 3,   anim: "border-anim-elite" },
  mathador: { stroke: "#6366f1", width: 2.5, anim: "border-anim-premium" },
  admin:    { stroke: "#ff6b6b", width: 3,   anim: "border-anim-admin" },
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
  const ringInset = ring.width / 2;
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

      <svg className="absolute inset-0 pointer-events-none overflow-visible" width={total} height={total} aria-hidden="true">
        <rect
          x={ringInset}
          y={ringInset}
          width={total - ring.width}
          height={total - ring.width}
          rx={ringRadius}
          ry={ringRadius}
          fill="none"
          stroke={ring.stroke}
          strokeWidth={ring.width}
          className={ring.anim}
        />
      </svg>

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

import AvatarRingDecor from "@/components/AvatarRingDecor";
import FlameFire from "@/components/FlameFire";
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

/** Épaisseur du cadre (px) selon la taille : les niveaux sont de vrais cadres épais en relief ; « aucun » reste un simple trait fin. */
const FRAME_W: Record<AvatarSize, number> = { xs: 3, sm: 4.5, md: 5.5, lg: 7.5, xl: 10, "2xl": 12 };
const KEYS = new Set(["none", "bronze", "silver", "gold", "diamond", "premium", "famille", "flamme", "pro", "elite", "mathador", "admin"]);

/** "border-admin" (ancien format du profil admin) → "admin". */
export function normalizeBorderKey(key: string | null | undefined): string {
  const k = (key || "none").replace(/^border-/, "");
  return KEYS.has(k) ? k : "none";
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
  const key = normalizeBorderKey(equippedBorder);
  const bigFlame = key === "flamme" && (size === "lg" || size === "xl" || size === "2xl");
  const rw = key === "none" ? 1.5 : bigFlame ? Math.max(2, FRAME_W[size] * 0.3) : FRAME_W[size];
  const url = avatarUrl(avatar);
  const isLogo = url === ADMIN_AVATAR;

  // Espace réservé autour de l'image pour le contour (+ sa lueur animée).
  const gap = Math.max(2, Math.round(av * 0.05));
  const total = av + (rw + gap) * 2;
  const radius = Math.round(av * 0.28);
  const ringRadius = radius + gap + rw / 2;

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
          inset: rw + gap,
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

      {key === "none" ? (
        <span className="ring-fx" data-ring="none" aria-hidden="true" style={{ borderRadius: ringRadius + rw / 2, ["--rw" as string]: `${rw}px` }}>
          <i className="ring-fx-band" />
        </span>
      ) : bigFlame ? (
        <span className="ring-fx" aria-hidden="true">
          <FlameFire total={total} inset={rw + gap} avatar={av} radius={radius} />
        </span>
      ) : (
        <span className="ring-fx" aria-hidden="true">
          <AvatarRingDecor ringKey={key} w={(rw / total) * 100} r={(ringRadius / total) * 100} compact={size === "xs"} />
        </span>
      )}

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

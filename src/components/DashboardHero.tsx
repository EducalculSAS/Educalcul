import type { ReactNode } from "react";
import { Camera } from "lucide-react";
import Link from "@/components/AppLink";
import GlassIconButton from "@/components/ui/GlassIconButton";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { getNameColor } from "@/lib/badgeStyles";
import { DEFAULT_COLOR } from "@/lib/cosmetics/catalog";

/**
 * En-tête des tableaux de bord élève et parent : la personne d'abord (avatar avec son contour, nom avec son titre),
 * pas des compteurs. `extra` reçoit ce qui la distingue (badges mis en avant), `aside` un seul repère utile.
 */
export default function DashboardHero({ name, avatar, equippedBorder, nameColor, pill, tagline, profileHref, extra, aside, greeting = "Bonjour", onEditAvatar, below }: {
  name: string;
  avatar?: string | null;
  equippedBorder?: string | null;
  nameColor?: string | null;
  /** Pastille dorée : la classe de l'élève, « Parent »… */
  pill: string;
  tagline: string;
  /** Tableau de bord : l'avatar mène au profil. Omis sur le profil lui-même. */
  profileHref?: string;
  /** Petit mot au-dessus du nom (« Bonjour », « Mon profil »). */
  greeting?: string;
  /** Page de profil : un bouton sur l'avatar ouvre le choix de la photo, affiché dans `below`. */
  onEditAvatar?: () => void;
  below?: ReactNode;
  extra?: ReactNode;
  aside?: ReactNode;
}) {
  const styled = !!nameColor && nameColor !== DEFAULT_COLOR;
  return (
    <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" aria-hidden="true" />
      <div className="container mx-auto max-w-6xl relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5 min-w-0">
          {profileHref ? (
            <Link href={profileHref} aria-label="Mon profil" className="shrink-0 transition-transform duration-300 hover:scale-105">
              <AvatarWithBorder avatar={avatar} equippedBorder={equippedBorder} name={name} size="xl" label="" onDark />
            </Link>
          ) : (
            <span className="relative shrink-0">
              <AvatarWithBorder avatar={avatar} equippedBorder={equippedBorder} name={name} size="xl" label="" onDark />
              {onEditAvatar && (
                <span className="absolute -bottom-1 -right-1">
                  <GlassIconButton icon={Camera} color="gold" size="sm" onClick={onEditAvatar} aria-label="Changer ma photo de profil" />
                </span>
              )}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--greek-gold)] mb-1">{greeting}</p>
            <h1 className="text-3xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 leading-tight">
              {/* Le titre équipé garde ses ornements : jamais de troncature sur le nom. */}
              <span className={styled ? getNameColor(nameColor!).cls : "[overflow-wrap:anywhere]"}>{name}</span>
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base md:text-lg opacity-90">
              <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-3 py-1 rounded-full">{pill}</span>
              <span>{tagline}</span>
            </p>
            {extra && <div className="mt-4">{extra}</div>}
          </div>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {below && <div className="container mx-auto max-w-6xl relative z-10 mt-6">{below}</div>}
    </div>
  );
}

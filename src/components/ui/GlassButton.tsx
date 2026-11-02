"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { clampGlassTranslate, isRectOffscreen, glassButtonRegistry } from "@/lib/liquidGlassBounds";
import { splitPositionClasses } from "@/lib/splitPositionClasses";

const DEFAULT_TRANSITION = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
const PRESS_TRANSITION = "transform 0.12s ease-out";
const RELEASE_TRANSITION = "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)";
const PRESS_SCALE = 0.93;

// Registre partagé avec GlassIconButton (src/lib/liquidGlassBounds.ts) — la
// vérification "suis-je le plus proche du curseur" doit comparer TOUS les
// boutons "verre liquide" de la page, pas seulement les frères DOM directs ni
// seulement les instances du même composant : deux boutons dans deux cartes
// tarifs différentes ne sont pas frères, et un GlassButton à côté d'un
// GlassIconButton (ex. "Exporter en .txt" + la corbeille ronde) doivent aussi
// se voir l'un l'autre pour ne pas réagir chacun dans son coin.
const registry = glassButtonRegistry;

type GlassButtonVariant =
  | "gold"
  | "light"
  | "navy"
  | "outline"
  | "danger"
  | "ghost";

/** Un seul jeu de couleurs par variante — change ici pour changer tous les
 * boutons du site qui utilisent cette variante. Transparent partout (même
 * registre que "light"/"Se connecter"), juste teinté — le saturate a été
 * réduit (1.2) pour que ça reste cohérent d'une section à l'autre. */
const VARIANTS: Record<GlassButtonVariant, CSSProperties> = {
  // Sur fond navy (héros, CTA final) — pilule dorée. Un doré translucide
  // (ancienne version, 32 % d'opacité) virait au kaki sur le bleu nuit : le
  // dégradé reprend le doré du logo, avec un texte navy lisible.
  gold: {
    background: "linear-gradient(180deg, rgba(222,188,104,0.92) 0%, rgba(190,152,62,0.92) 100%)",
    color: "var(--greek-blue)",
    borderColor: "rgba(240,214,150,0.55)",
  },
  // Sur fond navy — pilule claire secondaire.
  light: {
    background: "rgba(255,255,255,0.14)",
    color: "rgba(240,237,232,0.9)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  // Sur fond blanc (cartes tarifs) — pilule navy translucide, assez opaque
  // pour garder sa teinte (trop transparente sur fond blanc, elle vire gris).
  navy: {
    background: "rgba(15,30,58,0.72)",
    color: "#fff",
    borderColor: "rgba(255,255,255,0.18)",
  },
  // Sur fond blanc (cartes tarifs) — contour navy.
  outline: {
    background: "rgba(15,30,58,0.04)",
    color: "var(--greek-blue)",
    borderColor: "rgba(15,30,58,0.3)",
  },
  // Action destructive (supprimer/bannir) — partout, fond clair ou foncé.
  danger: {
    background: "rgba(220,38,38,0.12)",
    color: "#dc2626",
    borderColor: "rgba(220,38,38,0.3)",
  },
  // Action secondaire discrète (annuler, fermer une modale) — sur fond blanc.
  ghost: {
    background: "rgba(15,30,58,0.03)",
    color: "var(--text-muted)",
    borderColor: "rgba(15,30,58,0.12)",
  },
};

interface GlassButtonProps {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: GlassButtonVariant;
  className?: string;
  style?: CSSProperties;
  /** Le bouton (et son wrapper) remplit la largeur du parent, ex. dans une carte tarif. */
  fullWidth?: boolean;
  /** "full" = pilule (défaut) — "xl" = coin arrondi classique, pour les cartes tarifs. */
  rounded?: "full" | "xl";
  /** "md" = padding généreux (défaut, pages publiques) — "sm" = compact, pour
   * les actions denses (tableaux/modales admin, barres d'outils). */
  size?: "md" | "sm";
  /** Désactive le bouton (validation en cours, action indisponible) — visuel
   * grisé, ni clic ni navigation ni effets liquid glass. Si `href` est fourni
   * en même temps, la navigation est ignorée tant que `disabled` est vrai. */
  disabled?: boolean;
  /** "submit" dans un <form> : la touche Entrée d'un champ valide le
   * formulaire (sinon rien ne se passe, faute de bouton d'envoi). */
  type?: "button" | "submit";
}

/** Bouton "verre liquide" universel — même comportement partout sur le site :
 * flou réel (backdrop-filter, comme la navbar), étirement élastique ancré au
 * curseur, rebond au clic (mi-rebond tenu, complété au relâché). Couleur
 * pilotée par `variant` pour rester cohérent quel que soit le fond. Un seul
 * bout de code : changer VARIANTS ci-dessus change tous les boutons qui
 * l'utilisent, changer le comportement ici le change partout aussi.
 *
 * Le `transform` va sur un <span> englobant, jamais sur l'élément qui porte
 * `backdrop-blur` : Safari arrête de rendre le flou dès qu'un `transform`
 * change sur le même élément — bug WebKit connu. `href` → vrai lien
 * navigable ; `onClick` → bouton (pour les cas type "ouvrir une modale" où
 * il ne s'agit pas d'une navigation). */
export default function GlassButton({
  href,
  onClick,
  children,
  variant = "gold",
  className = "",
  style,
  fullWidth = false,
  rounded = "full",
  size = "md",
  disabled = false,
  type = "button",
}: GlassButtonProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const raf = useRef(0);
  const stretch = useRef({ tx: 0, ty: 0, scaleX: 1, scaleY: 1 });
  const pressed = useRef(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const disabledRef = useRef(disabled);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const ACTIVATION_ZONE = 100;
  const MAX_STRETCH = 0.07;
  const MAX_PULL = 2;
  const SAFETY_GAP = 6;

  const applyTransform = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const { tx, ty, scaleX, scaleY } = stretch.current;
    const p = pressed.current ? PRESS_SCALE : 1;
    wrapper.style.transform = `translate(${tx}px, ${ty}px) scaleX(${scaleX * p}) scaleY(${scaleY * p})`;
  };

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const el = elRef.current;
    if (!wrapper || !el) return;

    registry.add(wrapper);

    const onMove = (e: MouseEvent) => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        if (disabledRef.current) {
          wrapper.style.transformOrigin = "50% 50%";
          stretch.current = { tx: 0, ty: 0, scaleX: 1, scaleY: 1 };
          applyTransform();
          return;
        }

        const rect = wrapper.getBoundingClientRect();

        // Un ancêtre caché hors écran par transform (ex. la sidebar mobile
        // fermée, translateX(-100%)) ne fait QUE déplacer sa boîte — il ne la
        // clippe pas. Le bouton restait donc inscrit dans `registry` avec un
        // rect bien réel mais hors viewport ; s'il gagnait le "plus proche du
        // curseur" (ex. juste après le bord gauche), son propre transform de
        // survol le faisait "sortir" visuellement du conteneur caché. Un
        // bouton qui n'intersecte plus le viewport ne doit plus du tout
        // participer à l'effet, ni comme cible ni comme concurrent.
        if (isRectOffscreen(rect)) {
          wrapper.style.transformOrigin = "50% 50%";
          stretch.current = { tx: 0, ty: 0, scaleX: 1, scaleY: 1 };
          applyTransform();
          return;
        }

        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        const edgeX = Math.max(0, Math.abs(dx) - rect.width / 2);
        const edgeY = Math.max(0, Math.abs(dy) - rect.height / 2);
        const edgeDist = Math.hypot(edgeX, edgeY);

        // Le plus proche du curseur parmi TOUS les boutons de la page gagne —
        // pas seulement les frères DOM directs (cf. commentaire sur `registry`).
        let closest = true;
        for (const other of registry) {
          if (other === wrapper) continue;
          const oRect = other.getBoundingClientRect();
          if (isRectOffscreen(oRect)) continue;
          const oEdgeX = Math.max(
            0,
            Math.abs(e.clientX - (oRect.left + oRect.width / 2)) -
              oRect.width / 2,
          );
          const oEdgeY = Math.max(
            0,
            Math.abs(e.clientY - (oRect.top + oRect.height / 2)) -
              oRect.height / 2,
          );
          if (Math.hypot(oEdgeX, oEdgeY) < edgeDist) {
            closest = false;
            break;
          }
        }

        if (!closest || edgeDist > ACTIVATION_ZONE) {
          wrapper.style.transformOrigin = "50% 50%";
          stretch.current = { tx: 0, ty: 0, scaleX: 1, scaleY: 1 };
          applyTransform();
          return;
        }

        const fade = 1 - edgeDist / ACTIVATION_ZONE;
        const nx = Math.max(-1, Math.min(1, dx / (rect.width / 2)));
        const ny = Math.max(-1, Math.min(1, dy / (rect.height / 2)));

        const originX = nx >= 0 ? "0%" : "100%";
        const originY = ny >= 0 ? "0%" : "100%";

        let scaleX = 1 + Math.abs(nx) * MAX_STRETCH * fade;
        const scaleY = 1 + Math.abs(ny) * MAX_STRETCH * 0.5 * fade;

        // Le voisin DOM immédiat n'est un vrai voisin visuel que dans un
        // groupe de boutons côte à côte (segmented control, ligne de CTA) —
        // ailleurs (ex: bouton en bas d'une carte tarif, sous une liste de
        // features) c'est un élément sans rapport avec un rect qui n'a rien
        // à voir avec "à gauche/droite", et le calcul d'écart tombait
        // négatif : l'étirement restait bloqué en permanence dans cette
        // direction même avec beaucoup d'espace visuel libre. On ne
        // contraint donc que si le voisin est lui aussi un GlassButton.
        const neighbor = (
          nx >= 0 ? wrapper.nextElementSibling : wrapper.previousElementSibling
        ) as HTMLElement | null;
        if (neighbor?.classList.contains("liquid-glass-wrap")) {
          const nRect = neighbor.getBoundingClientRect();
          const gap =
            nx >= 0 ? nRect.left - rect.right : rect.left - nRect.right;
          const reachLimit = Math.max(0, gap - SAFETY_GAP);
          const maxScaleX = 1 + reachLimit / rect.width;
          scaleX = Math.min(scaleX, maxScaleX);
        }

        const pulledTx = nx * MAX_PULL * fade;
        const pulledTy = ny * MAX_PULL * 0.5 * fade;
        const originXFrac = originX === "0%" ? 0 : 1;
        const originYFrac = originY === "0%" ? 0 : 1;
        const clamped = clampGlassTranslate(wrapper, rect, pulledTx, pulledTy, scaleX, scaleY, originXFrac, originYFrac);

        wrapper.style.transformOrigin = `${originX} ${originY}`;
        stretch.current = { tx: clamped.tx, ty: clamped.ty, scaleX, scaleY };
        applyTransform();
      });
    };

    const onLeaveWindow = () => {
      wrapper.style.transformOrigin = "50% 50%";
      stretch.current = { tx: 0, ty: 0, scaleX: 1, scaleY: 1 };
      applyTransform();
    };

    const onDown = () => {
      if (disabledRef.current) return;
      clearTimeout(revertTimer.current);
      pressed.current = true;
      wrapper.style.transition = PRESS_TRANSITION;
      applyTransform();
    };

    const onUp = () => {
      if (!pressed.current) return;
      pressed.current = false;
      wrapper.style.transition = RELEASE_TRANSITION;
      applyTransform();
      revertTimer.current = setTimeout(() => {
        wrapper.style.transition = DEFAULT_TRANSITION;
      }, 450);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeaveWindow);
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeaveWindow);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf.current);
      clearTimeout(revertTimer.current);
      registry.delete(wrapper);
    };
  }, []);

  const preset = VARIANTS[variant];
  const radiusClass = rounded === "xl" ? "rounded-xl" : "rounded-full";
  const sizeClass =
    size === "sm" ? "px-4 py-2 text-xs gap-1.5" : "px-8 py-4 text-sm gap-2";
  const disabledClass = disabled
    ? "opacity-50 pointer-events-none"
    : "cursor-pointer";
  // Les classes de position (fixed/absolute/top-*/left-*/z-*...) vont sur le
  // <span> englobant, pas ici : cet élément est un descendant d'un ancêtre
  // animé par transform, qui devient son containing block dès que le survol
  // s'active — voir splitPositionClasses.ts pour le détail du bug que ça évite.
  const { position: positionClasses, rest: restClassName } = splitPositionClasses(className);
  const combinedClassName = `liquid-glass-btn backdrop-blur-[32px] backdrop-saturate-[1.2] inline-flex items-center justify-center ${disabledClass} ${radiusClass} ${sizeClass} font-[family-name:var(--font-body)] ${fullWidth ? "w-full" : ""} ${restClassName}`;
  const combinedStyle: CSSProperties = { ...preset, ...style };

  return (
    <span
      ref={wrapperRef}
      className={`liquid-glass-wrap ${positionClasses}`}
      style={{
        display: fullWidth ? "block" : "inline-block",
        width: fullWidth ? "100%" : undefined,
        transition: DEFAULT_TRANSITION,
        willChange: "transform",
      }}
    >
      {href && !disabled ? (
        <Link
          ref={elRef as React.Ref<HTMLAnchorElement>}
          href={href}
          onClick={onClick}
          className={combinedClassName}
          style={combinedStyle}
          data-variant={variant}
          data-custom={style ? "" : undefined}
        >
          {children}
        </Link>
      ) : (
        <button
          ref={elRef as React.Ref<HTMLButtonElement>}
          type={type}
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          aria-disabled={disabled}
          className={combinedClassName}
          style={combinedStyle}
          data-variant={variant}
          data-custom={style ? "" : undefined}
        >
          {children}
        </button>
      )}
    </span>
  );
}

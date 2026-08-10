"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Option {
  id: string;
  label: ReactNode;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SETTLE_TRANSITION =
  "left 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.3s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)";
const PREVIEW_TRANSITION =
  "left 0.25s cubic-bezier(0.34, 1.2, 0.64, 1), width 0.25s cubic-bezier(0.34, 1.2, 0.64, 1), top 0.2s ease, transform 0.2s ease";
const DRAG_TRANSITION = "transform 0.12s ease-out"; // left suit le doigt 1:1, pas de easing dessus pendant le drag
const PRESS_SCALE = 0.96;
const DRAG_THRESHOLD = 4; // px avant de considérer que c'est un drag et pas un clic

/** Segmented control "verre liquide" — PAS le même composant que GlassButton
 * (pas d'étirement vers le curseur) mais avec ses propres comportements
 * Apple-style propres à un thumb de sélection :
 *  - survol d'une option → le thumb glisse en PREVIEW dessus (sans
 *    sélectionner) et revient à la vraie sélection si la souris repart sans
 *    clic ;
 *  - appui maintenu → le thumb se tasse légèrement (déformation, comme un
 *    bouton pressé) ;
 *  - glissé (drag) tenu → le thumb suit le doigt/curseur librement entre les
 *    options, et se cale sur l'option la plus proche au relâché. */
export default function GlassSegmentedControl({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const thumbRef = useRef<HTMLDivElement>(null);

  const [rect, setRect] = useState<Rect | null>(null);
  const [pressed, setPressed] = useState(false);
  // L'option sous laquelle le thumb se trouve VISUELLEMENT en ce moment —
  // différent de `value` pendant un survol en preview ou un glissé : le texte
  // doit rester lisible (blanc) sur le pavé bleu là où il est réellement
  // affiché, pas seulement sur la vraie sélection logique.
  const [activeId, setActiveId] = useState(value);

  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const startXRef = useRef(0);
  const startLeftRef = useRef(0);
  const dragWidthRef = useRef(0);

  const rectOf = (id: string): Rect | null => {
    const btn = btnRefs.current[id];
    const container = containerRef.current;
    if (!btn || !container) return null;
    const c = container.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    return { left: b.left - c.left, top: b.top - c.top, width: b.width, height: b.height };
  };

  const settleToValue = () => {
    if (thumbRef.current) thumbRef.current.style.transition = SETTLE_TRANSITION;
    setRect(rectOf(value));
    setActiveId(value);
  };

  useEffect(() => {
    if (!draggingRef.current) settleToValue();
    const onResize = () => {
      if (!draggingRef.current) settleToValue();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  const handleOptionEnter = (id: string) => {
    if (draggingRef.current) return;
    const target = rectOf(id);
    if (!target) return;
    // Le pavé DOIT toujours matcher la taille réelle de l'option — le texte
    // passe en blanc dès le survol (lisibilité), donc un pavé figé à l'ancienne
    // taille ne recouvre plus le texte de l'option survolée si elle a une
    // largeur différente (texte coupé/débordant). Vu et confirmé buggy : on
    // redimensionne systématiquement, même en preview.
    if (thumbRef.current) thumbRef.current.style.transition = PREVIEW_TRANSITION;
    setRect(target);
    setActiveId(id);
  };

  const handleContainerLeave = () => {
    if (draggingRef.current) return;
    settleToValue();
  };

  /** Le pointerdown part du BOUTON pressé, pas du thumb : le thumb est un
   * <div> séparé positionné sous le bouton sélectionné, mais les boutons ont
   * z-10 et le recouvrent visuellement — un vrai clic touche donc toujours le
   * bouton en premier, jamais le thumb. Un handler posé uniquement sur le
   * thumb ne se déclenche donc jamais avec une vraie souris (seulement via un
   * dispatch synthétique direct, ce qui donnait une fausse impression que ça
   * marchait). En démarrant depuis le bouton : la déformation à l'appui et le
   * glissé sont atteignables normalement, quelle que soit l'option pressée. */
  const handleOptionPointerDown = (id: string) => (e: React.PointerEvent) => {
    const container = containerRef.current;
    const start = rectOf(id);
    if (!container || !start) return;
    e.preventDefault();
    draggingRef.current = true;
    movedRef.current = false;
    setPressed(true);
    startXRef.current = e.clientX;
    startLeftRef.current = start.left;
    dragWidthRef.current = start.width;
    if (thumbRef.current) thumbRef.current.style.transition = DRAG_TRANSITION;
    setRect(start);
    setActiveId(id);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startXRef.current;
      if (Math.abs(dx) > DRAG_THRESHOLD) movedRef.current = true;
      const cWidth = container.getBoundingClientRect().width;
      const maxLeft = Math.max(0, cWidth - dragWidthRef.current);
      const newLeft = Math.max(0, Math.min(maxLeft, startLeftRef.current + dx));
      setRect((prev) => (prev ? { ...prev, left: newLeft } : prev));

      // Le texte doit rester lisible pendant le glissé : on suit l'option la
      // plus proche du curseur en direct, pas seulement au relâché.
      const thumbCenter = newLeft + dragWidthRef.current / 2;
      let closest = id;
      let closestDist = Infinity;
      for (const o of options) {
        const r = rectOf(o.id);
        if (!r) continue;
        const dist = Math.abs(r.left + r.width / 2 - thumbCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closest = o.id;
        }
      }
      setActiveId(closest);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      draggingRef.current = false;
      setPressed(false);
      // Le clic natif suivant ce pointerup ne doit jamais re-déclencher
      // onChange en double : la sélection est décidée ici, dans les deux cas.
      suppressClickRef.current = true;

      if (!movedRef.current) {
        if (thumbRef.current) thumbRef.current.style.transition = SETTLE_TRANSITION;
        setActiveId(id);
        if (id !== value) onChange(id);
        else setRect(rectOf(value));
        return;
      }

      const cRect = container.getBoundingClientRect();
      const cursorX = ev.clientX - cRect.left;
      let closestId = value;
      let closestDist = Infinity;
      for (const o of options) {
        const r = rectOf(o.id);
        if (!r) continue;
        const center = r.left + r.width / 2;
        const dist = Math.abs(center - cursorX);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = o.id;
        }
      }
      if (thumbRef.current) thumbRef.current.style.transition = SETTLE_TRANSITION;
      setActiveId(closestId);
      if (closestId !== value) onChange(closestId);
      else setRect(rectOf(value));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const padding = size === "sm" ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-sm";

  return (
    <div
      ref={containerRef}
      onMouseLeave={handleContainerLeave}
      className={`relative inline-flex flex-wrap justify-center gap-1 rounded-full overflow-hidden backdrop-blur-[20px] backdrop-saturate-[1.3] ${className}`}
      style={{ background: "rgba(255,255,255,0.65)", border: "1px solid var(--greek-border)" }}
    >
      {rect && (
        <div
          ref={thumbRef}
          className="absolute inset-y-0 rounded-full pointer-events-none"
          style={{
            left: rect.left,
            width: rect.width,
            background: "var(--greek-blue)",
            boxShadow: "0 4px 14px rgba(15,30,58,0.28)",
            transition: SETTLE_TRANSITION,
            transform: pressed ? `scale(${PRESS_SCALE})` : "scale(1)",
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.id}
          ref={(el) => {
            btnRefs.current[o.id] = el;
          }}
          type="button"
          onMouseEnter={() => handleOptionEnter(o.id)}
          onPointerDown={handleOptionPointerDown(o.id)}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            onChange(o.id);
          }}
          className={`relative z-10 cursor-pointer ${padding} rounded-full font-bold transition-colors duration-300 font-[family-name:var(--font-display)]`}
          style={{ color: activeId === o.id ? "#fff" : "var(--greek-blue)", touchAction: "none" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

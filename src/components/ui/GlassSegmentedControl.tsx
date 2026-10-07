"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface Option {
  id: string;
  label: ReactNode;
  /** Zone de dépôt (glisser-déposer) : l'option devient dorée quand `hot` est vrai. */
  hot?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SETTLE_TRANSITION =
  "left 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.3s ease, height 0.3s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)";
const PREVIEW_TRANSITION =
  "left 0.25s cubic-bezier(0.34, 1.2, 0.64, 1), width 0.25s cubic-bezier(0.34, 1.2, 0.64, 1), top 0.2s ease, height 0.2s ease, transform 0.2s ease";
const DRAG_TRANSITION = "transform 0.12s ease-out"; // left suit le curseur 1:1 pendant le glissé
const PRESS_SCALE = 0.96;
const DRAG_THRESHOLD = 4; // px avant de considérer que c'est un glissé et pas un clic

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Sélecteur « verre liquide » (pavé bleu qui glisse sous l'option choisie).
 *
 * Toujours sur UNE ligne : si les options ne tiennent pas (mobile, fenêtre
 * étroite), la piste défile horizontalement au lieu de passer à la ligne —
 * deux lignes donnaient une pilule déformée avec un pavé géant.
 *
 * Mesures en offsetLeft/offsetTop (relatives à la piste) et non en
 * getBoundingClientRect : ces dernières sont faussées par les transformations
 * CSS (fenêtre qui s'ouvre avec un zoom, page qui entre en fondu), ce qui
 * décalait le pavé dans les modales. Un ResizeObserver recale le pavé dès que
 * la piste change de taille (police chargée, onglet devenu visible…).
 *
 * Souris : survol = aperçu, appui = tassement, glissé = le pavé suit le
 * curseur. Tactile : un simple tap sélectionne et le doigt peut faire défiler
 * la piste (pas de glissé du pavé, qui bloquait le défilement). */
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
  /** Conservé pour compatibilité : la piste ne passe plus jamais à la ligne. */
  nowrap?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const thumbRef = useRef<HTMLDivElement>(null);

  const [rect, setRect] = useState<Rect | null>(null);
  const [pressed, setPressed] = useState(false);
  // Option sous laquelle le pavé se trouve VISUELLEMENT (aperçu, glissé) :
  // son texte passe en blanc pour rester lisible sur le bleu.
  const [activeId, setActiveId] = useState(value);

  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const startXRef = useRef(0);
  const startLeftRef = useRef(0);
  const dragWidthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const rectOf = useCallback((id: string): Rect | null => {
    const btn = btnRefs.current[id];
    if (!btn || btn.offsetWidth === 0) return null;
    return { left: btn.offsetLeft, top: btn.offsetTop, width: btn.offsetWidth, height: btn.offsetHeight };
  }, []);

  const setTransition = (t: string) => {
    if (thumbRef.current) thumbRef.current.style.transition = t;
  };

  const settleToValue = useCallback(() => {
    if (draggingRef.current) return;
    setTransition(SETTLE_TRANSITION);
    const r = rectOf(valueRef.current);
    if (r) setRect(r);
    setActiveId(valueRef.current);
  }, [rectOf]);

  // Amène l'option choisie au centre de la piste (sans faire défiler la page).
  const revealValue = useCallback((smooth: boolean) => {
    const c = containerRef.current;
    const btn = btnRefs.current[valueRef.current];
    if (!c || !btn || c.scrollWidth <= c.clientWidth) return;
    const target = btn.offsetLeft - (c.clientWidth - btn.offsetWidth) / 2;
    c.scrollTo({ left: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }, []);

  const mountedRef = useRef(false);
  useIsoLayoutEffect(() => {
    settleToValue();
    const first = !mountedRef.current;
    mountedRef.current = true;
    const raf = requestAnimationFrame(() => revealValue(!first));
    return () => cancelAnimationFrame(raf);
  }, [value, options.length, settleToValue, revealValue]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let firstSize = true;
    const ro = new ResizeObserver(() => {
      settleToValue();
      // Première vraie mesure (fenêtre qui finit de s'ouvrir, onglet affiché) :
      // on recentre l'option choisie une fois.
      if (firstSize && container.clientWidth > 0) {
        firstSize = false;
        revealValue(false);
      }
    });
    ro.observe(container);
    Object.values(btnRefs.current).forEach((b) => b && ro.observe(b));
    document.fonts?.ready.then(() => settleToValue()).catch(() => {});
    return () => ro.disconnect();
  }, [options.length, settleToValue, revealValue]);

  const handleOptionEnter = (id: string) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || draggingRef.current) return;
    const target = rectOf(id);
    if (!target) return;
    setTransition(PREVIEW_TRANSITION);
    setRect(target);
    setActiveId(id);
  };

  const handleOptionPointerDown = (id: string) => (e: React.PointerEvent) => {
    // Tactile : on laisse le navigateur gérer (tap = clic, glissé = défilement).
    if (e.pointerType !== "mouse" || e.button !== 0) return;
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
    setTransition(DRAG_TRANSITION);
    setRect(start);
    setActiveId(id);

    const closestTo = (x: number) => {
      let closest = valueRef.current;
      let best = Infinity;
      for (const o of options) {
        const r = rectOf(o.id);
        if (!r) continue;
        const d = Math.abs(r.left + r.width / 2 - x);
        if (d < best) {
          best = d;
          closest = o.id;
        }
      }
      return closest;
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startXRef.current;
      if (Math.abs(dx) > DRAG_THRESHOLD) movedRef.current = true;
      const maxLeft = Math.max(0, container.scrollWidth - dragWidthRef.current);
      const newLeft = Math.max(0, Math.min(maxLeft, startLeftRef.current + dx));
      setRect((prev) => (prev ? { ...prev, left: newLeft } : prev));
      setActiveId(closestTo(newLeft + dragWidthRef.current / 2));
    };

    const finish = (commit: boolean, ev?: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      draggingRef.current = false;
      setPressed(false);
      // Le clic natif qui suit le relâché ne doit pas redoubler onChange ; s'il
      // n'arrive pas (relâché hors du bouton), le verrou saute tout de suite.
      suppressClickRef.current = commit;
      setTimeout(() => (suppressClickRef.current = false), 0);
      setTransition(SETTLE_TRANSITION);
      if (!commit) return settleToValue();
      const chosen = !movedRef.current || !ev
        ? id
        : closestTo(ev.clientX - container.getBoundingClientRect().left + container.scrollLeft);
      setActiveId(chosen);
      if (chosen !== valueRef.current) onChange(chosen);
      else settleToValue();
    };
    const onUp = (ev: PointerEvent) => finish(true, ev);
    const onCancel = () => finish(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const padding = size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-5 py-2 text-sm";

  return (
    <div
      ref={containerRef}
      onPointerLeave={(e) => e.pointerType === "mouse" && settleToValue()}
      role="tablist"
      className={`glass-segmented relative inline-flex flex-nowrap w-fit max-w-full gap-1 p-0 rounded-full overflow-x-auto overscroll-x-contain backdrop-blur-[20px] backdrop-saturate-[1.3] ${className}`}
      style={{ background: "rgba(255,255,255,0.65)", border: "1px solid var(--greek-border)" }}
    >
      {rect && (
        <div
          ref={thumbRef}
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            background: "var(--greek-blue)",
            boxShadow: "0 3px 10px rgba(15,30,58,0.25), inset 0 1px 0 rgba(255,255,255,0.18)",
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
          role="tab"
          aria-selected={value === o.id}
          onPointerEnter={handleOptionEnter(o.id)}
          onDragOver={o.onDragOver}
          onDragLeave={o.onDragLeave}
          onDrop={o.onDrop}
          onPointerDown={handleOptionPointerDown(o.id)}
          // Ne vole pas le focus (ex. onglets du clavier mathématique : le champ
          // de saisie garde le focus), sans bloquer le défilement tactile.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            if (o.id !== value) onChange(o.id);
          }}
          className={`relative z-10 shrink-0 whitespace-nowrap cursor-pointer ${padding} rounded-full font-bold transition-colors duration-300 font-[family-name:var(--font-display)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--greek-gold)]`}
          style={{ color: o.hot || (rect ? activeId : value) === o.id ? "#fff" : "var(--greek-blue)", touchAction: "manipulation" }}
        >
          {o.hot && <span aria-hidden className="absolute inset-0 -z-10 rounded-full" style={{ background: "var(--greek-gold)", boxShadow: "0 4px 14px rgba(197,161,72,0.35)" }} />}
          {/* Avant la première mesure, l'option choisie a son propre fond : jamais de texte blanc sur blanc. */}
          {!rect && value === o.id && <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-[var(--greek-blue)]" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Progression FLUIDE et continue pour les générations IA.
 * - Avance progressivement PENDANT chaque étape (au lieu de rester figée puis
 *   sauter brusquement), en remplissant linéairement la part de l'étape en cours
 *   sur ~stepMs, plafonnée à 95 % de cette part tant qu'elle n'est pas finie.
 * - Saute à la valeur réelle dès qu'une étape se termine, et ne recule JAMAIS.
 * - Arrive à 100 % quand current >= total.
 *
 * @param current  nombre d'étapes terminées
 * @param total    nombre total d'étapes (0 = indéterminé → creep doux vers 90 %)
 * @param active   true pendant la génération
 * @param stepMs   durée estimée d'une étape (ms)
 */
export function useSmoothPercent(
  current: number,
  total: number,
  active: boolean,
  stepMs = 22000
): number {
  const [pct, setPct] = useState(0);
  const stepStart = useRef<number>(0);
  const lastCurrent = useRef<number>(-1);
  const maxPct = useRef<number>(0);
  const raf = useRef<number>(0);

  // Réinitialise quand une nouvelle génération démarre.
  useEffect(() => {
    if (active) {
      maxPct.current = 0;
      stepStart.current = (typeof performance !== "undefined" ? performance.now() : Date.now());
      lastCurrent.current = current;
      setPct(0);
    } else {
      maxPct.current = 0;
      setPct(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

    const tick = () => {
      // Détecte le passage à l'étape suivante.
      if (current !== lastCurrent.current) {
        lastCurrent.current = current;
        stepStart.current = now();
      }

      let p: number;
      if (total <= 0) {
        const within = Math.min(0.9, (now() - stepStart.current) / (stepMs * 3));
        p = within * 100;
      } else if (current >= total) {
        p = 100;
      } else {
        const within = Math.min(0.95, (now() - stepStart.current) / stepMs);
        p = ((current + within) / total) * 100;
      }

      maxPct.current = Math.min(100, Math.max(maxPct.current, p));
      setPct(maxPct.current);
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, current, total, stepMs]);

  return pct;
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Progression FLUIDE et continue pour les générations IA.
 * - Avance progressivement PENDANT chaque étape (au lieu de rester figée puis
 *   sauter brusquement), en approchant la part de l'étape en cours de façon
 *   ASYMPTOTIQUE (jamais un plafond dur) : même si une étape dure bien plus
 *   longtemps que prévu (retry, correction ciblée, API lente...), la barre
 *   continue de ramper très lentement au lieu de se figer complètement — d'où
 *   le blocage à un pourcentage fixe suivi d'un saut brutal à 100 % observé
 *   auparavant avec un plafond à 95 % strict.
 * - Saute à la valeur réelle dès qu'une étape se termine, et ne recule JAMAIS.
 * - Arrive à 100 % uniquement quand current >= total (fin réelle envoyée par
 *   le serveur), jamais avant.
 *
 * @param current  nombre d'étapes terminées
 * @param total    nombre total d'étapes (0 = indéterminé → creep doux vers 90 %)
 * @param active   true pendant la génération
 * @param stepMs   durée typique d'une étape (ms) — passée cette durée, la
 *                 progression ralentit mais ne s'arrête jamais complètement.
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

      // Approche asymptotique de 1 (jamais atteinte) : rapide au début, puis
      // ralentit sans jamais s'arrêter — remplace l'ancien plafond dur à 95 %
      // qui gelait la barre pile à cette valeur dès qu'une étape dépassait
      // stepMs, avant un saut brutal à la valeur suivante.
      const asymptotic = (elapsedMs: number, horizonMs: number) =>
        1 - horizonMs / (horizonMs + Math.max(0, elapsedMs));

      let p: number;
      if (total <= 0) {
        p = asymptotic(now() - stepStart.current, stepMs * 3) * 90;
      } else if (current >= total) {
        p = 100;
      } else {
        const within = asymptotic(now() - stepStart.current, stepMs);
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

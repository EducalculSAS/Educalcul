"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Préférence « réduire les animations », sans écart d'hydratation.
 *
 * `useReducedMotion()` de framer-motion renvoie `false` côté serveur mais la vraie valeur dès le premier rendu du navigateur :
 * un composant qui change son HTML selon cette valeur (étincelles, éléments animés…) produit une page serveur différente de
 * la page client, et React lève l'erreur #418 chez tout visiteur qui a coché cette option (dont les robots de capture).
 * Ici la valeur reste `false` jusqu'au montage, puis suit la préférence : le premier rendu est identique des deux côtés.
 *
 * À utiliser À LA PLACE de `useReducedMotion` (interdit ailleurs par ESLint).
 */
export function useSafeReducedMotion(): boolean {
  const preference = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && !!preference;
}

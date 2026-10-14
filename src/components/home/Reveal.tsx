"use client";

import { motion, type Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Décalage vertical de départ (px). */
  y?: number;
  /** Échelle de départ (1 = pas d'effet). Apple-style : léger zoom-in au scroll. */
  scale?: number;
  delay?: number;
  duration?: number;
  /** Distance avant l'écran où le déclenchement se produit (négatif = anticipe). */
  margin?: string;
  once?: boolean;
}

/**
 * Apparition au scroll façon Apple : fondu + léger zoom + montée, easing
 * "spring-like" doux plutôt qu'un ease-in-out générique. Contrairement à
 * FadeInSection (IntersectionObserver maison, gardé pour les usages simples),
 * ce composant s'appuie sur framer-motion pour l'easing/scale/stagger.
 */
export default function Reveal({
  children,
  className,
  style,
  y = 32,
  scale = 0.97,
  delay = 0,
  duration = 0.9,
  margin = "-80px",
  once = true,
}: RevealProps) {
  const variants: Variants = {
    hidden: { opacity: 0, y, scale },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration, delay, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: margin }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

/** Conteneur à enfants échelonnés (stagger) — utiliser avec <RevealItem> à l'intérieur. */
export function RevealGroup({
  children,
  className,
  style,
  stagger = 0.12,
  margin = "-80px",
  once = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  stagger?: number;
  margin?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: margin }}
      variants={{ visible: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  style,
  y = 24,
  scale = 0.97,
  duration = 0.8,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  y?: number;
  scale?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={{
        hidden: { opacity: 0, y, scale },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

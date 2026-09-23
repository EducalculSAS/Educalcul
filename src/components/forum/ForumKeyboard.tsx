"use client";

import { useEffect, useState, type RefObject } from "react";
import CustomMathKeyboard, { type MathKeyboardConfig, type MathKeyboardKey } from "@/components/CustomMathKeyboard";

// Un seul chargement par session : le clavier complet (tous niveaux) change rarement.
let cached: Promise<MathKeyboardConfig | null> | null = null;
function loadConfig() {
  cached ??= fetch("/api/math-keyboard?level=all")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.config as MathKeyboardConfig) ?? null)
    .catch(() => {
      cached = null;
      return null;
    });
  return cached;
}

/** La position est-elle déjà à l'intérieur d'une formule $…$ ? */
function insideMath(text: string, pos: number) {
  return ((text.slice(0, pos).match(/(?<!\\)\$/g) ?? []).length) % 2 === 1;
}

/**
 * Clavier du site (mêmes onglets que dans les exercices, toutes classes
 * confondues) branché sur la zone de texte du forum. Les lettres et les
 * unités s'insèrent comme du texte ; une formule est entourée de $…$ (sauf si
 * le curseur est déjà dans une formule) et le curseur se place dans sa
 * première case vide.
 */
export default function ForumKeyboard({
  open, onClose, textareaRef, value, onChange, max,
}: {
  open: boolean;
  onClose: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  max: number;
}) {
  const [config, setConfig] = useState<MathKeyboardConfig | null>(null);

  useEffect(() => {
    if (open && !config) loadConfig().then(setConfig);
  }, [open, config]);

  const write = (next: string, caret: number) => {
    if (next.length > max) return;
    onChange(next);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(caret, caret);
    });
  };

  const onKey = (key: MathKeyboardKey) => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);

    if (key.cmd === "deleteBackward") {
      if (start !== end) return write(before + after, start);
      if (start === 0) return;
      return write(value.slice(0, start - 1) + after, start - 1);
    }
    if (key.cmd === "moveToPreviousChar" || key.cmd === "moveToNextChar") {
      const caret = Math.max(0, Math.min(value.length, start + (key.cmd === "moveToNextChar" ? 1 : -1)));
      return write(value, caret);
    }
    if (key.cmd === "addRowAfter") return write(`${before}\n${after}`, start + 1);
    if (key.cmd === "insertMatrix") {
      const m = "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}";
      const ins = insideMath(value, start) ? m : `$${m}$`;
      return write(before + ins + after, start + ins.length);
    }

    let text = key.text;
    const unit = key.latex?.match(/^\\text\{([^{}]*)\}$/);
    if (text === undefined && unit) text = unit[1];
    if (text !== undefined) return write(before + text + after, start + text.length);

    if (key.latex) {
      // Première case vide = position du curseur après insertion.
      const raw = key.latex.replace(/#0|#\?/g, "\\placeholder{}");
      const hole = raw.indexOf("\\placeholder{}");
      const latex = raw.replace(/\\placeholder\{\}/g, "");
      // Juste après une formule ($…$|) : on complète cette formule plutôt que
      // d'en ouvrir une autre collée (« $a$$b$ » se lirait comme un bloc $$).
      if (!insideMath(value, start) && before.endsWith("$") && insideMath(value, start - 1)) {
        const at = start - 1;
        return write(
          value.slice(0, at) + latex + value.slice(at, start) + after,
          at + (hole >= 0 ? hole : latex.length),
        );
      }
      const wrap = !insideMath(value, start);
      const ins = wrap ? `$${latex}$` : latex;
      const caret = start + (wrap ? 1 : 0) + (hole >= 0 ? hole : latex.length);
      return write(before + ins + after, hole >= 0 ? caret : start + ins.length);
    }
  };

  if (!config) return null;
  // Intégré sous la zone de texte (pas collé au bas de l'écran) : il reste
  // visible dans la fenêtre « Nouveau sujet » et ne cache pas ce qu'on écrit.
  return <CustomMathKeyboard config={config} visible={open} onKey={onKey} onClose={onClose} initialTabId="abc" embedded />;
}

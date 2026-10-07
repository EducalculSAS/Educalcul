"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Marqueur de trou dans un texte, protégé du rendu LaTeX : « {{2}} » devient « ⟦2⟧ ». */
export const tokenizeSlots = (html: string): string => html.replace(/\{\{(\d+)\}\}/g, "⟦$1⟧");

interface SlotBox {
  n: number;
  left: number;
  top: number;
  width: number;
  height: number;
  inSvg: boolean;
}

interface SlotHtmlProps {
  /** HTML déjà rendu (LaTeX compris) dont les trous sont des « ⟦n⟧ » (texte, tableaux) ou des éléments [data-slot] (figures). */
  html: string;
  /** Valeurs saisies : la réponse du trou n est values[n - 1]. */
  values: string[];
  disabled: boolean;
  /** Réponses attendues (alternatives séparées par « | »), connues seulement après correction. */
  expected?: string[];
  submitted: boolean;
  onChange: (values: string[]) => void;
}

/**
 * Contenu HTML dont CHAQUE trou est un champ de saisie posé exactement à sa place : dans une phrase, dans la case d'un
 * tableau, ou DANS une figure (cote, sommet, brique...). Les figures SVG marquent leurs emplacements par des éléments
 * `data-slot` ; le texte et les tableaux par des « ⟦n⟧ ». Les champs flottent au-dessus du contenu, qui n'est jamais
 * découpé : une figure ou un tableau reste d'un seul tenant.
 */
export default function SlotHtml({ html, values, disabled, expected, submitted, onChange }: SlotHtmlProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<SlotBox[]>([]);

  // Les « ⟦n⟧ » du texte et des tableaux deviennent des espaces réservés de la taille d'un champ (remplacement dans la
  // chaîne, avant rendu : le DOM n'est jamais modifié à la main). Les figures SVG fournissent déjà leurs [data-slot].
  const prepared = useMemo(
    () =>
      html.replace(
        /\u27E6(\d+)\u27E7/g,
        (_, n: string) =>
          `<span data-slot-text="${n}" style="display:inline-block;vertical-align:middle;width:5.5em;height:1.75em;margin:0 0.2em"></span>`,
      ),
    [html],
  );

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const found: SlotBox[] = [];
    root.querySelectorAll<Element>("[data-slot],[data-slot-text]").forEach((el) => {
      const n = Number(el.getAttribute("data-slot") ?? el.getAttribute("data-slot-text"));
      if (!Number.isInteger(n) || n < 1) return;
      const r = el.getBoundingClientRect();
      found.push({ n, left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height, inSvg: el.hasAttribute("data-slot") });
    });
    setBoxes((prev) => {
      const same =
        prev.length === found.length &&
        prev.every((p, i) => p.n === found[i].n && Math.abs(p.left - found[i].left) < 0.5 && Math.abs(p.top - found[i].top) < 0.5 && Math.abs(p.width - found[i].width) < 0.5 && Math.abs(p.height - found[i].height) < 0.5);
      return same ? prev : found;
    });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [prepared, measure]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    // Une figure libre (JSXGraph) se dessine après coup : on re-mesure quand de nouveaux emplacements apparaissent.
    let frame = 0;
    const mutations = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const setValue = (n: number, value: string) => {
    const next = [...values];
    for (let i = 0; i < n; i++) if (next[i] === undefined) next[i] = "";
    next[n - 1] = value;
    onChange(next);
  };

  return (
    <div className="relative">
      <div ref={rootRef} dangerouslySetInnerHTML={{ __html: prepared }} />
      {boxes.map((b) => {
        const value = values[b.n - 1] ?? "";
        let state: "idle" | "ok" | "ko" = "idle";
        const wanted = expected?.[b.n - 1];
        if (submitted && wanted !== undefined) {
          const alts = String(wanted).split("|").map((s) => s.trim().toLowerCase());
          state = alts.includes(value.trim().toLowerCase()) ? "ok" : "ko";
        }
        return (
          <input
            key={b.n}
            data-keep-light
            type="text"
            autoComplete="off"
            disabled={disabled}
            value={value}
            onChange={(e) => setValue(b.n, e.target.value)}
            aria-label={`Réponse ${b.n}`}
            className="absolute text-center font-bold outline-none transition-colors"
            style={{
              left: b.left,
              top: b.top,
              width: b.width,
              height: b.height,
              minWidth: 0,
              padding: "0 2px",
              borderRadius: b.inSvg ? 6 : 8,
              fontSize: b.inSvg ? Math.max(12, Math.min(17, b.height * 0.62)) : "inherit",
              color: "#0f1e3a",
              border: `${state === "idle" ? "1.5px dashed" : "2px solid"} ${state === "ok" ? "#16a34a" : state === "ko" ? "#dc2626" : "#c89f36"}`,
              background: state === "ok" ? "#dcfce7" : state === "ko" ? "#fee2e2" : "rgba(255,255,255,0.92)",
              boxShadow: "0 1px 4px rgba(15,30,58,0.08)",
            }}
          />
        );
      })}
    </div>
  );
}

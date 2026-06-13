"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "mathlive";
import type { MathfieldElement } from "mathlive";

let keyboardThemeApplied = false;
function applyKeyboardTheme() {
  if (keyboardThemeApplied) return;
  keyboardThemeApplied = true;
  const style = document.createElement("style");
  style.textContent = `
    .ML__keyboard, .ML__virtual-keyboard {
      --keyboard-background: var(--greek-cream, #faf7f2);
      --keyboard-text: var(--text-dark, #1a1008);
      --keyboard-text-active: var(--greek-blue, #0f1e3a);
      --keycap-background: #ffffff;
      --keycap-background-hover: rgba(197,161,72,0.18);
      --keycap-background-active: var(--greek-gold, #c5a148);
      --keycap-border: rgba(197,161,72,0.35);
      --keycap-border-bottom: rgba(197,161,72,0.5);
      --keycap-text: var(--text-dark, #1a1008);
      --keycap-text-active: #ffffff;
      --keycap-primary-background: var(--greek-blue, #0f1e3a);
      --keycap-primary-text: #ffffff;
      --keycap-secondary-background: rgba(197,161,72,0.12);
      --keycap-secondary-text: var(--text-dark, #1a1008);
      font-family: var(--font-body, "Inter", Arial, sans-serif);
      max-width: 100vw;
      border-top: 1px solid rgba(197,161,72,0.3);
    }
    .ML__keyboard .MLK__keycap, .ML__keyboard .MLK__key,
    .ML__virtual-keyboard .MLK__keycap, .ML__virtual-keyboard .MLK__key {
      box-shadow: 0 1px 2px rgba(15,30,58,0.06);
      border-radius: 8px;
      min-width: 0;
    }
    .ML__keyboard .MLK__keycap svg, .ML__keyboard .MLK__key svg,
    .ML__virtual-keyboard .MLK__keycap svg, .ML__virtual-keyboard .MLK__key svg {
      fill: currentColor;
    }
    /* Onglets en haut du clavier (123, abc, αβγ, ...) */
    .ML__keyboard .MLK__toolbar,
    .ML__virtual-keyboard .MLK__toolbar {
      background: var(--greek-cream, #faf7f2);
      border-bottom: 1px solid rgba(197,161,72,0.25);
      overflow-x: auto;
    }
    .ML__keyboard .MLK__toolbar button,
    .ML__virtual-keyboard .MLK__toolbar button {
      color: var(--text-dark, #1a1008);
      fill: var(--text-dark, #1a1008);
      flex-shrink: 0;
    }
    .ML__keyboard .MLK__toolbar button:hover,
    .ML__virtual-keyboard .MLK__toolbar button:hover {
      color: var(--greek-blue, #0f1e3a);
      fill: var(--greek-blue, #0f1e3a);
    }
    .ML__keyboard .MLK__toolbar button.is-active,
    .ML__virtual-keyboard .MLK__toolbar button.is-active,
    .ML__keyboard .MLK__toolbar button[aria-pressed="true"],
    .ML__virtual-keyboard .MLK__toolbar button[aria-pressed="true"] {
      color: var(--greek-gold, #c5a148);
      fill: var(--greek-gold, #c5a148);
      border-bottom: 2px solid var(--greek-gold, #c5a148);
    }
    .ML__keyboard .MLK__toolbar svg,
    .ML__virtual-keyboard .MLK__toolbar svg {
      color: inherit;
      fill: currentColor;
    }
    /* Empêche les touches d'être coupées sur petits écrans */
    .ML__keyboard .MLK__plate,
    .ML__virtual-keyboard .MLK__plate {
      max-width: 100vw;
      box-sizing: border-box;
    }
    .ML__keyboard .MLK__rows,
    .ML__virtual-keyboard .MLK__rows {
      width: 100%;
    }
    /* Menu contextuel + menu "insérer" (clic droit / bouton +) */
    :root {
      --ui-menu-bg: #ffffff;
      --ui-menu-text: var(--text-dark, #1a1008);
      --ui-menu-text-hover: var(--greek-blue, #0f1e3a);
      --ui-menu-text-active: #ffffff;
      --ui-menu-text-active-muted: #ffffff;
      --ui-menu-bg-active: var(--greek-blue, #0f1e3a);
      --ui-menu-bg-active-muted: var(--greek-blue, #0f1e3a);
      --ui-menu-bg-hover: rgba(197,161,72,0.18);
      --ui-menu-divider: 1px solid rgba(197,161,72,0.25);
      --ui-menu-shadow: 0 4px 16px rgba(15,30,58,0.18);
    }
    .ui-menu-container {
      border: 1px solid rgba(197,161,72,0.3);
      border-radius: 8px;
    }
    /* Place les boutons clavier virtuel / menu en bas à droite du champ */
    math-field {
      position: relative;
    }
    math-field::part(virtual-keyboard-toggle),
    math-field::part(menu-toggle) {
      position: absolute;
      bottom: 8px;
    }
    math-field::part(virtual-keyboard-toggle) {
      right: 8px;
    }
    math-field::part(menu-toggle) {
      right: 36px;
    }
  `;
  document.head.appendChild(style);
}

export interface MathInputHandle {
  insert: (latex: string) => void;
  command: (cmd: string | string[]) => void;
  focus: () => void;
}

interface MathInputProps {
  value: string;
  onChange: (latex: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const MathInput = forwardRef<MathInputHandle, MathInputProps>(function MathInput(
  { value, onChange, disabled, className, placeholder },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    applyKeyboardTheme();

    const mf = document.createElement("math-field") as MathfieldElement;
    mf.value = value || "";
    mf.mathVirtualKeyboardPolicy = "auto";
    mf.smartFence = true;
    mf.smartSuperscript = true;
    mf.removeExtraneousParentheses = true;
    // Permet à la barre d'espace du clavier physique d'insérer une vraie espace.
    mf.mathModeSpace = "\\;";
    mf.style.width = "100%";
    mf.style.display = "block";
    mf.style.border = "none";
    mf.style.outline = "none";
    mf.style.padding = "10px 12px";
    mf.style.fontSize = "1.125rem";
    mf.style.background = "transparent";
    mf.style.fontFamily = "var(--font-display)";
    mf.style.minHeight = "48px";
    mf.style.setProperty("--smart-fence-color", "var(--greek-blue)");
    mf.style.setProperty("--caret-color", "var(--greek-blue)");
    mf.style.setProperty("--selection-background-color", "rgba(197,161,72,0.25)");
    mf.style.setProperty("--selection-color", "var(--text-dark)");
    mf.style.setProperty("--highlight-color", "var(--text-dark)");
    mf.style.setProperty("--highlight-background-color", "rgba(197,161,72,0.25)");
    mf.style.setProperty("--primary-color", "var(--greek-gold)");
    mf.style.setProperty("--contains-highlight-background-color", "rgba(197,161,72,0.12)");
    container.appendChild(mf);
    mfRef.current = mf;

    const updatePlaceholder = () => {
      const ph = placeholderRef.current;
      if (ph) ph.style.display = mf.value.length === 0 ? "block" : "none";
    };

    const handler = () => {
      onChange(mf.value);
      updatePlaceholder();
    };
    mf.addEventListener("input", handler);

    // Permet de faire "Entrée" pour passer à la ligne suivante (réponse multi-lignes)
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (!mf.value.startsWith("\\begin{aligned}")) {
          mf.value = `\\begin{aligned}${mf.value}\\\\\\end{aligned}`;
          mf.executeCommand("moveToMathfieldEnd");
        } else {
          mf.executeCommand("addRowAfter");
        }
        onChange(mf.value);
        updatePlaceholder();
      }
    };
    mf.addEventListener("keydown", keydownHandler, true);

    // Au premier clic/focus, sélectionne tout pour que l'utilisateur puisse
    // directement remplacer le contenu existant en tapant.
    const focusHandler = () => {
      if (mf.value.length > 0) {
        mf.value = "";
        onChange("");
      }
      const ph = placeholderRef.current;
      if (ph) ph.style.display = "none";
    };
    mf.addEventListener("focus", focusHandler);
    mf.addEventListener("blur", updatePlaceholder);

    updatePlaceholder();

    return () => {
      mf.removeEventListener("input", handler);
      mf.removeEventListener("keydown", keydownHandler, true);
      mf.removeEventListener("focus", focusHandler);
      mf.removeEventListener("blur", updatePlaceholder);
      container.removeChild(mf);
      mfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    if (mf.value !== value) mf.value = value || "";
    const ph = placeholderRef.current;
    if (ph) ph.style.display = (value || "").length === 0 ? "block" : "none";
  }, [value]);

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.readOnly = !!disabled;
  }, [disabled]);

  useImperativeHandle(
    ref,
    () => ({
      insert: (latex: string) => {
        mfRef.current?.insert(latex, { focus: true, selectionMode: "placeholder" } as any);
      },
      command: (cmd: any) => {
        mfRef.current?.executeCommand(cmd);
        mfRef.current?.focus();
      },
      focus: () => mfRef.current?.focus(),
    }),
    []
  );

  return (
    <div className={`relative ${className || ""}`}>
      <div ref={containerRef} />
      {placeholder && (
        <div
          ref={placeholderRef}
          className="absolute left-0 top-1/2 -translate-y-1/2 px-3 text-lg text-[var(--text-muted)]/60 pointer-events-none select-none font-[family-name:var(--font-display)]"
        >
          {placeholder}
        </div>
      )}
    </div>
  );
});

export default MathInput;

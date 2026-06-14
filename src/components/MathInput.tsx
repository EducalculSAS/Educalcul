"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "mathlive";
import type { MathfieldElement } from "mathlive";

function getVirtualKeyboard(): any {
  return (window as any).mathVirtualKeyboard;
}

// Champ mathématique actuellement focalisé (pour les boutons injectés dans le
// clavier, comme la croix de fermeture ou le bouton matrice).
let activeMathfield: MathfieldElement | null = null;

// État du bouton matrice : appuis consécutifs -> agrandissement (2×2, 3×3…).
// On repart d'une 2×2 dès que l'utilisateur sort de la matrice (clic, flèches,
// fermeture du clavier).
let matrixActive = false;
let matrixGrowing = false;
let matrixSize = 2;
function resetMatrixState() {
  matrixActive = false;
}
/** Construit le LaTeX d'une matrice n×n dont toutes les cases sont des
 * placeholders (donc toutes visibles). */
function buildMatrixLatex(n: number): string {
  const row = Array(n).fill("\\placeholder{}").join(" & ");
  const rows = Array(n).fill(row).join(" \\\\ ");
  return `\\begin{pmatrix}${rows}\\end{pmatrix}`;
}

let keyboardThemeApplied = false;
function applyKeyboardTheme() {
  if (keyboardThemeApplied) return;
  keyboardThemeApplied = true;

  // Disposition alphabétique AZERTY pour le clavier virtuel
  getVirtualKeyboard().alphabeticLayout = "azerty";

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
    /* On retire les boutons "clavier virtuel" et "menu" (☰) du champ */
    math-field::part(virtual-keyboard-toggle),
    math-field::part(menu-toggle) {
      display: none !important;
    }
    math-field {
      position: relative;
    }
    /* Masque la barre grise de défilement (scrollbar) du clavier sur
       ordinateur (souris) ; sur tactile il n'y en a pas. */
    @media (pointer: fine) {
      .ML__keyboard *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
      .ML__keyboard * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
    }
    /* Croix simple de fermeture, en haut à droite du clavier virtuel */
    .ml-keyboard-close-btn {
      position: absolute;
      top: 6px;
      right: 12px;
      z-index: 1000;
      background: none;
      border: none;
      padding: 4px;
      margin: 0;
      color: var(--text-dark, #1a1008);
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      transition: transform 0.15s ease, color 0.15s ease;
      transform-origin: center;
    }
    .ml-keyboard-close-btn:hover {
      transform: scale(1.35);
      color: var(--greek-blue, #0f1e3a);
    }
    /* Bouton matrice, juste à gauche de la croix */
    .ml-keyboard-matrix-btn {
      position: absolute;
      top: 4px;
      right: 46px;
      z-index: 1000;
      background: none;
      border: none;
      padding: 3px;
      margin: 0;
      color: var(--text-dark, #1a1008);
      line-height: 0;
      cursor: pointer;
      transition: transform 0.15s ease, color 0.15s ease;
      transform-origin: center;
    }
    .ml-keyboard-matrix-btn:hover {
      transform: scale(1.25);
      color: var(--greek-blue, #0f1e3a);
    }
  `;
  document.head.appendChild(style);

  // Le clavier virtuel de mathlive est rendu en light DOM (classe .ML__keyboard
  // ajoutée directement à <body>), supprimé instantanément à la fermeture (pas
  // d'animation de sortie native). On injecte donc nous-mêmes le bouton de
  // fermeture dès qu'il apparaît.
  // Empêche mathlive de traiter le clic sur un bouton injecté comme une touche
  // et d'interférer avec le focus.
  const guardButton = (btn: HTMLButtonElement) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener("pointerup", (e) => e.stopPropagation());
  };

  const setupKeyboardEl = (kb: HTMLElement) => {
    // On insère nos boutons dans la "plate" (la surface visible des touches),
    // qui existe dès la création du clavier et reste en place.
    const plate = kb.querySelector<HTMLElement>(".MLK__plate");
    if (!plate || plate.querySelector(".ml-keyboard-close-btn")) return;

    // Croix de fermeture (en haut à droite).
    // On NE bloque PAS le focus ici : laisser le bouton prendre le focus retire
    // naturellement le curseur du champ (sinon, sur mobile, le curseur reste).
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ml-keyboard-close-btn";
    closeBtn.setAttribute("aria-label", "Fermer le clavier");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    closeBtn.addEventListener("pointerup", (e) => e.stopPropagation());
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      activeMathfield?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
      hideKeyboardAnimated();
    });
    plate.appendChild(closeBtn);

    // Bouton "matrice" (à gauche de la croix) : insère une matrice 2×2
    const matrixBtn = document.createElement("button");
    matrixBtn.type = "button";
    matrixBtn.className = "ml-keyboard-matrix-btn";
    matrixBtn.setAttribute("aria-label", "Insérer une matrice");
    matrixBtn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M7 4 H5 V20 H7" /><path d="M17 4 H19 V20 H17" />
        <circle cx="10" cy="9" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="14" cy="9" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="10" cy="15" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="14" cy="15" r="1.1" fill="currentColor" stroke="none" />
      </svg>`;
    guardButton(matrixBtn);
    matrixBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mf = activeMathfield;
      if (!mf) return;
      matrixGrowing = true;
      if (matrixActive) {
        // Appui consécutif : on agrandit (la matrice précédente est encore
        // sélectionnée, donc l'insertion la remplace) — toutes les cases sont
        // des placeholders, donc toutes visibles.
        matrixSize += 1;
        mf.insert(buildMatrixLatex(matrixSize), { selectionMode: "item" } as any);
      } else {
        // Première fois (ou après être sorti d'une matrice) : matrice 2×2 neuve,
        // en fin de champ pour éviter toute imbrication. On la sélectionne
        // (selectionMode "item") pour pouvoir la remplacer si on l'agrandit.
        matrixSize = 2;
        mf.executeCommand("moveToMathfieldEnd");
        mf.insert(buildMatrixLatex(matrixSize), { selectionMode: "item" } as any);
        matrixActive = true;
      }
      matrixGrowing = false;
      mf.focus();
    });
    plate.appendChild(matrixBtn);
  };

  const observer = new MutationObserver(() => {
    document.querySelectorAll<HTMLElement>(".ML__keyboard").forEach(setupKeyboardEl);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Préchauffe le clavier : mathlive construit son DOM à la 1re ouverture, ce
  // qui faisait que le tout premier appui sur un champ (surtout sur mobile) ne
  // faisait rien. On le construit puis on le masque immédiatement (sans
  // animation, donc invisible) une fois pour toute la session.
  try {
    const vk = getVirtualKeyboard();
    vk.show({ animate: false });
    vk.hide({ animate: false });
  } catch {
    /* ignore */
  }
}

/**
 * Ferme le clavier virtuel avec une animation de glissement vers le bas.
 * mathlive retire l'élément immédiatement sur hide(), donc on anime nous-mêmes
 * le backdrop puis on appelle hide() une fois l'animation terminée.
 */
const CLOSE_MS = 200;
let closingTimer: ReturnType<typeof setTimeout> | null = null;

function getBackdrop(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".ML__keyboard .MLK__backdrop");
}

/** Annule une fermeture en cours et remet le clavier en place (re-focus). */
function cancelKeyboardClosing() {
  if (closingTimer) {
    clearTimeout(closingTimer);
    closingTimer = null;
  }
  const backdrop = getBackdrop();
  if (backdrop) {
    backdrop.style.transition = "";
    backdrop.style.transform = "";
  }
}

/**
 * Ferme le clavier avec un glissement vers le bas qui démarre immédiatement.
 * mathlive n'anime que l'ouverture et retire l'élément instantanément à la
 * fermeture, donc on anime nous-mêmes le backdrop (translation) avant hide().
 */
function hideKeyboardAnimated() {
  const vk = getVirtualKeyboard();
  const backdrop = getBackdrop();
  if (!backdrop || !vk?.visible) {
    vk?.hide();
    return;
  }
  // Fige la position courante, force un reflow, puis anime vers le bas
  // (translateY(0) = position cachée sous l'écran).
  const current = getComputedStyle(backdrop).transform;
  backdrop.style.transition = "none";
  backdrop.style.transform = current === "none" ? "translateY(0)" : current;
  void backdrop.offsetHeight;
  backdrop.style.transition = `transform ${CLOSE_MS}ms cubic-bezier(0.4, 0, 1, 1)`;
  backdrop.style.transform = "translateY(0px)";

  if (closingTimer) clearTimeout(closingTimer);
  closingTimer = setTimeout(() => {
    closingTimer = null;
    // Si un champ a repris le focus entre-temps (réouverture rapide), on
    // annule la fermeture pour ne pas masquer un clavier de nouveau utilisé
    // (sinon, sur mobile, « ça n'écrit plus » après fermeture/réouverture).
    if (activeMathfield) {
      cancelKeyboardClosing();
      return;
    }
    vk.hide();
  }, CLOSE_MS);
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
  const isFocusedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    applyKeyboardTheme();

    const mf = document.createElement("math-field") as MathfieldElement;
    mf.value = value || "";
    // "manual" sur tous les appareils : on pilote nous-mêmes l'affichage
    // (focus → ouverture animée, blur/croix → fermeture animée). En mode
    // "auto", mathlive rouvrait le clavier tout seul sur tactile et ne
    // l'animait pas à la fermeture. Le champ a inputmode=none, donc aucun
    // clavier natif n'apparaît.
    mf.mathVirtualKeyboardPolicy = "manual";
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

    // Le placeholder ("Ta réponse…") ne s'affiche que si le champ est vide ET
    // non focalisé (curseur absent). Tant que le curseur clignote dedans, on
    // le masque, même après avoir tout effacé.
    const updatePlaceholder = () => {
      const ph = placeholderRef.current;
      if (ph)
        ph.style.display =
          mf.value.length === 0 && !isFocusedRef.current ? "block" : "none";
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

    // Dès que l'utilisateur navigue (clic dans le champ ou flèches), on
    // considère qu'il sort de la matrice : le prochain appui repart d'une 2×2.
    const matrixResetHandler = (e: Event) => {
      if (matrixGrowing) return;
      if (e.type === "keydown") {
        const k = (e as KeyboardEvent).key;
        if (!k.startsWith("Arrow")) return;
      }
      resetMatrixState();
    };
    mf.addEventListener("pointerdown", matrixResetHandler);
    mf.addEventListener("keydown", matrixResetHandler);

    // Au focus, masque le placeholder (le contenu existant est conservé) et
    // ouvre le clavier virtuel avec animation.
    const focusHandler = () => {
      isFocusedRef.current = true;
      activeMathfield = mf;
      updatePlaceholder();
      cancelKeyboardClosing();
      getVirtualKeyboard().show({ animate: true });
      // Fait remonter le champ au-dessus du clavier (utile quand un exo est
      // tout en bas de la page, sinon le clavier cache ce qu'on écrit).
      // On ne défile que si le champ se retrouve dans la zone couverte.
      setTimeout(() => {
        if (!isFocusedRef.current) return;
        const rect = mf.getBoundingClientRect();
        const keyboardTop = window.innerHeight * 0.55;
        if (rect.bottom > keyboardTop) {
          mf.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 350);
    };
    const blurHandler = () => {
      isFocusedRef.current = false;
      if (activeMathfield === mf) activeMathfield = null;
      resetMatrixState();
      updatePlaceholder();
      hideKeyboardAnimated();
    };
    mf.addEventListener("focus", focusHandler);
    mf.addEventListener("blur", blurHandler);

    updatePlaceholder();

    return () => {
      mf.removeEventListener("input", handler);
      mf.removeEventListener("keydown", keydownHandler, true);
      mf.removeEventListener("pointerdown", matrixResetHandler);
      mf.removeEventListener("keydown", matrixResetHandler);
      mf.removeEventListener("focus", focusHandler);
      mf.removeEventListener("blur", blurHandler);
      if (activeMathfield === mf) activeMathfield = null;
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
    // Ne jamais afficher le placeholder pendant que le champ est focalisé,
    // même si le contenu vient de passer à vide (sinon il "clignote").
    if (ph)
      ph.style.display =
        (value || "").length === 0 && !isFocusedRef.current ? "block" : "none";
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

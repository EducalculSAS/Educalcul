"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import "mathlive";
import type { MathfieldElement } from "mathlive";
import { supabase } from "@/lib/supabaseClient";
import CustomMathKeyboard, {
  type MathKeyboardConfig,
  type MathKeyboardKey,
} from "@/components/CustomMathKeyboard";

// État du bouton matrice : appuis consécutifs -> agrandissement (2×2, 3×3…).
// On repart d'une 2×2 dès que l'utilisateur sort de la matrice (clic, flèches,
// fermeture du clavier). Module-level : partagé entre tous les champs, comme
// avant — un seul champ est actif à la fois.
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

const DEFAULT_LEVEL = "6eme";

// On ne montre plus jamais le clavier virtuel natif de mathlive (remplacé par
// CustomMathKeyboard), mais le champ affiche par défaut sa propre icône
// "afficher/masquer le clavier" et un bouton menu (☰) qui, cliqués,
// pilotent l'état interne de mathlive indépendamment du nôtre — source de
// bugs d'état incohérent (vu et confirmé). On les masque une bonne fois pour
// toutes, comme avant.
let hideNativeTogglesApplied = false;
function hideNativeToggles() {
  if (hideNativeTogglesApplied) return;
  hideNativeTogglesApplied = true;
  const style = document.createElement("style");
  style.textContent = `
    math-field::part(virtual-keyboard-toggle),
    math-field::part(menu-toggle) {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Cache partagé entre tous les champs de la page : un seul aller-retour
// Supabase par niveau, quel que soit le nombre de champs MathInput montés.
const keyboardConfigCache = new Map<string, MathKeyboardConfig | null>();
const keyboardConfigPromises = new Map<string, Promise<MathKeyboardConfig | null>>();

async function loadKeyboardConfig(level: string): Promise<MathKeyboardConfig | null> {
  if (keyboardConfigCache.has(level)) return keyboardConfigCache.get(level) ?? null;
  if (keyboardConfigPromises.has(level)) return keyboardConfigPromises.get(level)!;

  const promise = (async () => {
    const { data } = await supabase
      .from("math_keyboards")
      .select("config")
      .eq("level", level)
      .maybeSingle();
    let config = (data?.config as MathKeyboardConfig | undefined) ?? null;
    if (!config && level !== DEFAULT_LEVEL) {
      // Repli sur un niveau par défaut si ce niveau précis n'a pas encore de
      // clavier configuré en base (ex: nouveau niveau ajouté ailleurs).
      const { data: fallback } = await supabase
        .from("math_keyboards")
        .select("config")
        .eq("level", DEFAULT_LEVEL)
        .maybeSingle();
      config = (fallback?.config as MathKeyboardConfig | undefined) ?? null;
    }
    keyboardConfigCache.set(level, config);
    return config;
  })().catch(() => null);
  keyboardConfigPromises.set(level, promise);
  return promise;
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
  /** Nom accessible du champ pour les lecteurs d'écran (ex: le titre de la question). */
  ariaLabel?: string;
  /** Niveau scolaire, pour charger le bon clavier personnalisé (voir math_keyboards). */
  level?: string;
}

const MathInput = forwardRef<MathInputHandle, MathInputProps>(function MathInput(
  { value, onChange, disabled, className, placeholder, ariaLabel, level },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardConfig, setKeyboardConfig] = useState<MathKeyboardConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadKeyboardConfig(level || DEFAULT_LEVEL).then((config) => {
      if (!cancelled) setKeyboardConfig(config);
    });
    return () => {
      cancelled = true;
    };
  }, [level]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    hideNativeToggles();

    const mf = document.createElement("math-field") as MathfieldElement;
    mf.value = value || "";
    // "manual" : mathlive ne montre JAMAIS son propre clavier virtuel — c'est
    // CustomMathKeyboard (liquid glass, personnalisable par niveau) qui pilote
    // entièrement l'affichage, via les callbacks focus/blur ci-dessous.
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
    if (ariaLabel) mf.setAttribute("aria-label", ariaLabel);
    container.appendChild(mf);
    mfRef.current = mf;

    // Désactive les raccourcis "lettres → symbole" de MathLive (ex. "or" → ∨,
    // "and" → ∧, "pi" → π) : au clavier physique l'élève veut taper des lettres
    // littérales. À faire APRÈS le montage dans le DOM (le setter exige que le
    // mathfield soit monté). Les symboles restent dispo via le clavier virtuel.
    try { mf.inlineShortcuts = {}; } catch { /* mathfield pas encore prêt */ }

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

    // Permet de faire "Entrée" pour passer à la ligne suivante (réponse
    // multi-lignes). "addRowAfter" gère nativement les deux cas : sur du
    // contenu plat, il coupe au niveau du curseur et crée lui-même un
    // environnement "\displaylines{...}" (voir parentArray() dans
    // mathlive.js) ; une fois dans cet environnement, il y ajoute une
    // nouvelle ligne. Reproduire cette création manuellement (par
    // concaténation de chaîne) est fragile : MathLive normalise/supprime les
    // lignes vides en fin de chaîne au moment du parsing, ce qui égarait le
    // curseur hors de l'environnement. Laisser l'API le faire évite ce piège.
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      mf.executeCommand("addRowAfter");
      onChange(mf.value);
      updatePlaceholder();
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
    // ouvre notre clavier personnalisé (CustomMathKeyboard, rendu plus bas).
    const focusHandler = () => {
      isFocusedRef.current = true;
      updatePlaceholder();
      setKeyboardVisible(true);
      // Fait remonter le champ ET son bouton "Vérifier" au-dessus du clavier
      // (utile quand un exo est tout en bas de la page, sinon le clavier
      // cache ce qu'on écrit ET le bouton de validation qui suit le champ).
      // On centre le bloc réponse ENTIER (data-exercise-answer-block, posé
      // par CourseViewer/ExerciseViewer autour du champ + du bouton), pas
      // seulement le champ — sinon le bouton juste en dessous reste caché
      // sous le clavier même quand le champ, lui, est bien visible.
      setTimeout(() => {
        if (!isFocusedRef.current) return;
        const target =
          (mf.closest("[data-exercise-answer-block]") as HTMLElement | null) || mf;
        const rect = target.getBoundingClientRect();
        const keyboardTop = window.innerHeight * 0.55;
        if (rect.bottom > keyboardTop) {
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 350);
    };
    const blurHandler = () => {
      isFocusedRef.current = false;
      resetMatrixState();
      updatePlaceholder();
      setKeyboardVisible(false);
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

  const handleInsertRaw = (latex: string) => {
    const mf = mfRef.current;
    if (!mf || !latex.trim()) return;
    mf.insert(latex, { focus: true, selectionMode: "after" } as any);
  };

  // Onglet "ABC" : bascule mathlive en mode texte pour que chaque lettre
  // s'insère comme un caractère normal (pas une variable maths italique
  // isolée), et repasse en mode maths sur tout autre onglet.
  const handleTabChange = (tab: MathKeyboardConfig["tabs"][number]) => {
    const mf = mfRef.current;
    if (!mf) return;
    try {
      mf.executeCommand(["switchMode", tab.special === "abc" ? "text" : "math"] as any);
    } catch {
      /* mode déjà correct ou commande indisponible selon la version */
    }
    mf.focus();
  };

  const handleKeyboardKey = (key: MathKeyboardKey) => {
    const mf = mfRef.current;
    if (!mf) return;
    if (key.text !== undefined) {
      mf.insert(key.text, { focus: true, mode: "text", selectionMode: "after" } as any);
      return;
    }
    if (key.cmd === "insertMatrix") {
      matrixGrowing = true;
      if (matrixActive) {
        // Appui consécutif : on agrandit (la matrice précédente est encore
        // sélectionnée, donc l'insertion la remplace) — toutes les cases sont
        // des placeholders, donc toutes visibles.
        matrixSize += 1;
        mf.insert(buildMatrixLatex(matrixSize), { selectionMode: "item" } as any);
      } else {
        // Première fois (ou après être sorti d'une matrice) : matrice 2×2
        // neuve, en fin de champ pour éviter toute imbrication.
        matrixSize = 2;
        mf.executeCommand("moveToMathfieldEnd");
        mf.insert(buildMatrixLatex(matrixSize), { selectionMode: "item" } as any);
        matrixActive = true;
      }
      matrixGrowing = false;
      mf.focus();
      return;
    }
    if (key.latex) {
      // "placeholder" ne doit être utilisé QUE si le LaTeX inséré contient
      // vraiment un \placeholder{} à sélectionner (ex: \frac{\placeholder{}}{...}).
      // Sinon (ex: "\text{ cm}"), MathLive laisse la sélection sur tout le
      // contenu inséré au lieu de placer le curseur après — l'insertion
      // suivante remplace/atterrit alors À L'INTÉRIEUR de ce \text{...}, où le
      // backslash d'un futur "\text{...}" est tapé comme un caractère littéral
      // au lieu d'être interprété (d'où le LaTeX brut "cm\text{m}\text{km}…"
      // et le surlignage bleu natif qui restait affiché). "after" place
      // simplement le curseur juste après, comme sur un vrai clavier.
      const hasPlaceholder = key.latex.includes("\\placeholder");
      mf.insert(key.latex, {
        focus: true,
        selectionMode: hasPlaceholder ? "placeholder" : "after",
      } as any);
      return;
    }
    if (key.cmd) {
      mf.executeCommand(key.cmd as any);
      mf.focus();
    }
  };

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
      {keyboardConfig && (
        <CustomMathKeyboard
          config={keyboardConfig}
          visible={keyboardVisible}
          onKey={handleKeyboardKey}
          onInsertRaw={handleInsertRaw}
          onTabChange={handleTabChange}
          onClose={() => {
            setKeyboardVisible(false);
            mfRef.current?.blur();
          }}
        />
      )}
    </div>
  );
});

export default MathInput;

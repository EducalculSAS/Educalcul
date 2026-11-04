"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import "mathlive";
import type { MathfieldElement } from "mathlive";

type MathCommand = Parameters<MathfieldElement["executeCommand"]>[0];
import { incrementMathKeyboardOpen, decrementMathKeyboardOpen, subscribeMathKeyboardVisibility } from "@/lib/mathKeyboardVisibility";
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

/** Ajoute un fragment "\text{...}" (`incoming`) à la fin de `current`, fusionné
 * avec un \text{...} déjà présent en toute fin de champ s'il y en a un — pour
 * que taper plusieurs lettres à la suite (clavier ABC, ou lettres tapées au
 * clavier physique) donne un seul mot "\text{bonjour}" au lieu d'imbriquer un
 * \text{} dans un autre (MathLive tape alors le "\" suivant littéralement au
 * lieu de l'interpréter, d'où le LaTeX brut affiché tel quel + le
 * surlignage résiduel). */
function mergeTrailingText(current: string, incoming: string): string {
  const trailing = current.match(/\\text\{([^{}]*)\}$/);
  const added = incoming.match(/^\\text\{([^{}]*)\}$/);
  return trailing && added
    ? current.slice(0, -trailing[0].length) + `\\text{${trailing[1]}${added[1]}}`
    : current + incoming;
}

export { subscribeMathKeyboardVisibility };

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
    // Le repli sur le niveau par défaut est géré côté serveur.
    const res = await fetch(`/api/math-keyboard?level=${encodeURIComponent(level)}`);
    const data = res.ok ? await res.json() : null;
    const config = (data?.config as MathKeyboardConfig | undefined) ?? null;
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

/**
 * Valeur d'un champ MathLive, sans jamais planter : une fois le champ retiré de la page (changement de page, remontage),
 * MathLive libère son contenu et lire `value` jette « Cannot read properties of undefined (reading 'options') ». Le navigateur
 * émet pourtant un `blur` au retrait d'un champ focalisé, ce qui relisait la valeur d'un champ déjà libéré.
 */
function safeValue(mf: MathfieldElement): string {
  try {
    return mf.value;
  } catch {
    return "";
  }
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

  // Prévient le bus partagé ci-dessus tant que CE champ a son clavier
  // ouvert, pour que la bulle Calia/AITutor en bas à droite s'efface le temps
  // que le clavier occupe le bas de l'écran.
  useEffect(() => {
    if (!keyboardVisible) return;
    incrementMathKeyboardOpen();
    return () => decrementMathKeyboardOpen();
  }, [keyboardVisible]);

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

    // Voir focusHandler/blurHandler plus bas : un délai avant de fermer le
    // clavier au blur, annulé par un refocus rapide (frappe mobile rapide).
    let blurTimer: ReturnType<typeof setTimeout> | null = null;

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
    // Fond bleu persistant derrière tout texte "\text{...}" (unités, mots
    // tapés au clavier ABC/physique) : c'est --text-highlight-background-color
    // (règle .ML__focused .ML__text { background: ... } du CSS de MathLive),
    // une variable distincte de --highlight-background-color qu'on avait
    // ratée — jamais personnalisée, elle prend sa valeur par défaut basée sur
    // --_hue (un bleu). Rien à voir avec la sélection/le curseur (les deux
    // pistes essayées avant, sans effet, pour cette même raison). Neutralisée
    // ici : le texte reste simplement sur le fond du champ, comme du texte
    // normal.
    mf.style.setProperty("--text-highlight-background-color", "transparent");
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
          safeValue(mf).length === 0 && !isFocusedRef.current ? "block" : "none";
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

    // Une lettre OU un chiffre tapé au clavier PHYSIQUE de l'ordinateur passe
    // par défaut par le moteur maths de MathLive (variable italique isolée
    // pour une lettre, chiffre dans un atome maths à la police différente du
    // texte environnant) — mais pour écrire une réponse normale (mots et/ou
    // nombres) on veut du texte droit, homogène. On l'intercepte donc et on
    // route par le même mécanisme \text{...} que les touches du clavier ABC/
    // 123 personnalisé (voir NUM_ROWS dans seed-math-keyboards.ts). Les
    // opérateurs (+ - × ÷ =) ne sont PAS interceptés : ils restent de vrais
    // symboles maths, y compris tapés au clavier physique.
    //
    // Exceptions, pour que le texte ne casse pas les structures : les CHIFFRES et la virgule restent toujours de vraies
    // saisies maths à l'endroit du curseur (sinon ils tombaient après une fraction, des parenthèses ou une racine au lieu
    // d'y entrer), et une lettre tapée À L'INTÉRIEUR d'une structure (curseur avant la fin du champ) est saisie
    // normalement elle aussi.
    const letterKeydownHandler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!/^[a-zA-Z0-9À-ÿ,]$/.test(e.key)) return;
      if (/^[0-9,]$/.test(e.key)) return;
      if (mf.position < mf.lastOffset) return;
      e.preventDefault();
      e.stopPropagation();
      mf.value = mergeTrailingText(mf.value, `\\text{${e.key}}`);
      mf.position = mf.lastOffset;
      mf.focus();
      onChange(mf.value);
      updatePlaceholder();
    };
    mf.addEventListener("keydown", letterKeydownHandler, true);

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
      // Annule une fermeture de clavier en attente : notre réécriture
      // directe de mf.value (mergeTrailingText, pour le texte/les chiffres)
      // recrée le DOM interne du champ à chaque frappe, et en tapant vite
      // sur mobile ce remontage peut déclencher un blur/focus fugace que le
      // navigateur émet en deux temps — sans ce garde, le blur fermait le
      // clavier avant même que le focus revienne.
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
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
      // Petit délai avant de vraiment fermer le clavier : voir le commentaire
      // dans focusHandler — un refocus dans la foulée (frappe rapide sur
      // mobile) annule ce timer via clearTimeout au lieu de laisser le
      // clavier se fermer puis se rouvrir (clignotement, voire fermeture
      // définitive si le refocus arrive juste après le démontage).
      blurTimer = setTimeout(() => {
        blurTimer = null;
        if (!isFocusedRef.current) setKeyboardVisible(false);
      }, 150);
    };
    mf.addEventListener("focus", focusHandler);
    mf.addEventListener("blur", blurHandler);

    updatePlaceholder();

    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      mf.removeEventListener("input", handler);
      mf.removeEventListener("keydown", keydownHandler, true);
      mf.removeEventListener("keydown", letterKeydownHandler, true);
      mf.removeEventListener("pointerdown", matrixResetHandler);
      mf.removeEventListener("keydown", matrixResetHandler);
      mf.removeEventListener("focus", focusHandler);
      mf.removeEventListener("blur", blurHandler);
      // "NotFoundError: The object can not be found here." observé en prod
      // (Sentry) sur /child/cours/preview : removeChild() suppose que `mf`
      // est toujours un enfant DIRECT de `container` au moment du nettoyage,
      // ce qui n'est pas garanti (ex: MathLive a pu détacher/remplacer son
      // propre élément en interne avant que ce cleanup ne s'exécute). On ne
      // retire que si c'est encore vraiment le cas.
      // Retirer un champ encore focalisé fait émettre à MathLive un « blur » interne APRÈS la libération de son contenu :
      // « undefined is not an object (evaluating 'this.mathfield.options') » (vu sur /child/cours/preview). On le défocalise
      // d'abord, tant qu'il est encore entier.
      try {
        if (mf.matches(":focus-within") || document.activeElement === mf) mf.blur();
      } catch {
        // champ déjà libéré : rien à défocaliser
      }
      if (mf.parentNode === container) container.removeChild(mf);
      mfRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;
    if (safeValue(mf) !== (value || "")) {
      try { mf.value = value || ""; } catch { /* champ déjà détaché par MathLive */ }
    }
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
        mfRef.current?.insert(latex, { focus: true, selectionMode: "placeholder" });
      },
      command: (cmd) => {
        mfRef.current?.executeCommand(cmd as MathCommand);
        mfRef.current?.focus();
      },
      focus: () => mfRef.current?.focus(),
    }),
    []
  );

  // Ajoute un fragment "\text{...}" TOUJOURS à la toute fin du contenu,
  // fusionné avec un \text{...} déjà présent en fin de champ s'il y en a un.
  // Utilisé pour les lettres (onglet ABC), l'espace et les unités : ce sont
  // les seuls cas où mf.insert(...) s'est montré peu fiable ici — une fois
  // le curseur "après" un \text{...} fraîchement inséré, MathLive le
  // considère encore À L'INTÉRIEUR de la zone texte, donc l'insertion
  // suivante y tape son "\text{...}" caractère par caractère au lieu de
  // l'interpréter (d'où "t\text{e}\text{s}\text{t}" affiché tel quel, et le
  // surlignage bleu qui restait dessus). Écrire directement le LaTeX final
  // et replacer le curseur à la fin contourne complètement ce problème.
  // Pour tout le reste (chiffres, opérateurs, \frac, \sqrt…) mf.insert()
  // fonctionne très bien et respecte la position du curseur — on n'y touche
  // pas, seul le texte a ce comportement d'accumulation en toutes lettres.
  const appendText = (snippet: string) => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.value = mergeTrailingText(mf.value, snippet);
    // mf.position (et pas juste executeCommand("moveToMathfieldEnd")) : after
    // avoir réassigné .value, un simple déplacement de curseur laissait tout
    // le contenu visuellement sélectionné (surlignage bleu resté affiché) —
    // repositionner le curseur via .position force une vraie sélection vide.
    mf.position = mf.lastOffset;
    mf.focus();
    if (placeholderRef.current) placeholderRef.current.style.display = "none";
    onChange(mf.value);
  };

  const handleKeyboardKey = (key: MathKeyboardKey) => {
    const mf = mfRef.current;
    if (!mf) return;
    if (key.text !== undefined) {
      // Chiffres et virgule : insérés À L'ENDROIT DU CURSEUR, comme des maths. En « texte » ils s'ajoutaient toujours à la
      // toute fin du champ : impossible alors de remplir le haut ou le bas d'une fraction, l'intérieur de parenthèses
      // ou d'une racine (les chiffres tombaient après la structure).
      if (/^[0-9]$/.test(key.text) || key.text === ",") {
        mf.insert(key.text === "," ? "{,}" : key.text, { focus: true, format: "latex", selectionMode: "after" });
        return;
      }
      // Une lettre tapée dans une structure (fraction, parenthèses…) s'y insère ; ailleurs elle s'ajoute en texte à la fin.
      if (/^[a-zA-ZÀ-ÿ]$/.test(key.text) && mf.position < mf.lastOffset) {
        mf.insert(key.text, { focus: true, format: "latex", selectionMode: "after" });
        return;
      }
      appendText(`\\text{${key.text}}`);
      return;
    }
    if (key.cmd === "insertMatrix") {
      matrixGrowing = true;
      if (matrixActive) {
        // Appui consécutif : on agrandit (la matrice précédente est encore
        // sélectionnée, donc l'insertion la remplace) — toutes les cases sont
        // des placeholders, donc toutes visibles.
        matrixSize += 1;
        mf.insert(buildMatrixLatex(matrixSize), { selectionMode: "item" });
      } else {
        // Première fois (ou après être sorti d'une matrice) : matrice 2×2
        // neuve, en fin de champ pour éviter toute imbrication.
        matrixSize = 2;
        mf.executeCommand("moveToMathfieldEnd");
        mf.insert(buildMatrixLatex(matrixSize), { selectionMode: "item" });
        matrixActive = true;
      }
      matrixGrowing = false;
      mf.focus();
      return;
    }
    if (key.latex) {
      // Les touches "\text{...}" simples (unités : cm, km, €…) passent par
      // appendText, pour la même raison que les lettres de l'onglet ABC
      // ci-dessus (voir son commentaire) — tout le reste (chiffres,
      // opérateurs, \frac, \sqrt, \placeholder…) garde mf.insert(), qui
      // respecte correctement la position du curseur.
      if (/^\\text\{[^{}]*\}$/.test(key.latex)) {
        appendText(key.latex);
        return;
      }
      const hasPlaceholder = key.latex.includes("\\placeholder");
      // Virgule décimale : « {,} » (sans l'espace que LaTeX met après une virgule), comme sur une calculatrice.
      mf.insert(key.latex === "," ? "{,}" : key.latex, {
        focus: true,
        format: "latex",
        selectionMode: hasPlaceholder ? "placeholder" : "after",
      });
      return;
    }
    if (key.cmd) {
      mf.executeCommand([key.cmd] as MathCommand);
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

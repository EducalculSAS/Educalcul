"use client";

import { useEffect, useRef, useState } from "react";
import { Delete, ArrowLeft, ArrowRight, ChevronDown, CornerDownLeft, ArrowBigUp } from "lucide-react";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";

export type MathKeyboardKey = {
  label: string;
  latex?: string;
  /** Texte littéral à insérer (mode texte, pas maths) — voir l'onglet "ABC". */
  text?: string;
  cmd?: string;
  wide?: boolean;
};

export type MathKeyboardTab = {
  id: string;
  label: string;
  rows: MathKeyboardKey[][];
  /** "abc" : onglet à mise en page fixe, non pilotée par `rows` — clavier de
   * lettres complet façon iPhone (AZERTY). */
  special?: "abc";
};

const AZERTY_ROWS = [
  ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
  ["w", "x", "c", "v", "b", "n"],
];

// Variantes accentuées accessibles par appui long (façon clavier iPhone) —
// la première valeur est toujours la lettre de base. Une lettre absente
// d'ici n'a pas de popup : l'appui long ne fait alors rien de spécial.
const ACCENTS: Record<string, string[]> = {
  a: ["a", "à", "â", "ä"],
  e: ["e", "é", "è", "ê", "ë"],
  i: ["i", "î", "ï"],
  o: ["o", "ô", "ö"],
  u: ["u", "ù", "û", "ü"],
  c: ["c", "ç"],
  n: ["n", "ñ"],
  y: ["y", "ÿ"],
};

// Hauteur fixe de la zone de touches (avant la rangée d'actions commune) —
// calée sur le plus grand nombre de rangées parmi tous les onglets (4, pour
// "123"), pour que le clavier fasse la même hauteur totale quel que soit
// l'onglet actif (2, 3 ou 4 rangées). h-11 (44px) par touche + gap-1.5 (6px).
const GRID_HEIGHT = 4 * 44 + 3 * 6;

const ACCENT_BOX = 34; // largeur d'une pastille dans le popup d'accents
const LONG_PRESS_MS = 350;

export type MathKeyboardStyle = {
  bg?: string;
  keyBg?: string;
  keyText?: string;
  keyActiveBg?: string;
  keyActiveText?: string;
  accent?: string;
};

export type MathKeyboardConfig = {
  tabs: MathKeyboardTab[];
  style?: MathKeyboardStyle;
};

const DEFAULT_STYLE: Required<MathKeyboardStyle> = {
  bg: "rgba(250, 247, 242, 0.55)",
  keyBg: "rgba(255, 255, 255, 0.55)",
  keyText: "#1a1008",
  keyActiveBg: "#c5a148",
  keyActiveText: "#ffffff",
  accent: "#0f1e3a",
};

interface CustomMathKeyboardProps {
  config: MathKeyboardConfig;
  visible: boolean;
  onKey: (key: MathKeyboardKey) => void;
  onClose: () => void;
  /** Aperçu admin : reste dans son conteneur (position absolute) au lieu de
   * se coller en bas du vrai viewport (position fixed, comportement normal
   * côté élève). */
  embedded?: boolean;
}

interface AccentPopupState {
  options: string[];
  index: number;
  /** Bord droit du popup (= bord droit de la touche pressée), en px viewport. */
  anchorRight: number;
  top: number;
}

/**
 * Onglet ouvert par défaut. Les configurations de `math_keyboards` listent
 * toutes "ABC" en premier (ordre d'affichage voulu), mais une réponse est
 * numérique dans l'immense majorité des cas : ouvrir sur les lettres oblige
 * l'élève à changer d'onglet à chaque exercice. On garde donc l'ordre
 * d'affichage configuré en admin, mais on présélectionne le pavé numérique.
 */
function defaultTabId(tabs: MathKeyboardTab[]): string | undefined {
  const numeric = tabs.find((t) => t.id === "num" || t.label === "123");
  return (numeric || tabs[0])?.id;
}

/** Clavier mathématique "liquid glass" façon Apple : flou + saturation
 * derrière, léger surlignage spéculaire en haut, contenu configurable par
 * niveau (voir math_keyboards en base, éditable depuis l'admin). Remplace
 * entièrement le clavier virtuel par défaut de MathLive (voir MathInput.tsx :
 * mathVirtualKeyboardPolicy="manual" et jamais de getVirtualKeyboard().show()). */
export default function CustomMathKeyboard({
  config,
  visible,
  onKey,
  onClose,
  embedded,
}: CustomMathKeyboardProps) {
  const style = { ...DEFAULT_STYLE, ...(config.style || {}) };
  const tabs = config.tabs?.length ? config.tabs : [{ id: "num", label: "123", rows: [] }];
  const [activeTabId, setActiveTabId] = useState(defaultTabId(tabs));
  const [closing, setClosing] = useState(false);
  const [shiftOn, setShiftOn] = useState(false);
  const [accentPopup, setAccentPopup] = useState<AccentPopupState | null>(null);

  // Appui long sur une lettre à variantes accentuées (façon iPhone) : on
  // laisse la pression s'installer avant d'ouvrir le popup (longPressTimer),
  // on retient si le popup a bien été ouvert pour CETTE pression
  // (poppedRef — sinon le onClick qui suit ferait une double insertion), et
  // startXRef sert à mesurer le glissé horizontal une fois le popup ouvert.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poppedRef = useRef(false);
  const startXRef = useRef(0);

  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTabId)) setActiveTabId(defaultTabId(tabs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (visible) setClosing(false);
  }, [visible]);

  if (!visible && !closing) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleClose = () => {
    setClosing(true);
    // Laisse l'animation de glissement se terminer avant de vraiment démonter
    // (même durée que le slide-down ci-dessous).
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  const commitLetter = (char: string) => {
    onKey({ label: char, text: char });
    if (shiftOn) setShiftOn(false);
  };

  const handleLetterPointerDown = (letter: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    poppedRef.current = false;
    const variants = ACCENTS[letter];
    if (!variants || variants.length < 2) return;
    // Garde le pointeur "capturé" par cette touche même si le doigt glisse
    // ensuite hors de sa zone (vers le popup, à gauche) — sinon
    // onPointerMove/onPointerUp arrêteraient de se déclencher dès que le
    // doigt sort du bouton.
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    longPressTimerRef.current = setTimeout(() => {
      poppedRef.current = true;
      const opts = shiftOn ? variants.map((v) => v.toUpperCase()) : variants;
      setAccentPopup({ options: opts, index: 0, anchorRight: rect.right, top: rect.top });
    }, LONG_PRESS_MS);
  };

  const handleLetterPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!poppedRef.current) return;
    setAccentPopup((p) => {
      if (!p) return p;
      // Glisser vers la GAUCHE (dx > 0) avance dans les variantes (index 0 =
      // lettre de base, ancrée sous le point de départ du doigt).
      const dx = startXRef.current - e.clientX;
      const index = Math.max(0, Math.min(p.options.length - 1, Math.round(dx / ACCENT_BOX)));
      return index === p.index ? p : { ...p, index };
    });
  };

  const handleLetterPointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (poppedRef.current) {
      // Le commit (onKey -> focus()) doit rester dans le fil synchrone du
      // vrai geste utilisateur (pointerup) — l'appeler depuis le callback
      // d'un setState (comme avant) le repousse après le rendu React, hors
      // de ce fil, et certains navigateurs mobiles n'y considèrent alors
      // plus le focus() qui suit comme un vrai geste utilisateur : le champ
      // perdait le focus et le clavier se refermait tout seul au choix d'un
      // accent. On lit donc accentPopup (capturé par la fermeture de ce
      // rendu) directement, puis on commit AVANT de vider l'état.
      if (accentPopup) commitLetter(accentPopup.options[accentPopup.index]);
      setAccentPopup(null);
      // Le "click" natif qui suit ce pointerup doit être ignoré (déjà géré
      // ici) — voir handleLetterClick.
      return;
    }
    // Pression courte sans popup : rien à faire ici, le "click" natif qui
    // suit insère la lettre de base (voir handleLetterClick) — évite une
    // double insertion si jamais pointerup ET click se déclenchaient tous
    // les deux pour ce cas simple.
  };

  const handleLetterClick = (letter: string) => () => {
    if (poppedRef.current) {
      // Déjà géré par pointerup (sélection d'une variante) : on absorbe le
      // click de suivi sans rien insérer de plus.
      poppedRef.current = false;
      return;
    }
    commitLetter(shiftOn ? letter.toUpperCase() : letter);
  };

  return (
    <div
      className={embedded ? "relative z-10 pointer-events-none" : "fixed inset-x-0 bottom-0 z-[1200] pointer-events-none"}
    >
      <div
        className="w-full overflow-hidden pointer-events-auto backdrop-blur-[24px] backdrop-saturate-[1.4] border-t relative"
        style={{
          background: style.bg,
          borderColor: "rgba(255,255,255,0.4)",
          boxShadow: "0 -8px 32px rgba(15,30,58,0.18), 0 1px 0 rgba(255,255,255,0.6) inset",
          paddingBottom: embedded ? undefined : "max(0.5rem, env(safe-area-inset-bottom))",
          transform: visible && !closing ? "translateY(0)" : "translateY(110%)",
          transition: "transform 220ms cubic-bezier(0.34, 1.1, 0.64, 1)",
        }}
      >
        {/* Surlignage spéculaire du haut, façon verre épais */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)" }}
        />

        {/* Onglets — vrai slider "liquid glass" (même GlassSegmentedControl que
           le toggle Clavier/Dessin), taille au contenu (pas étiré) + un
           bouton fermer à part. */}
        <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1.5">
          <div className="min-w-0">
            <GlassSegmentedControl
              size="sm"
              nowrap
              options={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
              value={activeTab?.id || tabs[0]?.id}
              onChange={setActiveTabId}
            />
          </div>
          <button
            type="button"
            aria-label="Fermer le clavier"
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleClose}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
            style={{ color: style.keyText }}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Touches */}
        <div className="px-2 pb-2 flex flex-col gap-1">
          {/* Zone des touches propres à l'onglet — hauteur fixe (le plus grand
             nombre de rangées parmi tous les onglets, ici "123" avec 4
             rangées) et centrée verticalement, pour que TOUS les onglets
             (ABC compris) fassent exactement la même hauteur totale de
             clavier, qu'ils aient 2, 3 ou 4 rangées de touches. */}
          <div className="flex flex-col justify-center gap-1.5" style={{ minHeight: GRID_HEIGHT }}>
            {activeTab?.special === "abc"
              ? AZERTY_ROWS.map((row, i) => (
                  <div key={i} className="flex gap-1.5">
                    {i === 2 && (
                      <button
                        type="button"
                        aria-label="Majuscule"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => setShiftOn((v) => !v)}
                        className="flex-[1.4] h-11 rounded-xl flex items-center justify-center transition-transform duration-100 active:scale-90"
                        style={{
                          background: shiftOn ? style.accent : "rgba(255,255,255,0.35)",
                          color: shiftOn ? "#fff" : style.keyText,
                        }}
                      >
                        <ArrowBigUp className="w-4 h-4" />
                      </button>
                    )}
                    {row.map((letter) => {
                      const char = shiftOn ? letter.toUpperCase() : letter;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onPointerDown={handleLetterPointerDown(letter)}
                          onPointerMove={handleLetterPointerMove}
                          onPointerUp={handleLetterPointerUp}
                          onClick={handleLetterClick(letter)}
                          className="flex-1 h-11 rounded-xl text-base font-semibold flex items-center justify-center transition-transform duration-100 active:scale-90 touch-none"
                          style={{
                            background: style.keyBg,
                            color: style.keyText,
                            boxShadow: "0 1px 2px rgba(15,30,58,0.08), 0 1px 0 rgba(255,255,255,0.7) inset",
                            fontFamily: "var(--font-display)",
                          }}
                        >
                          {char}
                        </button>
                      );
                    })}
                    {/* Effacer juste après la dernière lettre, comme Majuscule
                       juste avant la première — même rangée, même hauteur. */}
                    {i === 2 && (
                      <button
                        type="button"
                        aria-label="Effacer"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => onKey({ label: "⌫", cmd: "deleteBackward" })}
                        className="flex-[1.4] h-11 rounded-xl flex items-center justify-center transition-transform duration-100 active:scale-90"
                        style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
                      >
                        <Delete className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              : (activeTab?.rows || []).map((row, i) => (
                  <div key={i} className="flex gap-1.5">
                    {row.map((key, j) => (
                      <button
                        key={j}
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => onKey(key)}
                        className={`flex-1 h-11 rounded-xl text-base font-semibold flex items-center justify-center transition-transform duration-100 active:scale-90 ${key.wide ? "flex-[2]" : ""}`}
                        style={{
                          background: style.keyBg,
                          color: style.keyText,
                          boxShadow: "0 1px 2px rgba(15,30,58,0.08), 0 1px 0 rgba(255,255,255,0.7) inset",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {key.label}
                      </button>
                    ))}
                  </div>
                ))}
          </div>

          {/* Rangée d'actions commune, même hauteur (h-11) que le reste du
             clavier pour tous les onglets : flèches, espace (large), entrée.
             "Effacer" vit ici UNIQUEMENT pour les onglets non-ABC (pour ABC
             il est déjà dans la rangée de lettres, à côté de la dernière). */}
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Caractère précédent"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey({ label: "←", cmd: "moveToPreviousChar" })}
              className="flex-1 h-11 rounded-xl flex items-center justify-center transition-transform duration-100 active:scale-90"
              style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Caractère suivant"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey({ label: "→", cmd: "moveToNextChar" })}
              className="flex-1 h-11 rounded-xl flex items-center justify-center transition-transform duration-100 active:scale-90"
              style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey({ label: "espace", text: " " })}
              className={`h-11 rounded-xl text-sm font-semibold flex items-center justify-center transition-transform duration-100 active:scale-95 ${
                activeTab?.special === "abc" ? "flex-[4]" : "flex-[3]"
              }`}
              style={{ background: style.keyBg, color: style.keyText }}
            >
              espace
            </button>
            {activeTab?.special !== "abc" && (
              <button
                type="button"
                aria-label="Effacer"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey({ label: "⌫", cmd: "deleteBackward" })}
                className="flex-1 h-11 rounded-xl flex items-center justify-center transition-transform duration-100 active:scale-90"
                style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
              >
                <Delete className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              aria-label="Retour à la ligne"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey({ label: "↵", cmd: "addRowAfter" })}
              className="flex-1 h-11 rounded-xl flex items-center justify-center transition-transform duration-100 active:scale-90"
              style={{ background: style.accent, color: "#fff" }}
            >
              <CornerDownLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Popup d'accents (appui long sur une lettre) — pastilles alignées de
         droite à gauche (row-reverse) : la première (lettre de base) reste
         ancrée sous le doigt, glisser vers la gauche avance dans les
         variantes suivantes. */}
      {accentPopup && (
        <div
          className="fixed flex gap-0.5 pointer-events-none z-[1300]"
          style={{
            flexDirection: "row-reverse",
            right: window.innerWidth - accentPopup.anchorRight,
            top: accentPopup.top - 46,
          }}
        >
          {accentPopup.options.map((opt, i) => (
            <div
              key={opt + i}
              className="rounded-lg flex items-center justify-center text-base font-bold shadow-lg transition-colors"
              style={{
                width: ACCENT_BOX,
                height: 40,
                background: i === accentPopup.index ? style.accent : style.keyBg,
                color: i === accentPopup.index ? "#fff" : style.keyText,
                fontFamily: "var(--font-display)",
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

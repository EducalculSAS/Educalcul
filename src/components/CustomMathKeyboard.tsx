"use client";

import { useEffect, useState } from "react";
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
  /** Onglets à mise en page fixe, non pilotés par `rows` :
   *  - "abc" : clavier de lettres complet façon iPhone (AZERTY).
   *  - "raw" : zone pour taper/coller du LaTeX brut et l'insérer tel quel. */
  special?: "abc" | "raw";
};

const AZERTY_ROWS = [
  ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
  ["w", "x", "c", "v", "b", "n"],
];

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
  /** LaTeX brut à insérer tel quel (onglet "LaTeX"), séparé de onKey car ce
   * n'est pas une touche prédéfinie mais du texte libre tapé par l'élève. */
  onInsertRaw?: (latex: string) => void;
  /** Prévient le champ qu'on change d'onglet, pour basculer mathlive en mode
   * texte sur "ABC" (sinon chaque lettre s'insère comme variable maths
   * italique isolée) et repasser en mode maths ailleurs. */
  onTabChange?: (tab: MathKeyboardTab) => void;
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
  onInsertRaw,
  onTabChange,
}: CustomMathKeyboardProps) {
  const style = { ...DEFAULT_STYLE, ...(config.style || {}) };
  const tabs = config.tabs?.length ? config.tabs : [{ id: "num", label: "123", rows: [] }];
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id);
  const [closing, setClosing] = useState(false);
  const [shiftOn, setShiftOn] = useState(false);
  const [rawText, setRawText] = useState("");

  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTabId)) setActiveTabId(tabs[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (visible) setClosing(false);
  }, [visible]);

  if (!visible && !closing) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleTabChange = (id: string) => {
    setActiveTabId(id);
    setRawText("");
    const tab = tabs.find((t) => t.id === id);
    if (tab) onTabChange?.(tab);
  };

  const handleClose = () => {
    setClosing(true);
    // Laisse l'animation de glissement se terminer avant de vraiment démonter
    // (même durée que le slide-down ci-dessous).
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  return (
    <div
      className={`${embedded ? "absolute" : "fixed"} inset-x-0 bottom-0 z-[1200] pointer-events-none`}
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
           le toggle Clavier/Dessin), plus un bouton fermer à part. */}
        <div className="flex items-center gap-2 px-2 pt-2 pb-1.5">
          <div className="flex-1 min-w-0">
            <GlassSegmentedControl
              size="sm"
              nowrap
              className="w-full"
              options={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
              value={activeTab?.id || tabs[0]?.id}
              onChange={handleTabChange}
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
        <div className="px-2 pb-2 flex flex-col gap-1.5">
          {activeTab?.special === "raw" ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="Tape du LaTeX brut, ex: \\int_0^1 x^2 dx"
                rows={2}
                className="w-full rounded-xl px-3 py-2 text-sm font-mono resize-none outline-none"
                style={{ background: style.keyBg, color: style.keyText }}
              />
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!rawText.trim()) return;
                  onInsertRaw?.(rawText);
                  setRawText("");
                }}
                className="h-10 rounded-xl text-sm font-bold flex items-center justify-center"
                style={{ background: style.accent, color: "#fff" }}
              >
                Insérer le LaTeX
              </button>
            </div>
          ) : activeTab?.special === "abc" ? (
            <div className="flex flex-col gap-1.5">
              {AZERTY_ROWS.map((row, i) => (
                <div key={i} className="flex gap-1.5">
                  {i === 2 && (
                    <button
                      type="button"
                      aria-label="Majuscule"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => setShiftOn((v) => !v)}
                      className="flex-[1.4] h-11 rounded-xl flex items-center justify-center"
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
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onKey({ label: char, text: char });
                          if (shiftOn) setShiftOn(false);
                        }}
                        className="flex-1 h-11 rounded-xl text-base font-semibold flex items-center justify-center transition-transform active:scale-95"
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
                  {i === 2 && (
                    <button
                      type="button"
                      aria-label="Effacer"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => onKey({ label: "⌫", cmd: "deleteBackward" })}
                      className="flex-[1.4] h-11 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
                    >
                      <Delete className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onKey({ label: "espace", text: " " })}
                  className="flex-[4] h-11 rounded-xl text-sm font-semibold flex items-center justify-center"
                  style={{ background: style.keyBg, color: style.keyText }}
                >
                  espace
                </button>
                <button
                  type="button"
                  aria-label="Retour à la ligne"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => onKey({ label: "↵", cmd: "addRowAfter" })}
                  className="flex-1 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: style.accent, color: "#fff" }}
                >
                  <CornerDownLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            (activeTab?.rows || []).map((row, i) => (
              <div key={i} className="flex gap-1.5">
                {row.map((key, j) => (
                  <button
                    key={j}
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => onKey(key)}
                    className={`flex-1 h-11 rounded-xl text-base font-semibold flex items-center justify-center transition-transform active:scale-95 ${key.wide ? "flex-[2]" : ""}`}
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
            ))
          )}

          {/* Rangée d'actions commune (déplacement, effacer, retour à la
             ligne) — absente pour "ABC" qui a déjà ses propres touches. */}
          {activeTab?.special !== "abc" && (
            <div className="flex gap-1.5 pt-0.5">
              <button
                type="button"
                aria-label="Caractère précédent"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey({ label: "←", cmd: "moveToPreviousChar" })}
                className="flex-1 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Caractère suivant"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey({ label: "→", cmd: "moveToNextChar" })}
                className="flex-1 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Retour à la ligne"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey({ label: "↵", cmd: "addRowAfter" })}
                className="flex-1 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
              >
                <CornerDownLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Effacer"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey({ label: "⌫", cmd: "deleteBackward" })}
                className="flex-[2] h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

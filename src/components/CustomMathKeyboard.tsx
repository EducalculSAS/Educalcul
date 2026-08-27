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
  /** "abc" : onglet à mise en page fixe, non pilotée par `rows` — clavier de
   * lettres complet façon iPhone (AZERTY). */
  special?: "abc";
};

const AZERTY_ROWS = [
  ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
  ["w", "x", "c", "v", "b", "n"],
];

// Hauteur fixe de la zone de touches (avant la rangée d'actions commune) —
// calée sur le plus grand nombre de rangées parmi tous les onglets (4, pour
// "123"), pour que le clavier fasse la même hauteur totale quel que soit
// l'onglet actif (2, 3 ou 4 rangées). h-11 (44px) par touche + gap-1.5 (6px).
const GRID_HEIGHT = 4 * 44 + 3 * 6;

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
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id);
  const [closing, setClosing] = useState(false);
  const [shiftOn, setShiftOn] = useState(false);

  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTabId)) setActiveTabId(tabs[0]?.id);
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
        <div className="px-2 pb-2 flex flex-col gap-1.5">
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
                    {i === 2 && <div className="flex-[1.4]" />}
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
                ))}
          </div>

          {/* Rangée d'actions commune à TOUS les onglets, ABC compris — même
             taille compacte (h-11) que le reste du clavier : flèches, espace
             (large), effacer, entrée. */}
          <div className="flex gap-1.5 pt-0.5">
            <button
              type="button"
              aria-label="Caractère précédent"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey({ label: "←", cmd: "moveToPreviousChar" })}
              className="flex-1 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Caractère suivant"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey({ label: "→", cmd: "moveToNextChar" })}
              className="flex-1 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey({ label: "espace", text: " " })}
              className="flex-[4] h-11 rounded-xl text-sm font-semibold flex items-center justify-center"
              style={{ background: style.keyBg, color: style.keyText }}
            >
              espace
            </button>
            {/* Effacer/entrée empilés dans la même colonne (effacer dessus,
               entrée dessous) plutôt que côte à côte — laisse plus de place
               à "espace". */}
            <div className="flex-1 flex flex-col gap-1">
              <button
                type="button"
                aria-label="Effacer"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey({ label: "⌫", cmd: "deleteBackward" })}
                className="flex-1 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
              >
                <Delete className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Retour à la ligne"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => onKey({ label: "↵", cmd: "addRowAfter" })}
                className="flex-1 rounded-lg flex items-center justify-center"
                style={{ background: style.accent, color: "#fff" }}
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

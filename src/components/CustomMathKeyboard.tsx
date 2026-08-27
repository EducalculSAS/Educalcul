"use client";

import { useEffect, useState } from "react";
import { Delete, ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";

export type MathKeyboardKey = {
  label: string;
  latex?: string;
  cmd?: string;
  wide?: boolean;
};

export type MathKeyboardTab = {
  id: string;
  label: string;
  rows: MathKeyboardKey[][];
};

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
export default function CustomMathKeyboard({ config, visible, onKey, onClose, embedded }: CustomMathKeyboardProps) {
  const style = { ...DEFAULT_STYLE, ...(config.style || {}) };
  const tabs = config.tabs?.length ? config.tabs : [{ id: "num", label: "123", rows: [] }];
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id);
  const [closing, setClosing] = useState(false);

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

        {/* Onglets — même esprit "liquid glass" qu'un GlassSegmentedControl :
           une piste translucide unique, l'onglet actif en pastille pleine. */}
        <div className="flex items-center gap-2 px-2 pt-2 pb-1.5">
          <div
            className="flex items-center gap-0.5 p-1 rounded-full overflow-x-auto flex-1 backdrop-blur-[16px]"
            style={{ background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.5)" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setActiveTabId(tab.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold font-[family-name:var(--font-display)] transition-all duration-200"
                style={
                  activeTab?.id === tab.id
                    ? { background: style.accent, color: "#fff", boxShadow: "0 2px 8px rgba(15,30,58,0.25)" }
                    : { background: "transparent", color: style.keyText }
                }
              >
                {tab.label}
              </button>
            ))}
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
          {(activeTab?.rows || []).map((row, i) => (
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

          {/* Rangée d'actions commune à tous les onglets */}
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
              aria-label="Effacer"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => onKey({ label: "⌫", cmd: "deleteBackward" })}
              className="flex-[2] h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.35)", color: style.keyText }}
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

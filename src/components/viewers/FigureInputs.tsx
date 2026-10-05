"use client";

import type { FigureSpec } from "@/components/admin/ExerciseBuilder";

interface FigureInputsProps {
  spec: FigureSpec;
  /** Une valeur par case vide, dans l'ordre de lecture (haut vers bas, gauche vers droite). */
  values: string[];
  disabled: boolean;
  /** Réponses attendues (alternatives séparées par « | »), connues seulement après correction. */
  expected?: string[];
  submitted: boolean;
  onChange: (values: string[]) => void;
}

/**
 * Pyramide de briques ou grille à compléter : l'élève écrit directement DANS les
 * cases vides de la figure. Les cases données s'affichent, les cases vides sont des champs.
 */
export default function FigureInputs({ spec, values, disabled, expected, submitted, onChange }: FigureInputsProps) {
  let blankIndex = -1;

  const setValue = (idx: number, value: string) => {
    const next = [...values];
    next[idx] = value;
    onChange(next);
  };

  const cell = (text: string, key: string, tone: "pyramid" | "grid", size: { w: number; h: number }) => {
    if (text) {
      return (
        <div
          key={key}
          data-keep-light
          className="flex items-center justify-center font-bold"
          style={{
            width: size.w,
            height: size.h,
            borderRadius: tone === "pyramid" ? 6 : 0,
            background: tone === "pyramid" ? "#8abf9c" : "#ffffff",
            border: "1.5px solid #0f1e3a",
            color: "#0f1e3a",
            fontSize: tone === "pyramid" ? 15 : 17,
          }}
        >
          {text}
        </div>
      );
    }
    blankIndex += 1;
    const idx = blankIndex;
    const value = values[idx] ?? "";
    let state: "idle" | "ok" | "ko" = "idle";
    if (submitted && expected && expected[idx] !== undefined) {
      const alts = String(expected[idx]).split("|").map((s) => s.trim().toLowerCase());
      state = alts.includes(value.trim().toLowerCase()) ? "ok" : "ko";
    }
    return (
      <input
        key={key}
        data-keep-light
        type="text"
        inputMode="text"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => setValue(idx, e.target.value)}
        aria-label={`Case vide ${idx + 1}`}
        className="text-center font-bold outline-none"
        style={{
          width: size.w,
          height: size.h,
          borderRadius: tone === "pyramid" ? 6 : 0,
          border: `1.5px ${state === "idle" ? "dashed" : "solid"} ${state === "ok" ? "#16a34a" : state === "ko" ? "#dc2626" : "#0f1e3a"}`,
          background: state === "ok" ? "#dcfce7" : state === "ko" ? "#fee2e2" : tone === "grid" ? "#fff8e1" : "#ffffff",
          color: "#0f1e3a",
          fontSize: tone === "pyramid" ? 15 : 17,
        }}
      />
    );
  };

  if (spec.kind === "brick_pyramid") {
    const size = { w: 58, h: 34 };
    return (
      <div className="flex flex-col items-center gap-1 my-3 overflow-x-auto" role="group" aria-label="Pyramide à compléter">
        {spec.levels.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((text, c) => cell(text, `${r}-${c}`, "pyramid", size))}
          </div>
        ))}
      </div>
    );
  }

  const size = { w: 54, h: 54 };
  const cols = spec.cells[0]?.length ?? 1;
  return (
    <div
      className="inline-grid my-3"
      style={{ gridTemplateColumns: `repeat(${cols}, ${size.w}px)`, gap: 0 }}
      role="group"
      aria-label="Grille à compléter"
    >
      {spec.cells.flatMap((row, r) => row.map((text, c) => cell(text, `${r}-${c}`, "grid", size)))}
    </div>
  );
}

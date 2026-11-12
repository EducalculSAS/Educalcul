"use client";

import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { renderUserText } from "@/lib/katexLoader";
import GlassButton from "@/components/ui/GlassButton";
import type { LevelExercise } from "@/lib/seo/levels";

/** Petit exercice public (une question, correction immédiate) : un avant-goût, sans compte. */
export default function MiniExercise({ exercise }: { exercise: LevelExercise }) {
  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === exercise.answer;
  return (
    <div>
      <p className="text-base font-semibold text-gray-800 mb-4" dangerouslySetInnerHTML={{ __html: renderUserText(exercise.question) }} />
      <div className="grid grid-cols-2 gap-3" role="group" aria-label="Réponses possibles">
        {exercise.choices.map((c) => {
          const state = picked === null ? "idle" : c === exercise.answer ? "right" : c === picked ? "wrong" : "idle";
          return (
            <button
              key={c}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(c)}
              className={`rounded-2xl border-2 px-4 py-3 text-base font-bold transition-colors
                ${state === "right" ? "border-green-600 bg-green-50 text-green-800" : state === "wrong" ? "border-red-500 bg-red-50 text-red-700" : "border-[rgba(197,161,72,0.25)] bg-white text-[var(--greek-blue)] hover:border-[var(--greek-gold)]"}
                ${picked === null ? "cursor-pointer" : "cursor-default"}`}
            >
              <span dangerouslySetInnerHTML={{ __html: renderUserText(c) }} />
            </button>
          );
        })}
      </div>
      <div aria-live="polite">
        {picked !== null && (
          <div className={`mt-4 rounded-2xl p-4 border ${correct ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <p className={`font-bold flex items-center gap-2 ${correct ? "text-green-800" : "text-amber-800"}`}>
              {correct ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {correct ? "Bonne réponse !" : <span>Pas tout à fait : la bonne réponse est <span dangerouslySetInnerHTML={{ __html: renderUserText(exercise.answer) }} />.</span>}
            </p>
            <p className="text-sm text-gray-700 mt-1" dangerouslySetInnerHTML={{ __html: renderUserText(exercise.explanation) }} />
            <div className="mt-3 flex flex-wrap gap-2">
              <GlassButton onClick={() => setPicked(null)} variant="outline" size="sm">Réessayer</GlassButton>
              <GlassButton href="/auth/inscription" variant="navy" size="sm">Continuer avec 7 jours gratuits</GlassButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

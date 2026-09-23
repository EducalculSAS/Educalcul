"use client";

import { AlertCircle, CheckCircle2, Eye, XCircle } from "lucide-react";
import { renderLatexInHTML } from "@/lib/katexLoader";

export type AnswerFeedbackKind = "correct" | "wrong" | "revealed" | "unavailable";

const STYLES: Record<AnswerFeedbackKind, { bg: string; border: string; accent: string; title: string; Icon: typeof CheckCircle2 }> = {
  correct: { bg: "rgba(22,163,74,0.07)", border: "#16a34a", accent: "#15803d", title: "Bonne réponse", Icon: CheckCircle2 },
  wrong: { bg: "rgba(220,38,38,0.06)", border: "#dc2626", accent: "#b91c1c", title: "Pas tout à fait", Icon: XCircle },
  revealed: { bg: "rgba(197,161,72,0.10)", border: "var(--greek-gold)", accent: "var(--greek-blue)", title: "Correction", Icon: Eye },
  unavailable: { bg: "rgba(245,158,11,0.08)", border: "#f59e0b", accent: "#92400e", title: "Correction indisponible", Icon: AlertCircle },
};

/** Réponse attendue affichée en formule quand c'est du LaTeX nu (sans $). */
function asMath(value: string): string {
  const v = value.trim();
  return /[\\^_{}]/.test(v) && !v.includes("$") ? `$${v}$` : v;
}

/**
 * Retour de correction — LE même partout : exercices, mini-exercices des
 * cours, corrections de quiz, pour une bonne réponse comme pour une erreur.
 * Titre court, explication de l'IA (formules rendues), réponse attendue si
 * elle est révélée.
 */
export default function AnswerFeedback({
  kind, feedback, correctAnswer, points, tryAgain = false,
}: {
  kind: AnswerFeedbackKind;
  /** Explication (IA ou rédigée), en texte avec formules $…$. */
  feedback?: string | null;
  /** Réponse attendue à montrer (correction révélée ou copie corrigée). */
  correctAnswer?: string | null;
  /** Points gagnés, affichés pour une bonne réponse. */
  points?: number;
  /** « Essaie encore » sous une erreur quand l'élève peut retenter. */
  tryAgain?: boolean;
}) {
  const s = STYLES[kind];
  // « Bonne réponse ! » seul n'apporte rien sous le titre « Bonne réponse ».
  const text = (feedback ?? "").replace(/^(Bonne réponse|Correct)\b\s*!?\s*|^Ce n'est pas la bonne réponse\.?\s*/i, "").trim();
  return (
    <div
      role={kind === "wrong" || kind === "unavailable" ? "alert" : "status"}
      className="rounded-2xl px-4 py-3 flex items-start gap-3"
      style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}
    >
      <s.Icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: s.border }} aria-hidden />
      <div className="flex-1 min-w-0 text-sm leading-relaxed" style={{ color: "var(--greek-blue)" }}>
        <p className="font-bold flex items-center gap-2 flex-wrap" style={{ color: s.accent }}>
          {s.title}
          {kind === "correct" && points ? (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[rgba(22,163,74,0.12)] text-green-700">+{points} pt{points > 1 ? "s" : ""}</span>
          ) : null}
        </p>
        {text && <div className="latex-content mt-1" dangerouslySetInnerHTML={{ __html: renderLatexInHTML(text) }} />}
        {correctAnswer && (kind === "revealed" || kind === "wrong") && (
          <p className="latex-content mt-1.5">
            <span className="font-semibold">Réponse attendue : </span>
            <span dangerouslySetInnerHTML={{ __html: renderLatexInHTML(asMath(correctAnswer)) }} />
          </p>
        )}
        {kind === "wrong" && tryAgain && <p className="text-xs mt-1 opacity-75">Essaie encore.</p>}
      </div>
    </div>
  );
}

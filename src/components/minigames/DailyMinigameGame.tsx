"use client";

import { useRef, useState } from "react";
import { ArrowRight, SkipForward } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { useToast } from "@/components/Toast";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { GAME_BY_KEY, scoreLabel, shareText } from "@/lib/minigames/catalog";
import type { CorrectionLine } from "@/lib/minigames/correction";
import type { MinigameType, AnswerType } from "@/lib/minigames/gameTypes";
import { CorrectionList, GAME_CARD, GameFrame, GameIntro, GameResult, ProgressDots, TimerPill, useElapsed } from "@/components/minigames/GameShell";

interface Question { index: number; prompt: string }
type Answer = { index: number; value: number | string };
export interface DailyOutcome { score: number; maxScore: number; durationSeconds: number | null; correction: CorrectionLine[] }

// Les routes API suivent la convention d'URL à tirets du reste du site (ex. /child/minigames/calcul-mental), alors que
// `game_type` (la valeur en base) garde l'underscore ("calcul_mental").
function apiSlug(gameType: MinigameType): string {
  return gameType.replace(/_/g, "-");
}

/**
 * Jeux « à fiche du jour » (calcul mental, énigmes, suites, langues) : même déroulé, seule la saisie change
 * (nombre ou texte). La partie ne démarre qu'au clic sur « Commencer » : ouvrir la page ne consomme rien.
 * Si la fiche du jour est déjà faite, la page s'ouvre directement sur le résultat et sa correction.
 */
export default function DailyMinigameGame({ gameType, day, initialStreak, initialResult }: {
  gameType: MinigameType;
  /** Jour de la fiche (AAAA-MM-JJ). */
  day: string;
  initialStreak: number;
  initialResult: DailyOutcome | null;
}) {
  const game = GAME_BY_KEY[gameType];
  const { error: toastError } = useToast();
  const [phase, setPhase] = useState<"intro" | "playing" | "finished">(initialResult ? "finished" : "intro");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answerType, setAnswerType] = useState<AnswerType>("number");
  const [fullSheet, setFullSheet] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [result, setResult] = useState<DailyOutcome | null>(initialResult);
  // La série inclut déjà aujourd'hui quand la fiche était faite à l'arrivée ; sinon elle gagne un jour à la fin.
  const [streak, setStreak] = useState(initialStreak);
  const [startedAt, setStartedAt] = useState(0);
  const answersRef = useRef<Answer[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const elapsed = useElapsed(startedAt, phase === "playing");

  const startGame = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/child/minigames/${apiSlug(gameType)}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setStartError(data.error || "Impossible de démarrer la partie."); return; }
      answersRef.current = [];
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setAnswerType(data.answerType || "number");
      setFullSheet(data.isPremium !== false);
      setCurrentIndex(0);
      setInputValue("");
      setStartedAt(Date.now());
      setPhase("playing");
    } catch {
      setStartError("Connexion interrompue. Vérifie ta connexion puis réessaie.");
    } finally {
      setStarting(false);
    }
  };

  const finishGame = async (finalAnswers: Answer[]) => {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/child/minigames/${apiSlug(gameType)}/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers, durationSeconds: Math.round((Date.now() - startedAt) / 1000) }),
      });
      const data = await res.json();
      if (!res.ok) { toastError(data.error || "Impossible d'enregistrer la partie."); return; }
      setResult({ score: data.score, maxScore: data.maxScore, durationSeconds: data.durationSeconds ?? null, correction: data.correction || [] });
      setStreak((s) => s + 1);
      setSessionId(null); // partie close : le retour n'a plus rien à annuler
      setPhase("finished");
    } catch {
      toastError("Connexion interrompue : ta partie n'est pas enregistrée. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  const goToNext = (value: number | string | null) => {
    const next = value === null ? answersRef.current : [...answersRef.current, { index: currentIndex, value }];
    answersRef.current = next;
    setInputValue("");
    setInputError(null);
    if (currentIndex + 1 >= questions.length) {
      finishGame(next);
    } else {
      setCurrentIndex((i) => i + 1);
      inputRef.current?.focus();
    }
  };

  const validate = () => {
    const raw = inputValue.trim();
    if (raw === "") { setInputError(answerType === "number" ? "Écris un nombre, ou passe la question." : "Écris une réponse, ou passe la question."); return; }
    if (answerType === "number") {
      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value)) { setInputError("Ce n'est pas un nombre."); return; }
      goToNext(value);
    } else {
      goToNext(raw);
    }
  };

  if (phase === "finished" && result) {
    const perfect = result.score === result.maxScore && result.maxScore > 0;
    return (
      <GameFrame game={game} sessionId={null}>
        <GameResult
          game={game}
          tone={result.score > 0 ? "win" : "neutral"}
          title={perfect ? "Sans faute !" : result.score > 0 ? "Fiche terminée" : "Fiche terminée, on retente demain"}
          subtitle={perfect ? "Toutes les réponses sont justes." : "Regarde la correction juste en dessous."}
          score={scoreLabel(game, result.score, result.maxScore)}
          durationSeconds={result.durationSeconds}
          streak={streak}
          share={shareText(game, { date: day, score: result.score, max: result.maxScore, marks: result.correction.map((l) => l.correct), durationSeconds: result.durationSeconds, streak })}
        >
          <CorrectionList lines={result.correction} />
        </GameResult>
      </GameFrame>
    );
  }

  if (phase === "intro") {
    return (
      <GameFrame game={game} sessionId={null}>
        <GameIntro
          game={game}
          streak={streak}
          facts={["Une fiche par jour", "Jusqu'à 5 questions", "Sans limite de temps"]}
          onStart={startGame}
          starting={starting}
          error={startError}
        />
      </GameFrame>
    );
  }

  const question = questions[currentIndex];
  const last = currentIndex + 1 >= questions.length;

  return (
    <GameFrame game={game} sessionId={sessionId} right={<TimerPill seconds={elapsed} />}>
      <div className={GAME_CARD}>
        <ProgressDots total={questions.length} current={currentIndex} />
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-500 mt-4">Question {currentIndex + 1} sur {questions.length}</p>

        <div
          className="font-[family-name:var(--font-display)] text-xl md:text-2xl font-bold text-[var(--greek-blue)] text-center my-8 [overflow-wrap:anywhere]"
          dangerouslySetInnerHTML={{ __html: renderLatexInHTML(question?.prompt || "") }}
        />

        <form onSubmit={(e) => { e.preventDefault(); if (!submitting) validate(); }} className="max-w-sm mx-auto">
          <label htmlFor="minigame-answer" className="sr-only">Ta réponse</label>
          <input
            id="minigame-answer"
            ref={inputRef}
            type="text"
            inputMode={answerType === "number" ? "decimal" : "text"}
            autoComplete="off"
            autoFocus
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setInputError(null); }}
            aria-invalid={!!inputError}
            className={`w-full text-center text-2xl font-bold py-3 px-4 rounded-2xl border-2 bg-[var(--greek-cream)]/40 text-[var(--greek-blue)] outline-none transition-colors focus:border-[var(--greek-blue)] ${inputError ? "border-red-400" : "border-[rgba(197,161,72,0.5)]"}`}
            placeholder="Ta réponse"
          />
          <p className="h-5 mt-1 text-center text-xs text-red-600" role="alert">{inputError}</p>
          <div className="flex items-center justify-between gap-3 mt-3">
            <GlassButton type="button" onClick={() => goToNext(null)} variant="ghost" size="sm" disabled={submitting}>
              <SkipForward className="w-4 h-4" /> Passer
            </GlassButton>
            <GlassButton type="submit" variant="navy" disabled={submitting}>
              {submitting ? "Correction…" : last ? "Terminer" : "Valider"} <ArrowRight className="w-4 h-4" />
            </GlassButton>
          </div>
        </form>
      </div>
      {!fullSheet && (
        <p className="mt-4 text-center text-xs text-gray-500">Ta formule donne accès au début de la fiche. La fiche complète fait partie des formules Solo et Family.</p>
      )}
    </GameFrame>
  );
}

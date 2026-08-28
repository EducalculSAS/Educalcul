"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, PuzzleIcon, TrendingUp, Languages, type LucideIcon } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import AppLoader from "@/components/AppLoader";
import { useToast } from "@/components/Toast";
import { renderLatexInHTML } from "@/lib/katexLoader";
import MinigamesLeaderboard from "@/components/minigames/MinigamesLeaderboard";
import MinigameBackButton from "@/components/minigames/MinigameBackButton";
import type { MinigameType, AnswerType } from "@/lib/minigames/gameTypes";

interface Question {
  index: number;
  prompt: string;
}

type Answer = { index: number; value: number | string };
type GameState = "loading" | "playing" | "finished" | "error";

// Identité visuelle par jeu (icône + accent) — mêmes couleurs que les cartes
// du catalogue (/child/minigames) pour que le jeu reste reconnaissable une
// fois lancé, même si la mécanique (question/input) est partagée.
const GAME_VISUALS: Record<MinigameType, { icon: LucideIcon; badgeClass: string; accent: string }> = {
  calcul_mental: { icon: Calculator, badgeClass: "bg-yellow-100 text-[var(--greek-gold)]", accent: "var(--greek-gold)" },
  enigmes: { icon: PuzzleIcon, badgeClass: "bg-purple-100 text-purple-600", accent: "#9333ea" },
  suites: { icon: TrendingUp, badgeClass: "bg-teal-100 text-teal-600", accent: "#0d9488" },
  langues: { icon: Languages, badgeClass: "bg-rose-100 text-rose-600", accent: "#e11d48" },
};

// Les routes API suivent la convention d'URL à tirets du reste du site
// (ex. /child/minigames/calcul-mental), alors que `game_type` (la valeur en
// base, utilisée partout ailleurs dans le code) garde l'underscore
// ("calcul_mental") — seule la route calcul-mental a un tiret, les 3 autres
// jeux sont des mots simples et ne changent pas.
function apiSlug(gameType: MinigameType): string {
  return gameType.replace(/_/g, "-");
}

/** Composant générique pour tous les mini-jeux "à paliers" (calcul mental,
 * énigmes, suites, langues) — même mécanique (une question à la fois,
 * sans chrono), seule la saisie change (numérique ou texte) selon
 * `answerType` renvoyé par la route de démarrage. */
export default function DailyMinigameGame({ gameType }: { gameType: MinigameType }) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [state, setState] = useState<GameState>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answerType, setAnswerType] = useState<AnswerType>("number");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startedAt = useRef<number>(0);
  const answersRef = useRef<Answer[]>([]);

  const startGame = async () => {
    setState("loading");
    setResult(null);
    setAnswers([]);
    answersRef.current = [];
    setCurrentIndex(0);
    setInputValue("");
    try {
      const res = await fetch(`/api/child/minigames/${apiSlug(gameType)}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Impossible de démarrer la partie.");
        setState("error");
        return;
      }
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setAnswerType(data.answerType || "number");
      startedAt.current = Date.now();
      setState("playing");
    } catch {
      setErrorMsg("Erreur réseau.");
      setState("error");
    }
  };

  useEffect(() => {
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameType]);

  const finishGame = async (finalAnswers: Answer[]) => {
    if (!sessionId) return;
    const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    try {
      const res = await fetch(`/api/child/minigames/${apiSlug(gameType)}/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers, durationSeconds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || "Impossible d'enregistrer la partie.");
        return;
      }
      setResult({ score: data.score, maxScore: data.maxScore });
      setState("finished");
      if (data.score > 0) toastSuccess(`${data.score}/${data.maxScore} bonnes réponses !`);
    } catch {
      toastError("Erreur réseau.");
    }
  };

  const goToNext = (value: number | string | null) => {
    const next = value === null ? answersRef.current : [...answersRef.current, { index: currentIndex, value }];
    answersRef.current = next;
    setAnswers(next);
    setInputValue("");
    if (currentIndex + 1 >= questions.length) {
      finishGame(next);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSubmitAnswer = () => {
    if (inputValue.trim() === "") {
      toastError(answerType === "number" ? "Entre un nombre." : "Entre une réponse.");
      return;
    }
    if (answerType === "number") {
      const value = Number(inputValue);
      if (!Number.isFinite(value)) {
        toastError("Entre un nombre.");
        return;
      }
      goToNext(value);
    } else {
      goToNext(inputValue);
    }
  };

  if (state === "loading") {
    return (
      <>
        <MinigameBackButton sessionId={sessionId} />
        <AppLoader />
      </>
    );
  }

  if (state === "error") {
    const alreadyPlayedToday = errorMsg?.includes("déjà fait ce mini-jeu aujourd'hui");
    return (
      <>
        <MinigameBackButton sessionId={sessionId} />
        <div className="max-w-md mx-auto text-center py-20 px-4">
          <p className="text-[var(--text-muted)] mb-4">{errorMsg}</p>
          {!alreadyPlayedToday && (
            <GlassButton onClick={startGame} variant="navy">Réessayer</GlassButton>
          )}
          {alreadyPlayedToday && (
            <div className="mt-8 text-left">
              <MinigamesLeaderboard gameType={gameType} />
            </div>
          )}
        </div>
      </>
    );
  }

  const { icon: GameIcon, badgeClass, accent } = GAME_VISUALS[gameType];

  if (state === "finished" && result) {
    return (
      <>
        <MinigameBackButton sessionId={sessionId} />
        <div className="max-w-md mx-auto text-center py-16 px-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${badgeClass}`}>
            <GameIcon className="w-7 h-7" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-3">
            Partie terminée !
          </h1>
          <p className="text-lg mb-6">
            Score :{" "}
            <span className="font-bold" style={{ color: "var(--greek-gold)" }}>
              {result.score} / {result.maxScore}
            </span>
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-8">À demain pour une nouvelle fiche !</p>
          <div className="text-left">
            <MinigamesLeaderboard gameType={gameType} />
          </div>
        </div>
      </>
    );
  }

  const question = questions[currentIndex];

  return (
    <>
      <MinigameBackButton sessionId={sessionId} />
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-5 ${badgeClass}`}>
          <GameIcon className="w-6 h-6" />
        </div>

        <div className="mb-6 text-sm text-[var(--text-muted)]">
          <span>Question {currentIndex + 1} / {questions.length}</span>
        </div>

        <div
          className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--greek-blue)] mb-8"
          dangerouslySetInnerHTML={{ __html: renderLatexInHTML(question?.prompt || "") }}
        />

        <input
          type={answerType === "number" ? "number" : "text"}
          inputMode={answerType === "number" ? "decimal" : "text"}
          autoFocus
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
          className="w-full text-center text-2xl font-bold py-3 px-4 rounded-xl border-2 mb-6 outline-none"
          style={{ borderColor: accent, color: "var(--greek-blue)" }}
          placeholder="?"
        />

        <GlassButton onClick={handleSubmitAnswer} variant="gold" fullWidth>
          Valider
        </GlassButton>
      </div>
    </>
  );
}

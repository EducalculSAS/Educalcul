"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { useToast } from "@/components/Toast";

interface Question {
  index: number;
  prompt: string;
}

type GameState = "loading" | "playing" | "finished" | "error";

const SECONDS_PER_QUESTION = 10;

export default function CalculMentalGame() {
  const { error: toastError, success: toastSuccess } = useToast();
  const [state, setState] = useState<GameState>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ index: number; value: number }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startedAt = useRef<number>(0);
  const answersRef = useRef<{ index: number; value: number }[]>([]);

  const startGame = async () => {
    setState("loading");
    setResult(null);
    setAnswers([]);
    answersRef.current = [];
    setCurrentIndex(0);
    setInputValue("");
    try {
      const res = await fetch("/api/child/minigames/calcul-mental/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Impossible de démarrer la partie.");
        setState("error");
        return;
      }
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      startedAt.current = Date.now();
      setTimeLeft(SECONDS_PER_QUESTION);
      setState("playing");
    } catch {
      setErrorMsg("Erreur réseau.");
      setState("error");
    }
  };

  useEffect(() => {
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishGame = async (finalAnswers: { index: number; value: number }[]) => {
    if (!sessionId) return;
    const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    try {
      const res = await fetch(`/api/child/minigames/calcul-mental/${sessionId}/submit`, {
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

  const goToNext = (value: number | null) => {
    const next = value === null ? answersRef.current : [...answersRef.current, { index: currentIndex, value }];
    answersRef.current = next;
    setAnswers(next);
    setInputValue("");
    if (currentIndex + 1 >= questions.length) {
      finishGame(next);
    } else {
      setCurrentIndex((i) => i + 1);
      setTimeLeft(SECONDS_PER_QUESTION);
    }
  };

  // Minuteur par question — passe automatiquement à la suivante (réponse
  // vide comptée fausse) si le temps est écoulé.
  useEffect(() => {
    if (state !== "playing") return;
    if (timeLeft <= 0) {
      const value = Number(inputValue);
      goToNext(inputValue.trim() !== "" && Number.isFinite(value) ? value : null);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, state]);

  const handleSubmitAnswer = () => {
    const value = Number(inputValue);
    if (inputValue.trim() === "" || !Number.isFinite(value)) {
      toastError("Entre un nombre.");
      return;
    }
    goToNext(value);
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--greek-gold)" }} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <p className="text-[var(--text-muted)] mb-4">{errorMsg}</p>
        <GlassButton onClick={startGame} variant="navy">Réessayer</GlassButton>
      </div>
    );
  }

  if (state === "finished" && result) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-3">
          Partie terminée !
        </h1>
        <p className="text-lg mb-6">
          Score :{" "}
          <span className="font-bold" style={{ color: "var(--greek-gold)" }}>
            {result.score} / {result.maxScore}
          </span>
        </p>
        <GlassButton onClick={startGame} variant="gold">
          <RotateCcw className="w-4 h-4" /> Nouvelle partie
        </GlassButton>
      </div>
    );
  }

  const question = questions[currentIndex];

  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div className="flex items-center justify-between mb-6 text-sm text-[var(--text-muted)]">
        <span>Question {currentIndex + 1} / {questions.length}</span>
        <span className="font-bold" style={{ color: timeLeft <= 3 ? "#dc2626" : "var(--greek-blue)" }}>{timeLeft}s</span>
      </div>

      <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-8">
        {question?.prompt}
      </div>

      <input
        type="number"
        inputMode="decimal"
        autoFocus
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
        className="w-full text-center text-2xl font-bold py-3 px-4 rounded-xl border-2 mb-6 outline-none"
        style={{ borderColor: "rgba(15,30,58,0.15)", color: "var(--greek-blue)" }}
        placeholder="?"
      />

      <GlassButton onClick={handleSubmitAnswer} variant="gold" fullWidth>
        Valider
      </GlassButton>
    </div>
  );
}

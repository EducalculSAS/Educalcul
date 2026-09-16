"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Undo2, Sigma } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import AppLoader from "@/components/AppLoader";
import { useToast } from "@/components/Toast";
import MinigamesLeaderboard from "@/components/minigames/MinigamesLeaderboard";
import MinigameBackButton from "@/components/minigames/MinigameBackButton";

type Op = "+" | "-" | "x" | "/";
const OPS: { op: Op; label: string; points: number }[] = [
  { op: "+", label: "+", points: 1 },
  { op: "-", label: "−", points: 2 },
  { op: "x", label: "×", points: 1 },
  { op: "/", label: "÷", points: 3 },
];

interface Tile {
  id: number;
  value: number;
}

interface Step {
  a: number;
  b: number;
  op: Op;
  result: number;
}

function applyOp(a: number, b: number, op: Op): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b > 0 ? a - b : null;
    case "x":
      return a * b;
    case "/": {
      if (b === 0 || a % b !== 0) return null;
      const q = a / b;
      return q > 0 ? q : null;
    }
  }
}

type GameState = "loading" | "playing" | "finished" | "error";

export default function MathadorGame() {
  const { error: toastError, success: toastSuccess } = useToast();
  const [state, setState] = useState<GameState>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [target, setTarget] = useState<number>(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [nextTileId, setNextTileId] = useState(5);
  const [steps, setSteps] = useState<Step[]>([]);
  const [history, setHistory] = useState<Tile[][]>([]);
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedOp, setSelectedOp] = useState<Op | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; score: number; reason?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startedAt = useRef<number>(0);

  const startGame = async () => {
    setState("loading");
    setResult(null);
    setSteps([]);
    setHistory([]);
    setSelectedA(null);
    setSelectedOp(null);
    try {
      const res = await fetch("/api/child/minigames/mathador/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Impossible de démarrer la partie.");
        setState("error");
        return;
      }
      setSessionId(data.sessionId);
      setTarget(data.target);
      setTiles((data.numbers as number[]).map((value: number, i: number) => ({ id: i, value })));
      setNextTileId(data.numbers.length);
      startedAt.current = Date.now();
      setState("playing");
    } catch {
      setErrorMsg("Erreur réseau.");
      setState("error");
    }
  };

  // Garde anti double-appel StrictMode (dev) — startGame() decompte une
  // partie sur le quota quotidien a chaque appel, voir DailyMinigameGame.tsx.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTileClick = (tile: Tile) => {
    if (selectedA === null) {
      setSelectedA(tile.id);
      return;
    }
    if (selectedA === tile.id) {
      setSelectedA(null);
      setSelectedOp(null);
      return;
    }
    if (!selectedOp) return; // il faut choisir une opération avant le 2e nombre

    const aTile = tiles.find((t) => t.id === selectedA)!;
    const bTile = tile;
    const result = applyOp(aTile.value, bTile.value, selectedOp);
    if (result === null) {
      toastError("Ce calcul n'est pas possible (résultat négatif, nul, ou division non entière).");
      return;
    }

    setHistory((prev) => [...prev, tiles]);
    setSteps((prev) => [...prev, { a: aTile.value, b: bTile.value, op: selectedOp, result }]);
    setTiles((prev) => [
      ...prev.filter((t) => t.id !== aTile.id && t.id !== bTile.id),
      { id: nextTileId, value: result },
    ]);
    setNextTileId((n) => n + 1);
    setSelectedA(null);
    setSelectedOp(null);
  };

  const undoLastStep = () => {
    if (history.length === 0) return;
    const previousTiles = history[history.length - 1];
    setTiles(previousTiles);
    setHistory((prev) => prev.slice(0, -1));
    setSteps((prev) => prev.slice(0, -1));
    setSelectedA(null);
    setSelectedOp(null);
  };

  const submit = async (abandon = false) => {
    if (!sessionId) return;
    setSubmitting(true);
    const durationSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    try {
      const res = await fetch(`/api/child/minigames/mathador/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: abandon ? [] : steps, durationSeconds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || "Impossible d'enregistrer la partie.");
        return;
      }
      setResult(data);
      setState("finished");
      if (data.valid && data.score > 0) {
        toastSuccess(`Bravo ! ${data.score} point${data.score > 1 ? "s" : ""} marqué${data.score > 1 ? "s" : ""}.`);
        // Vérifie si ce score débloque un nouveau contour d'avatar — même
        // patron que le reste de l'app (voir BadgesSettings.tsx).
        supabaseCheckBadges();
      }
    } catch {
      toastError("Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  };

  const supabaseCheckBadges = async () => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch("/api/child/check-badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authId: session.user.id }),
      });
    } catch {
      // Best-effort — un badge manqué ici sera rattrapé à la prochaine visite de /child/badges.
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
    const alreadyPlayedToday = errorMsg?.includes("déjà fait Mathador aujourd'hui");
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
              <MinigamesLeaderboard gameType="mathador" />
            </div>
          )}
        </div>
      </>
    );
  }

  if (state === "finished" && result) {
    return (
      <>
        <MinigameBackButton sessionId={sessionId} />
        <div className="max-w-md mx-auto text-center py-16 px-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-indigo-100 text-indigo-600">
            <Sigma className="w-7 h-7" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-3">
            {result.valid ? "Partie terminée !" : "Partie non validée"}
          </h1>
          {result.valid ? (
            <p className="text-lg mb-6">
              Score : <span className="font-bold" style={{ color: "var(--greek-gold)" }}>{result.score} point{result.score > 1 ? "s" : ""}</span>
              {result.score >= 13 && <span className="block text-sm text-[var(--text-muted)] mt-1">Coup mathador : les 4 opérations utilisées !</span>}
            </p>
          ) : (
            <p className="text-[var(--text-muted)] mb-6">{result.reason || "La cible n'a pas été atteinte."}</p>
          )}
          <GlassButton onClick={startGame} variant="gold">
            <RotateCcw className="w-4 h-4" /> Nouvelle partie
          </GlassButton>
          <div className="mt-8 text-left">
            <MinigamesLeaderboard gameType="mathador" />
          </div>
        </div>
      </>
    );
  }

  const singleTileLeft = tiles.length === 1;

  return (
    <>
      <MinigameBackButton sessionId={sessionId} />
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-indigo-100 text-indigo-600">
          <Sigma className="w-6 h-6" />
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] text-center mb-2">
          Mathador
        </h1>
        <p className="text-center text-sm text-[var(--text-muted)] mb-8">
          Combine les nombres pour atteindre la cible. Choisis un nombre, une opération, puis un second nombre.
        </p>

        <div className="text-center mb-8">
          <span className="text-sm uppercase tracking-widest text-[var(--text-muted)]">Cible</span>
          <div className="font-[family-name:var(--font-display)] text-5xl font-black text-[var(--greek-blue)]">{target}</div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              onClick={() => handleTileClick(tile)}
              className="w-16 h-16 rounded-2xl font-bold text-xl flex items-center justify-center transition-all"
              style={{
                background: selectedA === tile.id ? "var(--greek-gold)" : "rgba(15,30,58,0.06)",
                color: selectedA === tile.id ? "var(--greek-blue)" : "var(--greek-blue)",
                border: "2px solid",
                borderColor: selectedA === tile.id ? "var(--greek-gold)" : "rgba(15,30,58,0.12)",
                transform: selectedA === tile.id ? "scale(1.08)" : "scale(1)",
              }}
            >
              {tile.value}
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {OPS.map(({ op, label, points }) => (
            <button
              key={op}
              disabled={selectedA === null}
              onClick={() => setSelectedOp(op)}
              className="w-14 h-14 rounded-xl font-bold text-lg flex flex-col items-center justify-center disabled:opacity-30 transition-all"
              style={{
                background: selectedOp === op ? "var(--greek-blue)" : "rgba(15,30,58,0.06)",
                color: selectedOp === op ? "#fff" : "var(--greek-blue)",
              }}
            >
              <span>{label}</span>
              <span className="text-[9px] font-normal opacity-70">{points}pt</span>
            </button>
          ))}
        </div>

        {steps.length > 0 && (
          <div className="mb-6 text-center text-sm text-[var(--text-muted)] space-y-1">
            {steps.map((s, i) => (
              <div key={i}>
                {s.a} {OPS.find((o) => o.op === s.op)?.label} {s.b} = <strong>{s.result}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <GlassButton onClick={undoLastStep} variant="ghost" size="sm" disabled={steps.length === 0}>
            <Undo2 className="w-4 h-4" /> Annuler
          </GlassButton>
          <GlassButton onClick={() => submit(false)} variant="gold" disabled={submitting || (steps.length === 0 && !singleTileLeft)}>
            <Send className="w-4 h-4" /> Valider
          </GlassButton>
          <GlassButton onClick={() => submit(true)} variant="danger" size="sm" disabled={submitting}>
            Abandonner
          </GlassButton>
        </div>
      </div>
    </>
  );
}

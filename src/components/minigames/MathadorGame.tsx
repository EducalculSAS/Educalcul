"use client";

import { useState } from "react";
import { Flag, Send, Undo2 } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { useToast } from "@/components/Toast";
import { GAME_BY_KEY, scoreLabel, shareText } from "@/lib/minigames/catalog";
import { GAME_CARD, GameFrame, GameIntro, GameResult, TimerPill, useElapsed } from "@/components/minigames/GameShell";

type Op = "+" | "-" | "x" | "/";
const OPS: { op: Op; label: string; name: string; points: number }[] = [
  { op: "+", label: "+", name: "Addition", points: 1 },
  { op: "-", label: "−", name: "Soustraction", points: 2 },
  { op: "x", label: "×", name: "Multiplication", points: 1 },
  { op: "/", label: "÷", name: "Division", points: 3 },
];
const opLabel = (op: string) => OPS.find((o) => o.op === op)?.label ?? op;

interface Tile { id: number; value: number }
interface Step { a: number; b: number; op: Op | string; result: number }

export interface MathadorOutcome {
  valid: boolean;
  score: number;
  maxScore: number | null;
  durationSeconds: number | null;
  reason?: string;
  target: number;
  steps: Step[];
}

function applyOp(a: number, b: number, op: Op): number | null {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b > 0 ? a - b : null;
    case "x": return a * b;
    case "/": {
      if (b === 0 || a % b !== 0) return null;
      const q = a / b;
      return q > 0 ? q : null;
    }
  }
}

const game = GAME_BY_KEY.mathador;

/** Mathador : la partie ne démarre qu'au clic sur « Commencer » ; si celle du jour est faite, la page s'ouvre sur le résultat. */
export default function MathadorGame({ day, initialStreak, initialResult }: { day: string; initialStreak: number; initialResult: MathadorOutcome | null }) {
  const { error: toastError } = useToast();
  const [phase, setPhase] = useState<"intro" | "playing" | "finished">(initialResult ? "finished" : "intro");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [target, setTarget] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [nextTileId, setNextTileId] = useState(5);
  const [steps, setSteps] = useState<Step[]>([]);
  const [history, setHistory] = useState<Tile[][]>([]);
  const [selectedA, setSelectedA] = useState<number | null>(null);
  const [selectedOp, setSelectedOp] = useState<Op | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MathadorOutcome | null>(initialResult);
  const [streak, setStreak] = useState(initialStreak);
  const [startedAt, setStartedAt] = useState(0);
  const elapsed = useElapsed(startedAt, phase === "playing");

  const startGame = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/child/minigames/mathador/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setStartError(data.error || "Impossible de démarrer la partie."); return; }
      setSessionId(data.sessionId);
      setTarget(data.target);
      setTiles((data.numbers as number[]).map((value, i) => ({ id: i, value })));
      setNextTileId(data.numbers.length);
      setSteps([]); setHistory([]); setSelectedA(null); setSelectedOp(null); setHint(null);
      setStartedAt(Date.now());
      setPhase("playing");
    } catch {
      setStartError("Connexion interrompue. Vérifie ta connexion puis réessaie.");
    } finally {
      setStarting(false);
    }
  };

  const handleTileClick = (tile: Tile) => {
    setHint(null);
    if (selectedA === null) { setSelectedA(tile.id); return; }
    if (selectedA === tile.id) { setSelectedA(null); setSelectedOp(null); return; }
    if (!selectedOp) { setSelectedA(tile.id); return; } // pas encore d'opération : on change simplement de premier nombre

    const aTile = tiles.find((t) => t.id === selectedA)!;
    const value = applyOp(aTile.value, tile.value, selectedOp);
    if (value === null) {
      setHint(selectedOp === "/" ? "Cette division ne tombe pas juste." : "Le résultat doit rester positif.");
      return;
    }
    setHistory((prev) => [...prev, tiles]);
    setSteps((prev) => [...prev, { a: aTile.value, b: tile.value, op: selectedOp, result: value }]);
    setTiles((prev) => [...prev.filter((t) => t.id !== aTile.id && t.id !== tile.id), { id: nextTileId, value }]);
    setNextTileId((n) => n + 1);
    setSelectedA(null);
    setSelectedOp(null);
  };

  const undoLastStep = () => {
    if (history.length === 0) return;
    setTiles(history[history.length - 1]);
    setHistory((prev) => prev.slice(0, -1));
    setSteps((prev) => prev.slice(0, -1));
    setSelectedA(null); setSelectedOp(null); setHint(null);
  };

  const checkBadges = async () => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch("/api/child/check-badges", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ authId: session.user.id }),
      });
    } catch { /* un badge manqué ici est rattrapé à la prochaine visite de « Mes trophées » */ }
  };

  // Abandonner supprime la partie en cours : elle ne compte ni dans la limite du jour ni au classement.
  const abandon = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    try { await fetch(`/api/child/minigames/session/${sessionId}/abandon`, { method: "POST" }); } catch { /* sans gravité */ }
    setSessionId(null);
    setSubmitting(false);
    setPhase("intro");
  };

  const submit = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/child/minigames/mathador/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps, durationSeconds: Math.round((Date.now() - startedAt) / 1000) }),
      });
      const data = await res.json();
      if (!res.ok) { toastError(data.error || "Impossible d'enregistrer la partie."); return; }
      setSessionId(null);
      setResult({ valid: data.valid, score: data.score, maxScore: data.maxScore ?? null, durationSeconds: data.durationSeconds ?? null, reason: data.reason, target, steps });
      setStreak((s) => s + 1);
      setPhase("finished");
      if (data.valid && data.score > 0) checkBadges();
    } catch {
      toastError("Connexion interrompue : ta partie n'est pas enregistrée. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "finished" && result) {
    const coup = result.valid && result.score >= 13;
    return (
      <GameFrame game={game} sessionId={null}>
        <GameResult
          game={game}
          tone={result.valid ? "win" : "neutral"}
          title={coup ? "Coup Mathador !" : result.valid ? "Cible atteinte" : "Cible manquée"}
          subtitle={coup ? "Les quatre opérations dans la même solution." : result.valid ? "Bien joué. Une solution avec plus d'opérations différentes rapporte davantage." : result.reason || "La cible n'a pas été atteinte."}
          score={scoreLabel(game, result.score)}
          durationSeconds={result.durationSeconds}
          streak={streak}
          share={shareText(game, { date: day, score: result.score, durationSeconds: result.durationSeconds, streak })}
        >
          <div className={GAME_CARD}>
            <h3 className="text-sm font-bold text-[var(--greek-blue)] mb-3">Ta solution pour {result.target}</h3>
            {result.steps.length === 0 ? (
              <p className="text-sm text-gray-600">Aucun calcul enregistré.</p>
            ) : (
              <ol className="space-y-2">
                {result.steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 px-4 py-2 text-[var(--greek-blue)] font-bold tabular-nums">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--greek-blue)] text-white text-xs flex items-center justify-center">{i + 1}</span>
                    {s.a} {opLabel(s.op)} {s.b} = {s.result}
                  </li>
                ))}
              </ol>
            )}
            {result.maxScore !== null && result.maxScore > 0 && (
              <p className="mt-3 text-sm text-gray-600">Meilleur score possible sur ce tirage : <strong className="text-[var(--greek-blue)]">{result.maxScore} point{result.maxScore > 1 ? "s" : ""}</strong>.</p>
            )}
          </div>
        </GameResult>
      </GameFrame>
    );
  }

  if (phase === "intro") {
    return (
      <GameFrame game={game} sessionId={null}>
        <GameIntro game={game} streak={streak} facts={["Une partie par jour", "5 nombres, 1 cible", "Jusqu'à 13 points"]} onStart={startGame} starting={starting} error={startError} />
      </GameFrame>
    );
  }

  const onTarget = tiles.some((t) => t.value === target);
  // On ne valide que lorsque le dernier calcul tombe sur la cible : valider trop tôt ferait perdre la partie du jour.
  const reached = steps.length > 0 && steps[steps.length - 1].result === target;
  const livePoints = new Set(steps.map((s) => s.op)).size === 4 ? 13 : steps.reduce((sum, s) => sum + (OPS.find((o) => o.op === s.op)?.points ?? 0), 0);
  const prompt = hint
    ?? (reached ? "Cible atteinte : valide ta solution." : selectedA === null ? "Choisis un premier nombre." : !selectedOp ? "Choisis une opération." : "Choisis le second nombre.");

  return (
    <GameFrame game={game} sessionId={sessionId} right={<TimerPill seconds={elapsed} />}>
      <div className={GAME_CARD}>
        {/* Cible */}
        <div className="text-center mb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Cible</span>
          <div className={`mx-auto mt-1 w-32 rounded-[20px] py-3 font-[family-name:var(--font-display)] text-5xl font-black tabular-nums transition-colors ${onTarget ? "bg-green-600 text-white" : "bg-[var(--greek-blue)] text-[var(--greek-gold)]"}`}
            style={{ boxShadow: onTarget ? "0 6px 0 #166534" : "0 6px 0 #060d1c" }}>
            {target}
          </div>
        </div>

        {/* Nombres : des touches en relief */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-5" role="group" aria-label="Nombres disponibles">
          {tiles.map((tile) => {
            const on = selectedA === tile.id;
            const hit = tile.value === target;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => handleTileClick(tile)}
                aria-pressed={on}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl font-bold text-xl sm:text-2xl tabular-nums flex items-center justify-center transition-transform active:translate-y-1 ${on ? "-translate-y-1" : ""}`}
                style={{
                  background: hit ? "#dcfce7" : on ? "linear-gradient(180deg,#f8e3a0,#dcb650)" : "linear-gradient(180deg,#ffffff,#f1e6cc)",
                  color: "var(--greek-blue)",
                  border: `2px solid ${hit ? "#16a34a" : on ? "#a8842c" : "rgba(197,161,72,0.55)"}`,
                  boxShadow: `0 5px 0 ${hit ? "#16a34a" : on ? "#a8842c" : "#c9b27c"}`,
                }}
              >
                {tile.value}
              </button>
            );
          })}
        </div>

        {/* Opérations */}
        <div className="flex justify-center gap-3 mb-4" role="group" aria-label="Opérations">
          {OPS.map(({ op, label, name, points }) => {
            const on = selectedOp === op;
            return (
              <button
                key={op}
                type="button"
                disabled={selectedA === null}
                onClick={() => { setSelectedOp(op); setHint(null); }}
                aria-pressed={on}
                aria-label={`${name}, ${points} point${points > 1 ? "s" : ""}`}
                className="w-14 h-14 rounded-full font-bold text-2xl flex flex-col items-center justify-center leading-none disabled:opacity-35 transition-transform active:translate-y-0.5"
                style={{
                  background: on ? "var(--greek-blue)" : "#fff",
                  color: on ? "var(--greek-gold)" : "var(--greek-blue)",
                  border: "2px solid var(--greek-blue)",
                  boxShadow: on ? "0 3px 0 #060d1c" : "0 3px 0 rgba(15,30,58,0.35)",
                }}
              >
                <span>{label}</span>
                <span className="text-[9px] font-semibold opacity-80 mt-0.5">{points} pt{points > 1 ? "s" : ""}</span>
              </button>
            );
          })}
        </div>

        <p className={`text-center text-sm min-h-5 mb-5 ${hint ? "text-red-600 font-semibold" : "text-gray-600"}`} role="status">{prompt}</p>

        {/* Calculs déjà faits */}
        {steps.length > 0 && (
          <ol className="flex flex-wrap justify-center gap-2 mb-5">
            {steps.map((s, i) => (
              <li key={i} className="rounded-full bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.3)] px-3 py-1 text-sm font-bold tabular-nums text-[var(--greek-blue)]">
                {s.a} {opLabel(s.op)} {s.b} = {s.result}
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[rgba(197,161,72,0.2)]">
          <GlassButton onClick={undoLastStep} variant="ghost" size="sm" disabled={steps.length === 0 || submitting}>
            <Undo2 className="w-4 h-4" /> Annuler
          </GlassButton>
          <span className="text-sm font-semibold text-gray-600 tabular-nums">{livePoints} point{livePoints > 1 ? "s" : ""} en jeu</span>
          <GlassButton onClick={submit} variant="navy" disabled={submitting || !reached}>
            <Send className="w-4 h-4" /> {submitting ? "Vérification…" : "Valider"}
          </GlassButton>
        </div>
      </div>

      <div className="mt-4 text-center">
        <GlassButton onClick={abandon} variant="ghost" size="sm" disabled={submitting}>
          <Flag className="w-4 h-4" /> Abandonner cette partie
        </GlassButton>
      </div>
    </GameFrame>
  );
}

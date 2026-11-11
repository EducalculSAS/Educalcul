"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock, Play, Share2, X } from "lucide-react";
import Link from "@/components/AppLink";
import Emblem3D from "@/components/Emblem3D";
import StreakFlame from "@/components/StreakFlame";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { useToast } from "@/components/Toast";
import { renderLatexInHTML } from "@/lib/katexLoader";
import MinigamesLeaderboard from "@/components/minigames/MinigamesLeaderboard";
import { GAMES, formatClock, formatCountdown, formatDuration, secondsToNextSheet, type GameInfo } from "@/lib/minigames/catalog";
import type { CorrectionLine } from "@/lib/minigames/correction";

export const GAME_CARD = "bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]";

/** Secondes écoulées depuis `startedAt` (ms), rafraîchies chaque seconde tant que `running`. */
export function useElapsed(startedAt: number, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return running && startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
}

/**
 * Cadre commun à tous les mini-jeux : retour au catalogue (la partie en cours est annulée pour ne pas compter dans la
 * limite du jour), emblème et nom du jeu, et à droite ce que le jeu veut montrer (chrono, progression).
 */
export function GameFrame({ game, sessionId, right, children }: { game: GameInfo; sessionId: string | null; right?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const back = async () => {
    if (sessionId) {
      try { await fetch(`/api/child/minigames/session/${sessionId}/abandon`, { method: "POST" }); } catch { /* un abandon manqué n'empêche pas de revenir */ }
    }
    router.push("/child/minigames");
  };
  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-16">
      <div className="flex items-center gap-3 mb-5">
        <GlassIconButton icon={ArrowLeft} onClick={back} color="navy" size="sm" aria-label="Retour aux mini-jeux" />
        <Emblem3D kind={game.emblem} size={40} float={false} />
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--greek-blue)] flex-1 min-w-0 truncate">{game.label}</h1>
        {right}
      </div>
      {children}
    </div>
  );
}

export function TimerPill({ seconds }: { seconds: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(197,161,72,0.35)] bg-white px-3 py-1 text-sm font-bold tabular-nums text-[var(--greek-blue)]" aria-label={`Temps écoulé : ${formatClock(seconds)}`}>
      <Clock className="w-4 h-4 text-[var(--greek-gold)]" aria-hidden="true" /> {formatClock(seconds)}
    </span>
  );
}

/** Écran d'avant-partie : la partie ne démarre (et ne compte) qu'au clic sur « Commencer ». */
export function GameIntro({ game, streak, facts, onStart, starting, error }: {
  game: GameInfo; streak: number; facts: string[]; onStart: () => void; starting: boolean; error?: string | null;
}) {
  return (
    <div className={`${GAME_CARD} text-center`}>
      <div className="mb-2"><Emblem3D kind={game.emblem} size={112} /></div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-1">{game.label}</h2>
      <p className="text-gray-600 mb-5">{game.pitch}</p>

      <ul className="flex flex-wrap justify-center gap-2 mb-6">
        {facts.map((f) => (
          <li key={f} className="rounded-full bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.3)] px-3 py-1 text-xs font-semibold text-[var(--greek-blue)]">{f}</li>
        ))}
        {streak > 0 && (
          <li className="rounded-full bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.3)] pl-1.5 pr-3 py-0.5 text-xs font-semibold text-[var(--greek-blue)] inline-flex items-center gap-1">
            <StreakFlame size={22} animate={false} /> Série de {streak} jour{streak > 1 ? "s" : ""}
          </li>
        )}
      </ul>

      <div className="text-left rounded-2xl bg-[var(--greek-cream)]/50 border border-[rgba(197,161,72,0.25)] p-4 mb-6">
        <h3 className="text-sm font-bold text-[var(--greek-blue)] mb-2">Comment jouer</h3>
        <ol className="space-y-2">
          {game.rules.map((r, i) => (
            <li key={r} className="flex gap-3 text-sm text-gray-700">
              <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--greek-blue)] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </div>

      {error && <p className="mb-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <GlassButton onClick={onStart} variant="navy" disabled={starting}>
        <Play className="w-4 h-4 fill-current" /> {starting ? "Préparation…" : "Commencer"}
      </GlassButton>
    </div>
  );
}

/** « Nouvelle fiche dans 5 h 12 min », tenu à jour. */
export function NextSheetCountdown({ className = "" }: { className?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(secondsToNextSheet());
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Clock className="w-4 h-4 text-[var(--greek-gold)] shrink-0" aria-hidden="true" />
      {left === null ? "Nouvelle fiche chaque jour" : `Nouvelle fiche dans ${formatCountdown(left)}`}
    </span>
  );
}

export function ShareButton({ text }: { text: string }) {
  const { success, error } = useToast();
  const share = async () => {
    try {
      if (typeof navigator.share === "function") { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      success("Résultat copié : colle-le où tu veux.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") error("Impossible de partager le résultat.");
    }
  };
  return (
    <GlassButton onClick={share} variant="outline" size="sm"><Share2 className="w-4 h-4" /> Partager mon résultat</GlassButton>
  );
}

function StatTile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 px-3 py-3 text-center min-w-0">
      <div className="text-xl font-bold text-[var(--greek-blue)] tabular-nums flex items-center justify-center gap-1">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

/** Écran de fin : score, temps, série, partage, prochaine fiche, puis ce que le jeu ajoute (correction) et le classement. */
export function GameResult({ game, title, subtitle, score, durationSeconds, streak, share, tone = "win", children }: {
  game: GameInfo; title: string; subtitle?: string; score: string; durationSeconds: number | null; streak: number; share: string;
  tone?: "win" | "neutral"; children?: ReactNode;
}) {
  const others = GAMES.filter((g) => g.gameType !== game.gameType);
  return (
    <div className="space-y-5">
      <div className={`${GAME_CARD} text-center`}>
        <div className="mb-2"><Emblem3D kind={tone === "win" ? "trophy" : game.emblem} size={96} /></div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--greek-blue)] mb-1">{title}</h2>
        {subtitle && <p className="text-sm text-gray-600 mb-1">{subtitle}</p>}
        <div className="grid grid-cols-3 gap-3 my-5">
          <StatTile value={score} label="Score" />
          <StatTile value={formatDuration(durationSeconds) ?? "–"} label="Temps" />
          <StatTile value={<><StreakFlame size={24} lit={streak > 0} animate={false} /> {streak}</>} label={streak > 1 ? "Jours de suite" : "Jour de suite"} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ShareButton text={share} />
          <NextSheetCountdown className="text-sm text-gray-600" />
        </div>
      </div>

      {children}

      <MinigamesLeaderboard gameType={game.gameType} />

      <div className={GAME_CARD}>
        <h3 className="text-sm font-bold text-[var(--greek-blue)] mb-3">Continuer à jouer</h3>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {others.map((g) => (
            <li key={g.gameType}>
              <Link href={`/child/minigames/${g.slug}`} className="flex flex-col items-center gap-1 rounded-2xl border border-[rgba(197,161,72,0.25)] px-2 py-3 text-center hover:border-[var(--greek-gold)] transition-colors">
                <Emblem3D kind={g.emblem} size={44} float={false} />
                <span className="text-xs font-bold text-[var(--greek-blue)]">{g.short}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Correction d'une fiche : question, réponse de l'élève, bonne réponse. */
export function CorrectionList({ lines }: { lines: CorrectionLine[] }) {
  if (!lines.length) return null;
  return (
    <div className={GAME_CARD}>
      <h3 className="text-sm font-bold text-[var(--greek-blue)] mb-3">Correction</h3>
      <ol className="space-y-3">
        {lines.map((l) => (
          <li key={l.index} className={`rounded-2xl border p-4 ${l.correct ? "border-green-200 bg-green-50/60" : "border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40"}`}>
            <div className="flex items-start gap-3">
              <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white ${l.correct ? "bg-green-600" : "bg-gray-400"}`} aria-label={l.correct ? "Juste" : "À revoir"}>
                {l.correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--greek-blue)] [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: renderLatexInHTML(l.prompt) }} />
                <p className="text-sm text-gray-600 mt-1">
                  {l.given === null ? "Question passée" : <>Ta réponse : <strong className={l.correct ? "text-green-700" : "text-gray-800"}>{String(l.given)}</strong></>}
                  {!l.correct && <> · Bonne réponse : <strong className="text-green-700">{String(l.expected)}</strong></>}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Points de progression : un par question, plein quand elle est passée. */
export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-label={`Question ${current + 1} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-2 rounded-full transition-all duration-300 ${i < current ? "w-6 bg-[var(--greek-gold)]" : i === current ? "w-10 bg-[var(--greek-blue)]" : "w-6 bg-[rgba(15,30,58,0.12)]"}`} />
      ))}
    </div>
  );
}

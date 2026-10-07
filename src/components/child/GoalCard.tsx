"use client";

import Link from "next/link";
import { useState } from "react";
import { Flame, Repeat, Target } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  today: number;
  dailyGoal: number;
  streak: number;
  last7: { day: string; count: number }[];
  weekTotal: number;
  weeklyTarget: number | null;
  dueReviews: number;
}

const DAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];
const GOALS = [1, 2, 3, 5];

/** Objectif du jour, série de jours et révisions à faire : de quoi revenir chaque jour. */
export default function GoalCard({ today, dailyGoal, streak, last7, weekTotal, weeklyTarget, dueReviews }: Props) {
  const [goal, setGoal] = useState(dailyGoal);
  const [saving, setSaving] = useState(false);
  const reached = today >= goal;
  const pct = Math.min(1, today / goal);
  const R = 30;
  const C = 2 * Math.PI * R;

  const changeGoal = async (next: number) => {
    setGoal(next);
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/child/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ dailyGoal: next }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)] mb-8">
      <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 items-center">
        <div className="flex items-center gap-5">
          <div className="relative w-[84px] h-[84px] shrink-0">
            <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90" aria-hidden>
              <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(197,161,72,0.2)" strokeWidth="9" />
              <circle cx="42" cy="42" r={R} fill="none" stroke={reached ? "#16a34a" : "var(--greek-gold)"} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset .6s" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-xl font-bold text-[var(--greek-blue)]">{Math.min(today, 99)}</span>
              <span className="text-[10px] text-gray-400 font-semibold">sur {goal}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Objectif du jour</p>
            <p className="font-bold text-[var(--greek-blue)] text-lg leading-tight">{reached ? "Objectif atteint, bravo !" : `Encore ${goal - today} activité${goal - today > 1 ? "s" : ""}`}</p>
            <div className="flex items-center gap-1 mt-2" role="group" aria-label="Changer l'objectif du jour">
              {GOALS.map((g) => (
                <button key={g} type="button" disabled={saving} onClick={() => changeGoal(g)} className={`w-7 h-7 rounded-full text-xs font-bold border transition-colors ${g === goal ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]" : "bg-white text-gray-500 border-gray-200 hover:border-[var(--greek-gold)]"}`}>
                  {g}
                </button>
              ))}
              <span className="text-[11px] text-gray-400 ml-1">par jour</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2">
            <Flame className={`w-7 h-7 ${streak > 0 ? "text-orange-500 fill-orange-400" : "text-gray-300"}`} />
            <span className="text-2xl font-bold text-[var(--greek-blue)]">{streak}</span>
            <span className="text-sm text-gray-500">jour{streak > 1 ? "s" : ""} de suite</span>
          </div>
          <div className="flex gap-1.5" aria-label="Activité des 7 derniers jours">
            {last7.map((d) => (
              <div key={d.day} className="flex flex-col items-center gap-1" title={`${d.day} : ${d.count} activité${d.count > 1 ? "s" : ""}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${d.count >= goal ? "bg-green-500 text-white" : d.count > 0 ? "bg-[var(--greek-gold)]/70 text-[var(--greek-blue)]" : "bg-gray-100 text-gray-300"}`}>
                  {d.count > 0 ? d.count : ""}
                </span>
                <span className="text-[9px] text-gray-400 font-semibold">{DAY_LETTER[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span>
              </div>
            ))}
          </div>
          {weeklyTarget ? (
            <p className="text-xs text-gray-500">Cible de la semaine fixée par tes parents : <strong className="text-[var(--greek-blue)]">{Math.min(weekTotal, weeklyTarget)}/{weeklyTarget}</strong></p>
          ) : (
            <p className="text-xs text-gray-400">{weekTotal} activité{weekTotal > 1 ? "s" : ""} cette semaine</p>
          )}
        </div>

        <Link href="/child/revisions" className={`rounded-2xl border px-5 py-4 text-center transition-all hover:shadow-md ${dueReviews > 0 ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
          <Repeat className={`w-6 h-6 mx-auto mb-1 ${dueReviews > 0 ? "text-[var(--greek-bronze)]" : "text-gray-300"}`} />
          <div className="text-2xl font-bold text-[var(--greek-blue)]">{dueReviews}</div>
          <div className="text-xs font-semibold text-gray-500">à revoir</div>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bell, Clock, Flame, Target, TrendingUp } from "lucide-react";

interface Chapter {
  label: string;
  pct: number;
  color: string;
}

interface ChildPreview {
  id: string;
  name: string;
  level: string;
  trend: string;
  chapters: Chapter[];
  today: { done: number; goal: number };
  streak: number;
  week: { done: number; target: number };
  status: { text: string; tone: "good" | "warn" };
  last: string;
  alert: string;
  alertTone: "gold" | "green" | "warn";
}

const GOLD = "var(--greek-gold)";
const BLUE = "#60a5fa";
const GREEN = "#34d399";
const ROSE = "#f0a3a3";

/** Trois élèves d'une même famille fictive : niveaux, rythmes et situations différents, chacun cohérent. */
const CHILDREN: ChildPreview[] = [
  {
    id: "emma",
    name: "Emma",
    level: "5ème",
    trend: "+12 %",
    chapters: [
      { label: "Fractions", pct: 87, color: GOLD },
      { label: "Géométrie", pct: 64, color: BLUE },
      { label: "Algèbre", pct: 41, color: GREEN },
    ],
    today: { done: 2, goal: 2 },
    streak: 7,
    week: { done: 6, target: 8 },
    status: { text: "Actif aujourd'hui", tone: "good" },
    last: "Quiz Fractions · il y a 2 h",
    alert: "7 jours de suite : bravo à elle",
    alertTone: "gold",
  },
  {
    id: "hugo",
    name: "Hugo",
    level: "3ème",
    trend: "+5 %",
    chapters: [
      { label: "Pythagore", pct: 78, color: GOLD },
      { label: "Probabilités", pct: 62, color: BLUE },
      { label: "Thalès", pct: 55, color: GREEN },
      { label: "Fonctions", pct: 33, color: ROSE },
    ],
    today: { done: 1, goal: 3 },
    streak: 3,
    week: { done: 4, target: 10 },
    status: { text: "Actif hier", tone: "good" },
    last: "Exercice Thalès · hier soir",
    alert: "Brevet dans 62 jours : parcours prêt",
    alertTone: "green",
  },
  {
    id: "ines",
    name: "Inès",
    level: "Terminale",
    trend: "−8 %",
    chapters: [
      { label: "Suites", pct: 91, color: GOLD },
      { label: "Limites", pct: 72, color: BLUE },
      { label: "Dérivation", pct: 58, color: GREEN },
    ],
    today: { done: 0, goal: 2 },
    streak: 0,
    week: { done: 1, target: 6 },
    status: { text: "Inactive depuis 4 jours", tone: "warn" },
    last: "Cours Limites · il y a 4 jours",
    alert: "Alerte envoyée : un encouragement peut aider",
    alertTone: "warn",
  },
];

const INK = "#f0ede8";
const MUTED = "rgba(240,237,232,0.45)";
const FAINT = "rgba(240,237,232,0.3)";

/** Aperçu du tableau de bord parent (section « Suivi Parents » de l'accueil) : une fiche par enfant, comme dans
 * l'espace parent. Isolé en îlot client pour l'animation des barres et le choix de l'enfant. */
export default function ParentDashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState(CHILDREN[0].id);
  const [bars, setBars] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Les barres repartent de zéro à chaque changement d'enfant puis se remplissent.
  useEffect(() => {
    if (!visible) return;
    setBars(false);
    const t = setTimeout(() => setBars(true), 60);
    return () => clearTimeout(t);
  }, [selected, visible]);

  const child = CHILDREN.find((c) => c.id === selected) ?? CHILDREN[0];
  const weekPct = Math.min(100, Math.round((child.week.done / child.week.target) * 100));
  const alertStyle =
    child.alertTone === "gold"
      ? { bg: "rgba(197,161,72,0.14)", fg: "var(--greek-gold)" }
      : child.alertTone === "green"
        ? { bg: "rgba(52,211,153,0.12)", fg: GREEN }
        : { bg: "rgba(240,163,163,0.13)", fg: ROSE };

  return (
    <div ref={ref} className="rounded-2xl p-4 sm:p-5 w-full" style={{ background: "#0d1829", border: "1px solid rgba(197,161,72,0.18)", boxShadow: "0 24px 60px -24px rgba(0,0,0,0.5)" }}>
      {/* Choix de l'enfant */}
      <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1 pb-1" role="tablist" aria-label="Enfants de la famille">
        {CHILDREN.map((c) => {
          const active = c.id === selected;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(c.id)}
              className="flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all"
              style={{
                background: active ? "rgba(197,161,72,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${active ? "rgba(197,161,72,0.55)" : "rgba(255,255,255,0.08)"}`,
                color: active ? INK : MUTED,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px]" style={{ background: active ? GOLD : "rgba(255,255,255,0.1)", color: active ? "#0d1829" : INK }}>
                {c.name[0]}
              </span>
              {c.name}
            </button>
          );
        })}
      </div>

      {/* En-tête de la fiche */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b" style={{ borderColor: "rgba(197,161,72,0.12)" }}>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: INK }}>{child.name} · {child.level}</p>
          <p className="text-xs flex items-center gap-1.5" style={{ color: child.status.tone === "warn" ? ROSE : GREEN }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: child.status.tone === "warn" ? ROSE : GREEN }} />
            {child.status.text}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0" style={{ background: child.trend.startsWith("−") ? "rgba(240,163,163,0.13)" : "rgba(197,161,72,0.12)", color: child.trend.startsWith("−") ? ROSE : GOLD }}>
          <TrendingUp className="w-3 h-3" style={{ transform: child.trend.startsWith("−") ? "scaleY(-1)" : undefined }} /> {child.trend}
        </div>
      </div>

      {/* Niveau par chapitre */}
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: FAINT }}>Niveau par chapitre</p>
      {child.chapters.map((p, i) => (
        <div key={p.label} className="mb-2.5">
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{ color: MUTED }}>{p.label}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: p.color }}>{bars ? p.pct : 0}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: bars ? `${p.pct}%` : "0%", background: p.color, opacity: 0.85, transition: bars ? "width 1100ms cubic-bezier(0.16, 1, 0.3, 1)" : "none", transitionDelay: bars ? `${i * 90}ms` : "0ms" }}
            />
          </div>
        </div>
      ))}

      {/* Aujourd'hui, série, semaine */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t" style={{ borderColor: "rgba(197,161,72,0.1)" }}>
        <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-1 min-h-[68px]" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-1 h-8">
            <Target className="w-3.5 h-3.5" style={{ color: child.today.done >= child.today.goal ? GREEN : GOLD }} />
            <span className="font-[family-name:var(--font-display)] font-bold text-base leading-none" style={{ color: child.today.done >= child.today.goal ? GREEN : GOLD }}>{child.today.done}/{child.today.goal}</span>
          </div>
          <span className="text-[10px] leading-none" style={{ color: FAINT }}>Aujourd&apos;hui</span>
        </div>

        <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-1 min-h-[68px]" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="h-8 flex items-end justify-center">
            {child.streak > 0 ? (
              <div className="relative w-10 h-10" style={{ marginBottom: -4 }}>
                <Image src="/Streaks.gif" alt="" fill className="object-contain" unoptimized />
                <span className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-display)] font-bold z-10" style={{ color: "#fff", fontSize: 11, textShadow: "0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8)", paddingTop: 10 }}>
                  {child.streak}
                </span>
              </div>
            ) : (
              <span className="flex items-center gap-1 pb-1">
                <Flame className="w-4 h-4" style={{ color: "rgba(240,237,232,0.25)" }} />
                <span className="font-[family-name:var(--font-display)] font-bold text-base leading-none" style={{ color: "rgba(240,237,232,0.35)" }}>0</span>
              </span>
            )}
          </div>
          <span className="text-[10px] leading-none" style={{ color: FAINT }}>Série</span>
        </div>

        <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-2 min-h-[68px]" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="h-8 w-full flex flex-col items-center justify-center gap-1.5">
            <span className="font-[family-name:var(--font-display)] font-bold text-base leading-none" style={{ color: GOLD }}>{child.week.done}/{child.week.target}</span>
            <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: bars ? `${weekPct}%` : "0%", background: GOLD, transition: bars ? "width 1100ms cubic-bezier(0.16, 1, 0.3, 1)" : "none" }} />
            </div>
          </div>
          <span className="text-[10px] leading-none" style={{ color: FAINT }}>Semaine</span>
        </div>
      </div>

      {/* Dernière activité et alerte */}
      <div className="mt-3 space-y-2">
        <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: FAINT }} /> {child.last}
        </p>
        <p className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: alertStyle.bg, color: alertStyle.fg }}>
          <Bell className="w-3.5 h-3.5 shrink-0" /> {child.alert}
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import FamilyCardShell, { type FamilyCardData } from "@/components/parent/FamilyCardShell";
import GlassButton from "@/components/ui/GlassButton";
import { FileText } from "lucide-react";

type Tone = "gold" | "green" | "warn";

interface ChildPreview {
  id: string;
  name: string;
  level: string;
  color: string;
  chapters: { label: string; pct: number; color: string }[];
  today: number;
  dailyGoal: number;
  streak: number;
  week: number[]; // 7 derniers jours, du plus ancien à aujourd'hui
  weeklyTarget: number;
  exerciseCount: number;
  successRate: number;
  status: { text: string; dot: string };
  last: { type: string; title: string; relativeTime: string };
  alert: { text: string; tone: Tone };
}

const GOLD = "#c5a148";
const BLUE = "#3b82f6";
const GREEN = "#16a34a";
const ROSE = "#e11d48";

/** Quatre élèves d'une même famille fictive : niveaux, rythmes et situations différents, chacun cohérent. */
const CHILDREN: ChildPreview[] = [
  {
    id: "emma", name: "Emma", level: "5ème", color: "#e8b4b8",
    chapters: [{ label: "Fractions", pct: 87, color: GOLD }, { label: "Géométrie", pct: 64, color: BLUE }, { label: "Algèbre", pct: 41, color: GREEN }],
    today: 2, dailyGoal: 2, streak: 7, week: [1, 2, 2, 3, 2, 2, 2], weeklyTarget: 16, exerciseCount: 64, successRate: 82,
    status: { text: "Active aujourd'hui", dot: "#4ade80" },
    last: { type: "Quiz", title: "Quiz Fractions", relativeTime: "il y a 2 h" },
    alert: { text: "7 jours de suite : bravo à elle", tone: "gold" },
  },
  {
    id: "hugo", name: "Hugo", level: "3ème", color: "#9ec5fe",
    chapters: [{ label: "Pythagore", pct: 78, color: GOLD }, { label: "Probabilités", pct: 62, color: BLUE }, { label: "Fonctions", pct: 33, color: ROSE }],
    today: 1, dailyGoal: 3, streak: 3, week: [0, 2, 3, 0, 3, 3, 1], weeklyTarget: 14, exerciseCount: 118, successRate: 71,
    status: { text: "Actif aujourd'hui", dot: "#4ade80" },
    last: { type: "Exercice", title: "Exercice Thalès", relativeTime: "il y a 1 h" },
    alert: { text: "Brevet dans 62 jours : parcours prêt", tone: "green" },
  },
  {
    id: "ines", name: "Inès", level: "Terminale", color: "#c4b5fd",
    chapters: [{ label: "Suites", pct: 91, color: GOLD }, { label: "Limites", pct: 72, color: BLUE }, { label: "Dérivation", pct: 58, color: GREEN }],
    today: 0, dailyGoal: 2, streak: 0, week: [2, 3, 1, 0, 0, 0, 0], weeklyTarget: 10, exerciseCount: 203, successRate: 88,
    status: { text: "Inactive depuis 4 jours", dot: "#f0a3a3" },
    last: { type: "Cours", title: "Cours Limites", relativeTime: "il y a 4 jours" },
    alert: { text: "Alerte envoyée : un encouragement peut aider", tone: "warn" },
  },
  {
    id: "lucas", name: "Lucas", level: "CM2", color: "#fcd34d",
    chapters: [{ label: "Multiplication", pct: 94, color: GOLD }, { label: "Fractions", pct: 52, color: BLUE }, { label: "Mesures", pct: 38, color: GREEN }],
    today: 3, dailyGoal: 3, streak: 12, week: [3, 3, 2, 3, 3, 3, 3], weeklyTarget: 24, exerciseCount: 142, successRate: 91,
    status: { text: "Actif aujourd'hui", dot: "#4ade80" },
    last: { type: "Quiz", title: "Quiz Mesures", relativeTime: "il y a 30 min" },
    alert: { text: "Objectif atteint 12 jours de suite", tone: "green" },
  },
];

/** Les 7 derniers jours se terminent aujourd'hui : on construit les dates à l'affichage, côté client. */
function lastSevenDays(counts: number[]) {
  const now = new Date();
  return counts.map((count, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (counts.length - 1 - i), 12);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { day, count };
  });
}

/** Aperçu du tableau de bord parent (section « Suivi Parents » de l'accueil) : EXACTEMENT la fiche de l'espace parent
 * (FamilyCardShell), avec quatre enfants fictifs. Îlot client pour le choix de l'enfant et le remplissage des barres. */
export default function ParentDashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState(CHILDREN[0].id);
  const [ready, setReady] = useState(false);
  const [week, setWeek] = useState<{ day: string; count: number }[] | null>(null);

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
      { threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const child = CHILDREN.find((c) => c.id === selected) ?? CHILDREN[0];

  // Les barres repartent de zéro à chaque changement d'enfant puis se remplissent.
  useEffect(() => {
    if (!visible) return;
    setWeek(lastSevenDays(child.week));
    setReady(false);
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, [selected, visible, child]);

  const data: FamilyCardData = {
    avatar: (
      <span className="shrink-0 w-12 h-12 rounded-[30%] flex items-center justify-center font-[family-name:var(--font-display)] font-bold text-xl text-[#0f1e3a] bg-white/95 p-0.5 shadow-lg">
        <span className="w-full h-full rounded-[28%] flex items-center justify-center" style={{ background: child.color }}>{child.name[0]}</span>
      </span>
    ),
    name: child.name,
    level: child.level,
    status: child.status,
    today: ready ? child.today : 0,
    dailyGoal: child.dailyGoal,
    streak: child.streak,
    exerciseCount: child.exerciseCount,
    successRate: child.successRate,
    last7: week ?? lastSevenDays(child.week.map(() => 0)),
    weekTotal: child.week.reduce((a, b) => a + b, 0),
    weeklyTarget: child.weeklyTarget,
    chapters: child.chapters,
    chaptersReady: ready,
    lastActivity: child.last,
    alert: child.alert,
    footer: (
      <div className="flex items-center gap-2">
        <p className="flex-1 min-w-0 text-xs text-gray-500">Exemple fictif : le vôtre se met à jour en direct.</p>
        <GlassButton variant="outline" size="sm" rounded="xl" disabled>
          <FileText className="w-4 h-4" /> Bulletin
        </GlassButton>
      </div>
    ),
  };

  return (
    <div ref={ref} className="w-full">
      <div className="flex gap-2 mb-3 overflow-x-auto -mx-1 px-1 pb-1" role="tablist" aria-label="Enfants de la famille">
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
                background: active ? "rgba(197,161,72,0.22)" : "rgba(255,255,255,0.6)",
                border: `1px solid ${active ? "rgba(197,161,72,0.7)" : "rgba(15,30,58,0.1)"}`,
                color: "#0f1e3a",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                boxShadow: active ? "0 6px 16px rgba(197,161,72,0.25)" : "none",
              }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px]" style={{ background: c.color, color: "#0f1e3a" }}>{c.name[0]}</span>
              {c.name}
            </button>
          );
        })}
      </div>
      <FamilyCardShell d={data} />
    </div>
  );
}

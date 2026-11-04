"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import type { CourseViewerProps } from "@/components/viewers/CourseViewer";
import type { ExerciseViewerProps } from "@/components/viewers/ExerciseViewer";
import type { QuizViewerProps } from "@/components/viewers/QuizViewer";

// Les lecteurs ne sont chargés qu'à l'ouverture de l'onglet : la page Offres reste légère.
const CourseViewer = dynamic(() => import("@/components/viewers/CourseViewer"), { ssr: false });
const ExerciseViewer = dynamic(() => import("@/components/viewers/ExerciseViewer"), { ssr: false });
const QuizViewer = dynamic(() => import("@/components/viewers/QuizViewer"), { ssr: false });

type Tab = "cours" | "exercice" | "quiz";

/**
 * Démonstration jouable de la page Offres : les VRAIS lecteurs de cours, d'exercices et de quiz de l'espace élève, avec
 * un contenu d'exemple (fractions en 6e, Pythagore en 4e). Correction réelle côté serveur, rien n'est enregistré, aucun compte requis.
 */
export default function OffresDemo({ courses, exercise, quiz }: {
  /** Cours proposés (niveaux différents) : un sélecteur permet de passer de l'un à l'autre. */
  courses: { label: string; course: CourseViewerProps["course"] }[];
  exercise: ExerciseViewerProps["exercise"];
  quiz: QuizViewerProps["quiz"];
}) {
  const [tab, setTab] = useState<Tab>("exercice");
  const [run, setRun] = useState(0);
  const [courseIdx, setCourseIdx] = useState(0);
  return (
    <div>
      <div className="flex justify-center mb-6">
        <GlassSegmentedControl
          value={tab}
          onChange={(v) => { setTab(v as Tab); setRun((r) => r + 1); }}
          options={[{ id: "cours", label: "Un cours" }, { id: "exercice", label: "Un exercice" }, { id: "quiz", label: "Un quiz" }]}
        />
      </div>
      {tab === "cours" && courses.length > 1 && (
        <div className="flex justify-center mb-4">
          <GlassSegmentedControl
            size="sm"
            value={String(courseIdx)}
            onChange={(v) => { setCourseIdx(Number(v)); setRun((r) => r + 1); }}
            options={courses.map((c, i) => ({ id: String(i), label: c.label }))}
          />
        </div>
      )}
      {/* Le liseré doré est dessiné PAR-DESSUS le lecteur : il suit l'arrondi sans être rogné par le contenu. */}
      <div className="relative h-[640px] max-h-[80vh] rounded-[20px] shadow-xl">
        <div className="absolute inset-0 rounded-[20px] overflow-hidden bg-white [transform:translateZ(0)]">
          {tab === "cours" && <CourseViewer key={`c${run}-${courseIdx}`} course={courses[courseIdx].course} />}
          {tab === "exercice" && <ExerciseViewer key={`e${run}`} exercise={exercise} onRestart={() => setRun((r) => r + 1)} />}
          {tab === "quiz" && <QuizViewer key={`q${run}`} quiz={quiz} />}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 rounded-[20px] border-2 border-[rgba(197,161,72,0.55)]" />
      </div>
    </div>
  );
}

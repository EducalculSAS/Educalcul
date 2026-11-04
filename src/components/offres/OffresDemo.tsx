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
 * un contenu d'exemple (fractions, 6e). Correction réelle côté serveur, rien n'est enregistré, aucun compte requis.
 */
export default function OffresDemo({ course, exercise, quiz }: {
  course: CourseViewerProps["course"];
  exercise: ExerciseViewerProps["exercise"];
  quiz: QuizViewerProps["quiz"];
}) {
  const [tab, setTab] = useState<Tab>("exercice");
  const [run, setRun] = useState(0);
  return (
    <div>
      <div className="flex justify-center mb-6">
        <GlassSegmentedControl
          value={tab}
          onChange={(v) => { setTab(v as Tab); setRun((r) => r + 1); }}
          options={[{ id: "cours", label: "Un cours" }, { id: "exercice", label: "Un exercice" }, { id: "quiz", label: "Un quiz" }]}
        />
      </div>
      <div className="h-[640px] max-h-[80vh] rounded-[20px] overflow-hidden shadow-xl border border-[rgba(197,161,72,0.35)] bg-white">
        {tab === "cours" && <CourseViewer key={`c${run}`} course={course} />}
        {tab === "exercice" && <ExerciseViewer key={`e${run}`} exercise={exercise} onRestart={() => setRun((r) => r + 1)} />}
        {tab === "quiz" && <QuizViewer key={`q${run}`} quiz={quiz} />}
      </div>
    </div>
  );
}

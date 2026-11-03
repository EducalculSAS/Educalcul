"use client";

import GlassIconButton from "@/components/ui/GlassIconButton";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import QuizViewer, { type QuizViewerProps } from "@/components/viewers/QuizViewer";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

export default function QuizReviewClient({ quiz, progress }: { quiz: QuizViewerProps["quiz"]; progress: QuizViewerProps["initialProgress"] }) {
  const router = useRouter();

  return (
    <div className="fixed inset-x-0 bottom-0 top-[calc(var(--nav-h)+var(--imp-banner-h,0px))] z-50 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
        <GlassIconButton
            icon={ArrowLeft}
            onClick={() => router.back()}
            color="white"
            className="flex-shrink-0"
            aria-label="Retour"
          />
        <h1 className="text-lg font-bold truncate flex-1">
          Correction : {quiz.title}
        </h1>
        <GlassCloseButton
          variant="dark"
          onClick={() => router.push("/child/quiz/history")}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <QuizViewer
          quiz={quiz}
          reviewMode
          initialProgress={progress}
          onBack={() => router.push("/child/quiz/history")}
        />
      </div>
    </div>
  );
}

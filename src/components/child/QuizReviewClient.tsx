"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import QuizViewer from "@/components/viewers/QuizViewer";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

export default function QuizReviewClient({ quiz, progress }: { quiz: any; progress: any }) {
  const router = useRouter();

  return (
    <div className="fixed inset-x-0 bottom-0 top-[calc(var(--nav-h)+var(--imp-banner-h,0px))] z-50 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
        <button
          onClick={() => router.back()}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
          title="Retour"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold truncate flex-1">
          Correction — {quiz.title}
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

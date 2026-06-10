"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, X, AlertCircle } from "lucide-react";
import QuizViewer from "@/components/viewers/QuizViewer";
import AppAdminLoader from "@/components/AppAdminLoader";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function QuizReviewPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const [qzRes, progRes] = await Promise.all([
          fetch(`/api/admin/quizzes?id=${quizId}`),
          fetch(`/api/child/quizzes/${quizId}/progress?userId=${session.user.id}`),
        ]);

        const qzData = await qzRes.json();
        const progData = await progRes.json();

        if (qzData?.id) setQuiz(qzData);
        if (progData?.progress) setProgress(progData.progress);
      } catch (e) {
        console.error("Error loading quiz review:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [quizId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppAdminLoader />
      </div>
    );
  }

  if (!quiz || !progress) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-[var(--greek-blue)] mb-2">
          Aucune correction disponible
        </h1>
        <Link href="/child/quiz/history" className="text-[var(--greek-gold)] hover:underline">
          Retour à mes tentatives
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--greek-gold)] bg-[var(--greek-blue)] text-white shrink-0">
        <button
          onClick={() => router.back()}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
          title="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold truncate flex-1">
          Correction — {quiz.title}
        </h1>
        <Link
          href="/child/quiz/history"
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </Link>
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

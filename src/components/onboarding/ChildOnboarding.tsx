"use client";

import Emblem3D from "@/components/Emblem3D";
import Image from "next/image";
import { useEffect, useState } from "react";
import { updateMyProfile } from "@/lib/updateMyProfile";
import { ChevronRight } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

interface Props {
  firstName: string;
  authId: string;
  gradeLevel: string;
  onComplete: () => void;
}

interface PlacementQuestion { id: number; question: string; options: string[] }

const SCORE_MESSAGES = [
  { min: 0, max: 33, emoji: "", title: "Bon début !", msg: "Pas d'inquiétude, c'est pour ça qu'on est là ! Les cours vont t'aider à progresser rapidement." },
  { min: 34, max: 66, emoji: "", title: "Bien !", msg: "Tu as de bonnes bases. Avec de la pratique, tu vas vite exceller !" },
  { min: 67, max: 100, emoji: "", title: "Excellent !", msg: "Impressionnant ! Tu as déjà de solides connaissances. Les défis avancés t'attendent !" },
];

export default function ChildOnboarding({ firstName, gradeLevel, onComplete }: Props) {
  const [step, setStep] = useState<"welcome" | "quiz" | "result">("welcome");
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [answers, setAnswers] = useState<{ id: number; answerIndex: number }[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [scorePercent, setScorePercent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/placement-quiz?gradeLevel=${encodeURIComponent(gradeLevel)}`)
      .then((res) => (res.ok ? res.json() : { questions: [] }))
      .then((data) => setQuestions(data.questions || []))
      .catch(() => setQuestions([]))
      .finally(() => setQuestionsLoaded(true));
  }, [gradeLevel]);

  const scoreMsg = SCORE_MESSAGES.find(m => scorePercent >= m.min && scorePercent <= m.max) ?? SCORE_MESSAGES[0];

  const startQuizOrSkip = () => {
    if (questionsLoaded && questions.length === 0) {
      setScorePercent(0);
      setStep("result");
    } else {
      setStep("quiz");
    }
  };

  const handleAnswer = async (idx: number) => {
    const newAnswers = [...answers, { id: questions[quizIndex].id, answerIndex: idx }];
    setAnswers(newAnswers);
    if (quizIndex < questions.length - 1) {
      setQuizIndex(q => q + 1);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/placement-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: newAnswers }),
      });
      const data = await res.json().catch(() => ({}));
      setScorePercent(res.ok ? data.scorePercent : 0);
    } finally {
      setSubmitting(false);
      setStep("result");
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    await updateMyProfile({ onboarding_completed: true });
    setSaving(false);
    onComplete();
  };

  const progress = step === "welcome" ? 8
    : step === "quiz" ? 15 + ((quizIndex + 1) / Math.max(1, questions.length)) * 75
    : 100;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-overlay">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">

        {/* Progress */}
        <div className="h-1.5 bg-gray-100">
          <div className="h-full bg-gradient-to-r from-[var(--greek-blue)] to-[var(--greek-gold)] transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>

        {/* ── WELCOME ── */}
        {step === "welcome" && (
          <div className="flex flex-col items-center justify-center px-8 py-12 text-center gap-5 flex-1">
            <Image src="/logo.png" alt="Educalcul" width={80} height={80} className="w-20 h-20 object-contain" />
            <div>
              <h2 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-3">
                Salut {firstName} !
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Bienvenue sur <strong>Educalcul</strong> ! Je suis <strong>Calia</strong>, ton assistante. On commence par un mini-test pour connaître ton niveau, puis je te fais visiter le site.
              </p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 text-sm text-[var(--greek-blue)] font-medium max-w-xs">
              Des cours, des exercices, des quiz et des badges t&apos;attendent !
            </div>
            <GlassButton onClick={startQuizOrSkip} variant="navy" disabled={!questionsLoaded}>
              C&apos;est parti ! <ChevronRight className="w-5 h-5" />
            </GlassButton>
          </div>
        )}

        {/* ── QUIZ ── */}
        {step === "quiz" && (
          <div className="flex flex-col h-full">
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Emblem3D kind="quiz" size={28} float={false} />
                <h3 className="font-bold text-[var(--greek-blue)]">Mini-test de niveau</h3>
                <span className="ml-auto text-sm text-gray-400">{quizIndex + 1}/{questions.length}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full mt-2">
                <div className="h-full bg-[var(--greek-gold)] rounded-full transition-all" style={{ width: `${((quizIndex) / questions.length) * 100}%` }} />
              </div>
            </div>

            <div className="flex-1 px-8 py-4 flex flex-col gap-4">
              <p className="text-lg font-bold text-gray-800 text-center py-4">
                {questions[quizIndex]?.question}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {questions[quizIndex]?.options.map((opt, i) => (
                  <GlassButton key={i} onClick={() => handleAnswer(i)} disabled={submitting} variant="outline" fullWidth>
                    {opt}
                  </GlassButton>
                ))}
              </div>
            </div>

            <div className="px-8 pb-6 text-center">
              <p className="text-xs text-gray-400">Ce test aide à personnaliser ton expérience, pas de mauvaises réponses !</p>
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && (
          <div className="flex flex-col items-center justify-center px-8 py-10 text-center gap-5 flex-1">
            <Image src="/logo.png" alt="Educalcul" width={64} height={64} className="w-16 h-16 object-contain mx-auto" />
            {questions.length > 0 ? (
              <div>
                <h3 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-2">
                  {scoreMsg.title}
                </h3>
                <div className="text-3xl font-black text-[var(--greek-gold)] mb-3">{scorePercent}%</div>
                <p className="text-gray-600 leading-relaxed max-w-sm mx-auto">{scoreMsg.msg}</p>
              </div>
            ) : (
              <h3 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-2">
                C&apos;est prêt !
              </h3>
            )}
            <div className="bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-2xl p-4 max-w-xs text-sm text-gray-700">
              <p className="font-bold text-[var(--greek-blue)] mb-1">Et maintenant</p>
              <p>Je te fais visiter le site : suis les zones éclairées.</p>
            </div>
            <GlassButton
              onClick={handleComplete}
              variant="gold"
              disabled={saving}
            >
              {saving ? "Un instant…" : "Visiter le site"}
            </GlassButton>
          </div>
        )}
      </div>
    </div>
  );
}

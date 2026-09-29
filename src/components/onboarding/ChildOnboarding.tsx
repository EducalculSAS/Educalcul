"use client";

import { useEffect, useState } from "react";
import { updateMyProfile } from "@/lib/updateMyProfile";
import {
  BookOpen, Brain, Trophy, Calculator,
  ChevronRight, ChevronLeft, CheckCircle, MessageSquare,
} from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

interface Props {
  firstName: string;
  authId: string;
  gradeLevel: string;
  onComplete: () => void;
}

const TOUR_STEPS = [
  {
    icon: <BookOpen className="w-14 h-14 text-blue-600" />,
    title: "Mes Cours",
    desc: "Des cours de maths adaptés à ton niveau, avec des formules et des exemples. Lis-les à ton rythme !",
    color: "from-blue-50 to-indigo-50",
    tip: "Tu peux surligner du texte et demander à Calia de t'expliquer !",
  },
  {
    icon: <Calculator className="w-14 h-14 text-orange-500" />,
    title: "Exercices",
    desc: "Pratique avec des exercices corrigés par une IA qui t'explique tes erreurs. Chaque bonne réponse = des XP !",
    color: "from-orange-50 to-amber-50",
    tip: "Certains exercices sont débloqués avec l'abonnement de tes parents.",
  },
  {
    icon: <Brain className="w-14 h-14 text-purple-600" />,
    title: "Quiz",
    desc: "Teste tes connaissances avec des quiz. Tu peux voir ta correction détaillée après chaque quiz.",
    color: "from-purple-50 to-pink-50",
    tip: "Lis bien l'explication après chaque question pour progresser !",
  },
  {
    icon: <Trophy className="w-14 h-14 text-yellow-500" />,
    title: "Trophées & Badges",
    desc: "Gagne des badges en progressant, débloque des contours et couleurs pour ton profil !",
    color: "from-yellow-50 to-orange-50",
    tip: "Plus tu fais d'exercices, plus tu débloques de badges exclusifs.",
  },
  {
    icon: <MessageSquare className="w-14 h-14 text-teal-600" />,
    title: "Assistant Calia & Forum",
    desc: "Calia t'aide quand tu bloques. Le forum te permet d'échanger avec d'autres élèves.",
    color: "from-green-50 to-teal-50",
    tip: "Calia ne donne jamais la réponse directement, elle te guide !",
  },
];

interface PlacementQuestion { id: number; question: string; options: string[] }

const SCORE_MESSAGES = [
  { min: 0, max: 33, emoji: "", title: "Bon début !", msg: "Pas d'inquiétude, c'est pour ça qu'on est là ! Les cours vont t'aider à progresser rapidement." },
  { min: 34, max: 66, emoji: "", title: "Bien !", msg: "Tu as de bonnes bases. Avec de la pratique, tu vas vite exceller !" },
  { min: 67, max: 100, emoji: "", title: "Excellent !", msg: "Impressionnant ! Tu as déjà de solides connaissances. Les défis avancés t'attendent !" },
];

export default function ChildOnboarding({ firstName, authId, gradeLevel, onComplete }: Props) {
  const [step, setStep] = useState<"welcome" | "tour" | "quiz" | "result">("welcome");
  const [tourIndex, setTourIndex] = useState(0);
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

  const progress = step === "welcome" ? 5 : step === "tour"
    ? 5 + ((tourIndex + 1) / TOUR_STEPS.length) * 50
    : step === "quiz" ? 55 + ((quizIndex + 1) / questions.length) * 35
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
            <img src="/logo.png" alt="Educalcul" className="w-20 h-20 object-contain" />
            <div>
              <h2 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-3">
                Salut {firstName} !
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Bienvenue sur <strong>Educalcul</strong> ! Je suis <strong>Calia</strong>, ton assistante. Je vais te faire une petite visite de la plateforme en moins de 2 minutes.
              </p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 text-sm text-[var(--greek-blue)] font-medium max-w-xs">
              Des cours, des exercices, des quiz et des badges t'attendent !
            </div>
            <GlassButton onClick={() => setStep("tour")} variant="navy">
              C'est parti ! <ChevronRight className="w-5 h-5" />
            </GlassButton>
          </div>
        )}

        {/* ── TOUR ── */}
        {step === "tour" && (
          <div className="flex flex-col h-full">
            <div className={`flex-1 bg-gradient-to-br ${TOUR_STEPS[tourIndex].color} flex flex-col items-center justify-center px-8 py-8 text-center gap-5 transition-all duration-300`}>
              <div>{TOUR_STEPS[tourIndex].icon}</div>
              <div>
                <p className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-widest mb-2">
                  {tourIndex + 1} / {TOUR_STEPS.length}
                </p>
                <h3 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-2">
                  {TOUR_STEPS[tourIndex].title}
                </h3>
                <p className="text-gray-600 leading-relaxed max-w-sm mx-auto">
                  {TOUR_STEPS[tourIndex].desc}
                </p>
              </div>
              <div className="bg-white/80 rounded-xl px-4 py-3 max-w-xs text-sm text-gray-600 font-medium shadow-sm">
                {TOUR_STEPS[tourIndex].tip}
              </div>
            </div>

            <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => tourIndex === 0 ? setStep("welcome") : setTourIndex(i => i - 1)}
                className="flex items-center gap-1 text-gray-400 hover:text-[var(--greek-blue)] transition-colors font-semibold text-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
              <div className="flex gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === tourIndex ? "bg-[var(--greek-gold)] w-5" : "bg-gray-200 w-1.5"}`} />
                ))}
              </div>
              {tourIndex < TOUR_STEPS.length - 1 ? (
                <button onClick={() => setTourIndex(i => i + 1)}
                  className="flex items-center gap-1 text-[var(--greek-blue)] font-bold text-sm hover:text-blue-800">
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <GlassButton onClick={startQuizOrSkip} variant="navy" size="sm" disabled={!questionsLoaded}>
                  Mini-test ! <ChevronRight className="w-4 h-4" />
                </GlassButton>
              )}
            </div>
          </div>
        )}

        {/* ── QUIZ ── */}
        {step === "quiz" && (
          <div className="flex flex-col h-full">
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-5 h-5 text-[var(--greek-gold)]" />
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
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={submitting}
                    className="py-4 px-4 bg-gray-50 border border-[rgba(197,161,72,0.25)] rounded-xl font-semibold text-gray-700 hover:bg-[var(--greek-blue)] hover:text-white hover:border-[var(--greek-blue)] transition-all text-sm shadow-sm disabled:opacity-50"
                  >
                    {opt}
                  </button>
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
            <img src="/logo.png" alt="Educalcul" className="w-16 h-16 object-contain mx-auto" />
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
                C'est prêt !
              </h3>
            )}
            <div className="bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-2xl p-4 max-w-xs text-sm text-gray-700">
              <p className="font-bold text-[var(--greek-blue)] mb-1">Pour commencer</p>
              <p>Va dans <strong>Mes Cours</strong> et commence par la première leçon de ton niveau !</p>
            </div>
            <GlassButton
              onClick={handleComplete}
              variant="gold"
              disabled={saving}
            >
              {saving ? "Sauvegarde..." : "C'est parti !"}
            </GlassButton>
          </div>
        )}
      </div>
    </div>
  );
}

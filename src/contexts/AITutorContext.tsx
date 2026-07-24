"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export interface AITutorPageContext {
  page: "dashboard" | "cours" | "cours_detail" | "exercises" | "exercise_detail" | "quiz" | "quiz_detail" | "forum" | "badges" | "profile" | "support" | "other";
  
  // Course context
  courseTitle?: string;
  courseSubject?: string;
  courseLevel?: string;
  courseContent?: string; // text summary of the course chapters
  
  // Exercise context
  exerciseTitle?: string;
  exerciseQuestion?: string; // Full exercise statement
  exerciseDifficulty?: string;
  exerciseType?: string; // Type: calcul_mental, resolution_probleme, etc.
  userAnswer?: string; // Student's current answer
  exerciseHints?: string[]; // Available hints for the exercise
  
  // Quiz context
  quizTitle?: string;
  currentQuestionText?: string;
  userScore?: number;
  
  // Session context (for better continuity)
  previousExercises?: string[]; // Titles of recently completed exercises
  studentLevel?: string; // Student's learning level
  recentMistakes?: string[]; // Topics student struggled with recently
}

interface AITutorContextType {
  pageContext: AITutorPageContext;
  setPageContext: (ctx: AITutorPageContext) => void;
  clearContext: () => void;
}

const defaultContext: AITutorPageContext = { page: "other" };

const AITutorContext = createContext<AITutorContextType>({
  pageContext: defaultContext,
  setPageContext: () => {},
  clearContext: () => {},
});

export function AITutorProvider({ children }: { children: React.ReactNode }) {
  const [pageContext, setPageContextState] = useState<AITutorPageContext>(defaultContext);

  const setPageContext = useCallback((ctx: AITutorPageContext) => {
    setPageContextState(ctx);
  }, []);

  const clearContext = useCallback(() => {
    setPageContextState(defaultContext);
  }, []);

  return (
    <AITutorContext.Provider value={{ pageContext, setPageContext, clearContext }}>
      {children}
    </AITutorContext.Provider>
  );
}

export function useAITutor() {
  return useContext(AITutorContext);
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";

export type GenerationChapterPreview = {
  title: string;
  lessons: unknown[];
};

export type GenerationProgress = {
  step: "outline" | "chapter" | "final-check";
  current: number;
  total: number;
  message: string;
  chapterTitles?: string[];
  chapters?: Record<number, GenerationChapterPreview>;
};

export type CourseGeneration = {
  id: string;
  status: "pending" | "running" | "cancel_requested" | "done" | "error" | "cancelled";
  progress: GenerationProgress;
  course_id: number | null;
  error: string | null;
  params: { subject?: string } & Record<string, unknown>;
  created_at: string;
};

interface CourseGenerationsContextValue {
  generations: CourseGeneration[];
  /** id de la génération affichée en modale complète (null = juste le widget replié). */
  focusedId: string | null;
  startGeneration: (params: Record<string, unknown>) => Promise<string | null>;
  cancelGeneration: (id: string) => Promise<void>;
  minimize: () => void;
  focus: (id: string) => void;
  dismiss: (id: string) => void;
  /** Appelé quand une génération passe à "done" — la page cours s'y abonne pour rafraîchir sa liste. */
  onCourseCreated: (cb: (courseId: number) => void) => () => void;
}

const CourseGenerationsContext = createContext<CourseGenerationsContextValue | null>(null);

const POLL_MS = 2500;
const FINISHED_STATUSES = new Set(["done", "error", "cancelled"]);

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export function CourseGenerationsProvider({ children }: { children: React.ReactNode }) {
  const [generations, setGenerations] = useState<CourseGeneration[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const notifiedDoneRef = useRef<Set<string>>(new Set());
  const listenersRef = useRef<Set<(courseId: number) => void>>(new Set());

  // Rehydrate on mount (survives reload/navigation) — l'API est déjà filtrée sur l'admin courant.
  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/admin/ai/course/active", { headers });
        if (!res.ok) return;
        const data: CourseGeneration[] = await res.json();
        setGenerations(data);
      } catch {
        // Silencieux : le widget reste vide, pas bloquant pour le reste de l'admin.
      }
    })();
  }, []);

  // Poll toutes les générations non terminées.
  useEffect(() => {
    const active = generations.filter((g) => !FINISHED_STATUSES.has(g.status));
    if (active.length === 0) return;

    const timer = setInterval(async () => {
      const headers = await authHeaders();
      const updates = await Promise.all(
        active.map(async (g) => {
          try {
            const res = await fetch(`/api/admin/ai/course/${g.id}`, { headers });
            if (!res.ok) return null;
            return (await res.json()) as CourseGeneration;
          } catch {
            return null;
          }
        }),
      );

      setGenerations((prev) => {
        const byId = new Map(prev.map((g) => [g.id, g]));
        for (const u of updates) {
          if (u) byId.set(u.id, u);
        }
        return Array.from(byId.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      });
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [generations]);

  // Notifie les abonnés (rafraîchir la liste des cours) quand une génération se termine.
  useEffect(() => {
    for (const g of generations) {
      if (g.status === "done" && g.course_id && !notifiedDoneRef.current.has(g.id)) {
        notifiedDoneRef.current.add(g.id);
        listenersRef.current.forEach((cb) => cb(g.course_id!));
      }
    }
  }, [generations]);

  const startGeneration = useCallback(async (params: Record<string, unknown>) => {
    const headers = await authHeaders();
    const res = await fetch("/api/admin/ai/course", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const { generationId } = await res.json();
    if (!generationId) return null;

    setGenerations((prev) => [
      {
        id: generationId,
        status: "pending",
        progress: { step: "outline", current: 0, total: Number(params.page_count) || 4, message: "Démarrage..." },
        course_id: null,
        error: null,
        params: { subject: String(params.subject || "") },
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setFocusedId(generationId);
    return generationId as string;
  }, []);

  const cancelGeneration = useCallback(async (id: string) => {
    const headers = await authHeaders();
    await fetch(`/api/admin/ai/course/${id}`, { method: "POST", headers });
    setGenerations((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: "cancel_requested" } : g)),
    );
  }, []);

  const minimize = useCallback(() => setFocusedId(null), []);
  const focus = useCallback((id: string) => setFocusedId(id), []);
  // Supprime aussi côté serveur : sinon /active la retrouve à chaque
  // rechargement de page et elle réapparaît dans le widget malgré le retrait.
  const dismiss = useCallback((id: string) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id));
    setFocusedId((prev) => (prev === id ? null : prev));
    (async () => {
      const headers = await authHeaders();
      await fetch(`/api/admin/ai/course/${id}`, { method: "DELETE", headers });
    })();
  }, []);

  const onCourseCreated = useCallback((cb: (courseId: number) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  return (
    <CourseGenerationsContext.Provider
      value={{
        generations,
        focusedId,
        startGeneration,
        cancelGeneration,
        minimize,
        focus,
        dismiss,
        onCourseCreated,
      }}
    >
      {children}
    </CourseGenerationsContext.Provider>
  );
}

export function useCourseGenerations(): CourseGenerationsContextValue {
  const ctx = useContext(CourseGenerationsContext);
  if (!ctx) {
    throw new Error("useCourseGenerations doit être utilisé dans CourseGenerationsProvider");
  }
  return ctx;
}

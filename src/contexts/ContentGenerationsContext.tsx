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

export type ContentKind = "course" | "exercise" | "quiz";

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

export type ContentGeneration = {
  id: string;
  kind: ContentKind;
  status: "pending" | "running" | "cancel_requested" | "done" | "error" | "cancelled";
  progress: GenerationProgress;
  contentId: number | null;
  error: string | null;
  params: { subject?: string } & Record<string, unknown>;
  created_at: string;
};

interface ContentGenerationsContextValue {
  generations: ContentGeneration[];
  /** id de la génération affichée en modale complète (null = juste le widget replié). */
  focusedId: string | null;
  startGeneration: (kind: ContentKind, params: Record<string, unknown>) => Promise<string | null>;
  cancelGeneration: (id: string) => Promise<void>;
  minimize: () => void;
  focus: (id: string) => void;
  dismiss: (id: string) => void;
  /** Appelé quand une génération de ce type passe à "done" — la page correspondante s'y abonne pour rafraîchir sa liste. */
  onContentCreated: (kind: ContentKind, cb: (contentId: number) => void) => () => void;
}

const ContentGenerationsContext = createContext<ContentGenerationsContextValue | null>(null);

const POLL_MS = 2500;
const FINISHED_STATUSES = new Set(["done", "error", "cancelled"]);

const KIND_ID_FIELD: Record<ContentKind, string> = {
  course: "course_id",
  exercise: "exercise_id",
  quiz: "quiz_id",
};

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function normalize(kind: ContentKind, raw: Record<string, unknown>): ContentGeneration {
  return {
    id: raw.id as string,
    kind,
    status: raw.status as ContentGeneration["status"],
    progress: raw.progress as GenerationProgress,
    contentId: (raw[KIND_ID_FIELD[kind]] as number) ?? null,
    error: (raw.error as string) ?? null,
    params: (raw.params as ContentGeneration["params"]) || {},
    created_at: raw.created_at as string,
  };
}

export function ContentGenerationsProvider({ children }: { children: React.ReactNode }) {
  const [generations, setGenerations] = useState<ContentGeneration[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const notifiedDoneRef = useRef<Set<string>>(new Set());
  const listenersRef = useRef<Map<ContentKind, Set<(contentId: number) => void>>>(new Map());

  // Rehydrate on mount (survives reload/navigation) — les 3 types en parallèle,
  // chaque API est déjà filtrée sur l'admin courant.
  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const kinds: ContentKind[] = ["course", "exercise", "quiz"];
        const results = await Promise.all(
          kinds.map(async (kind) => {
            const res = await fetch(`/api/admin/ai/${kind}/active`, { headers });
            if (!res.ok) return [];
            const data: Record<string, unknown>[] = await res.json();
            return data.map((raw) => normalize(kind, raw));
          }),
        );
        setGenerations(
          results.flat().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        );
      } catch {
        // Silencieux : le widget reste vide, pas bloquant pour le reste de l'admin.
      }
    })();
  }, []);

  // Poll toutes les générations non terminées (hors ids provisoires : le
  // serveur ne les connaît pas encore tant que startGeneration n'a pas reçu
  // l'id réel).
  useEffect(() => {
    const active = generations.filter(
      (g) => !FINISHED_STATUSES.has(g.status) && !g.id.startsWith("temp-"),
    );
    if (active.length === 0) return;

    const timer = setInterval(async () => {
      const headers = await authHeaders();
      const updates = await Promise.all(
        active.map(async (g) => {
          try {
            const res = await fetch(`/api/admin/ai/${g.kind}/${g.id}`, { headers });
            if (!res.ok) return null;
            const raw = await res.json();
            return normalize(g.kind, raw);
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

  // Notifie les abonnés (rafraîchir la liste correspondante) quand une génération se termine.
  useEffect(() => {
    for (const g of generations) {
      if (g.status === "done" && g.contentId && !notifiedDoneRef.current.has(g.id)) {
        notifiedDoneRef.current.add(g.id);
        listenersRef.current.get(g.kind)?.forEach((cb) => cb(g.contentId!));
      }
    }
  }, [generations]);

  // ids provisoires en attente de la réponse du serveur, associés à une
  // éventuelle annulation demandée avant même que l'id réel soit connu.
  const pendingCancelRef = useRef<Set<string>>(new Set());

  const startGeneration = useCallback(async (kind: ContentKind, params: Record<string, unknown>) => {
    // La modale plein écran s'affiche IMMÉDIATEMENT avec un id provisoire :
    // sans ça, le temps de l'aller-retour réseau (création de la ligne en
    // base côté serveur) laisse un écran vide entre la fermeture du
    // formulaire et l'apparition de la progression.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const totalGuess =
      kind === "course"
        ? Number(params.page_count) || 4
        : Math.ceil((Number(params.questionCount) || (kind === "exercise" ? 5 : 7)) / (kind === "exercise" ? 3 : 4));

    setGenerations((prev) => [
      {
        id: tempId,
        kind,
        status: "pending",
        progress: { step: "outline", current: 0, total: totalGuess, message: "Démarrage..." },
        contentId: null,
        error: null,
        params: { subject: String(params.subject || "") },
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setFocusedId(tempId);

    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/ai/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("start failed");
      const { generationId } = await res.json();
      if (!generationId) throw new Error("no id");

      const cancelledEarly = pendingCancelRef.current.delete(tempId);
      setGenerations((prev) =>
        prev.map((gen) =>
          gen.id === tempId
            ? { ...gen, id: generationId, status: cancelledEarly ? "cancel_requested" : gen.status }
            : gen,
        ),
      );
      setFocusedId((prev) => (prev === tempId ? generationId : prev));

      if (cancelledEarly) {
        const cancelHeaders = await authHeaders();
        await fetch(`/api/admin/ai/${kind}/${generationId}`, { method: "POST", headers: cancelHeaders });
      }

      return generationId as string;
    } catch {
      pendingCancelRef.current.delete(tempId);
      setGenerations((prev) => prev.filter((gen) => gen.id !== tempId));
      setFocusedId((prev) => (prev === tempId ? null : prev));
      return null;
    }
  }, []);

  const cancelGeneration = useCallback(
    async (id: string) => {
      const g = generations.find((gen) => gen.id === id);
      if (!g) return;
      // Feedback immédiat : le bouton "Annuler" disparaît et "Annulation en
      // cours..." s'affiche sans attendre l'aller-retour réseau.
      setGenerations((prev) =>
        prev.map((gen) => (gen.id === id ? { ...gen, status: "cancel_requested" } : gen)),
      );
      if (id.startsWith("temp-")) {
        // L'id réel n'existe pas encore côté serveur : on mémorise la demande,
        // startGeneration l'appliquera dès que l'id définitif sera connu.
        pendingCancelRef.current.add(id);
        return;
      }
      const headers = await authHeaders();
      await fetch(`/api/admin/ai/${g.kind}/${id}`, { method: "POST", headers });
    },
    [generations],
  );

  const minimize = useCallback(() => setFocusedId(null), []);
  const focus = useCallback((id: string) => setFocusedId(id), []);
  // Supprime aussi côté serveur : sinon /active la retrouve à chaque
  // rechargement de page et elle réapparaît dans le widget malgré le retrait.
  const dismiss = useCallback(
    (id: string) => {
      const g = generations.find((gen) => gen.id === id);
      setGenerations((prev) => prev.filter((gen) => gen.id !== id));
      setFocusedId((prev) => (prev === id ? null : prev));
      if (!g) return;
      (async () => {
        const headers = await authHeaders();
        await fetch(`/api/admin/ai/${g.kind}/${id}`, { method: "DELETE", headers });
      })();
    },
    [generations],
  );

  const onContentCreated = useCallback((kind: ContentKind, cb: (contentId: number) => void) => {
    if (!listenersRef.current.has(kind)) listenersRef.current.set(kind, new Set());
    listenersRef.current.get(kind)!.add(cb);
    return () => {
      listenersRef.current.get(kind)?.delete(cb);
    };
  }, []);

  return (
    <ContentGenerationsContext.Provider
      value={{
        generations,
        focusedId,
        startGeneration,
        cancelGeneration,
        minimize,
        focus,
        dismiss,
        onContentCreated,
      }}
    >
      {children}
    </ContentGenerationsContext.Provider>
  );
}

export function useContentGenerations(): ContentGenerationsContextValue {
  const ctx = useContext(ContentGenerationsContext);
  if (!ctx) {
    throw new Error("useContentGenerations doit être utilisé dans ContentGenerationsProvider");
  }
  return ctx;
}

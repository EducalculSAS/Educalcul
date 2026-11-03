"use client";
 

import { compareDisplayOrder } from "@/lib/contentOrder";
import { useState, useEffect, useRef, useMemo } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  isSelfOrDescendant as folderIsSelfOrDescendant,
  buildBreadcrumbs,
  reorderFolders as reorderContentFolders,
  type ContentFolder,
} from "@/lib/contentFoldersClient";
import { compareFolderOrder } from "@/lib/contentOrder";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/difficultyLevels";
import ExerciseGeneratorModal, { ExerciseGenParams } from "@/components/admin/ExerciseGeneratorModal";
import ExerciseFromPhotoModal, { ExerciseFromPhotoParams } from "@/components/admin/ExerciseFromPhotoModal";
import { useContentGenerations } from "@/contexts/ContentGenerationsContext";
import { Page } from "@/components/admin/ExerciseBuilder";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { getAdminCache, setAdminCache, invalidateAdminCache } from "@/lib/adminCache";
import { Plus, Search, X, FolderPlus, XCircle, GraduationCap, Sparkles, Camera, Upload } from "lucide-react";
import ImportJsonModal from "@/components/admin/ImportJsonModal";
import { SCHOOL_CYCLES, getLevelCycle, getEffectiveFolderLevel } from "@/lib/constants";
import { importFromJSONFile } from "@/lib/jsonIO";
import { EXERCISE_JSON_TEMPLATE } from "@/lib/jsonTemplates";
import { compileHandAuthoredExercise } from "@/lib/ai/handAuthoredContent";
import { errMessage } from "@/lib/safeError";
import { FOLDER_COLORS } from "@/components/admin/folderStyle";



import ExerciseEditorModal from "@/components/admin/ExerciseEditorModal";
import ExerciseFolderModal from "@/components/admin/ExerciseFolderModal";
import ExerciseGrid from "@/components/admin/ExerciseGrid";

export interface Exercise {
  id: string;
  display_order?: number | null;
  title: string;
  question: string | null; // Description in UI
  course_id: string | null;
  folder_id: number | null;
  difficulty_level: "easy" | "medium" | "hard" | null;
  type: string | null;
  level: string | null;
  grading_type: "auto" | "ai" | "manual" | null;
  status: "published" | "draft" | "archived";
  thumbnail_url: string | null;
  time_limit: number | null;
  time_limit_minutes: number | null;
  estimated_time: number | null;
  min_score_percent: number | null;
  max_attempts: number | null;
  created_at: string;
  content_json: Page[] | null;
  // relations
  courses?: { title: string };
  exercise_folders?: { name: string; color: string };
}

export interface Course {
  id: string;
  title: string;
  level?: string | null;
}

export interface ExerciseFolder {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
  status: "published" | "draft" | "archived";
  grade_level: string | null;
  icon?: string | null;
  is_system?: boolean;
}

export interface ExerciseFormData {
  title: string;
  description: string;
  course_id: string;
  folder_id: string | number;
  difficulty_level: "easy" | "medium" | "hard";
  type: string;
  level: string;
  grading_type: "auto" | "ai" | "manual";
  status: "published" | "draft" | "archived";
  thumbnail_url: string;
  time_limit: number;
  time_limit_minutes: number;
  estimated_time?: number;
  min_score_percent: number;
  max_attempts: number;
  content_json: Page[];
}

/** Bibliothèque d'exercices admin : le dossier racine + tous les exercices
 * (filtres par défaut) arrivent déjà chargés du serveur ; naviguer dans les
 * dossiers, changer un filtre, et tout le CRUD restent des allers-retours
 * client, comme avant. */
export default function AdminExercisesClient({
  initialFolderId,
  initialItems,
  initialAllFolders,
  initialCourses,
}: {
  initialFolderId: number | null;
  initialItems: Exercise[];
  initialAllFolders: ContentFolder[];
  initialCourses: Course[];
}) {
  const confirm = useConfirm();
  const [exercises, setExercises] = useState<Exercise[]>(initialItems);
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [allFolders, setAllFolders] = useState<ContentFolder[]>(initialAllFolders);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isFirstContentsFetch = useRef(true);

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("admin_exercises_folder", initialFolderId);


  // Drag and drop state
  const [, setDraggedExerciseId] = useState<string | null>(
    null
  );
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);

  // Folder creation/edit state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ExerciseFolder | null>(
    null
  );
  const [folderFormData, setFolderFormData] = useState({
    name: "",
    status: "draft" as "published" | "draft" | "archived",
    color: FOLDER_COLORS[0],
    grade_level: "6eme" as string,
    icon: "",
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Dossiers, fil d'Ariane et compteurs DÉRIVÉS de la liste plate des
  // dossiers, déjà en mémoire : ils s'affichent au clic, sans attendre le
  // réseau. Avant, le fil d'Ariane n'était mis à jour qu'à la FIN du
  // chargement du dossier — d'où son décalage visible.
  const folders = useMemo(
    () =>
      allFolders.filter(
        (f) => (currentFolderId === null ? f.parent_id === null : f.parent_id === currentFolderId),
      ).sort(compareFolderOrder) as unknown as ExerciseFolder[],
    [allFolders, currentFolderId],
  );
  const breadcrumbs = useMemo(
    () =>
      (currentFolderId === null ? [] : buildBreadcrumbs(allFolders, currentFolderId)) as unknown as ExerciseFolder[],
    [allFolders, currentFolderId],
  );
  const subfolderCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const f of allFolders) {
      if (f.parent_id !== null) counts.set(f.parent_id, (counts.get(f.parent_id) ?? 0) + 1);
    }
    return counts;
  }, [allFolders]);
  const currentFolderLevel = getEffectiveFolderLevel(breadcrumbs);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [cycleFilter, setCycleFilter] = useState<string>("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [formData, setFormData] = useState<ExerciseFormData>({
    title: "",
    description: "", // Maps to question column
    course_id: "",
    folder_id: "",
    difficulty_level: "medium",
    type: "standard",
    level: "6eme",
    grading_type: "auto",
    status: "draft",
    thumbnail_url: "",
    time_limit: 0,
    time_limit_minutes: 0,
    estimated_time: 15,
    min_score_percent: 0,
    max_attempts: 0,
    content_json: [] as Page[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const processImportFile = async (file: File) => {
    try {
      const data = await importFromJSONFile(file);
      if (data._type && data._type !== "exercise") { alert("Ce fichier n'est pas un exercice."); return; }
      let compiledContent = ((data.content_json as Page[] | undefined) || []) as Page[];
      try {
        const result = compileHandAuthoredExercise(data);
        compiledContent = result.content;
        if (result.warnings.length > 0) {
          alert(`Importé, mais à vérifier avant d'enregistrer :\n\n- ${result.warnings.join("\n- ")}`);
        }
      } catch (compileErr: unknown) {
        alert(`Le contenu du fichier n'a pas pu être compilé : ${errMessage(compileErr)}`);
        return;
      }
      setFormData({
        title: data.title || "",
        description: data.description || "",
        course_id: String(data.course_id ?? ""),
        difficulty_level: (data.difficulty_level || "medium") as "easy" | "medium" | "hard",
        type: data.type || "standard",
        level: data.level || "6eme",
        grading_type: data.grading_type || "auto",
        status: data.status || "draft",
        thumbnail_url: data.thumbnail_url || "",
        folder_id: data.folder_id ?? "",
        time_limit: data.time_limit || 0,
        time_limit_minutes: data.time_limit_minutes || 0,
        min_score_percent: data.min_score_percent || 0,
        max_attempts: data.max_attempts || 0,
        content_json: compiledContent,
      });
      setEditingExercise(data.id ? ({ id: data.id } as Exercise) : null);
      setIsModalOpen(true);
    } catch (err: unknown) { alert(errMessage(err)); }
  };

  // AI Generation state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { startGeneration, onContentCreated, generations, minimize } = useContentGenerations();
  const generationsRef = useRef(generations);
  generationsRef.current = generations;

  // Lot de photos : lance la génération puis attend qu'elle se termine (une seule à la fois : le plan gratuit
  // de Mistral refuse les appels en rafale). Renvoie un message d'erreur, ou null si l'exercice est créé.
  const generateAndWait = async (params: ExerciseFromPhotoParams): Promise<string | null> => {
    const id = await startGeneration("exercise", {
      exerciseType: params.exerciseType,
      blockType: params.blockType,
      linkedCourseId: null,
      subject: params.subject,
      level: currentFolderLevel || params.level || "6eme",
      difficulty: params.difficulty,
      questionCount: params.questionCount,
      subjectArea: params.subjectArea,
      instructions: params.instructions,
      folder_id: currentFolderId || null,
      sourceExercise: params.sourceExercise,
      sourceQuestionCount: params.sourceQuestionCount,
      sourceFigureDescription: params.sourceFigureDescription,
      copyMode: params.copyMode,
      sourceFigures: params.sourceFigures,
    });
    if (!id) return "Impossible de démarrer la génération.";
    minimize();
    for (let waited = 0; waited < 20 * 60_000; waited += 1_500) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const g = generationsRef.current.find((x) => x.id === id);
      if (!g) return "Génération retirée de la liste.";
      if (g.status === "done") return null;
      if (g.status === "error") return g.error || "Erreur de génération.";
      if (g.status === "cancelled") return "Génération annulée.";
    }
    return "Délai dépassé.";
  };

  // Une génération lancée depuis cette page (ou une autre, ou avant un
  // rechargement) rafraîchit la liste dès qu'elle aboutit à un exercice créé.
  useEffect(() => {
    return onContentCreated("exercise", () => {
      invalidateAdminCache("exercises:");
      fetchContents(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onContentCreated]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    // Le serveur a déjà prérécupéré le dossier racine avec les filtres par
    // défaut : si c'est exactement l'état au premier rendu (rien restauré
    // depuis sessionStorage), inutile de refaire cet appel immédiatement.
    if (isFirstContentsFetch.current) {
      isFirstContentsFetch.current = false;
      // La page serveur a déjà chargé le dossier affiché (lu dans le même
      // cookie) : inutile de refaire la même requête au montage.
      if (statusFilter === "all" && courseFilter === "all" && difficultyFilter === "all") {
        return;
      }
    }
    fetchContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, courseFilter, difficultyFilter, currentFolderId]);

  // Contenu créé/modifié ailleurs (autre onglet, autre appareil) : on
  // rafraîchit silencieusement (sans spinner) quand l'onglet redevient actif,
  // et périodiquement en arrière-plan tant qu'il l'est déjà.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchContents(true); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchContents(true);
    }, 60000); // 60 s : assez pour voir un contenu ajouté ailleurs, sans recharger sans arrêt
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, courseFilter, difficultyFilter, currentFolderId]);

  async function fetchInitialData() {
    try {
      const coursesRes = await fetch("/api/admin/courses");
      const coursesData = await coursesRes.json();

      if (coursesRes.ok) setCourses(coursesData);
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  }

  async function fetchContents(silent = false) {
    const cacheKey = `exercises:${currentFolderId}:${statusFilter}:${courseFilter}:${difficultyFilter}`;
    const cached = getAdminCache<{ items: Exercise[]; allFolders: ContentFolder[] }>(cacheKey);
    if (!silent) {
      if (cached) {
        // Affiche instantanément la dernière version connue — pas d'écran de
        // chargement — pendant qu'une requête fraîche part en arrière-plan.
        setExercises(cached.items);
        setAllFolders(cached.allFolders);
        setLoading(false);
      } else {
        // Pas encore en cache : la liste de l'ancien dossier ne doit pas rester affichée.
        setExercises([]);
        setLoading(true);
      }
    }
    try {
      // Seul le contenu du dossier COURANT est demandé (paramètre `folder`,
      // filtré côté base). Avant, chaque ouverture de dossier — et un
      // rafraîchissement toutes les 20 s — retéléchargeait TOUT le contenu
      // pour n'en garder que quelques lignes : c'était le manque de fluidité
      // dès qu'il y a beaucoup de cours. La liste des dossiers porte déjà le
      // nombre d'éléments de chacun (agrégé en base). Les deux partent en
      // parallèle.
      let url = `/api/admin/exercises?folder=${currentFolderId ?? "root"}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (courseFilter !== "all") url += `&course_id=${courseFilter}`;
      const [freshFolders, response] = await Promise.all([listFolders("exercise"), fetch(url)]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch contents");

      let items = data as Exercise[];
      if (difficultyFilter !== "all") {
        items = items.filter((ex) => ex.difficulty_level === difficultyFilter);
      }
      setAllFolders(freshFolders);
      setExercises(items);
      setAdminCache(cacheKey, { items, allFolders: freshFolders });
    } catch (error: unknown) {
      console.error("Error fetching contents:", errMessage(error) || error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const handleDragStart = (e: React.DragEvent, exerciseId: string) => {
    e.dataTransfer.setData("exerciseId", exerciseId);
    setDraggedExerciseId(exerciseId);
  };

  const handleFolderDragStart = (e: React.DragEvent, folderId: number) => {
    e.dataTransfer.setData("folderId", String(folderId));
  };

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  // Checks if `candidateId` is the folder itself or one of its descendants,
  // by walking up the parent chain of the candidate target.
  // Moves an exercise or a folder (depending on dataTransfer payload)
  // into the target folder (null = root).
  const moveDroppedItem = async (
    e: React.DragEvent,
    targetFolderId: number | null
  ) => {
    const exerciseId = e.dataTransfer.getData("exerciseId");
    const folderId = e.dataTransfer.getData("folderId");

    try {
      if (exerciseId) {
        const response = await fetch("/api/admin/exercises", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: exerciseId,
            folder_id: targetFolderId,
          }),
        });

        if (!response.ok) throw new Error("Failed to move exercise");
        invalidateAdminCache("exercises:");
        fetchContents();
      } else if (folderId) {
        if (targetFolderId !== null && Number(folderId) === targetFolderId)
          return;
        // Prevent cycles: target must not be the folder itself or a descendant
        if (folderIsSelfOrDescendant(allFolders, Number(folderId), targetFolderId)) {
          alert("Impossible de déplacer un dossier dans lui-même ou un de ses sous-dossiers");
          return;
        }
        const { ok } = await updateFolder("exercise", Number(folderId), { parent_id: targetFolderId });
        if (!ok) throw new Error("Failed to move folder");
        invalidateAdminCache("exercises:");
        fetchContents();
      }
    } catch (error) {
      console.error("Error moving item:", error);
      alert("Erreur lors du déplacement");
    } finally {
      setDraggedExerciseId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    await moveDroppedItem(e, targetFolderId);
  };

  const handleBreadcrumbDrop = async (
    e: React.DragEvent,
    targetFolderId: number | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    await moveDroppedItem(e, targetFolderId);
  };

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const folderName = folderFormData.name.trim();
    if (!folderName) return;

    const normFolder = folderName.toLowerCase();
    const folderConflict = folders.some(
      (f) => f.id !== editingFolder?.id && f.name.trim().toLowerCase() === normFolder
    );
    const exerciseConflict = exercises.some((ex) => ex.title.trim().toLowerCase() === normFolder);
    if (folderConflict || exerciseConflict) {
      alert("Un dossier ou un exercice porte déjà ce nom à cet emplacement.");
      return;
    }

    try {
      const payload = {
        name: folderFormData.name,
        status: folderFormData.status,
        color: folderFormData.color,
        grade_level: folderFormData.grade_level || null,
        icon: folderFormData.icon || null,
      };
      const { ok, error } = editingFolder
        ? await updateFolder("exercise", editingFolder.id, payload)
        : await createFolder("exercise", { ...payload, parent_id: currentFolderId });
      if (!ok) throw new Error(error || "Échec");

      setFolderFormData({
        name: "",
        status: "draft",
        color: FOLDER_COLORS[0],
        grade_level: "6eme",
        icon: "",
      });
      setEditingFolder(null);
      setIsFolderModalOpen(false);
      invalidateAdminCache("exercises:");
      fetchContents();
    } catch (error: unknown) {
      console.error("Error saving folder:", error);
      alert(
        "Erreur lors de l'enregistrement du dossier: " +
          (errMessage(error) || JSON.stringify(error))
      );
    }
  };

  const handleDeleteFolder = async (folder: ExerciseFolder) => {
    if (
      !(await confirm(
        `Voulez-vous vraiment supprimer le dossier "${folder.name}" et tout son contenu ?`
      ))
    )
      return;

    const { ok } = await deleteFolder("exercise", folder.id);
    if (!ok) {
      alert("Erreur lors de la suppression du dossier");
      return;
    }
    invalidateAdminCache("exercises:");
    fetchContents();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const file = e.target.files[0];
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("folder", "uploads/exercise_thumbnails");

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formDataUpload,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");

      // Store the full URL or relative path as per PHP logic preference
      // Here we store relative path /uploads/...
      setFormData((prev) => ({ ...prev, thumbnail_url: result.url }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur upload inconnue";
      alert("Erreur upload: " + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // La liste ne charge plus content_json (trop volumineux pour un simple
  // aperçu de carte) : on le récupère à la demande, seulement quand une
  // action a besoin du contenu complet (édition, aperçu, export).
  const getFullExercise = async (exercise: Exercise): Promise<Exercise> => {
    if (exercise.content_json) return exercise;
    const res = await fetch(`/api/admin/exercises?id=${exercise.id}`);
    const full = await res.json();
    if (!res.ok) return exercise;
    const merge = (e: Exercise) => (e.id === exercise.id ? { ...e, content_json: full.content_json ?? [] } : e);
    setExercises((es) => es.map(merge));
    return { ...exercise, content_json: full.content_json ?? [] };
  };

  // Duplique un exercice (brouillon, titre « … (copie) ») : même contenu, nouveaux identifiants côté base.
  const duplicateExercise = async (exercise: Exercise) => {
    const full = await getFullExercise(exercise);
    const taken = new Set(exercises.map((e) => e.title.trim().toLowerCase()));
    let title = `${full.title} (copie)`;
    for (let n = 2; taken.has(title.trim().toLowerCase()); n++) title = `${full.title} (copie ${n})`;
    try {
      const res = await fetch("/api/admin/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: full.question || "",
          course_id: full.course_id || null,
          difficulty_level: full.difficulty_level,
          type: full.type,
          level: full.level,
          status: "draft",
          folder_id: full.folder_id || null,
          thumbnail_url: full.thumbnail_url || "",
          content_json: full.content_json ?? [],
          time_limit: full.time_limit || null,
          min_score_percent: full.min_score_percent || null,
          max_attempts: full.max_attempts || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Duplication impossible.");
      invalidateAdminCache("exercises:");
      fetchContents(true);
    } catch (err: unknown) {
      alert(errMessage(err));
    }
  };

  const handlePreview = async (exercise: Exercise, win?: Window | null) => {
    const previewData = {
      title: exercise.title,
      description: exercise.question || "",
      course_id: exercise.course_id || "",
      folder_id: exercise.folder_id || "",
      difficulty_level: exercise.difficulty_level || "medium",
      type: exercise.type || "standard",
      level: exercise.level || "6eme",
      grading_type: exercise.grading_type || "auto",
      status: exercise.status,
      thumbnail_url: exercise.thumbnail_url || "",
      time_limit: exercise.time_limit || 0,
      time_limit_minutes: exercise.time_limit_minutes || 0,
      estimated_time: exercise.estimated_time ?? 15,
      min_score_percent: exercise.min_score_percent || 0,
      max_attempts: exercise.max_attempts || 0,
      content_json: exercise.content_json || [],
    };

    const res = await fetch("/api/admin/content-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "exercise", payload: previewData }),
    });
    const data = await res.json();
    if (!res.ok) {
      win?.close();
      return;
    }
    const url = `/child/exercises/preview?pid=${data.id}`;
    // `win` ouvert de façon synchrone AVANT tout await, sinon Safari mobile
    // bloque silencieusement le window.open (plus rattaché au geste utilisateur).
    if (win) win.location.href = url;
    else window.open(url, "_blank");
  };

  // Génération en arrière-plan (même architecture que les cours) : ferme le
  // formulaire immédiatement et laisse le widget global (haut à droite)
  // suivre la progression — plus d'étape de validation manuelle, l'exercice
  // final s'enregistre directement en brouillon.
  const handleAiGenerate = (params: ExerciseGenParams) => {
    setIsAiModalOpen(false);
    startGeneration("exercise", {
      exerciseType: params.exerciseType,
      blockType: params.blockType,
      linkedCourseId: params.linkedCourseId || null,
      subject: params.subject,
      level: currentFolderLevel || params.level || "6eme",
      difficulty: params.difficulty,
      questionCount: params.questionCount,
      subjectArea: params.subjectArea,
      instructions: params.instructions,
      folder_id: currentFolderId || null,
    }).then((id) => {
      if (!id) setAiError("Impossible de démarrer la génération. Réessaie.");
    });
  };

  const handlePhotoGenerate = (params: ExerciseFromPhotoParams) => {
    setIsPhotoModalOpen(false);
    startGeneration("exercise", {
      exerciseType: params.exerciseType,
      blockType: params.blockType,
      linkedCourseId: null,
      subject: params.subject,
      level: currentFolderLevel || params.level || "6eme",
      difficulty: params.difficulty,
      questionCount: params.questionCount,
      subjectArea: params.subjectArea,
      instructions: params.instructions,
      folder_id: currentFolderId || null,
      sourceExercise: params.sourceExercise,
      sourceQuestionCount: params.sourceQuestionCount,
      sourceFigureDescription: params.sourceFigureDescription,
      copyMode: params.copyMode,
      sourceFigures: params.sourceFigures,
    }).then((id) => {
      if (!id) setAiError("Impossible de démarrer la génération. Réessaie.");
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normTitle = formData.title.trim().toLowerCase();
    const folderConflict = folders.some((f) => f.name.trim().toLowerCase() === normTitle);
    const exerciseConflict = exercises.some(
      (ex) => ex.id !== editingExercise?.id && ex.title.trim().toLowerCase() === normTitle
    );
    if (folderConflict || exerciseConflict) {
      alert("Un dossier ou un exercice porte déjà ce nom à cet emplacement.");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = "/api/admin/exercises";
      const method = editingExercise ? "PUT" : "POST";
      const body = {
        ...formData,
        id: editingExercise?.id,
        // Handle numeric conversions
        time_limit: formData.time_limit
          ? parseInt(String(formData.time_limit))
          : null,
        time_limit_minutes: formData.time_limit_minutes
          ? parseInt(String(formData.time_limit_minutes))
          : null,
        min_score_percent: formData.min_score_percent
          ? parseInt(String(formData.min_score_percent))
          : null,
        max_attempts: formData.max_attempts
          ? parseInt(String(formData.max_attempts))
          : null,
        // Handle empty strings
        course_id: formData.course_id || null,
        folder_id: formData.folder_id || null,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Une erreur est survenue");

      setIsModalOpen(false);
      invalidateAdminCache("exercises:");
      fetchContents();
      resetForm();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      course_id: "",
      folder_id: currentFolderId || "",
      difficulty_level: "medium",
      type: "standard",
      level: currentFolderLevel || "6eme",
      grading_type: "auto",
      status: "draft",
      thumbnail_url: "",
      time_limit: 0,
      time_limit_minutes: 0,
      min_score_percent: 0,
      max_attempts: 0,
      content_json: [],
    });
    setEditingExercise(null);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Êtes-vous sûr de vouloir supprimer cet exercice ?"))) return;

    try {
      const response = await fetch(`/api/admin/exercises?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Erreur lors de la suppression");
      }

      setExercises(exercises.filter((q) => q.id !== id));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression";
      alert(errorMessage);
    }
  };

  const openEditModal = (exercise: Exercise) => {
    fetchInitialData();
    setEditingExercise(exercise);
    setFormData({
      title: exercise.title,
      description: exercise.question || "",
      course_id: exercise.course_id || "",
      folder_id: exercise.folder_id || "",
      difficulty_level: exercise.difficulty_level || "medium",
      type: exercise.type || "standard",
      level: exercise.level || "6eme",
      grading_type: exercise.grading_type || "auto",
      status: exercise.status,
      thumbnail_url: exercise.thumbnail_url || "",
      time_limit: exercise.time_limit || 0,
      time_limit_minutes: exercise.time_limit_minutes || 0,
      estimated_time: exercise.estimated_time ?? 15,
      min_score_percent: exercise.min_score_percent || 0,
      max_attempts: exercise.max_attempts || 0,
      content_json: exercise.content_json || [],
    });
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Publié
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Brouillon
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Archivé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getDifficultyBadge = (level: string | null) => {
    if (!level) return null;
    const normalized = normalizeDifficulty(level);
    const styles: Record<string, string> = {
      facile: "bg-green-50 text-green-700",
      moyen: "bg-blue-50 text-blue-700",
      avance: "bg-orange-50 text-orange-700",
      difficile: "bg-red-50 text-red-700",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[normalized]}`}>
        {DIFFICULTY_LABELS[normalized]}
      </span>
    );
  };

  const filteredExercises = exercises.filter(
    (ex) =>
      (ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ex.question &&
          ex.question.toLowerCase().includes(searchQuery.toLowerCase()))) &&
      (cycleFilter === "all" || getLevelCycle(ex.level) === cycleFilter)
  ).sort(compareDisplayOrder);

  // Ordre du dossier, réglé avec les flèches : c'est exactement celui que verra
  // l'élève. Seulement sans recherche ni filtre (déplacer dans une liste
  // partielle n'aurait pas de sens). Mise à jour optimiste, annulée en cas d'échec.
  const canReorder = !searchQuery && cycleFilter === "all" && statusFilter === "all" && courseFilter === "all" && difficultyFilter === "all";
  const moveItem = async (itemId: string, direction: -1 | 1) => {
    const ordered = [...exercises].sort(compareDisplayOrder);
    const index = ordered.findIndex((x) => x.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const renumbered = ordered.map((x, i) => ({ ...x, display_order: (i + 1) * 10 }));
    const previous = exercises;
    setExercises(renumbered);
    const res = await fetch("/api/admin/exercises/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: renumbered.map((x) => x.id) }),
    });
    if (!res.ok) setExercises(previous);
  };

  // Les dossiers racine portent le niveau scolaire (`grade_level`) : c'est là
  // que filtrer par cycle a du sens. Une fois entré dans un dossier de niveau,
  // le cycle est déjà déterminé, on ne filtre plus les sous-dossiers de cours.
  // Ordre des dossiers du niveau courant, réglé avec les flèches : c'est celui que verra l'élève. Seulement sans recherche ni
  // filtre (déplacer dans une liste partielle n'aurait pas de sens). Mise à jour optimiste, annulée en cas d'échec.
  const canReorderFolders = !searchQuery && cycleFilter === "all";
  const moveFolder = async (folderId: number, direction: -1 | 1) => {
    const ordered = [...folders];
    const index = ordered.findIndex((f) => f.id === folderId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const ranks = new Map(ordered.map((f, i) => [f.id, (i + 1) * 10]));
    const previous = allFolders;
    setAllFolders((all) => all.map((f) => (ranks.has(f.id) ? { ...f, display_order: ranks.get(f.id)! } : f)));
    const ok = await reorderContentFolders("exercise", ordered.map((f) => f.id));
    if (ok) invalidateAdminCache("exercises:");
    else setAllFolders(previous);
  };

  const filteredFolders = folders.filter(
    (folder) =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (cycleFilter === "all" ||
        currentFolderId !== null ||
        getLevelCycle(folder.grade_level) === cycleFilter)
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={GraduationCap}
        title="Gestion des Exercices"
        subtitle="Gérez les exercices et leur contenu"
        actions={
          <>
            <GlassButton
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingFolder(null);
                setFolderFormData({
                  name: "",
                  status: "draft",
                  color: breadcrumbs[0]?.color || FOLDER_COLORS[0],
                  grade_level: currentFolderLevel || "6eme",
                  icon: "",
                });
                setIsFolderModalOpen(true);
              }}
            >
              <FolderPlus size={18} />
              Nouveau Dossier
            </GlassButton>
            <GlassButton size="sm" variant="navy" onClick={() => setIsAiModalOpen(true)}>
              <Sparkles size={18} />
              Générer avec IA
            </GlassButton>
            <GlassButton size="sm" variant="navy" onClick={() => setIsPhotoModalOpen(true)}>
              <Camera size={18} />
              Depuis une photo
            </GlassButton>
            <GlassButton size="sm" variant="ghost" onClick={() => setShowImportModal(true)}>
              <Upload size={16} /> JSON
            </GlassButton>
            <GlassButton size="sm" variant="navy" onClick={() => { fetchInitialData(); resetForm(); setIsModalOpen(true); }}>
              <Plus size={18} />
              Nouvel Exercice
            </GlassButton>
          </>
        }
      />

      {/* Fil d'Ariane — dérivé en mémoire, boutons liquid glass */}
      <AdminBreadcrumbs
        crumbs={breadcrumbs}
        currentFolderId={currentFolderId}
        onNavigate={(id) => { setCurrentFolderId(id); setSearchQuery(""); }}
        onDropOnto={handleBreadcrumbDrop}
      />

      {/* Filters */}
      <div className="bg-white p-4 rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] space-y-4">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Rechercher un exercice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-w-[160px]">
              <option value="all">Tous les statuts</option>
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
              <option value="archived">Archivé</option>
            </select>

            <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className="min-w-[160px]">
              <option value="all">Toutes difficultés</option>
              <option value="easy">Facile</option>
              <option value="medium">Moyen</option>
              <option value="hard">Difficile</option>
            </select>

            <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="min-w-[160px]">
              <option value="all">Tous les niveaux</option>
              {SCHOOL_CYCLES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>

            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-48 max-w-[12rem]">
              <option value="all">Tous les cours</option>
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* Exercises Grid */}
      <ExerciseGrid loading={loading} filteredFolders={filteredFolders} handleFolderDragStart={handleFolderDragStart} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave} handleDrop={handleDrop} setCurrentFolderId={setCurrentFolderId} setSearchQuery={setSearchQuery} dragOverFolderId={dragOverFolderId} canReorderFolders={canReorderFolders} folders={folders} moveFolder={moveFolder} setEditingFolder={setEditingFolder} setFolderFormData={setFolderFormData} setIsFolderModalOpen={setIsFolderModalOpen} handleDeleteFolder={handleDeleteFolder} currentFolderId={currentFolderId} subfolderCounts={subfolderCounts} filteredExercises={filteredExercises} handleDragStart={handleDragStart} setDraggedExerciseId={setDraggedExerciseId} getStatusBadge={getStatusBadge} canReorder={canReorder} moveItem={moveItem} getDifficultyBadge={getDifficultyBadge} getFullExercise={getFullExercise} handlePreview={handlePreview} openEditModal={openEditModal} duplicateExercise={duplicateExercise} handleDelete={handleDelete} />

      {/* Folder Creation/Edit Modal */}
      {isFolderModalOpen && <ExerciseFolderModal editingFolder={editingFolder} setIsFolderModalOpen={setIsFolderModalOpen} setEditingFolder={setEditingFolder} setFolderFormData={setFolderFormData} handleSaveFolder={handleSaveFolder} folderFormData={folderFormData} />}

      {/* Inline AI error */}
      {aiError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
          <XCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Erreur IA</p>
            <p className="opacity-90">{aiError}</p>
          </div>
          <GlassIconButton
            icon={X}
            onClick={() => setAiError(null)}
            color="red"
            size="sm"
            aria-label="Fermer"
          />
        </div>
      )}

      {/* Modal AI Generator */}
      {isAiModalOpen && (
        <ExerciseGeneratorModal
          onGenerate={handleAiGenerate}
          onClose={() => setIsAiModalOpen(false)}
          defaultLevel={currentFolderLevel || undefined}
        />
      )}

      {isPhotoModalOpen && (
        <ExerciseFromPhotoModal
          onGenerate={handlePhotoGenerate}
          onGenerateBatch={generateAndWait}
          onClose={() => setIsPhotoModalOpen(false)}
          defaultLevel={currentFolderLevel || undefined}
        />
      )}

      {/* Modal Création/Édition - Full Screen */}
      {isModalOpen && <ExerciseEditorModal editingExercise={editingExercise} setIsModalOpen={setIsModalOpen} handleSubmit={handleSubmit} formData={formData} setFormData={setFormData} courses={courses} folders={folders} uploading={uploading} handleFileUpload={handleFileUpload} currentFolderLevel={currentFolderLevel} isSubmitting={isSubmitting} />}

      {/* Preview Modal removed in favor of tab-based preview */}

      {showImportModal && (
        <ImportJsonModal
          label="exercice"
          onClose={() => setShowImportModal(false)}
          onFileLoaded={processImportFile}
          template={EXERCISE_JSON_TEMPLATE}
          templateFilename="modele_exercice.json"
        />
      )}
    </div>
  );
}



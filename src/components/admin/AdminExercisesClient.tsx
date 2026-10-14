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
  type ContentFolder,
} from "@/lib/contentFoldersClient";
import { openPreviewLoadingWindow } from "@/lib/openPreviewWindow";
import { DIFFICULTY_LABELS, normalizeDifficulty } from "@/lib/difficultyLevels";
import ExerciseGeneratorModal, { ExerciseGenParams } from "@/components/admin/ExerciseGeneratorModal";
import ExerciseFromPhotoModal, { ExerciseFromPhotoParams } from "@/components/admin/ExerciseFromPhotoModal";
import { useContentGenerations } from "@/contexts/ContentGenerationsContext";
import ExerciseBuilder, { Page } from "@/components/admin/ExerciseBuilder";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { getAdminCache, setAdminCache, invalidateAdminCache } from "@/lib/adminCache";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Clock,
  Folder,
  FolderPlus,
  ImageIcon,
  XCircle,
  BookOpen,
  Zap,
  GraduationCap,
  Sparkles,
  Camera,
  Loader2,
  Eye, Download, Upload,
  Calculator,
  Brain,
  Trophy,
  Star,
  Pencil,
  Ruler,
  FlaskConical,
  Shapes,
  Pi,
  Puzzle,
  LineChart,
  Hash,
  Table2,
  Superscript,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import ExerciseViewer from "@/components/viewers/ExerciseViewer";
import ImportJsonModal from "@/components/admin/ImportJsonModal";
import PageLoader from "@/components/PageLoader";
import { SCHOOL_LEVELS, SCHOOL_CYCLES, getLevelLabel, getLevelCycle, getEffectiveFolderLevel } from "@/lib/constants";
import { exportAsJSON, importFromJSONFile } from "@/lib/jsonIO";
import { EXERCISE_JSON_TEMPLATE } from "@/lib/jsonTemplates";
import { compileHandAuthoredExercise } from "@/lib/ai/handAuthoredContent";
import CourseSelect from "@/components/admin/CourseSelect";

const FOLDER_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#1e3a8a", // Bleu marine
  "#84cc16", // Lime
  "#166534", // Vert foncé
  "#78350f", // Marron
  "#06b6d4", // Cyan
  "#d946ef", // Fuchsia
  "#0ea5e9", // Sky
  "#f43f5e", // Rose
];

function Num123Icon({ size = 24, ...props }: any) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...props}
    >
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor" fillOpacity="1" stroke="none">
        123
      </text>
    </svg>
  );
}

const FOLDER_ICONS = [
  { name: "folder", Icon: Folder },
  { name: "book", Icon: BookOpen },
  { name: "calculator", Icon: Calculator },
  { name: "brain", Icon: Brain },
  { name: "trophy", Icon: Trophy },
  { name: "star", Icon: Star },
  { name: "pencil", Icon: Pencil },
  { name: "ruler", Icon: Ruler },
  { name: "flask", Icon: FlaskConical },
  { name: "shapes", Icon: Shapes },
  { name: "pi", Icon: Pi },
  { name: "puzzle", Icon: Puzzle },
  { name: "chart", Icon: LineChart },
  { name: "numbers", Icon: Hash },
  { name: "table", Icon: Table2 },
  { name: "exponent", Icon: Superscript },
  { name: "123", Icon: Num123Icon },
];

const getFolderIcon = (iconName?: string | null) => {
  const found = FOLDER_ICONS.find((i) => i.name === iconName);
  return found ? found.Icon : Folder;
};

const EXERCISE_TYPES = [
  { value: "standard", label: "Standard (Calcul/Réponse libre)" },
  { value: "qcm", label: "QCM" },
  { value: "fill_in_the_blank", label: "Texte à trous" },
  { value: "matching", label: "Association / Relier" },
  { value: "ordering", label: "Mise en ordre" },
  { value: "coding", label: "Code / Algo" },
];

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

interface ExerciseFormData {
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
  const [draggedExerciseId, setDraggedExerciseId] = useState<string | null>(
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
      ) as unknown as ExerciseFolder[],
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
  const importExerciseRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImportExercise = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImportFile(file);
  };

  const processImportFile = async (file: File) => {
    try {
      const data = await importFromJSONFile(file);
      if (data._type && data._type !== "exercise") { alert("Ce fichier n'est pas un exercice."); return; }
      let compiledContent = data.content_json || [];
      try {
        const result = compileHandAuthoredExercise(data);
        compiledContent = result.content;
        if (result.warnings.length > 0) {
          alert(`Importé, mais à vérifier avant d'enregistrer :\n\n- ${result.warnings.join("\n- ")}`);
        }
      } catch (compileErr: any) {
        alert(`Le contenu du fichier n'a pas pu être compilé : ${compileErr.message}`);
        return;
      }
      setFormData({
        title: data.title || "",
        description: data.description || "",
        course_id: data.course_id || "",
        difficulty_level: data.difficulty_level || "medium",
        type: data.type || "standard",
        level: data.level || "6eme",
        grading_type: data.grading_type || "auto",
        status: data.status || "draft",
        thumbnail_url: data.thumbnail_url || "",
        folder_id: data.folder_id || "",
        time_limit: data.time_limit || 0,
        time_limit_minutes: data.time_limit_minutes || 0,
        min_score_percent: data.min_score_percent || 0,
        max_attempts: data.max_attempts || 0,
        content_json: compiledContent,
      });
      setEditingExercise(data.id ? ({ id: data.id } as Exercise) : null);
      setIsModalOpen(true);
    } catch (err: any) { alert(err.message); }
  };

  // AI Generation state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { startGeneration, onContentCreated } = useContentGenerations();

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

  const fetchInitialData = async () => {
    try {
      const coursesRes = await fetch("/api/admin/courses");
      const coursesData = await coursesRes.json();

      if (coursesRes.ok) setCourses(coursesData);
    } catch (error) {
      console.error("Error loading initial data:", error);
    }
  };

  const fetchContents = async (silent = false) => {
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
        items = items.filter((ex: any) => ex.difficulty_level === difficultyFilter);
      }
      setAllFolders(freshFolders);
      setExercises(items);
      setAdminCache(cacheKey, { items, allFolders: freshFolders });
    } catch (error: any) {
      console.error("Error fetching contents:", error?.message || error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

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
    } catch (error: any) {
      console.error("Error saving folder:", error);
      alert(
        "Erreur lors de l'enregistrement du dossier: " +
          (error?.message || JSON.stringify(error))
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
  const filteredFolders = folders.filter(
    (folder) =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (cycleFilter === "all" ||
        currentFolderId !== null ||
        getLevelCycle((folder as any).grade_level) === cycleFilter)
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Indicateur seulement si l'attente dure (appear-late : 400 ms) ; les
            sous-dossiers, déjà connus, restent affichés pendant ce temps. */}
        {loading && (
          <div className="col-span-full appear-late order-last">
            <PageLoader className="h-24" />
          </div>
        )}
        {(
          <>
            {/* Folders */}
            {filteredFolders.map((folder) => {
              const FolderCardIcon = getFolderIcon(folder.icon);
              return (
              <div
                key={`folder-${folder.id}`}
                draggable
                onDragStart={(e) => handleFolderDragStart(e, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
                onClick={() => { setCurrentFolderId(folder.id); setSearchQuery(""); }}
                className={`bg-white rounded-2xl p-6 shadow-sm border transition-all group cursor-pointer relative overflow-hidden flex flex-col items-center justify-center text-center aspect-[4/3]
                  ${
                    dragOverFolderId === folder.id
                      ? "border-[var(--greek-blue)] ring-2 ring-[var(--greek-blue)]/20 bg-blue-50"
                      : "border-[rgba(197,161,72,0.25)] hover:shadow-lg hover:-translate-y-1"
                  }`}
              >
                <div
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GlassIconButton
                    icon={Edit}
                    onClick={() => {
                      setEditingFolder(folder);
                      setFolderFormData({
                        name: folder.name,
                        status: folder.status,
                        color: folder.color || FOLDER_COLORS[0],
                        grade_level: folder.grade_level || "6eme",
                        icon: folder.icon || "",
                      });
                      setIsFolderModalOpen(true);
                    }}
                    color="navy"
                    size="sm"
                    aria-label="Modifier"
                  />
                  {!folder.is_system && (
                    <GlassIconButton
                      icon={Trash2}
                      onClick={() => {
                        handleDeleteFolder(folder);
                      }}
                      color="red"
                      size="sm"
                      aria-label="Supprimer"
                    />
                  )}
                </div>

                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${folder.color || "#3b82f6"}15`,
                    color: folder.color || "#3b82f6",
                  }}
                >
                  <FolderCardIcon size={32} fill="currentColor" fillOpacity={0.2} />
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-1 truncate w-full px-2">
                  {folder.name}
                </h3>
                {!folder.is_system && (
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {folder.status === "published"
                      ? "Publié"
                      : folder.status === "archived"
                      ? "Archivé"
                      : "Brouillon"}
                  </p>
                )}
                {(() => {
                  const subCount = currentFolderId === null ? 0 : (subfolderCounts.get(folder.id) ?? 0);
                  const itemCount = ((folder as { item_count?: number }).item_count ?? 0);
                  if (subCount === 0 && itemCount === 0) return null;
                  const parts = [];
                  if (subCount > 0) parts.push(`${subCount} dossier${subCount > 1 ? "s" : ""}`);
                  if (itemCount > 0) parts.push(`${itemCount} exercice${itemCount > 1 ? "s" : ""}`);
                  return (
                    <p className="text-xs text-gray-400 mt-1">{parts.join(" · ")}</p>
                  );
                })()}
              </div>
              );
            })}

            {filteredExercises.map((exercise) => (
              <div
                key={exercise.id}
                draggable
                onDragStart={(e) => handleDragStart(e, exercise.id)}
                onDragEnd={() => setDraggedExerciseId(null)}
                className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden hover:shadow-md transition-shadow group cursor-move"
              >
                <div className="relative h-40 bg-gray-100">
                  {exercise.thumbnail_url ? (
                    <img
                      src={exercise.thumbnail_url}
                      alt={exercise.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder-exercise.png"; // Fallback
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <GraduationCap size={48} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(exercise.status)}
                  </div>
                  {canReorder && filteredExercises.length > 1 && (
                    <div className="absolute top-2 left-2 flex gap-1">
                      <GlassIconButton
                        icon={ArrowUp}
                        size="sm"
                        color="navy"
                        disabled={filteredExercises[0]?.id === exercise.id}
                        onClick={() => void moveItem(exercise.id, -1)}
                        aria-label={`Avancer « ${exercise.title} » dans l'ordre du dossier`}
                      />
                      <GlassIconButton
                        icon={ArrowDown}
                        size="sm"
                        color="navy"
                        disabled={filteredExercises[filteredExercises.length - 1]?.id === exercise.id}
                        onClick={() => void moveItem(exercise.id, 1)}
                        aria-label={`Reculer « ${exercise.title} » dans l'ordre du dossier`}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      {exercise.courses?.title || "Sans cours"}
                    </span>
                    {getDifficultyBadge(exercise.difficulty_level)}
                  </div>

                  <h3
                    className="font-semibold text-gray-900 mb-1 line-clamp-1"
                    title={exercise.title}
                  >
                    {exercise.title}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                    {exercise.question || "Aucune description"}
                  </p>

                  <div className="flex justify-between items-center pt-2 border-t border-[rgba(197,161,72,0.25)]">
                    <span className="text-xs text-gray-400">
                      {new Date(exercise.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      <GlassIconButton
                        icon={Eye}
                        onClick={() => {
                          const win = openPreviewLoadingWindow();
                          void (async () => {
                            const full = await getFullExercise(exercise);
                            await handlePreview(full, win);
                          })();
                        }}
                        color="gray"
                        size="sm"
                        aria-label="Prévisualiser"
                      />
                      <GlassIconButton
                        icon={Edit}
                        onClick={async () => openEditModal(await getFullExercise(exercise))}
                        color="navy"
                        size="sm"
                        aria-label="Modifier"
                      />
                      <GlassIconButton
                        icon={Download}
                        onClick={async () => {
                          const full = await getFullExercise(exercise);
                          exportAsJSON(full, "exercise", full.title);
                        }}
                        color="gold"
                        size="sm"
                        aria-label="Exporter JSON"
                      />
                      <GlassIconButton
                        icon={Trash2}
                        onClick={() => handleDelete(exercise.id)}
                        color="red"
                        size="sm"
                        aria-label="Supprimer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!loading && filteredExercises.length === 0 && filteredFolders.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                Aucun contenu dans ce dossier
              </div>
            )}
          </>
        )}
      </div>

      {/* Folder Creation/Edit Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 modal-overlay">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)] flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                {editingFolder ? "Modifier le dossier" : "Nouveau Dossier"}
              </h3>
              <GlassCloseButton
                onClick={() => {
                  setIsFolderModalOpen(false);
                  setEditingFolder(null);
                  setFolderFormData({
                    name: "",
                    status: "draft",
                    color: FOLDER_COLORS[0],
                    grade_level: "6eme",
                    icon: "",
                  });
                }}
              />
            </div>
            <form onSubmit={handleSaveFolder} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du dossier
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={folderFormData.name}
                  onChange={(e) =>
                    setFolderFormData({
                      ...folderFormData,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                  placeholder="Ex: Mathématiques"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  value={folderFormData.status}
                  onChange={(e) =>
                    setFolderFormData({
                      ...folderFormData,
                      status: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  <option value="draft">Brouillon</option>
                  <option value="published">Publié</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau scolaire</label>
                <select
                  value={folderFormData.grade_level}
                  onChange={(e) => setFolderFormData({ ...folderFormData, grade_level: e.target.value })}
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  {SCHOOL_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Pré-sélectionne ce niveau lors de la génération IA dans ce dossier.</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur du dossier
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() =>
                        setFolderFormData({ ...folderFormData, color })
                      }
                      className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                        folderFormData.color === color
                          ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icône du dossier
                </label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_ICONS.map(({ name, Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        setFolderFormData({ ...folderFormData, icon: name })
                      }
                      className={`w-9 h-9 rounded-full flex items-center justify-center bg-gray-50 transition-transform hover:scale-110 ${
                        (folderFormData.icon || "folder") === name
                          ? "ring-2 ring-[var(--greek-blue)] scale-110"
                          : ""
                      }`}
                    >
                      <Icon size={18} style={{ color: folderFormData.color }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsFolderModalOpen(false);
                    setEditingFolder(null);
                    setFolderFormData({
                      name: "",
                      status: "draft",
                      color: FOLDER_COLORS[0],
                      grade_level: "6eme",
                      icon: "",
                    });
                  }}
                >
                  Annuler
                </GlassButton>
                <GlassButton
                  size="sm"
                  variant="navy"
                  disabled={!folderFormData.name.trim()}
                  type="submit"
                >
                  {editingFolder ? "Sauvegarder" : "Créer"}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

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
          onClose={() => setIsPhotoModalOpen(false)}
          defaultLevel={currentFolderLevel || undefined}
        />
      )}

      {/* Modal Création/Édition - Full Screen */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1060] p-4 modal-overlay">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-8 py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <GraduationCap size={24} className="text-[var(--greek-gold)]" />
                <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
                  {editingExercise ? "Modifier l'exercice" : "Nouvel exercice"}
                </h2>
              </div>
              <GlassCloseButton variant="dark" onClick={() => setIsModalOpen(false)} />
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto">
                
                {/* Section 1: Informations générales */}
                <div className="p-6 border-b border-[rgba(197,161,72,0.25)]">
                  <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">1</span>
                    Informations générales
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Titre de l'exercice</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-gray-50 font-medium"
                        placeholder="Ex: Maths : Les fractions (CP)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description / Énoncé</label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] resize-none bg-gray-50"
                        placeholder="Description affichée sur la page d'accueil de l'exercice..."
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cours associé</label>
                          <CourseSelect value={formData.course_id} onChange={(id) => setFormData({ ...formData, course_id: id })} courses={courses} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Dossier</label>
                          <select
                            value={formData.folder_id}
                            onChange={(e) => setFormData({ ...formData, folder_id: e.target.value })}
                            className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50"
                          >
                            <option value="">Racine</option>
                            {folders.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Image miniature</label>
                        {formData.thumbnail_url && (
                          <div className="relative w-full h-20 bg-gray-100 rounded-lg overflow-hidden border border-[rgba(197,161,72,0.25)] mb-2">
                            <img src={formData.thumbnail_url} alt="Aperçu" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-exercise.png"; }} />
                            <div className="absolute top-1.5 right-1.5">
                              <GlassIconButton
                                icon={XCircle}
                                onClick={() => setFormData({ ...formData, thumbnail_url: "" })}
                                color="red"
                                size="sm"
                                aria-label="Supprimer l'image"
                              />
                            </div>
                          </div>
                        )}
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium w-full justify-center border border-dashed border-[rgba(197,161,72,0.25)]">
                          <ImageIcon size={16} />
                          {uploading ? "Upload en cours..." : "Choisir une image"}
                          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Paramètres pédagogiques */}
                <div className="p-6 border-b border-[rgba(197,161,72,0.25)] bg-gray-50/50">
                  <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">2</span>
                    Paramètres pédagogiques
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Niveau scolaire</label>
                      {!editingExercise && currentFolderLevel ? (
                        <div className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl bg-blue-50 font-semibold text-[var(--greek-blue)]">
                          {getLevelLabel(currentFolderLevel)}
                        </div>
                      ) : (
                      <select
                        value={formData.level}
                        onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                        className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                      >
                        {SCHOOL_LEVELS.map((level) => (<option key={level.value} value={level.value}>{level.label}</option>))}
                      </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Difficulté</label>
                      <GlassSegmentedControl
                        size="sm"
                        options={[
                          { id: "easy", label: "Facile" },
                          { id: "medium", label: "Moyen" },
                          { id: "hard", label: "Difficile" },
                        ]}
                        value={formData.difficulty_level}
                        onChange={(v) => setFormData({ ...formData, difficulty_level: v as "easy" | "medium" | "hard" })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durée estimée</label>
                      <div className="relative">
                        <input
                          type="number" min={1} max={600}
                          value={formData.estimated_time ?? ""}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            setFormData({ ...formData, estimated_time: Number.isFinite(n) ? Math.min(600, Math.max(1, n)) : undefined });
                          }}
                          aria-label="Durée estimée en minutes"
                          className="w-full px-4 py-2.5 pr-14 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">min</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Statut</label>
                      <GlassSegmentedControl
                        size="sm"
                        options={[
                          { id: "draft", label: "Brouillon" },
                          { id: "published", label: "Publié" },
                          { id: "archived", label: "Archivé" },
                        ]}
                        value={formData.status}
                        onChange={(v) => setFormData({ ...formData, status: v as "draft" | "published" | "archived" })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correction</label>
                      <select
                        value={formData.grading_type}
                        onChange={(e) => setFormData({ ...formData, grading_type: e.target.value as "auto" | "ai" | "manual" })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                      >
                        <option value="auto">Automatique</option>
                        <option value="ai">IA</option>
                        <option value="manual">Manuelle</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type d'exercice</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                      >
                        {EXERCISE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durée (minutes)</label>
                      <input
                        type="number" min="0"
                        value={formData.time_limit}
                        onChange={(e) => setFormData({ ...formData, time_limit: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                        placeholder="0 = illimité"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Score minimum requis (%)</label>
                      <input
                        type="number" min="0" max="100"
                        inputMode="numeric"
                        value={formData.min_score_percent || ""}
                        onChange={(e) => setFormData({ ...formData, min_score_percent: Math.min(100, parseInt(e.target.value) || 0) })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                        placeholder="0 = pas de minimum"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Essais max</label>
                      <input
                        type="number" min="0"
                        value={formData.max_attempts}
                        onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                        placeholder="0 = illimité"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Contenu */}
                <div className="p-6">
                  <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">3</span>
                    Contenu de l'exercice
                  </h3>
                  <ExerciseBuilder
                    initialContent={formData.content_json || []}
                    level={formData.level}
                    onChange={(content) => setFormData({ ...formData, content_json: content })}
                    onMetadataChange={(metadata) => {
                      setFormData((prev) => ({
                        ...prev,
                        title: metadata.title || prev.title,
                        description: metadata.description || prev.description,
                        difficulty_level: metadata.difficulty_level || prev.difficulty_level,
                        time_limit: metadata.time_limit || prev.time_limit,
                        time_limit_minutes: metadata.time_limit_minutes || prev.time_limit_minutes,
                        min_score_percent: metadata.min_score_percent || prev.min_score_percent,
                        max_attempts: metadata.max_attempts || prev.max_attempts,
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 p-6 border-t border-[rgba(197,161,72,0.25)] bg-white flex-shrink-0">
                <GlassButton size="sm" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </GlassButton>
                <GlassButton
                  size="sm"
                  variant="navy"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent)}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingExercise ? "Mettre à jour" : "Créer l'exercice"}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

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



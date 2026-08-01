"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import { supabase } from "@/lib/supabaseClient";
import { exportAsJSON, importFromJSONFile } from "@/lib/jsonIO";
import { QUIZ_JSON_TEMPLATE } from "@/lib/jsonTemplates";
import QuizGeneratorModal, { QuizGenParams } from "@/components/admin/QuizGeneratorModal";
import { useContentGenerations } from "@/contexts/ContentGenerationsContext";
import QuizBuilder, { Question } from "@/components/admin/QuizBuilder";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { getAdminCache, setAdminCache, invalidateAdminCache } from "@/lib/adminCache";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Clock,
  Folder,
  FolderPlus,
  ChevronRight,
  Home,
  ImageIcon,
  XCircle,
  CheckCircle,
  FileText,
  BookOpen,
  BrainCircuit,
  Zap,
  GraduationCap,
  Sparkles,
  Loader2, Eye, Download, Upload,
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
} from "lucide-react";
import QuizViewer from "@/components/viewers/QuizViewer";
import ImportJsonModal from "@/components/admin/ImportJsonModal";
import PageLoader from "@/components/PageLoader";
import ThemedSelect from "@/components/admin/ThemedSelect";
import { SCHOOL_LEVELS, getLevelLabel, getEffectiveFolderLevel } from "@/lib/constants";

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

const QUIZ_TYPES = [
  { value: "standard", label: "Standard (Mélange)" },
  { value: "exam", label: "Examen / Évaluation" },
  { value: "practice", label: "Entraînement / Révision" },
  { value: "homework", label: "Devoir Maison" },
];

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  course_id: string | null;
  folder_id: number | null;
  time_limit_minutes: number | null;
  min_score_percent: number | null;
  status: "published" | "draft" | "archived";
  type: string | null;
  difficulty_level: string | null;
  level: string | null;
  max_attempts: number | null;
  grading_type: string | null;
  thumbnail_filename: string | null;
  content_json: Question[] | null;
  created_at: string;
  // relations
  courses?: { title: string };
  quiz_folders?: { name: string; color: string };
}

export interface Course {
  id: string;
  title: string;
}

export interface QuizFolder {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
  status: "published" | "draft" | "archived";
  grade_level: string | null;
  icon?: string | null;
  is_system?: boolean;
}

/** Bibliothèque de quiz admin : le dossier racine + tous les quiz (filtres
 * par défaut) arrivent déjà chargés du serveur ; naviguer dans les dossiers,
 * changer un filtre, et tout le CRUD restent des allers-retours client,
 * comme avant. */
export default function AdminQuizzesClient({
  initialFolders,
  initialAllQuizzes,
  initialAllFolderCounts,
  initialCourses,
}: {
  initialFolders: QuizFolder[];
  initialAllQuizzes: Quiz[];
  initialAllFolderCounts: { id: number; parent_id: number | null }[];
  initialCourses: Course[];
}) {
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialAllQuizzes.filter((q: any) => !q.folder_id));
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [folders, setFolders] = useState<QuizFolder[]>(initialFolders);
  const [allFolderCounts, setAllFolderCounts] = useState<{ id: number; parent_id: number | null }[]>(initialAllFolderCounts);
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>(initialAllQuizzes);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isFirstContentsFetch = useRef(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("admin_quizzes_folder");
  const [breadcrumbs, setBreadcrumbs] = useState<QuizFolder[]>([]);
  const currentFolderLevel = getEffectiveFolderLevel(breadcrumbs);

  // Drag and drop state
  const [draggedQuizId, setDraggedQuizId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [dragOverBreadcrumb, setDragOverBreadcrumb] = useState<
    number | "root" | null
  >(null);

  // Folder creation/edit state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<QuizFolder | null>(null);
  const [folderFormData, setFolderFormData] = useState({
    name: "",
    status: "draft" as "published" | "draft" | "archived",
    color: FOLDER_COLORS[0],
    grade_level: "6eme" as string,
    icon: "",
  });

  const importQuizRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImportQuiz = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImportFile(file);
  };

  const processImportFile = async (file: File) => {
    try {
      const data = await importFromJSONFile(file);
      if (data._type && data._type !== "quiz") { alert("Ce fichier n'est pas un quiz."); return; }
      setFormData({
        title: data.title || "",
        description: data.description || "",
        course_id: data.course_id || "",
        folder_id: data.folder_id || "",
        time_limit_minutes: data.time_limit_minutes || data.time_limit || 0,
        min_score_percent: data.min_score_percent || 0,
        difficulty_level: data.difficulty_level || "medium",
        type: data.type || "standard",
        level: data.level || "6eme",
        grading_type: data.grading_type || "auto",
        max_attempts: data.max_attempts || 0,
        status: data.status || "draft",
        thumbnail_filename: "",
        content_json: data.content_json || [],
      });
      setQuizEstimatedTime(data.estimated_time ?? 15);
      setEditingQuiz(data.id ? ({ id: data.id } as Quiz) : null);
      setIsModalOpen(true);
    } catch (err: any) { alert(err.message); }
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    course_id: "",
    folder_id: "" as string | number,
    time_limit_minutes: 0,
    min_score_percent: 0,
    difficulty_level: "medium",
    type: "standard",
    level: "6eme",
    grading_type: "auto",
    max_attempts: 0,
    status: "draft",
    thumbnail_filename: "",
    content_json: [] as Question[],
  });
  const [quizEstimatedTime, setQuizEstimatedTime] = useState(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // AI Generation state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const { startGeneration, onContentCreated } = useContentGenerations();

  // Une génération lancée depuis cette page (ou une autre, ou avant un
  // rechargement) rafraîchit la liste dès qu'elle aboutit à un quiz créé.
  useEffect(() => {
    return onContentCreated("quiz", () => {
      invalidateAdminCache("quizzes:");
      fetchContents(true);
      setAiSuccess("Quiz généré et enregistré directement en brouillon.");
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
      if (currentFolderId === null && statusFilter === "all" && courseFilter === "all" && difficultyFilter === "all") {
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
    }, 20000);
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
    const cacheKey = `quizzes:${currentFolderId}:${statusFilter}:${courseFilter}:${difficultyFilter}`;
    const cached = getAdminCache<{
      folders: QuizFolder[]; quizzes: Quiz[]; allQuizzes: Quiz[]; allFolderCounts: { id: number; parent_id: number | null }[];
    }>(cacheKey);
    if (!silent) {
      if (cached) {
        setFolders(cached.folders);
        setQuizzes(cached.quizzes);
        setAllQuizzes(cached.allQuizzes);
        setAllFolderCounts(cached.allFolderCounts);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }
    try {
      // 1. Fetch Folders
      let folderQuery = supabase.from("quiz_folders").select("*").order("name");

      if (currentFolderId === null) {
        folderQuery = folderQuery.is("parent_id", null);
      } else {
        folderQuery = folderQuery.eq("parent_id", currentFolderId);
      }

      if (statusFilter !== "all") {
        folderQuery = folderQuery.eq("status", statusFilter);
      }

      const { data: foldersData, error: foldersError } = await folderQuery;
      if (foldersError) console.warn("Folders error:", foldersError.message);

      // 2. Fetch Quizzes
      let url = "/api/admin/quizzes?";
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (courseFilter !== "all") url += `&course_id=${courseFilter}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch quizzes");
      }

      // Client-side filtering
      let filteredData = data as Quiz[];

      // Filter by current folder
      if (currentFolderId === null) {
        filteredData = filteredData.filter((q) => !q.folder_id);
      } else {
        filteredData = filteredData.filter(
          (q) => q.folder_id === currentFolderId
        );
      }

      if (difficultyFilter !== "all") {
        filteredData = filteredData.filter(
          (q) => q.difficulty_level === difficultyFilter
        );
      }

      setFolders(foldersData || []);
      setQuizzes(filteredData);
      setAllQuizzes(data as Quiz[]);

      const { data: allFoldersData } = await supabase
        .from("quiz_folders")
        .select("id, parent_id");
      setAllFolderCounts(allFoldersData || []);

      setAdminCache(cacheKey, {
        folders: foldersData || [],
        quizzes: filteredData,
        allQuizzes: data as Quiz[],
        allFolderCounts: allFoldersData || [],
      });

      // Update breadcrumbs
      if (currentFolderId !== null) {
        updateBreadcrumbs(currentFolderId);
      } else {
        setBreadcrumbs([]);
      }
    } catch (error: any) {
      console.error("Error fetching contents:", error?.message || error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateBreadcrumbs = async (folderId: number) => {
    try {
      const path: QuizFolder[] = [];
      let currentId: number | null = folderId;

      while (currentId !== null) {
        const { data } = await supabase
          .from("quiz_folders")
          .select("id, name, parent_id, color, status, grade_level, is_system")
          .eq("id", currentId)
          .single();

        if (data) {
          const folder = data as QuizFolder;
          path.unshift(folder);
          currentId = folder.parent_id;
        } else {
          break;
        }
      }
      setBreadcrumbs(path);
    } catch (e) {
      console.error("Error building breadcrumbs", e);
    }
  };

  const handleDragStart = (e: React.DragEvent, quizId: string) => {
    e.dataTransfer.setData("quizId", quizId);
    setDraggedQuizId(quizId);
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
  const isSelfOrDescendant = async (
    folderId: number,
    candidateId: number | null
  ): Promise<boolean> => {
    let currentId: number | null = candidateId;
    let guard = 0;
    while (currentId !== null && guard < 50) {
      if (currentId === folderId) return true;
      const { data } = await supabase
        .from("quiz_folders")
        .select("parent_id")
        .eq("id", currentId)
        .single();
      currentId = (data?.parent_id as number | null) ?? null;
      guard++;
    }
    return false;
  };

  // Moves a quiz or a folder (depending on dataTransfer payload)
  // into the target folder (null = root).
  const moveDroppedItem = async (
    e: React.DragEvent,
    targetFolderId: number | null
  ) => {
    const quizId = e.dataTransfer.getData("quizId");
    const folderId = e.dataTransfer.getData("folderId");

    try {
      if (quizId) {
        const response = await fetch("/api/admin/quizzes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: quizId,
            folder_id: targetFolderId,
          }),
        });

        if (!response.ok) throw new Error("Failed to move quiz");
        invalidateAdminCache("quizzes:");
        fetchContents();
      } else if (folderId) {
        if (targetFolderId !== null && Number(folderId) === targetFolderId)
          return;
        // Prevent cycles: target must not be the folder itself or a descendant
        if (await isSelfOrDescendant(Number(folderId), targetFolderId)) {
          alert("Impossible de déplacer un dossier dans lui-même ou un de ses sous-dossiers");
          return;
        }
        const { error } = await supabase
          .from("quiz_folders")
          .update({ parent_id: targetFolderId })
          .eq("id", Number(folderId));

        if (error) throw error;
        invalidateAdminCache("quizzes:");
        fetchContents();
      }
    } catch (error) {
      console.error("Error moving item:", error);
      alert("Erreur lors du déplacement");
    } finally {
      setDraggedQuizId(null);
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
    setDragOverBreadcrumb(null);
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
    const quizConflict = quizzes.some((q) => q.title.trim().toLowerCase() === normFolder);
    if (folderConflict || quizConflict) {
      alert("Un dossier ou un quiz porte déjà ce nom à cet emplacement.");
      return;
    }

    try {
      if (editingFolder) {
        const { error } = await supabase
          .from("quiz_folders")
          .update({
            name: folderFormData.name,
            status: folderFormData.status,
            color: folderFormData.color,
            grade_level: null,
            icon: folderFormData.icon || null,
          })
          .eq("id", editingFolder.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("quiz_folders").insert({
          name: folderFormData.name,
          parent_id: currentFolderId,
          status: folderFormData.status,
          color: folderFormData.color,
          grade_level: null,
          icon: folderFormData.icon || null,
        });

        if (error) throw error;
      }

      setFolderFormData({
        name: "",
        status: "draft",
        color: FOLDER_COLORS[0],
        grade_level: "6eme",
        icon: "",
      });
      setEditingFolder(null);
      setIsFolderModalOpen(false);
      invalidateAdminCache("quizzes:");
      fetchContents();
    } catch (error: any) {
      console.error("Error saving folder:", error);
      alert(
        "Erreur lors de l'enregistrement du dossier: " +
          (error?.message || JSON.stringify(error))
      );
    }
  };

  const handleDeleteFolder = async (folder: QuizFolder) => {
    if (
      !(await confirm(
        `Voulez-vous vraiment supprimer le dossier "${folder.name}" et tout son contenu ?`
      ))
    )
      return;

    try {
      const { error } = await supabase
        .from("quiz_folders")
        .delete()
        .eq("id", folder.id);

      if (error) throw error;
      invalidateAdminCache("quizzes:");
      fetchContents();
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Erreur lors de la suppression du dossier");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "uploads/quiz_thumbnails");

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");

      const filename = result.url.split("/").pop();
      setFormData((prev) => ({ ...prev, thumbnail_filename: filename }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur upload inconnue";
      alert("Erreur upload: " + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Génération en arrière-plan (même architecture que les cours/exercices) :
  // ferme le formulaire immédiatement et laisse le widget global (haut à
  // droite) suivre la progression — plus d'étape de validation manuelle, le
  // quiz final s'enregistre directement en brouillon.
  const handleAiGenerate = (params: QuizGenParams) => {
    setIsAiModalOpen(false);
    startGeneration("quiz", {
      linkedCourseId: params.linkedCourseId || null,
      subject: params.subject,
      level: currentFolderLevel || params.level || "6eme",
      difficulty: params.difficulty,
      questionCount: params.questionCount,
      instructions: params.instructions,
      folder_id: currentFolderId || null,
    }).then((id) => {
      if (!id) setAiError("Impossible de démarrer la génération. Réessaie.");
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normTitle = formData.title.trim().toLowerCase();
    const folderConflict = folders.some((f) => f.name.trim().toLowerCase() === normTitle);
    const quizConflict = quizzes.some(
      (q) => q.id !== editingQuiz?.id && q.title.trim().toLowerCase() === normTitle
    );
    if (folderConflict || quizConflict) {
      alert("Un dossier ou un quiz porte déjà ce nom à cet emplacement.");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = "/api/admin/quizzes";
      const method = editingQuiz ? "PUT" : "POST";
      const body = {
        ...formData,
        id: editingQuiz?.id,
        estimated_time: quizEstimatedTime,
        // Ensure numbers are numbers
        time_limit_minutes: formData.time_limit_minutes
          ? parseInt(String(formData.time_limit_minutes))
          : null,
        min_score_percent: formData.min_score_percent
          ? parseInt(String(formData.min_score_percent))
          : null,
        max_attempts: formData.max_attempts
          ? parseInt(String(formData.max_attempts))
          : null,
        // Handle empty strings for optional IDs
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
      invalidateAdminCache("quizzes:");
      fetchContents();
      setFormData({
        title: "",
        description: "",
        course_id: "",
        folder_id: currentFolderId || "",
        time_limit_minutes: 0,
        min_score_percent: 0,
        difficulty_level: "medium",
        type: "standard",
        level: currentFolderLevel || "6eme",
        grading_type: "auto",
        max_attempts: 0,
        status: "draft",
        thumbnail_filename: "",
        content_json: [],
      });
      setEditingQuiz(null);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Êtes-vous sûr de vouloir supprimer ce quiz ?"))) return;

    try {
      const response = await fetch(`/api/admin/quizzes?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Erreur lors de la suppression");
      }

      setQuizzes(quizzes.filter((q) => q.id !== id));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression";
      alert(errorMessage);
    }
  };

  // La liste ne charge plus content_json (trop volumineux pour un simple
  // aperçu de carte) : on le récupère à la demande, seulement quand une
  // action a besoin du contenu complet (édition, aperçu, export).
  const getFullQuiz = async (quiz: Quiz): Promise<Quiz> => {
    if (quiz.content_json) return quiz;
    const res = await fetch(`/api/admin/quizzes?id=${quiz.id}`);
    const full = await res.json();
    if (!res.ok) return quiz;
    const merge = (q: Quiz) => (q.id === quiz.id ? { ...q, content_json: full.content_json ?? [] } : q);
    setQuizzes((qs) => qs.map(merge));
    setAllQuizzes((qs) => qs.map(merge));
    return { ...quiz, content_json: full.content_json ?? [] };
  };

  const handlePreview = (quiz: Quiz) => {
    const previewData = {
      title: quiz.title,
      description: quiz.description || "",
      course_id: quiz.course_id || "",
      folder_id: quiz.folder_id || "",
      time_limit_minutes: quiz.time_limit_minutes || 0,
      min_score_percent: quiz.min_score_percent || 0,
      difficulty_level: quiz.difficulty_level || "medium",
      type: quiz.type || "standard",
      level: quiz.level || "6eme",
      grading_type: quiz.grading_type || "auto",
      max_attempts: quiz.max_attempts || 0,
      status: quiz.status,
      thumbnail_filename: quiz.thumbnail_filename || "",
      content_json: quiz.content_json || [],
    };

    localStorage.setItem("quiz_preview_data", JSON.stringify(previewData));
    window.open("/child/quiz/preview", "_blank");
  };

  const handleOpenModal = (quiz: Quiz | null = null) => {
    if (quiz) {
      setEditingQuiz(quiz);
      setFormData({
        title: quiz.title,
        description: quiz.description || "",
        course_id: quiz.course_id || "",
        folder_id: quiz.folder_id || "",
        time_limit_minutes: quiz.time_limit_minutes || 0,
        min_score_percent: quiz.min_score_percent || 0,
        difficulty_level: quiz.difficulty_level || "medium",
        type: quiz.type || "standard",
        level: quiz.level || "6eme",
        grading_type: quiz.grading_type || "auto",
        max_attempts: quiz.max_attempts || 0,
        status: quiz.status,
        thumbnail_filename: quiz.thumbnail_filename || "",
        content_json: quiz.content_json || [],
      });
    } else {
      setEditingQuiz(null);
      setFormData({
        title: "",
        description: "",
        course_id: "",
        folder_id: currentFolderId || "",
        time_limit_minutes: 0,
        min_score_percent: 0,
        difficulty_level: "medium",
        type: "standard",
        level: currentFolderLevel || "6eme",
        grading_type: "auto",
        max_attempts: 0,
        status: "draft",
        thumbnail_filename: "",
        content_json: [],
      });
    }
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

  const filteredQuizzes = quizzes.filter(
    (quiz) =>
      quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (quiz.description &&
        quiz.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={FileText}
        title="Gestion des Quiz"
        subtitle="Gérez les quiz, les questions et leur organisation"
        actions={
          <>
            <button
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
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-[var(--greek-blue)] border border-[var(--greek-blue)] rounded-xl hover:bg-blue-50 transition-colors shadow-sm"
            >
              <FolderPlus size={20} />
              Nouveau Dossier
            </button>
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--greek-gold)] text-white rounded-xl hover:bg-yellow-600 transition-colors shadow-lg shadow-yellow-900/10"
            >
              <Sparkles size={20} />
              Générer avec IA
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Upload size={18} /> JSON
            </button>
            <button
              onClick={() => {
                setEditingQuiz(null);
                setFormData({
                  title: "",
                  description: "",
                  course_id: "",
                  folder_id: currentFolderId || "",
                  time_limit_minutes: 0,
                  min_score_percent: 0,
                  difficulty_level: "medium",
                  type: "standard",
                  level: currentFolderLevel || "6eme",
                  grading_type: "auto",
                  max_attempts: 0,
                  status: "draft",
                  thumbnail_filename: "",
                  content_json: [],
                });
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/10"
            >
              <Plus size={20} />
              Nouveau Quiz
            </button>
          </>
        }
      />

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-x-auto">
        <button
          onClick={() => { setCurrentFolderId(null); setSearchQuery(""); }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverBreadcrumb("root");
          }}
          onDragLeave={() => setDragOverBreadcrumb(null)}
          onDrop={(e) => handleBreadcrumbDrop(e, null)}
          className={`flex items-center gap-1 px-2 py-1 hover:text-[var(--greek-blue)] transition-colors ${
            currentFolderId === null ? "font-bold text-[var(--greek-blue)]" : ""
          } ${
            dragOverBreadcrumb === "root"
              ? "bg-[var(--greek-gold)]/20 rounded-lg"
              : ""
          }`}
        >
          <Home size={16} />
          Racine
        </button>
        {breadcrumbs.map((folder, index) => (
          <div
            key={folder.id}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <ChevronRight size={14} className="text-gray-400" />
            <button
              onClick={() => { setCurrentFolderId(folder.id); setSearchQuery(""); }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverBreadcrumb(folder.id);
              }}
              onDragLeave={() => setDragOverBreadcrumb(null)}
              onDrop={(e) => handleBreadcrumbDrop(e, folder.id)}
              className={`px-2 py-1 hover:text-[var(--greek-blue)] transition-colors ${
                index === breadcrumbs.length - 1
                  ? "font-bold text-[var(--greek-blue)]"
                  : ""
              } ${
                dragOverBreadcrumb === folder.id
                  ? "bg-[var(--greek-gold)]/20 rounded-lg"
                  : ""
              }`}
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>

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
              placeholder="Rechercher un quiz..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <ThemedSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "Tous les statuts" },
                { value: "published", label: "Publié" },
                { value: "draft", label: "Brouillon" },
                { value: "archived", label: "Archivé" },
              ]}
              className="min-w-[160px]"
            />

            <ThemedSelect
              value={difficultyFilter}
              onChange={setDifficultyFilter}
              options={[
                { value: "all", label: "Toutes difficultés" },
                { value: "easy", label: "Facile" },
                { value: "medium", label: "Moyen" },
                { value: "hard", label: "Difficile" },
              ]}
              className="min-w-[160px]"
            />

            <ThemedSelect
              value={courseFilter}
              onChange={setCourseFilter}
              options={[
                { value: "all", label: "Tous les cours" },
                ...courses.map((c) => ({ value: c.id, label: c.title })),
              ]}
              className="w-48 max-w-[12rem]"
            />
          </div>
        </div>
      </div>

      {/* Quiz Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          <div className="col-span-full">
            <PageLoader />
          </div>
        ) : (
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
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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
                    className="p-1.5 text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit size={14} />
                  </button>
                  {!folder.is_system && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
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
                  const subCount = currentFolderId === null ? 0 : allFolderCounts.filter((f) => f.parent_id === folder.id).length;
                  const itemCount = allQuizzes.filter((q) => q.folder_id === folder.id).length;
                  if (subCount === 0 && itemCount === 0) return null;
                  const parts = [];
                  if (subCount > 0) parts.push(`${subCount} dossier${subCount > 1 ? "s" : ""}`);
                  if (itemCount > 0) parts.push(`${itemCount} quiz`);
                  return (
                    <p className="text-xs text-gray-400 mt-1">{parts.join(" · ")}</p>
                  );
                })()}
              </div>
              );
            })}

            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                draggable
                onDragStart={(e) => handleDragStart(e, quiz.id)}
                onDragEnd={() => setDraggedQuizId(null)}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-shadow group cursor-move ${
                  draggedQuizId === quiz.id
                    ? "border-[var(--greek-blue)] opacity-50 border-2 border-dashed"
                    : "border-[rgba(197,161,72,0.25)] hover:shadow-md"
                }`}
              >
                <div className="relative h-40 bg-gray-100">
                  {quiz.thumbnail_filename ? (
                    <img
                      src={`/uploads/quiz_thumbnails/${quiz.thumbnail_filename}`}
                      alt={quiz.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes("http")) {
                          // prevent infinite loop
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <FileText size={48} />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(quiz.status)}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1">
                      <BookOpen size={12} />
                      {quiz.courses?.title || "Sans cours"}
                    </span>
                    {quiz.time_limit_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {quiz.time_limit_minutes} min
                      </span>
                    )}
                  </div>

                  <h3
                    className="font-semibold text-gray-900 mb-1 line-clamp-1"
                    title={quiz.title}
                  >
                    {quiz.title}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                    {quiz.description || "Aucune description"}
                  </p>

                  <div className="flex justify-between items-center pt-2 border-t border-[rgba(197,161,72,0.25)]">
                    <span className="text-xs text-gray-400">
                      {new Date(quiz.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={async () => handlePreview(await getFullQuiz(quiz))}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Prévisualiser"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={async () => handleOpenModal(await getFullQuiz(quiz))}
                        className="p-1.5 text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          const full = await getFullQuiz(quiz);
                          exportAsJSON(full, "quiz", full.title);
                        }}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Exporter JSON"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredQuizzes.length === 0 && filteredFolders.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                Aucun contenu dans ce dossier
              </div>
            )}
          </>
        )}
      </div>

      {/* Folder Creation/Edit Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)] flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">
                {editingFolder ? "Modifier le dossier" : "Nouveau Dossier"}
              </h3>
              <button
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
                className="group p-2 text-gray-400 hover:text-gray-600 transition-colors relative z-10"
                aria-label="Fermer"
              >
                <X size={22} className="transition-transform group-hover:scale-125" />
              </button>
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
                <button
                  type="button"
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
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!folderFormData.name.trim()}
                  className="px-4 py-2 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50"
                >
                  {editingFolder ? "Sauvegarder" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline AI success */}
      {aiSuccess && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-start gap-2">
          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Quiz généré</p>
            <p className="opacity-90">{aiSuccess}</p>
          </div>
          <button
            onClick={() => setAiSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
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
          <button
            onClick={() => setAiError(null)}
            className="text-red-700 hover:text-red-900"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Modal AI Generator */}
      {isAiModalOpen && (
        <QuizGeneratorModal
          onGenerate={handleAiGenerate}
          onClose={() => setIsAiModalOpen(false)}
          defaultLevel={currentFolderLevel || undefined}
        />
      )}

      {/* Modal Création/Édition */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1060] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <BrainCircuit size={22} className="text-[var(--greek-gold)]" />
                <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">
                  {editingQuiz ? "Modifier le quiz" : "Nouveau quiz"}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="group p-2 text-white/70 hover:text-white transition-colors relative z-10">
                <X size={22} className="transition-transform group-hover:scale-125" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {/* Section 1: Informations */}
                <div className="p-6 border-b border-[rgba(197,161,72,0.25)]">
                  <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">1</span>
                    Informations générales
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Titre du quiz</label>
                      <input
                        type="text" required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-gray-50 font-medium"
                        placeholder="Ex: Les équations du second degré"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cours associé</label>
                        <select
                          value={formData.course_id}
                          onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                          className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50"
                        >
                          <option value="">Aucun</option>
                          {courses.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
                        </select>
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
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                      <textarea
                        rows={2}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50 resize-none"
                        placeholder="Description du quiz..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Image miniature</label>
                      {formData.thumbnail_filename ? (
                        <div className="relative w-full h-20 bg-gray-100 rounded-lg overflow-hidden border border-[rgba(197,161,72,0.25)] mb-2">
                          <img
                            src={`/uploads/quiz_thumbnails/${formData.thumbnail_filename}`}
                            alt="Aperçu"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, thumbnail_filename: "" })}
                            className="absolute top-1.5 right-1.5 p-1 bg-white rounded-full shadow-sm text-gray-500 hover:text-red-500"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium border border-dashed border-[rgba(197,161,72,0.25)]">
                          <ImageIcon size={16} />
                          {uploading ? "Upload..." : "Choisir une image"}
                          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                        </label>
                      )}
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
                      {!editingQuiz && currentFolderLevel ? (
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
                      <div className="flex gap-1.5">
                        {[{ v: "easy", l: "Facile", c: "text-green-700 border-green-300 bg-green-50" }, { v: "medium", l: "Moyen", c: "text-blue-700 border-blue-300 bg-blue-50" }, { v: "hard", l: "Difficile", c: "text-red-700 border-red-300 bg-red-50" }].map((d) => (
                          <button key={d.v} type="button" onClick={() => setFormData({ ...formData, difficulty_level: d.v as any })}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl border-2 transition-all ${formData.difficulty_level === d.v ? d.c + " shadow-sm" : "text-gray-400 border-[rgba(197,161,72,0.25)] bg-white"}`}>
                            {d.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durée estimée</label>
                      <select
                        value={quizEstimatedTime}
                        onChange={(e) => setQuizEstimatedTime(parseInt(e.target.value))}
                        className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                      >
                        {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => (<option key={m} value={m}>{m} min</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Statut</label>
                      <div className="flex gap-1.5">
                        {[{ v: "draft", l: "Brouillon" }, { v: "published", l: "Publié" }, { v: "archived", l: "Archivé" }].map((s) => (
                          <button key={s.v} type="button" onClick={() => setFormData({ ...formData, status: s.v as "draft" | "published" | "archived" })}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl border-2 transition-all ${formData.status === s.v ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]" : "text-gray-400 border-[rgba(197,161,72,0.25)] bg-white"}`}>
                            {s.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correction</label>
                      <select
                        value={formData.grading_type}
                        onChange={(e) => setFormData({ ...formData, grading_type: e.target.value as any })}
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
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                      >
                        <option value="standard">Standard</option>
                        <option value="speed">Vitesse</option>
                        <option value="practice">Entraînement</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Durée (minutes)</label>
                      <input
                        type="number" min="0"
                        value={formData.time_limit_minutes}
                        onChange={(e) => setFormData({ ...formData, time_limit_minutes: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                        placeholder="0 = illimité"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Score minimum requis (%)</label>
                      <input
                        type="number" min="0" max="100"
                        value={formData.min_score_percent}
                        onChange={(e) => setFormData({ ...formData, min_score_percent: parseInt(e.target.value) || 0 })}
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

                {/* Section 3: Questions */}
                <div className="p-6">
                  <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">3</span>
                    Questions du quiz
                  </h3>
                  <QuizBuilder
                    initialQuestions={formData.content_json || []}
                    level={formData.level}
                    onChange={(questions) => setFormData({ ...formData, content_json: questions })}
                    onMetadataChange={(metadata) => {
                      setFormData((prev) => ({
                        ...prev,
                        title: metadata.title || prev.title,
                        description: metadata.description || prev.description,
                        time_limit_minutes: metadata.time_limit || prev.time_limit_minutes,
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-[rgba(197,161,72,0.25)] bg-white flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handlePreview({ 
                    id: editingQuiz?.id || "",
                    title: formData.title,
                    description: formData.description,
                    course_id: formData.course_id,
                    folder_id: typeof formData.folder_id === "number" ? formData.folder_id : null,
                    time_limit_minutes: formData.time_limit_minutes,
                    min_score_percent: formData.min_score_percent,
                    status: formData.status as any,
                    type: formData.type,
                    difficulty_level: formData.difficulty_level,
                    level: formData.level,
                    max_attempts: formData.max_attempts,
                    grading_type: formData.grading_type,
                    thumbnail_filename: formData.thumbnail_filename,
                    content_json: formData.content_json,
                    created_at: new Date().toISOString()
                  })}
                  className="px-5 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-2 mr-auto border border-blue-200"
                >
                  <Eye className="w-4 h-4" />
                  Prévisualiser
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors border border-[rgba(197,161,72,0.25)]">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="px-8 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-[var(--greek-blue)]/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-900/20">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingQuiz ? "Mettre à jour" : "Créer le quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}





      {/* Preview Modal removed in favor of tab-based preview */}

      {showImportModal && (
        <ImportJsonModal
          label="quiz"
          onClose={() => setShowImportModal(false)}
          onFileLoaded={processImportFile}
          template={QUIZ_JSON_TEMPLATE}
          templateFilename="modele_quiz.json"
        />
      )}
    </div>
  );
}

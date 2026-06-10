"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import ExerciseGeneratorModal, { ExerciseGenParams, AIGenerateProgress } from "@/components/admin/ExerciseGeneratorModal";
import ExerciseBuilder, { Page } from "@/components/admin/ExerciseBuilder";
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
  BookOpen,
  Zap,
  GraduationCap,
  Sparkles,
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
} from "lucide-react";
import ExerciseViewer from "@/components/viewers/ExerciseViewer";
import ImportJsonModal from "@/components/admin/ImportJsonModal";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { exportAsJSON, importFromJSONFile } from "@/lib/jsonIO";
import { EXERCISE_JSON_TEMPLATE } from "@/lib/jsonTemplates";

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
];

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
];

const getFolderIcon = (iconName?: string | null) => {
  const found = FOLDER_ICONS.find((i) => i.name === iconName);
  return found ? found.Icon : Folder;
};

const EXERCISE_TYPES = [
  { value: "standard", label: "Standard (Calcul/Réponse libre)" },
  { value: "qcm", label: "QCM (Choix unique/multiple)" },
  { value: "fill_in_the_blank", label: "Texte à trous" },
  { value: "matching", label: "Association / Relier" },
  { value: "ordering", label: "Mise en ordre" },
  { value: "coding", label: "Code / Algo" },
];

interface Exercise {
  id: string;
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
  min_score_percent: number | null;
  max_attempts: number | null;
  created_at: string;
  content_json: Page[] | null;
  // relations
  courses?: { title: string };
  exercise_folders?: { name: string; color: string };
}

interface Course {
  id: string;
  title: string;
}

interface ExerciseFolder {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
  status: "published" | "draft" | "archived";
  grade_level: string | null;
  icon?: string | null;
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
  min_score_percent: number;
  max_attempts: number;
  content_json: Page[];
}

export default function AdminExercisesPage() {
  const confirm = useConfirm();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [folders, setFolders] = useState<ExerciseFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<ExerciseFolder[]>([]);

  // Drag and drop state
  const [draggedExerciseId, setDraggedExerciseId] = useState<string | null>(
    null
  );
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [dragOverBreadcrumb, setDragOverBreadcrumb] = useState<
    number | "root" | null
  >(null);

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
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");

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
      setFormData({
        title: data.title || "",
        description: data.description || "",
        course_id: "",
        difficulty_level: "medium",
        type: data.type || "standard",
        level: data.level || "6eme",
        grading_type: "auto",
        status: data.status || "draft",
        thumbnail_url: data.thumbnail_url || "",
        folder_id: "",
        time_limit: data.time_limit || 0,
        time_limit_minutes: data.time_limit_minutes || 0,
        min_score_percent: data.min_score_percent || 0,
        max_attempts: data.max_attempts || 0,
        content_json: data.content_json || [],
      });
      setIsModalOpen(true);
    } catch (err: any) { alert(err.message); }
  };

  // AI Generation state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState<AIGenerateProgress | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchContents();
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

  const fetchContents = async () => {
    setLoading(true);
    try {
      // 1. Fetch Folders
      let folderQuery = supabase
        .from("exercise_folders")
        .select("*")
        .order("name");

      if (currentFolderId === null) {
        folderQuery = folderQuery.is("parent_id", null);
      } else {
        folderQuery = folderQuery.eq("parent_id", currentFolderId);
      }

      const { data: foldersData, error: foldersError } = await folderQuery;
      if (foldersError) console.warn("Folders error:", foldersError.message);

      // 2. Fetch Exercises
      let url = "/api/admin/exercises?";
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (courseFilter !== "all") url += `&course_id=${courseFilter}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch exercises");
      }

      // Client-side filtering
      let filteredData = data;

      // Filter by current folder
      if (currentFolderId === null) {
        filteredData = filteredData.filter((ex: any) => !ex.folder_id);
      } else {
        filteredData = filteredData.filter(
          (ex: any) => ex.folder_id === currentFolderId
        );
      }

      if (difficultyFilter !== "all") {
        filteredData = filteredData.filter(
          (ex: any) => ex.difficulty_level === difficultyFilter
        );
      }

      setFolders(foldersData || []);
      setExercises(filteredData as Exercise[]);

      // Update breadcrumbs
      if (currentFolderId !== null) {
        updateBreadcrumbs(currentFolderId);
      } else {
        setBreadcrumbs([]);
      }
    } catch (error: any) {
      console.error("Error fetching contents:", error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const updateBreadcrumbs = async (folderId: number) => {
    try {
      const path: ExerciseFolder[] = [];
      let currentId: number | null = folderId;

      while (currentId !== null) {
        const { data } = await supabase
          .from("exercise_folders")
          .select("id, name, parent_id, color, status")
          .eq("id", currentId)
          .single();

        if (data) {
          const folder = data as ExerciseFolder;
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
  const isSelfOrDescendant = async (
    folderId: number,
    candidateId: number | null
  ): Promise<boolean> => {
    let currentId: number | null = candidateId;
    let guard = 0;
    while (currentId !== null && guard < 50) {
      if (currentId === folderId) return true;
      const { data } = await supabase
        .from("exercise_folders")
        .select("parent_id")
        .eq("id", currentId)
        .single();
      currentId = (data?.parent_id as number | null) ?? null;
      guard++;
    }
    return false;
  };

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
          .from("exercise_folders")
          .update({ parent_id: targetFolderId })
          .eq("id", Number(folderId));

        if (error) throw error;
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
    setDragOverBreadcrumb(null);
    await moveDroppedItem(e, targetFolderId);
  };

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderFormData.name.trim()) return;

    try {
      if (editingFolder) {
        const { error } = await supabase
          .from("exercise_folders")
          .update({
            name: folderFormData.name,
            status: folderFormData.status,
            color: folderFormData.color,
            grade_level: folderFormData.grade_level,
            icon: folderFormData.icon || null,
          })
          .eq("id", editingFolder.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("exercise_folders").insert({
          name: folderFormData.name,
          parent_id: currentFolderId,
          status: folderFormData.status,
          color: folderFormData.color,
          grade_level: folderFormData.grade_level,
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

    try {
      const { error } = await supabase
        .from("exercise_folders")
        .delete()
        .eq("id", folder.id);

      if (error) throw error;
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

  const handlePreview = (exercise: Exercise) => {
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
      min_score_percent: exercise.min_score_percent || 0,
      max_attempts: exercise.max_attempts || 0,
      content_json: exercise.content_json || [],
    };

    localStorage.setItem("exercise_preview_data", JSON.stringify(previewData));
    window.open("/child/exercises/preview", "_blank");
  };

  const handleAiGenerate = async (params: ExerciseGenParams) => {
    setIsGenerating(true);
    setAiError(null);
    setAiProgress({ current: 0, total: 0, message: "Préparation de l'exercice...", chapters: [] });

    try {
      const response = await fetch("/api/admin/generate-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Generation failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "progress") {
            setAiProgress((prev) => ({
              current: evt.current,
              total: evt.total,
              message: evt.message,
              chapters: prev?.chapters || [],
            }));
            if (evt.step === "chapter" && evt.current > 0) {
              setAiProgress((prev) => ({
                current: evt.current,
                total: evt.total,
                message: evt.message,
                chapters: [...(prev?.chapters || []), evt.message].slice(-evt.total),
              }));
            }
          } else if (evt.type === "done") {
            result = evt.data;
          } else if (evt.type === "error") {
            throw new Error(evt.message || "Erreur de génération");
          }
        }
      }

      if (!result) throw new Error("Aucune donnée générée");

      const content = result.content;
      const metadata = result.metadata;

      setFormData({
        title: metadata?.title || `Exercice : ${params.subject}`,
        description: metadata?.description || "",
        course_id: params.linkedCourseId || "",
        folder_id: currentFolderId || "",
        difficulty_level:
          (params.difficulty as "easy" | "medium" | "hard") ||
          metadata?.difficulty_level ||
          "medium",
        type: metadata?.type || "standard",
        level: params.level || metadata?.level || "6eme",
        grading_type: metadata?.grading_type || "ai",
        status: "draft",
        thumbnail_url: "",
        time_limit: metadata?.time_limit || 0,
        time_limit_minutes: metadata?.time_limit_minutes || 0,
        min_score_percent: metadata?.min_score_percent || 0,
        max_attempts: metadata?.max_attempts || 0,
        content_json: content || [],
      });

      setIsAiModalOpen(false);
      setEditingExercise(null);
      setIsModalOpen(true);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur IA inconnue";
      setAiError(errorMessage);
    } finally {
      setIsGenerating(false);
      setAiProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      folder_id: "",
      difficulty_level: "medium",
      type: "standard",
      level: "6eme",
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
    switch (level) {
      case "easy":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
            Facile
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
            Moyen
          </span>
        );
      case "hard":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
            Difficile
          </span>
        );
      default:
        return null;
    }
  };

  const filteredExercises = exercises.filter(
    (ex) =>
      ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ex.question &&
        ex.question.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <GraduationCap className="text-[var(--greek-gold)]" size={32} />
              Gestion des Exercices
            </h1>
            <p className="text-[var(--greek-bronze)] text-lg">
              Gérez les exercices et leur contenu
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setEditingFolder(null);
                setFolderFormData({
                  name: "",
                  status: "draft",
                  color: FOLDER_COLORS[0],
                  grade_level: "6eme",
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
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/10"
            >
              <Plus size={20} />
              Nouvel Exercice
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-x-auto">
        <button
          onClick={() => setCurrentFolderId(null)}
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
              onClick={() => setCurrentFolderId(folder.id)}
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
              placeholder="Rechercher un exercice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
            >
              <option value="all">Tous les statuts</option>
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
              <option value="archived">Archivé</option>
            </select>

            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
            >
              <option value="all">Toutes difficultés</option>
              <option value="easy">Facile</option>
              <option value="medium">Moyen</option>
              <option value="hard">Difficile</option>
            </select>

            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
            >
              <option value="all">Tous les cours</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Exercises Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-4 animate-pulse h-64"
            >
              <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))
        ) : (
          <>
            {/* Folders */}
            {folders.map((folder) => {
              const FolderCardIcon = getFolderIcon(folder.icon);
              return (
              <div
                key={`folder-${folder.id}`}
                draggable
                onDragStart={(e) => handleFolderDragStart(e, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
                onClick={() => setCurrentFolderId(folder.id)}
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
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  {folder.status === "published"
                    ? "Publié"
                    : folder.status === "archived"
                    ? "Archivé"
                    : "Brouillon"}
                </p>
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
                      <button
                        onClick={() => handlePreview(exercise)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Prévisualiser"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(exercise)}
                        className="p-1.5 text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => exportAsJSON(exercise, "exercise", exercise.title)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Exporter JSON"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(exercise.id)}
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

            {filteredExercises.length === 0 && folders.length === 0 && (
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
                  Niveau du dossier
                </label>
                <select
                  value={folderFormData.grade_level}
                  onChange={(e) =>
                    setFolderFormData({
                      ...folderFormData,
                      grade_level: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  <option value="all">Tous niveaux</option>
                  {SCHOOL_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
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
        <ExerciseGeneratorModal
          onGenerate={handleAiGenerate}
          onClose={() => setIsAiModalOpen(false)}
          progress={aiProgress}
        />
      )}

      {/* Modal Création/Édition - Full Screen */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1060] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-8 py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <GraduationCap size={24} className="text-[var(--greek-gold)]" />
                <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
                  {editingExercise ? "Modifier l'exercice" : "Nouvel exercice"}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="group p-2 text-white/70 hover:text-white transition-colors relative z-10">
                <X size={22} className="transition-transform group-hover:scale-125" />
              </button>
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
                        placeholder="Ex: Maths — Les fractions (CP)"
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
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Image miniature</label>
                        {formData.thumbnail_url && (
                          <div className="relative w-full h-20 bg-gray-100 rounded-lg overflow-hidden border border-[rgba(197,161,72,0.25)] mb-2">
                            <img src={formData.thumbnail_url} alt="Aperçu" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-exercise.png"; }} />
                            <button type="button" onClick={() => setFormData({ ...formData, thumbnail_url: "" })} className="absolute top-1.5 right-1.5 p-1 bg-white rounded-full shadow-sm text-gray-500 hover:text-red-500">
                              <XCircle size={16} />
                            </button>
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
                      <select
                        value={formData.level}
                        onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                        className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                      >
                        {SCHOOL_LEVELS.map((level) => (<option key={level.value} value={level.value}>{level.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Difficulté</label>
                      <div className="flex gap-1.5">
                        {[{ v: "easy", l: "Facile", c: "text-green-700 border-green-300 bg-green-50" }, { v: "medium", l: "Moyen", c: "text-blue-700 border-blue-300 bg-blue-50" }, { v: "hard", l: "Difficile", c: "text-red-700 border-red-300 bg-red-50" }].map((d) => (
                          <button key={d.v} type="button" onClick={() => setFormData({ ...formData, difficulty_level: d.v as "easy" | "medium" | "hard" })}
                            className={`flex-1 py-2.5 text-xs font-bold rounded-xl border-2 transition-all ${formData.difficulty_level === d.v ? d.c + " shadow-sm" : "text-gray-400 border-[rgba(197,161,72,0.25)] bg-white"}`}>
                            {d.l}
                          </button>
                        ))}
                      </div>
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

                {/* Section 3: Contenu */}
                <div className="p-6">
                  <h3 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">3</span>
                    Contenu de l'exercice
                  </h3>
                  <ExerciseBuilder
                    initialContent={formData.content_json || []}
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
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors border border-[rgba(197,161,72,0.25)]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-[var(--greek-blue)]/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-900/20"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingExercise ? "Mettre à jour" : "Créer l'exercice"}
                </button>
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



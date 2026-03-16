"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import AIGeneratorModal from "@/components/admin/AIGeneratorModal";
import QuizBuilder, { Question } from "@/components/admin/QuizBuilder";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  FileText,
  Clock,
  Folder,
  FolderPlus,
  ChevronRight,
  Home,
  ImageIcon,
  XCircle,
  BookOpen,
  Sparkles,
  Loader2,
  Eye,
} from "lucide-react";
import QuizViewer from "@/components/viewers/QuizViewer";
import { SCHOOL_LEVELS } from "@/lib/constants";

const FOLDER_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

const QUIZ_TYPES = [
  { value: "standard", label: "Standard (Mélange)" },
  { value: "exam", label: "Examen / Évaluation" },
  { value: "practice", label: "Entraînement / Révision" },
  { value: "homework", label: "Devoir Maison" },
];

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  course_id: string | null;
  folder_id: number | null;
  time_limit_minutes: number | null;
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

interface Course {
  id: string;
  title: string;
}

interface QuizFolder {
  id: number;
  name: string;
  color: string;
  parent_id: number | null;
  status: "published" | "draft" | "archived";
}

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [folders, setFolders] = useState<QuizFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<QuizFolder[]>([]);

  // Drag and drop state
  const [draggedQuizId, setDraggedQuizId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);

  // Folder creation/edit state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<QuizFolder | null>(null);
  const [folderFormData, setFolderFormData] = useState({
    name: "",
    status: "draft" as "published" | "draft" | "archived",
    color: FOLDER_COLORS[0],
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    course_id: "",
    folder_id: "" as string | number,
    time_limit_minutes: 0,
    difficulty_level: "moyen",
    type: "standard",
    level: "6eme",
    grading_type: "auto",
    max_attempts: 0,
    status: "draft",
    thumbnail_filename: "",
    content_json: [] as Question[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // AI Generation state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchContents();
  }, [statusFilter, courseFilter, currentFolderId]);

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
      if (foldersError) throw foldersError;

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

      setFolders(foldersData || []);
      setQuizzes(filteredData);

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
      const path: QuizFolder[] = [];
      let currentId: number | null = folderId;

      while (currentId !== null) {
        const { data } = await supabase
          .from("quiz_folders")
          .select("id, name, parent_id, color, status")
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

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: number) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const quizId = e.dataTransfer.getData("quizId");

    if (!quizId) return;

    try {
      // Update quiz folder_id
      const response = await fetch("/api/admin/quizzes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quizId,
          folder_id: targetFolderId,
        }),
      });

      if (!response.ok) throw new Error("Failed to move quiz");

      // Refresh to show quiz moved
      fetchContents();
    } catch (error) {
      console.error("Error moving quiz:", error);
      alert("Erreur lors du déplacement du quiz");
    } finally {
      setDraggedQuizId(null);
    }
  };

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderFormData.name.trim()) return;

    try {
      if (editingFolder) {
        const { error } = await supabase
          .from("quiz_folders")
          .update({
            name: folderFormData.name,
            status: folderFormData.status,
            color: folderFormData.color,
          })
          .eq("id", editingFolder.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("quiz_folders").insert({
          name: folderFormData.name,
          parent_id: currentFolderId,
          status: folderFormData.status,
          color: folderFormData.color,
        });

        if (error) throw error;
      }

      setFolderFormData({
        name: "",
        status: "draft",
        color: FOLDER_COLORS[0],
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

  const handleDeleteFolder = async (folder: QuizFolder) => {
    if (
      !confirm(
        `Voulez-vous vraiment supprimer le dossier "${folder.name}" et tout son contenu ?`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("quiz_folders")
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

  const handleAiGenerate = async (params: any) => {
    try {
      const response = await fetch("/api/admin/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Generation failed");
      }

      // Handle new response structure
      const content = data.data.content || data.data; // Fallback
      const metadata = data.data.metadata;

      setFormData({
        title: metadata?.title || "Quiz généré par IA",
        description: metadata?.description || "",
        course_id: "",
        folder_id: currentFolderId || "",
        time_limit_minutes: metadata?.time_limit || 10,
        difficulty_level: metadata?.difficulty_level || "moyen",
        type: metadata?.type || "standard",
        level: metadata?.level || "6eme",
        grading_type: metadata?.grading_type || "auto",
        max_attempts: metadata?.max_attempts || 0,
        status: "draft",
        thumbnail_filename: "",
        content_json: content || [],
      });

      setIsAiModalOpen(false);
      setEditingQuiz(null); // Ensure we are in create mode
      setIsModalOpen(true);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur IA inconnue";
      alert("Erreur IA: " + errorMessage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = "/api/admin/quizzes";
      const method = editingQuiz ? "PUT" : "POST";
      const body = {
        ...formData,
        id: editingQuiz?.id,
        // Ensure numbers are numbers
        time_limit_minutes: formData.time_limit_minutes
          ? parseInt(String(formData.time_limit_minutes))
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
      fetchContents();
      setFormData({
        title: "",
        description: "",
        course_id: "",
        folder_id: "",
        time_limit_minutes: 0,
        difficulty_level: "moyen",
        type: "standard",
        level: "6eme",
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
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce quiz ?")) return;

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

  const handlePreview = (quiz: Quiz) => {
    const previewData = {
      title: quiz.title,
      description: quiz.description || "",
      course_id: quiz.course_id || "",
      folder_id: quiz.folder_id || "",
      time_limit_minutes: quiz.time_limit_minutes || 0,
      difficulty_level: quiz.difficulty_level || "moyen",
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
        difficulty_level: quiz.difficulty_level || "moyen",
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
        folder_id: "",
        time_limit_minutes: 0,
        difficulty_level: "moyen",
        type: "standard",
        level: "6eme",
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <FileText className="text-[var(--greek-gold)]" size={32} />
              Gestion des Quiz
            </h1>
            <p className="text-[var(--greek-bronze)] text-lg">
              Gérez les quiz, les questions et leur organisation
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingFolder(null);
                setFolderFormData({
                  name: "",
                  status: "draft",
                  color: FOLDER_COLORS[0],
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
              className="flex items-center gap-2 px-4 py-3 bg-[var(--greek-gold)] text-white rounded-xl hover:bg-yellow-600 transition-colors shadow-lg shadow-yellow-900/10"
            >
              <Sparkles size={20} />
              Générer avec IA
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
                  difficulty_level: "moyen",
                  type: "standard",
                  level: "6eme",
                  grading_type: "auto",
                  max_attempts: 0,
                  status: "draft",
                  thumbnail_filename: "",
                  content_json: [],
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/10"
            >
              <Plus size={20} />
              Nouveau Quiz
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <button
          onClick={() => setCurrentFolderId(null)}
          className={`flex items-center gap-1 hover:text-[var(--greek-blue)] transition-colors ${
            currentFolderId === null ? "font-bold text-[var(--greek-blue)]" : ""
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
              className={`hover:text-[var(--greek-blue)] transition-colors ${
                index === breadcrumbs.length - 1
                  ? "font-bold text-[var(--greek-blue)]"
                  : ""
              }`}
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[20px] shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Rechercher un quiz..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 min-w-[140px]"
            >
              <option value="all">Tous les statuts</option>
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
              <option value="archived">Archivé</option>
            </select>

            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 min-w-[160px]"
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

      {/* Quiz Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-pulse h-64"
            >
              <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))
        ) : (
          <>
            {/* Folders */}
            {folders.map((folder) => (
              <div
                key={`folder-${folder.id}`}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
                onClick={() => setCurrentFolderId(folder.id)}
                className={`bg-white rounded-2xl p-6 shadow-sm border transition-all group cursor-pointer relative overflow-hidden flex flex-col items-center justify-center text-center aspect-[4/3]
                  ${
                    dragOverFolderId === folder.id
                      ? "border-[var(--greek-blue)] ring-2 ring-[var(--greek-blue)]/20 bg-blue-50"
                      : "border-gray-100 hover:shadow-lg hover:-translate-y-1"
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
                      });
                      setIsFolderModalOpen(true);
                    }}
                    className="p-1.5 bg-white text-gray-400 hover:text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg shadow-sm border border-gray-100"
                    title="Modifier"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder);
                    }}
                    className="p-1.5 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg shadow-sm border border-gray-100"
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
                  <Folder size={32} fill="currentColor" fillOpacity={0.2} />
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
            ))}

            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                draggable
                onDragStart={(e) => handleDragStart(e, quiz.id)}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-shadow group cursor-move ${
                  draggedQuizId === quiz.id
                    ? "border-[var(--greek-blue)] opacity-50 border-2 border-dashed"
                    : "border-gray-200 hover:shadow-md"
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

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {new Date(quiz.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handlePreview(quiz)}
                        className="p-1.5 text-gray-500 hover:text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Prévisualiser"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleOpenModal(quiz)}
                        className="p-1.5 text-gray-500 hover:text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredQuizzes.length === 0 && folders.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                Aucun contenu dans ce dossier
              </div>
            )}
          </>
        )}
      </div>

      {/* Folder Creation/Edit Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editingFolder ? "Modifier le dossier" : "Nouveau Dossier"}
            </h2>
            <form onSubmit={handleSaveFolder}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du dossier
                </label>
                <input
                  type="text"
                  value={folderFormData.name}
                  onChange={(e) =>
                    setFolderFormData({
                      ...folderFormData,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] outline-none"
                  placeholder="Ex: Mathématiques"
                  autoFocus
                />
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] outline-none bg-white"
                >
                  <option value="draft">Brouillon</option>
                  <option value="published">Publié</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFolderModalOpen(false);
                    setEditingFolder(null);
                    setFolderFormData({
                      name: "",
                      status: "draft",
                      color: FOLDER_COLORS[0],
                    });
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!folderFormData.name.trim()}
                  className="px-4 py-2 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {editingFolder ? "Sauvegarder" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal AI Generator */}
      {isAiModalOpen && (
        <AIGeneratorModal
          type="quiz"
          onGenerate={handleAiGenerate}
          onClose={() => setIsAiModalOpen(false)}
        />
      )}

      {/* Modal Création/Édition */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingQuiz ? "Modifier le quiz" : "Nouveau quiz"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Titre
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      placeholder="Ex: Les équations du second degré"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cours associé
                    </label>
                    <select
                      value={formData.course_id}
                      onChange={(e) =>
                        setFormData({ ...formData, course_id: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                    >
                      <option value="">Sélectionner un cours</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dossier
                    </label>
                    <select
                      value={formData.folder_id}
                      onChange={(e) =>
                        setFormData({ ...formData, folder_id: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                    >
                      <option value="">Aucun (Racine)</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Niveau
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                    >
                      {SCHOOL_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={formData.type || "standard"}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      >
                        {QUIZ_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notation
                      </label>
                      <select
                        value={formData.grading_type || "auto"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            grading_type: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      >
                        <option value="auto">Automatique</option>
                        <option value="manual">Manuelle</option>
                        <option value="mixed">Mixte</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Durée (min)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.time_limit_minutes}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            time_limit_minutes: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tentatives max
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.max_attempts}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            max_attempts: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0 = illimité"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Difficulté
                      </label>
                      <select
                        value={formData.difficulty_level || "medium"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            difficulty_level: e.target.value as any,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      >
                        <option value="easy">Facile</option>
                        <option value="medium">Moyen</option>
                        <option value="hard">Difficile</option>
                        <option value="expert">Expert</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Statut
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as
                              | "published"
                              | "draft"
                              | "archived",
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                      >
                        <option value="draft">Brouillon</option>
                        <option value="published">Publié</option>
                        <option value="archived">Archivé</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={4}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 resize-none"
                      placeholder="Description du quiz..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image miniature
                    </label>
                    <div className="space-y-3">
                      {formData.thumbnail_filename && (
                        <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={`/uploads/quiz_thumbnails/${formData.thumbnail_filename}`}
                            alt="Aperçu"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                formData.thumbnail_filename || "";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                thumbnail_filename: "",
                              })
                            }
                            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm text-gray-500 hover:text-red-500"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium w-full justify-center border border-dashed border-gray-300">
                          <ImageIcon size={18} />
                          {uploading
                            ? "Upload en cours..."
                            : "Choisir une image"}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        Recommandé : 800x600px, JPG/PNG
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quiz Builder */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Questions du Quiz
                </h3>
                <QuizBuilder
                  initialQuestions={formData.content_json || []}
                  onChange={(questions) =>
                    setFormData({ ...formData, content_json: questions })
                  }
                  onMetadataChange={(metadata) => {
                    setFormData((prev) => ({
                      ...prev,
                      title: metadata.title || prev.title,
                      description: metadata.description || prev.description,
                      time_limit_minutes:
                        metadata.time_limit || prev.time_limit_minutes,
                    }));
                  }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t mt-8">
                <button
                  type="button"
                  onClick={() => handlePreview({ 
                    id: editingQuiz?.id || "",
                    title: formData.title,
                    description: formData.description,
                    course_id: formData.course_id,
                    folder_id: typeof formData.folder_id === "number" ? formData.folder_id : null,
                    time_limit_minutes: formData.time_limit_minutes,
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
                  className="px-6 py-2 bg-blue-100 text-blue-700 font-bold rounded-xl hover:bg-blue-200 transition-colors flex items-center gap-2 mr-auto"
                >
                  <Eye className="w-4 h-4" />
                  Prévisualiser
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-[var(--greek-blue)]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingQuiz ? "Mettre à jour" : "Créer le quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal removed in favor of tab-based preview */}
    </div>
  );
}

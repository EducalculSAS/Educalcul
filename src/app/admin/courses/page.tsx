"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionFolderId } from "@/lib/useSessionFolderId";
import { supabase } from "@/lib/supabaseClient";
import PageLoader from "@/components/PageLoader";
import ThemedSelect from "@/components/admin/ThemedSelect";
import {
  BookOpen, Search, Plus, Edit, Trash2, XCircle, X, Loader2,
  Image as ImageIcon, Sparkles, Eye, Folder as FolderIcon,
  FolderPlus, ChevronRight, Home, Download, Upload,
  CheckCircle, AlertTriangle,
  Calculator, Brain, Trophy, Star, Pencil, Ruler,
  FlaskConical, Shapes, Pi, Puzzle,
  LineChart, Hash, Table2, Superscript,
} from "lucide-react";
import { exportAsJSON, importFromJSONFile } from "@/lib/jsonIO";
import { COURSE_JSON_TEMPLATE } from "@/lib/jsonTemplates";
import CourseBuilder, { Chapter } from "@/components/admin/CourseBuilder";
import AIGeneratorModal, { AIGenerateParams, AIGenerateProgress } from "@/components/admin/AIGeneratorModal";
import ImportJsonModal from "@/components/admin/ImportJsonModal";
import { SCHOOL_LEVELS, getLevelLabel, getEffectiveFolderLevel } from "@/lib/constants";
import { useConfirm } from "@/components/ConfirmDialog";

interface Course {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  level: string | null;
  thumbnail_url: string | null;
  status: "published" | "draft" | "archived";
  folder_id: number | null;
  content_json: Chapter[] | null;
  created_at: string;
}

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  status: "published" | "draft" | "archived";
  color: string;
  grade_level: string | null;
  icon?: string | null;
  is_system?: boolean;
}

const FOLDER_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Yellow/Gold
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#1e3a8a", // Bleu marine
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#64748b", // Slate
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
  { name: "folder", Icon: FolderIcon },
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
  return found ? found.Icon : FolderIcon;
};

export default function AdminCoursesPage() {
  const confirm = useConfirm();
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("admin_courses_folder");
  const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);
  // Niveau imposé par l'espace de publication courant (dossier de niveau parent)
  const currentFolderLevel = getEffectiveFolderLevel(breadcrumbs);

  // Data State
  const [courses, setCourses] = useState<Course[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allFolderCounts, setAllFolderCounts] = useState<{ id: number; parent_id: number | null }[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Drag and Drop State
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [dragOverBreadcrumb, setDragOverBreadcrumb] = useState<
    number | "root" | null
  >(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "Algèbre",
    level: "6eme",
    status: "draft",
    thumbnail_url: "",
    folder_id: null as number | null,
    content_json: [] as Chapter[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const importCourseRef = useRef<HTMLInputElement>(null);

  const handleImportCourse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromJSONFile(file);
      if (data._type && data._type !== "course") { alert("Ce fichier n'est pas un cours."); return; }
      setFormData({
        title: data.title || "",
        description: data.description || "",
        subject: data.subject || "Algèbre",
        level: data.level || "6eme",
        status: data.status || "draft",
        thumbnail_url: data.thumbnail_url || "",
        folder_id: data.folder_id ?? currentFolderId,
        content_json: data.content_json || [],
      });
      if (data.id) {
        setCurrentCourse({ id: data.id } as Course);
        setModalMode("edit");
      } else {
        setCurrentCourse(null);
        setModalMode("create");
      }
      setIsModalOpen(true);
    } catch (err: any) { alert(err.message); }
    e.target.value = "";
  };

  // Folder Creation State
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderFormData, setFolderFormData] = useState({
    name: "",
    status: "draft" as "published" | "draft" | "archived",
    color: FOLDER_COLORS[0],
    grade_level: "6eme" as string,
    icon: "" as string,
  });

  // AI States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState<AIGenerateProgress | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Notification Modal State (replaces alert())
  const [notification, setNotification] = useState<
    | {
        variant: "success" | "error";
        title: string;
        subtitle: string;
      }
    | null
  >(null);

  useEffect(() => {
    fetchContents();
  }, [currentFolderId, statusFilter]);

  // Handle LaTeX rendering for the course grid
  useEffect(() => {
    if (loading || courses.length === 0) return;

    const loadKatex = async () => {
      if (!document.getElementById("katex-css")) {
        const link = document.createElement("link");
        link.id = "katex-css";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.rel = "stylesheet";
        link.integrity = "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }

      const loadScript = (src: string, integrity: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          if ((window as any).katex && src.includes("katex.min.js")) return resolve();
          if ((window as any).renderMathInElement && src.includes("auto-render.min.js")) return resolve();
          const script = document.createElement("script");
          script.src = src;
          script.integrity = integrity;
          script.crossOrigin = "anonymous";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(script);
        });
      };

      try {
        await loadScript("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js", "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8");
        await loadScript("https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js", "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05");
        renderMath();
      } catch (err) { console.error(err); }
    };

    const renderMath = () => {
      if (gridRef.current && (window as any).renderMathInElement) {
        setIsRendering(true);
        try {
          (window as any).renderMathInElement(gridRef.current, {
            delimiters: [
              {left: '$$', right: '$$', display: true},
              {left: '$', right: '$', display: false}
            ],
            throwOnError: false
          });
        } finally {
          setTimeout(() => setIsRendering(false), 50);
        }
      }
    };

    const timer = setTimeout(loadKatex, 100);
    return () => clearTimeout(timer);
  }, [loading, courses, searchTerm]);

  // Fetch folders and courses for the current directory
  const fetchContents = async () => {
    setLoading(true);
    try {
      // 1. Fetch Folders
      let folderQuery = supabase
        .from("course_folders")
        .select("*")
        .order("name");

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

      // 2. Fetch Courses
      let coursesUrl = `/api/admin/courses?`;
      if (statusFilter !== "all") coursesUrl += `&status=${statusFilter}`;

      // We filter by folder_id on the client side for now because the API might not support it perfectly
      // or we can add it to the URL if the API supports it.
      // Based on previous code, let's fetch all and filter client-side or modify API.
      // To be safe and fast, let's fetch all relevant courses.
      // Actually, for performance, we should filter by folder_id in API.
      // Assuming API supports filtering, let's try. If not, we filter client side.

      const response = await fetch(coursesUrl);
      const coursesData = await response.json();

      if (!response.ok)
        throw new Error(coursesData.error || "Failed to fetch courses");

      let filteredCourses = coursesData as Course[];

      // Filter by current folder
      if (currentFolderId === null) {
        filteredCourses = filteredCourses.filter((c) => !c.folder_id);
      } else {
        filteredCourses = filteredCourses.filter(
          (c) => c.folder_id === currentFolderId
        );
      }

      setFolders(foldersData || []);
      setCourses(filteredCourses);
      setAllCourses(coursesData as Course[]);

      const { data: allFoldersData } = await supabase
        .from("course_folders")
        .select("id, parent_id");
      setAllFolderCounts(allFoldersData || []);

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
    // This is a simple recursive fetch to build breadcrumbs up to root
    // In a real app with deep nesting, you might want a materialized path or optimized query
    try {
      const path: Folder[] = [];
      let currentId: number | null = folderId;

      while (currentId !== null) {
        const { data } = await supabase
          .from("course_folders")
          .select("id, name, parent_id, status, color, grade_level, is_system")
          .eq("id", currentId)
          .single();

        if (data) {
          const folderData = data as Folder;
          path.unshift(folderData);
          currentId = folderData.parent_id;
        } else {
          break;
        }
      }
      setBreadcrumbs(path);
    } catch (e) {
      console.error("Error building breadcrumbs", e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const file = e.target.files[0];
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setFormData((prev) => ({ ...prev, thumbnail_url: data.url }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur upload inconnue";
      alert("Erreur upload: " + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleAiGenerate = async (params: AIGenerateParams) => {
    setIsGenerating(true);
    setAiProgress({ current: 0, total: params.count || 1, message: "Initialisation...", chapters: [] });

    const processChapter = (chapter: any) => ({
      id: crypto.randomUUID(),
      title: chapter.title,
      lessons: (chapter.lessons || []).map((lesson: any) => ({
        id: crypto.randomUUID(),
        title: lesson.title,
        type: lesson.type || "text",
        content: lesson.content || "",
        duration: lesson.duration || params.durationPerLesson || 30,
        exercises: Array.isArray(lesson.exercises)
          ? lesson.exercises.map((ex: any, idx: number) => ({
              id: ex.id || `ex-${idx + 1}`,
              question: ex.question || "",
              type: "short_answer" as const,
              answer: ex.answer || "",
              hint: ex.hint || undefined,
              explanation: ex.explanation || undefined,
            }))
          : [],
      })),
    });

    try {
      const response = await fetch("/api/admin/ai/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade_level: currentFolderLevel || params.level || "6eme",
          subject: params.topic,
          type: "cours_complet",
          page_count: params.count?.toString() || "2",
          difficulty: params.difficulty || "medium",
          additional_info: params.instructions || "",
          lessons_per_chapter: params.lessonsPerChapter,
          content_style: params.contentStyle,
          include_exercises: params.includeExercises,
          language_level: params.languageLevel,
          subject_area: params.subjectArea,
          duration_per_lesson: params.durationPerLesson,
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || "Generation failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let courseTitle = params.topic;
      let courseDescription = "";
      const chapters: any[] = [];
      let total = params.count || 1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "progress") {
            setAiProgress((prev) => ({
              current: event.current,
              total: event.total,
              message: event.message,
              chapters: prev?.chapters || [],
            }));
            total = event.total;
          } else if (event.type === "outline") {
            courseTitle = event.title || courseTitle;
            courseDescription = event.description || "";
          } else if (event.type === "chapter") {
            chapters[event.index] = processChapter(event.chapter);
            setAiProgress((prev) => ({
              current: event.index + 1,
              total: prev?.total || total,
              message: prev?.message || "",
              chapters: [...(prev?.chapters || []), event.chapter.title],
            }));
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            courseTitle = event.course?.title || courseTitle;
            courseDescription = event.course?.description || courseDescription;
          }
        }
      }

      setFormData({
        title: courseTitle,
        description: courseDescription,
        subject: params.topic,
        level: currentFolderLevel || params.level || "6eme",
        status: "draft",
        thumbnail_url: "",
        folder_id: currentFolderId,
        content_json: chapters.filter(Boolean),
      });

      setIsAiModalOpen(false);
      setNotification({
        variant: "success",
        title: "Cours généré !",
        subtitle:
          "Le contenu a été importé dans le formulaire. Complétez les détails et publiez.",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur IA inconnue";
      setIsAiModalOpen(false);
      setNotification({
        variant: "error",
        title: "Erreur de génération",
        subtitle: errorMessage,
      });
    } finally {
      setIsGenerating(false);
      setAiProgress(null);
    }
  };

  const handlePreview = (course: Course) => {
    const previewData = {
      title: course.title,
      description: course.description || "",
      subject: course.subject || "Algèbre",
      level: course.level || "6eme",
      content_json: course.content_json || [],
    };
    
    // Save to localStorage so children windows can access it (even if unsaved)
    localStorage.setItem("course_preview_data", JSON.stringify(previewData));
    
    // Open preview in a new window (using the real student route)
    window.open("/child/cours/preview", "_blank");
  };

  const handleOpenModal = (mode: "create" | "edit", course?: Course) => {
    setModalMode(mode);
    if (mode === "edit" && course) {
      setCurrentCourse(course);
      setFormData({
        title: course.title,
        description: course.description || "",
        subject: course.subject || "Algèbre",
        level: course.level || "6eme",
        status: course.status as string,
        thumbnail_url: course.thumbnail_url || "",
        folder_id: course.folder_id || null,
        content_json: course.content_json || [],
      });
    } else {
      setCurrentCourse(null);
      setFormData({
        title: "",
        description: "",
        subject: "Algèbre",
        level: currentFolderLevel || "6eme",
        status: "draft",
        thumbnail_url: "",
        folder_id: currentFolderId, // Default to current folder
        content_json: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const norm = formData.title.trim().toLowerCase();
    const folderConflict = folders.some((f) => f.name.trim().toLowerCase() === norm);
    const courseConflict = courses.some(
      (c) => c.id !== currentCourse?.id && c.title.trim().toLowerCase() === norm
    );
    if (folderConflict || courseConflict) {
      alert("Un dossier ou un cours porte déjà ce nom à cet emplacement.");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = "/api/admin/courses";
      const method = modalMode === "create" ? "POST" : "PUT";

      const body: Partial<Course> & {
        subject: string;
        thumbnail_url: string;
        folder_id: number | null;
        content_json: Chapter[];
        level: string;
      } = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        level: formData.level,
        status: formData.status as "published" | "draft" | "archived",
        thumbnail_url: formData.thumbnail_url,
        folder_id: formData.folder_id,
        content_json: formData.content_json,
      };

      if (modalMode === "edit" && currentCourse) {
        body.id = currentCourse.id;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Une erreur est survenue");
      }

      // Refresh list
      fetchContents();
      setIsModalOpen(false);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (course: Course) => {
    if (
      !(await confirm(
        `Êtes-vous sûr de vouloir supprimer le cours "${course.title}" ?`
      ))
    )
      return;

    try {
      const response = await fetch(`/api/admin/courses?id=${course.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Erreur lors de la suppression");
      }

      setCourses(courses.filter((c) => c.id !== course.id));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erreur lors de la suppression";
      alert(errorMessage);
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    if (!(await confirm(`Supprimer le dossier "${folder.name}" et tout son contenu ?`)))
      return;

    try {
      const { error } = await supabase
        .from("course_folders")
        .delete()
        .eq("id", folder.id);
      if (error) throw error;
      fetchContents();
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Erreur lors de la suppression du dossier");
    }
  };

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = folderFormData.name.trim();
    if (!name) return;

    const norm = name.toLowerCase();
    const folderConflict = folders.some(
      (f) => f.id !== editingFolder?.id && f.name.trim().toLowerCase() === norm
    );
    const courseConflict = courses.some((c) => c.title.trim().toLowerCase() === norm);
    if (folderConflict || courseConflict) {
      alert("Un dossier ou un cours porte déjà ce nom à cet emplacement.");
      return;
    }

    try {
      if (editingFolder) {
        const { error } = await supabase
          .from("course_folders")
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
        const { error } = await supabase.from("course_folders").insert({
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
      fetchContents();
    } catch (error: any) {
      console.error("Error saving folder:", error);
      alert(
        "Erreur lors de l'enregistrement du dossier: " +
          (error?.message || JSON.stringify(error))
      );
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, courseId: string) => {
    e.dataTransfer.setData("courseId", courseId);
    setDraggedCourseId(courseId);
  };

  const handleFolderDragStart = (e: React.DragEvent, folderId: number) => {
    e.dataTransfer.setData("folderId", String(folderId));
  };

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    e.preventDefault(); // Necessary to allow dropping
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
        .from("course_folders")
        .select("parent_id")
        .eq("id", currentId)
        .single();
      currentId = (data?.parent_id as number | null) ?? null;
      guard++;
    }
    return false;
  };

  // Moves a course or a folder (depending on dataTransfer payload)
  // into the target folder (null = root).
  const moveDroppedItem = async (
    e: React.DragEvent,
    targetFolderId: number | null
  ) => {
    const courseId = e.dataTransfer.getData("courseId");
    const folderId = e.dataTransfer.getData("folderId");

    try {
      if (courseId) {
        const response = await fetch("/api/admin/courses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: courseId,
            folder_id: targetFolderId,
          }),
        });

        if (!response.ok) throw new Error("Failed to move course");
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
          .from("course_folders")
          .update({ parent_id: targetFolderId })
          .eq("id", Number(folderId));

        if (error) throw error;
        fetchContents();
      }
    } catch (error) {
      console.error("Error moving item:", error);
      alert("Erreur lors du déplacement");
    } finally {
      setDraggedCourseId(null);
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

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourses = courses.filter((course) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (course.title?.toLowerCase() || "").includes(searchLower) ||
      (course.description?.toLowerCase() || "").includes(searchLower) ||
      (course.subject?.toLowerCase() || "").includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <BookOpen className="text-[var(--greek-gold)]" size={32} />
              Gestion des Cours
            </h1>
            <p className="text-[var(--greek-bronze)] text-lg">
              Organisez vos cours dans des dossiers et sous-dossiers
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
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
              onClick={() => handleOpenModal("create")}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/10"
            >
              <Plus size={20} />
              Nouveau Cours
            </button>
          </div>
        </div>
      </div>

      {/* Navigation & Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-x-auto">
        <button
          onClick={() => { setCurrentFolderId(null); setSearchTerm(""); }}
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
              onClick={() => { setCurrentFolderId(folder.id); setSearchTerm(""); }}
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

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] space-y-4">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un cours..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div 
        ref={gridRef}
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity duration-300 ${isRendering ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* Loading State */}
        {loading && (
          <div className="col-span-full">
            <PageLoader />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredFolders.length === 0 && filteredCourses.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-[rgba(197,161,72,0.25)] border-dashed">
            <div className="flex flex-col items-center justify-center">
              <FolderIcon size={48} className="text-gray-200 mb-2" />
              <p>Ce dossier est vide</p>
              <button
                onClick={() => setIsFolderModalOpen(true)}
                className="mt-4 text-[var(--greek-blue)] font-medium hover:underline"
              >
                Créer un dossier
              </button>
            </div>
          </div>
        )}

        {/* Folders List */}
        {!loading &&
          filteredFolders.map((folder) => {
            const FolderCardIcon = getFolderIcon(folder.icon);
            return (
            <div
              key={`folder-${folder.id}`}
              draggable
              onDragStart={(e) => handleFolderDragStart(e, folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
              onClick={() => { setCurrentFolderId(folder.id); setSearchTerm(""); }}
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
                const itemCount = allCourses.filter((c) => c.folder_id === folder.id).length;
                if (subCount === 0 && itemCount === 0) return null;
                const parts = [];
                if (subCount > 0) parts.push(`${subCount} dossier${subCount > 1 ? "s" : ""}`);
                if (itemCount > 0) parts.push(`${itemCount} cours`);
                return (
                  <p className="text-xs text-gray-400 mt-1">{parts.join(" · ")}</p>
                );
              })()}
            </div>
            );
          })}

        {/* Courses List */}
        {!loading &&
          filteredCourses.map((course) => (
            <div
              key={`course-${course.id}`}
              draggable
              onDragStart={(e) => handleDragStart(e, course.id)}
              onDragEnd={() => setDraggedCourseId(null)}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-shadow group flex flex-col h-full cursor-move ${
                draggedCourseId === course.id
                  ? "border-[var(--greek-blue)] opacity-50 border-2 border-dashed"
                  : "border-[rgba(197,161,72,0.25)] hover:shadow-md"
              }`}
            >
              <div className="relative h-40 bg-gray-100 flex-shrink-0">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--greek-blue)]/5">
                    <img src="/logo.png" alt="Educalcul" className="w-12 h-12 object-contain opacity-20" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {getStatusBadge(course.status)}
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <div className="mb-2">
                  <span className="text-xs font-bold text-[var(--greek-gold)] uppercase tracking-wide">
                    {course.subject || "Algèbre"}
                  </span>
                </div>
                <h3
                  className="font-bold text-lg text-[var(--greek-blue)] mb-2 line-clamp-1"
                  title={course.title}
                >
                  {course.title}
                </h3>
                <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-1">
                  {course.description || "Aucune description"}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-[rgba(197,161,72,0.25)] mt-auto">
                  <span className="text-xs text-gray-400">
                    {new Date(course.created_at).toLocaleDateString("fr-FR")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePreview(course)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Prévisualiser"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleOpenModal("edit", course)}
                      className="p-1.5 text-[var(--greek-blue)] hover:bg-blue-50 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => exportAsJSON(course, "course", course.title)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Exporter JSON"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(course)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Create Course Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <BookOpen size={22} className="text-[var(--greek-gold)]" />
                <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">
                  {modalMode === "create" ? "Ajouter un cours" : "Modifier le cours"}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="group p-2 text-white/70 hover:text-white transition-colors relative z-10" aria-label="Fermer">
                <X size={22} className="transition-transform group-hover:scale-125" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {/* Section 1: Informations */}
                <div className="p-6 border-b border-[rgba(197,161,72,0.25)]">
                  <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">1</span>
                    Informations générales
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Titre du cours</label>
                      <input
                        type="text" required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-gray-50 font-medium"
                        placeholder="Ex: Les fractions (CM1)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Domaine</label>
                        <select
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50"
                        >
                          <option value="Algèbre">Algèbre</option>
                          <option value="Géométrie">Géométrie</option>
                          <option value="Statistiques">Statistiques</option>
                          <option value="Arithmétique">Arithmétique</option>
                          <option value="Fonctions">Fonctions</option>
                          <option value="Probabilités">Probabilités</option>
                          <option value="Mesures">Mesures</option>
                          <option value="Logique">Logique</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Niveau scolaire</label>
                        {modalMode === "create" && currentFolderLevel ? (
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
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50 resize-none"
                        placeholder="Description courte du cours..."
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Paramètres */}
                <div className="p-6 border-b border-[rgba(197,161,72,0.25)] bg-gray-50/50">
                  <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">2</span>
                    Paramètres de publication
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
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
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Image de couverture</label>
                      <div className="flex items-center gap-3">
                        {formData.thumbnail_url && (
                          <div className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-[rgba(197,161,72,0.25)] flex-shrink-0">
                            <img src={formData.thumbnail_url} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, thumbnail_url: "" }))}
                              className="absolute top-0.5 right-0.5 p-0.5 bg-white rounded-full shadow-sm text-gray-500 hover:text-red-500"
                            >
                              <XCircle size={13} />
                            </button>
                          </div>
                        )}
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium flex-1 justify-center border border-dashed border-[rgba(197,161,72,0.25)]">
                          <ImageIcon size={16} />
                          {uploading ? "Upload..." : "Choisir"}
                          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Contenu */}
                <div className="p-6">
                  <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">3</span>
                    Contenu du cours
                  </h4>
                  <CourseBuilder
                    initialContent={formData.content_json}
                    onChange={(chapters) => setFormData({ ...formData, content_json: chapters })}
                    level={formData.level}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-[rgba(197,161,72,0.25)] bg-white flex-shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors border border-[rgba(197,161,72,0.25)]">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="px-8 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-[var(--greek-blue)]/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-900/20">
                  {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                  {modalMode === "create" ? "Créer le cours" : "Sauvegarder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}




      {/* Create Folder Modal */}
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
                  placeholder="Ex: Chapitre 1"
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
                  className="px-4 py-2 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-800 transition-colors"
                >
                  {editingFolder ? "Sauvegarder" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Modal */}
      {isAiModalOpen && (
        <AIGeneratorModal
          type="course"
          onGenerate={handleAiGenerate}
          onClose={() => setIsAiModalOpen(false)}
          progress={aiProgress}
        />
      )}

      {showImportModal && (
        <ImportJsonModal
          onClose={() => setShowImportModal(false)}
          onFileLoaded={(file) => {
            const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleImportCourse(fakeEvent);
            setShowImportModal(false);
          }}
          label="cours"
          template={COURSE_JSON_TEMPLATE}
          templateFilename="modele_cours.json"
        />
      )}

      {/* Notification Modal — replaces alert() */}
      {notification && (
        <NotificationModal
          variant={notification.variant}
          title={notification.title}
          subtitle={notification.subtitle}
          onAction={() => {
            const wasSuccess = notification.variant === "success";
            setNotification(null);
            if (wasSuccess) {
              setModalMode("create");
              setIsModalOpen(true);
            } else {
              setIsAiModalOpen(true);
            }
          }}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}

// ─── Notification Modal — styled replacement for alert() ───────────────────────
interface NotificationModalProps {
  variant: "success" | "error";
  title: string;
  subtitle: string;
  onAction: () => void;
  onClose: () => void;
}

function NotificationModal({
  variant,
  title,
  subtitle,
  onAction,
  onClose,
}: NotificationModalProps) {
  const isSuccess = variant === "success";
  const Icon = isSuccess ? CheckCircle : AlertTriangle;
  const accent = isSuccess ? "#10b981" : "#ef4444";
  const ctaLabel = isSuccess ? "Continuer" : "Réessayer";

  return (
    <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-fade-bounce relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="group absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X size={20} className="transition-transform group-hover:scale-125" />
        </button>
        <div className="px-8 pt-8 pb-4 flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: `${accent}15` }}
          >
            <Icon size={36} style={{ color: accent }} strokeWidth={2.25} />
          </div>
          <h3
            className="text-2xl font-bold mb-2 font-[family-name:var(--font-display)]"
            style={{ color: "var(--greek-blue)" }}
          >
            {title}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">{subtitle}</p>
        </div>
        <div className="px-8 pb-8 pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAction}
            className="w-full py-3 rounded-xl font-bold text-white transition-all shadow-md hover:-translate-y-0.5"
            style={{
              background:
                "linear-gradient(to right, var(--greek-gold), #b08438)",
            }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


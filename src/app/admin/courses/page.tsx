"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BookOpen, Search, Plus, Edit, Trash2, XCircle, Loader2,
  Image as ImageIcon, Sparkles, Eye, Folder as FolderIcon,
  FolderPlus, ChevronRight, Home, Download, Upload,
} from "lucide-react";
import { exportAsJSON, importFromJSONFile } from "@/lib/jsonIO";
import CourseBuilder, { Chapter } from "@/components/admin/CourseBuilder";
import CourseViewer from "@/components/viewers/CourseViewer";
import AIGeneratorModal from "@/components/admin/AIGeneratorModal";
import { SCHOOL_LEVELS } from "@/lib/constants";

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
}

const FOLDER_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Yellow/Gold
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#64748b", // Slate
];

export default function AdminCoursesPage() {
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);

  // Data State
  const [courses, setCourses] = useState<Course[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Drag and Drop State
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "Mathématiques",
    level: "6eme",
    status: "draft",
    thumbnail_url: "",
    folder_id: null as number | null,
    content_json: [] as Chapter[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
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
        subject: data.subject || "Mathématiques",
        level: data.level || "6eme",
        status: data.status || "draft",
        thumbnail_url: data.thumbnail_url || "",
        folder_id: null,
        content_json: data.content_json || [],
      });
      setCurrentCourse(null);
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
  });

  // AI States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

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
          .select("id, name, parent_id, status, color")
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

  const handleAiGenerate = async (params: any) => {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/admin/ai/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade_level: params.level || "6eme",
          subject: params.topic,
          type: "cours_complet", // AI determines this is a course
          page_count: params.count?.toString() || "2",
          difficulty: params.difficulty || "medium",
          additional_info: params.instructions || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Generation failed");
      }

      const aiCourse = data.course || data;

      // Add IDs to chapters and lessons if missing
      const processedContent = (aiCourse.chapters || []).map(
        (chapter: any) => ({
          id: crypto.randomUUID(),
          title: chapter.title,
          lessons: (chapter.lessons || []).map((lesson: any) => ({
            id: crypto.randomUUID(),
            title: lesson.title,
            type: lesson.type || "text",
            content: lesson.content || "",
            duration: lesson.duration || 10,
          })),
        })
      );

      setFormData({
        title: aiCourse.title || params.topic,
        description: aiCourse.description || "",
        subject: params.topic,
        level: params.level || "6eme",
        status: "draft",
        thumbnail_url: "",
        folder_id: currentFolderId, // Auto-assign to current folder
        content_json: processedContent,
      });

      console.log("AI Content Generated:", aiCourse);
      alert(
        "Cours généré avec succès ! Vous pouvez maintenant compléter les détails."
      );

      setIsAiModalOpen(false);
      setModalMode("create");
      setIsModalOpen(true);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur IA inconnue";
      alert("Erreur IA: " + errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = (course: Course) => {
    const previewData = {
      title: course.title,
      description: course.description || "",
      subject: course.subject || "Mathématiques",
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
        subject: course.subject || "Mathématiques",
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
        subject: "Mathématiques",
        level: "6eme",
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
      !confirm(
        `Êtes-vous sûr de vouloir supprimer le cours "${course.title}" ?`
      )
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
    if (!confirm(`Supprimer le dossier "${folder.name}" et tout son contenu ?`))
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
    if (!folderFormData.name.trim()) return;

    try {
      if (editingFolder) {
        const { error } = await supabase
          .from("course_folders")
          .update({
            name: folderFormData.name,
            status: folderFormData.status,
            color: folderFormData.color,
            grade_level: folderFormData.grade_level,
          })
          .eq("id", editingFolder.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_folders").insert({
          name: folderFormData.name,
          parent_id: currentFolderId,
          status: folderFormData.status,
          color: folderFormData.color,
          grade_level: folderFormData.grade_level,
        });

        if (error) throw error;
      }

      setFolderFormData({
        name: "",
        status: "draft",
        color: FOLDER_COLORS[0],
        grade_level: "6eme",
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

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    e.preventDefault(); // Necessary to allow dropping
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: number) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const courseId = e.dataTransfer.getData("courseId");

    if (!courseId) return;

    try {
      // Update course folder_id
      const response = await fetch("/api/admin/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: courseId,
          folder_id: targetFolderId,
        }),
      });

      if (!response.ok) throw new Error("Failed to move course");

      // Refresh to show course moved (disappear from current view)
      fetchContents();
    } catch (error) {
      console.error("Error moving course:", error);
      alert("Erreur lors du déplacement du cours");
    } finally {
      setDraggedCourseId(null);
    }
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
                  color: FOLDER_COLORS[0],
                  grade_level: "6eme",
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
              onClick={() => importCourseRef.current?.click()}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Upload size={18} /> Importer JSON
            </button>
            <input ref={importCourseRef} type="file" accept=".json" className="hidden" onChange={handleImportCourse} />
            <button
              onClick={() => handleOpenModal("create")}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-800 transition-colors shadow-lg shadow-blue-900/10"
            >
              <Plus size={20} />
              Ajouter un cours
            </button>
          </div>
        </div>
      </div>

      {/* Navigation & Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-x-auto">
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
          <div className="col-span-full py-12 text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[var(--greek-blue)]" />
            Chargement du contenu...
          </div>
        )}

        {/* Empty State */}
        {!loading && folders.length === 0 && filteredCourses.length === 0 && (
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
          folders.map((folder) => (
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
                <FolderIcon size={32} fill="currentColor" fillOpacity={0.2} />
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

        {/* Courses List */}
        {!loading &&
          filteredCourses.map((course) => (
            <div
              key={`course-${course.id}`}
              draggable
              onDragStart={(e) => handleDragStart(e, course.id)}
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
                    {course.subject || "Mathématiques"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <BookOpen size={22} className="text-[var(--greek-gold)]" />
                <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">
                  {modalMode === "create" ? "Ajouter un cours" : "Modifier le cours"}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                <XCircle size={22} />
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
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Matière</label>
                        <select
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50"
                        >
                          <option value="Mathématiques">Mathématiques</option>
                          <option value="Français">Français</option>
                          <option value="Histoire">Histoire</option>
                          <option value="Géographie">Géographie</option>
                          <option value="Sciences">Sciences</option>
                        </select>
                      </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
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
        />
      )}
    </div>
  );
}

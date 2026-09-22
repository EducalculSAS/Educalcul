"use client";

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
import PageLoader from "@/components/PageLoader";
import {
  BookOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  XCircle,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  Eye,
  Folder as FolderIcon,
  FolderPlus,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
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
import { exportAsJSON, importFromJSONFile } from "@/lib/jsonIO";
import { COURSE_JSON_TEMPLATE } from "@/lib/jsonTemplates";
import { compileHandAuthoredCourse } from "@/lib/ai/handAuthoredContent";
import CourseBuilder, { Chapter } from "@/components/admin/CourseBuilder";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import {
  getAdminCache,
  setAdminCache,
  invalidateAdminCache,
} from "@/lib/adminCache";
import AIGeneratorModal, {
  AIGenerateParams,
} from "@/components/admin/AIGeneratorModal";
import { useContentGenerations } from "@/contexts/ContentGenerationsContext";
import ImportJsonModal from "@/components/admin/ImportJsonModal";
import {
  SCHOOL_LEVELS,
  SCHOOL_CYCLES,
  getLevelLabel,
  getLevelCycle,
  getEffectiveFolderLevel,
} from "@/lib/constants";
import { useConfirm } from "@/components/ConfirmDialog";
import { ensureKatexAutoRenderLoaded } from "@/lib/katexLoader";
import { openPreviewLoadingWindow } from "@/lib/openPreviewWindow";

export interface Course {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  level: string | null;
  thumbnail_url: string | null;
  status: "published" | "draft" | "archived";
  folder_id: number | null;
  estimated_time: number | null;
  content_json: Chapter[] | null;
  created_at: string;
}

export interface Folder {
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
    <svg width={size} height={size} viewBox="0 0 24 24" {...props}>
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        fill="currentColor"
        fillOpacity="1"
        stroke="none"
      >
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

/** Bibliothèque de cours admin : le dossier racine + tous les cours (filtres
 * par défaut) arrivent déjà chargés du serveur ; naviguer dans les dossiers,
 * changer un filtre, et tout le CRUD restent des allers-retours client,
 * comme avant. */
export default function AdminCoursesClient({
  initialFolderId,
  initialItems,
  initialAllFolders,
}: {
  initialFolderId: number | null;
  initialItems: Course[];
  initialAllFolders: ContentFolder[];
}) {
  const confirm = useConfirm();
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("admin_courses_folder", initialFolderId);


  // Data State
  const [courses, setCourses] = useState<Course[]>(initialItems);
  const [allFolders, setAllFolders] = useState<ContentFolder[]>(initialAllFolders);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Dossiers, fil d'Ariane et compteurs DÉRIVÉS de la liste plate des
  // dossiers, déjà en mémoire : ils s'affichent au clic, sans attendre le
  // réseau. Avant, le fil d'Ariane n'était mis à jour qu'à la FIN du
  // chargement du dossier — d'où son décalage visible.
  const folders = useMemo(
    () =>
      allFolders.filter(
        (f) => (currentFolderId === null ? f.parent_id === null : f.parent_id === currentFolderId)
          && (statusFilter === "all" || f.status === statusFilter),
      ) as unknown as Folder[],
    [allFolders, currentFolderId, statusFilter],
  );
  const breadcrumbs = useMemo(
    () =>
      (currentFolderId === null ? [] : buildBreadcrumbs(allFolders, currentFolderId)) as unknown as Folder[],
    [allFolders, currentFolderId],
  );
  const subfolderCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const f of allFolders) {
      if (f.parent_id !== null) counts.set(f.parent_id, (counts.get(f.parent_id) ?? 0) + 1);
    }
    return counts;
  }, [allFolders]);
  // Niveau imposé par l'espace de publication courant (dossier de niveau parent)
  const currentFolderLevel = getEffectiveFolderLevel(breadcrumbs);
  const [cycleFilter, setCycleFilter] = useState("all");
  const isFirstContentsFetch = useRef(true);

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
    subject: "Algèbre",
    level: "6eme",
    status: "draft",
    thumbnail_url: "",
    folder_id: null as number | null,
    content_json: [] as Chapter[],
  });
  const [estimatedTime, setEstimatedTime] = useState(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const importCourseRef = useRef<HTMLInputElement>(null);

  const handleImportCourse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromJSONFile(file);
      if (data._type && data._type !== "course") {
        alert("Ce fichier n'est pas un cours.");
        return;
      }
      // "_format":"source" (modèle téléchargé, rempli à la main) : les blocs
      // déclaratifs + texte $...$ sont compilés vers le format affiché par le
      // site. Sans ce marqueur (ex: export ré-importé), contenu déjà compilé
      // → inchangé.
      let compiledContent = data.content_json || [];
      try {
        const result = compileHandAuthoredCourse(data);
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
        subject: data.subject || "Algèbre",
        level: data.level || "6eme",
        status: data.status || "draft",
        thumbnail_url: data.thumbnail_url || "",
        folder_id: data.folder_id ?? currentFolderId,
        content_json: compiledContent,
      });
      if (data.id) {
        setCurrentCourse({ id: data.id } as Course);
        setModalMode("edit");
      } else {
        setCurrentCourse(null);
        setModalMode("create");
      }
      setIsModalOpen(true);
    } catch (err: any) {
      alert(err.message);
    }
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
  const [isRendering, setIsRendering] = useState(false);
  const { startGeneration, onContentCreated } = useContentGenerations();

  // Une génération lancée depuis cette page (ou une autre, ou avant un
  // rechargement) rafraîchit la liste dès qu'elle aboutit à un cours créé.
  // Pas de notification ici : la modale plein écran et le widget affichent
  // déjà l'état "Cours créé !", une seconde modale ferait doublon.
  useEffect(() => {
    return onContentCreated("course", () => {
      invalidateAdminCache("courses:");
      fetchContents(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onContentCreated]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Notification Modal State (replaces alert())
  const [notification, setNotification] = useState<{
    variant: "success" | "error";
    title: string;
    subtitle: string;
  } | null>(null);

  useEffect(() => {
    // Le serveur a déjà prérécupéré le dossier racine avec les filtres par
    // défaut : si c'est exactement l'état au premier rendu (rien restauré
    // depuis sessionStorage), inutile de refaire cet appel immédiatement.
    if (isFirstContentsFetch.current) {
      isFirstContentsFetch.current = false;
      // La page serveur a déjà chargé le dossier affiché (lu dans le même
      // cookie) : inutile de refaire la même requête au montage.
      if (statusFilter === "all") {
        return;
      }
    }
    fetchContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, statusFilter]);

  // Contenu créé/modifié ailleurs (autre onglet, autre appareil) : on
  // rafraîchit silencieusement (sans spinner) quand l'onglet redevient actif,
  // et périodiquement en arrière-plan tant qu'il l'est déjà.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchContents(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchContents(true);
    }, 20000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, statusFilter]);

  // Handle LaTeX rendering for the course grid
  useEffect(() => {
    if (loading || courses.length === 0) return;

    const loadKatex = async () => {
      try {
        await ensureKatexAutoRenderLoaded();
        renderMath();
      } catch (err) {
        console.error(err);
      }
    };

    const renderMath = () => {
      if (gridRef.current && (window as any).renderMathInElement) {
        setIsRendering(true);
        try {
          (window as any).renderMathInElement(gridRef.current, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
            ],
            throwOnError: false,
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
  const fetchContents = async (silent = false) => {
    const cacheKey = `courses:${currentFolderId}:${statusFilter}`;
    const cached = getAdminCache<{ items: Course[]; allFolders: ContentFolder[] }>(cacheKey);
    if (!silent) {
      if (cached) {
        // Affiche instantanément la dernière version connue — pas d'écran de
        // chargement — pendant qu'une requête fraîche part en arrière-plan.
        setCourses(cached.items);
        setAllFolders(cached.allFolders);
        setLoading(false);
      } else {
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
      let url = `/api/admin/courses?folder=${currentFolderId ?? "root"}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      const [freshFolders, response] = await Promise.all([listFolders("course"), fetch(url)]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch contents");

      const items = data as Course[];
      setAllFolders(freshFolders);
      setCourses(items);
      setAdminCache(cacheKey, { items, allFolders: freshFolders });
    } catch (error: any) {
      console.error("Error fetching contents:", error?.message || error);
    } finally {
      if (!silent) setLoading(false);
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

  // Génération en arrière-plan : le vrai travail tourne côté serveur (survit
  // au reload/à la fermeture de la page) via ContentGenerationsContext. Cette
  // fonction se contente de démarrer la génération et de fermer le
  // formulaire — plus d'étape de validation manuelle, le cours final
  // s'enregistre directement en brouillon.
  const handleAiGenerate = (params: AIGenerateParams) => {
    // Fermé IMMÉDIATEMENT (avant même d'attendre la réponse du serveur) :
    // sinon AIGeneratorModal reste monté le temps de l'appel réseau et
    // affiche sa propre vue de chargement (ancienne modale, avec sa croix)
    // pendant cette fraction de seconde avant que ContentGenerationFullModal
    // ne prenne le relais.
    setIsAiModalOpen(false);
    startGeneration("course", {
      grade_level: currentFolderLevel || params.level || "6eme",
      subject: params.topic,
      page_count: params.count?.toString() || "2",
      difficulty: params.difficulty || "medium",
      additional_info: params.instructions || "",
      lessons_per_chapter: params.lessonsPerChapter,
      content_style: params.contentStyle,
      include_exercises: params.includeExercises,
      language_level: params.languageLevel,
      subject_area: params.subjectArea,
      duration_per_lesson: params.durationPerLesson,
      folder_id: currentFolderId,
    }).then((id) => {
      if (!id) {
        setNotification({
          variant: "error",
          title: "Erreur de génération",
          subtitle: "Impossible de démarrer la génération. Réessaie.",
        });
      }
    });
  };

  // La liste ne charge plus content_json (trop volumineux pour un simple
  // aperçu de carte) : on le récupère à la demande, seulement quand une
  // action a besoin du contenu complet (édition, aperçu, export).
  const getFullCourse = async (course: Course): Promise<Course> => {
    if (course.content_json) return course;
    const res = await fetch(`/api/admin/courses?id=${course.id}`);
    const full = await res.json();
    if (!res.ok) return course;
    const merge = (c: Course) => (c.id === course.id ? { ...c, content_json: full.content_json ?? [] } : c);
    setCourses((cs) => cs.map(merge));
    return { ...course, content_json: full.content_json ?? [] };
  };

  const handlePreview = async (course: Course, win?: Window | null) => {
    const previewData = {
      title: course.title,
      description: course.description || "",
      subject: course.subject || "Algèbre",
      level: course.level || "6eme",
      content_json: course.content_json || [],
    };

    // Aperçu transmis via une ligne DB temporaire (pas de localStorage) —
    // l'onglet ouvert par window.open la récupère via son id dans l'URL.
    const res = await fetch("/api/admin/content-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "course", payload: previewData }),
    });
    const data = await res.json();
    if (!res.ok || !data.id) {
      win?.close();
      return;
    }

    const url = `/child/cours/preview?pid=${data.id}`;
    // `win` doit avoir été ouvert de façon SYNCHRONE au clic (avant tout
    // await) : Safari mobile bloque silencieusement un window.open() appelé
    // après un await, car il n'est plus rattaché au geste utilisateur — vu et
    // confirmé buggy sur iPhone (l'oeil ne faisait rien, aucune erreur).
    if (win) win.location.href = url;
    else window.open(url, "_blank");
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
      setEstimatedTime((course as any).estimated_time ?? 15);
    } else {
      setCurrentCourse(null);
      setEstimatedTime(15);
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
    const folderConflict = folders.some(
      (f) => f.name.trim().toLowerCase() === norm,
    );
    const courseConflict = courses.some(
      (c) =>
        c.id !== currentCourse?.id && c.title.trim().toLowerCase() === norm,
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
        estimated_time: estimatedTime,
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
      invalidateAdminCache("courses:");
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
        `Êtes-vous sûr de vouloir supprimer le cours "${course.title}" ?`,
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
    if (
      !(await confirm(
        `Supprimer le dossier "${folder.name}" et tout son contenu ?`,
      ))
    )
      return;

    const { ok } = await deleteFolder("course", folder.id);
    if (!ok) {
      alert("Erreur lors de la suppression du dossier");
      return;
    }
    invalidateAdminCache("courses:");
    fetchContents();
  };

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = folderFormData.name.trim();
    if (!name) return;

    const norm = name.toLowerCase();
    const folderConflict = folders.some(
      (f) => f.id !== editingFolder?.id && f.name.trim().toLowerCase() === norm,
    );
    const courseConflict = courses.some(
      (c) => c.title.trim().toLowerCase() === norm,
    );
    if (folderConflict || courseConflict) {
      alert("Un dossier ou un cours porte déjà ce nom à cet emplacement.");
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
        ? await updateFolder("course", editingFolder.id, payload)
        : await createFolder("course", { ...payload, parent_id: currentFolderId });
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
      invalidateAdminCache("courses:");
      fetchContents();
    } catch (error: any) {
      console.error("Error saving folder:", error);
      alert(
        "Erreur lors de l'enregistrement du dossier: " +
          (error?.message || JSON.stringify(error)),
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
  // Moves a course or a folder (depending on dataTransfer payload)
  // into the target folder (null = root).
  const moveDroppedItem = async (
    e: React.DragEvent,
    targetFolderId: number | null,
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
        invalidateAdminCache("courses:");
        fetchContents();
      } else if (folderId) {
        if (targetFolderId !== null && Number(folderId) === targetFolderId)
          return;
        // Prevent cycles: target must not be the folder itself or a descendant
        if (folderIsSelfOrDescendant(allFolders, Number(folderId), targetFolderId)) {
          alert(
            "Impossible de déplacer un dossier dans lui-même ou un de ses sous-dossiers",
          );
          return;
        }
        const { ok } = await updateFolder("course", Number(folderId), { parent_id: targetFolderId });
        if (!ok) throw new Error("Failed to move folder");
        invalidateAdminCache("courses:");
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
    targetFolderId: number | null,
  ) => {
    e.preventDefault();
    e.stopPropagation();
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

  // Seuls les dossiers racine portent le niveau scolaire : une fois dans un
  // dossier de niveau, le cycle est deja determine.
  const filteredFolders = folders.filter(
    (folder) =>
      folder.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (cycleFilter === "all" ||
        currentFolderId !== null ||
        getLevelCycle((folder as any).grade_level) === cycleFilter),
  );

  const filteredCourses = courses.filter((course) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (course.title?.toLowerCase() || "").includes(searchLower) ||
      (course.description?.toLowerCase() || "").includes(searchLower) ||
      (course.subject?.toLowerCase() || "").includes(searchLower);
    const matchesCycle =
      cycleFilter === "all" || getLevelCycle((course as any).level) === cycleFilter;
    return matchesSearch && matchesCycle;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={BookOpen}
        title="Gestion des Cours"
        subtitle="Organisez vos cours dans des dossiers et sous-dossiers"
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
            <GlassButton size="sm" variant="ghost" onClick={() => setShowImportModal(true)}>
              <Upload size={16} /> JSON
            </GlassButton>
            <GlassButton size="sm" variant="navy" onClick={() => handleOpenModal("create")}>
              <Plus size={18} />
              Nouveau Cours
            </GlassButton>
          </>
        }
      />

      {/* Fil d'Ariane — dérivé en mémoire, boutons liquid glass */}
      <AdminBreadcrumbs
        crumbs={breadcrumbs}
        currentFolderId={currentFolderId}
        onNavigate={(id) => { setCurrentFolderId(id); setSearchTerm(""); }}
        onDropOnto={handleBreadcrumbDrop}
      />

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
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-w-[160px]">
              <option value="all">Tous les statuts</option>
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
              <option value="archived">Archivé</option>
            </select>

            <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="min-w-[160px]">
              <option value="all">Tous les niveaux</option>
              {SCHOOL_CYCLES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div
        ref={gridRef}
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity duration-300 ${isRendering ? "opacity-0" : "opacity-100"}`}
      >
        {/* Loading State */}
        {loading && (
          <div className="col-span-full">
            <PageLoader />
          </div>
        )}

        {/* Empty State */}
        {!loading &&
          filteredFolders.length === 0 &&
          filteredCourses.length === 0 && (
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
                onClick={() => {
                  setCurrentFolderId(folder.id);
                  setSearchTerm("");
                }}
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
                    color="navy"
                    size="sm"
                    aria-label="Modifier"
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
                  />
                  {!folder.is_system && (
                    <GlassIconButton
                      icon={Trash2}
                      color="red"
                      size="sm"
                      aria-label="Supprimer"
                      onClick={() => handleDeleteFolder(folder)}
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
                  <FolderCardIcon
                    size={32}
                    fill="currentColor"
                    fillOpacity={0.2}
                  />
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
                  const subCount =
                    currentFolderId === null
                      ? 0
                      : (subfolderCounts.get(folder.id) ?? 0);
                  const itemCount = ((folder as { item_count?: number }).item_count ?? 0);
                  if (subCount === 0 && itemCount === 0) return null;
                  const parts = [];
                  if (subCount > 0)
                    parts.push(`${subCount} dossier${subCount > 1 ? "s" : ""}`);
                  if (itemCount > 0) parts.push(`${itemCount} cours`);
                  return (
                    <p className="text-xs text-gray-400 mt-1">
                      {parts.join(" · ")}
                    </p>
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
                    <img
                      src="/logo.png"
                      alt="Educalcul"
                      className="w-12 h-12 object-contain opacity-20"
                    />
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
                    <GlassIconButton
                      icon={Eye}
                      onClick={() => {
                        // Ouverture synchrone AVANT tout await : voir handlePreview.
                        const win = openPreviewLoadingWindow();
                        void (async () => {
                          const full = await getFullCourse(course);
                          await handlePreview(full, win);
                        })();
                      }}
                      color="navy"
                      size="sm"
                      aria-label="Prévisualiser"
                    />
                    <GlassIconButton
                      icon={Edit}
                      onClick={async () => handleOpenModal("edit", await getFullCourse(course))}
                      color="navy"
                      size="sm"
                      aria-label="Modifier"
                    />
                    <GlassIconButton
                      icon={Download}
                      onClick={async () => {
                        const full = await getFullCourse(course);
                        exportAsJSON(full, "course", full.title);
                      }}
                      color="gold"
                      size="sm"
                      aria-label="Exporter JSON"
                    />
                    <GlassIconButton
                      icon={Trash2}
                      onClick={() => handleDelete(course)}
                      color="red"
                      size="sm"
                      aria-label="Supprimer"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Create Course Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-[rgba(197,161,72,0.25)] bg-gradient-to-r from-[var(--greek-blue)] to-blue-800 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-3">
                <BookOpen size={22} className="text-[var(--greek-gold)]" />
                <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">
                  {modalMode === "create"
                    ? "Ajouter un cours"
                    : "Modifier le cours"}
                </h3>
              </div>
              <GlassCloseButton variant="dark" onClick={() => setIsModalOpen(false)} />
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto">
                {/* Section 1: Informations */}
                <div className="p-4 sm:p-6 border-b border-[rgba(197,161,72,0.25)]">
                  <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">
                      1
                    </span>
                    Informations générales
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Titre du cours
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-gray-50 font-medium"
                        placeholder="Ex: Les fractions (CM1)"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Domaine
                        </label>
                        <select
                          value={formData.subject}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              subject: e.target.value,
                            })
                          }
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
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Niveau scolaire
                        </label>
                        {modalMode === "create" && currentFolderLevel ? (
                          <div className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl bg-blue-50 font-semibold text-[var(--greek-blue)]">
                            {getLevelLabel(currentFolderLevel)}
                          </div>
                        ) : (
                          <select
                            value={formData.level}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                level: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                          >
                            {SCHOOL_LEVELS.map((level) => (
                              <option key={level.value} value={level.value}>
                                {level.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          Durée estimée
                        </label>
                        <select
                          value={estimatedTime}
                          onChange={(e) =>
                            setEstimatedTime(parseInt(e.target.value))
                          }
                          className="w-full px-4 py-2.5 border-2 border-[var(--greek-blue)]/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white font-semibold"
                        >
                          {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => (
                            <option key={m} value={m}>
                              {m} min
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        rows={2}
                        className="w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-gray-50 resize-none"
                        placeholder="Description courte du cours..."
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Paramètres */}
                <div className="p-4 sm:p-6 border-b border-[rgba(197,161,72,0.25)] bg-gray-50/50">
                  <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">
                      2
                    </span>
                    Paramètres de publication
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Statut
                      </label>
                      <GlassSegmentedControl
                        size="sm"
                        options={[
                          { id: "draft", label: "Brouillon" },
                          { id: "published", label: "Publié" },
                          { id: "archived", label: "Archivé" },
                        ]}
                        value={formData.status}
                        onChange={(v) =>
                          setFormData({
                            ...formData,
                            status: v as "draft" | "published" | "archived",
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Image de couverture
                      </label>
                      <div className="flex items-center gap-3">
                        {formData.thumbnail_url && (
                          <div className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-[rgba(197,161,72,0.25)] flex-shrink-0">
                            <img
                              src={formData.thumbnail_url}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                            <GlassIconButton
                              icon={XCircle}
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  thumbnail_url: "",
                                }))
                              }
                              color="red"
                              size="sm"
                              aria-label="Retirer l'image"
                              className="absolute top-0.5 right-0.5"
                            />
                          </div>
                        )}
                        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium flex-1 justify-center border border-dashed border-[rgba(197,161,72,0.25)]">
                          <ImageIcon size={16} />
                          {uploading ? "Upload..." : "Choisir"}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Contenu */}
                <div className="p-4 sm:p-6">
                  <h4 className="text-xs font-bold text-[var(--greek-blue)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--greek-blue)] text-white flex items-center justify-center text-[10px] font-black">
                      3
                    </span>
                    Contenu du cours
                  </h4>
                  <CourseBuilder
                    initialContent={formData.content_json}
                    onChange={(chapters) =>
                      setFormData({ ...formData, content_json: chapters })
                    }
                    level={formData.level}
                  />
                </div>
              </div>

              {/* Footer */}
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
                  {isSubmitting && (
                    <Loader2 className="animate-spin" size={16} />
                  )}
                  {modalMode === "create" ? "Créer le cours" : "Sauvegarder"}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Niveau scolaire
                </label>
                <select
                  value={folderFormData.grade_level}
                  onChange={(e) => setFolderFormData({ ...folderFormData, grade_level: e.target.value })}
                  className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 bg-white"
                >
                  {SCHOOL_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Pré-sélectionne ce niveau lors de la génération IA dans ce dossier.
                </p>
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
                  onClick={() => handleSaveFolder({ preventDefault: () => {} } as unknown as React.FormEvent)}
                >
                  {editingFolder ? "Sauvegarder" : "Créer"}
                </GlassButton>
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
          defaultLevel={currentFolderLevel || undefined}
        />
      )}

      {showImportModal && (
        <ImportJsonModal
          onClose={() => setShowImportModal(false)}
          onFileLoaded={(file) => {
            const fakeEvent = {
              target: { files: [file] },
            } as unknown as React.ChangeEvent<HTMLInputElement>;
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
            setNotification(null);
            setIsAiModalOpen(true);
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
  const ctaLabel = isSuccess ? "Fermer" : "Réessayer";

  return (
    <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-fade-bounce relative">
        <div className="absolute top-3 right-3 z-10">
          <GlassCloseButton onClick={onClose} />
        </div>
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
          <GlassButton
            onClick={onAction}
            variant="navy"
            fullWidth
          >
            {ctaLabel}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

"use client";
 

import { useKatexIn } from "@/lib/useKatexIn";
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
import { BookOpen, Search, Plus, Sparkles, FolderPlus, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import { importFromJSONFile } from "@/lib/jsonIO";
import { COURSE_JSON_TEMPLATE } from "@/lib/jsonTemplates";
import { compileHandAuthoredCourse } from "@/lib/ai/handAuthoredContent";
import { Chapter } from "@/components/admin/CourseBuilder";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import SubjectAreasEditor from "@/components/admin/SubjectAreasEditor";
import { useSubjectAreas } from "@/lib/useSubjectAreas";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { compareCourseOrder } from "@/lib/courseOrder";
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
import { SCHOOL_CYCLES, getLevelCycle, getEffectiveFolderLevel } from "@/lib/constants";
import { useConfirm } from "@/components/ConfirmDialog";
import { errMessage } from "@/lib/safeError";
import { COURSE_FOLDER_COLORS as FOLDER_COLORS } from "@/components/admin/folderStyle";

import CourseFolderModal from "@/components/admin/CourseFolderModal";
import CourseEditorModal from "@/components/admin/CourseEditorModal";
import CourseGrid from "@/components/admin/CourseGrid";
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
  /** Rang d'affichage dans le dossier (voir src/lib/courseOrder.ts). */
  chapter_order?: number | null;
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
      ).sort(compareFolderOrder) as unknown as Folder[],
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
      } catch (compileErr: unknown) {
        alert(`Le contenu du fichier n'a pas pu être compilé : ${errMessage(compileErr)}`);
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
    } catch (err: unknown) {
      alert(errMessage(err));
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
  const { startGeneration, onContentCreated } = useContentGenerations();
  const { areas: subjectAreas, setAreas: setSubjectAreas } = useSubjectAreas();
  const [isAreasEditorOpen, setIsAreasEditorOpen] = useState(false);

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
    }, 60000); // 60 s : assez pour voir un contenu ajouté ailleurs, sans recharger sans arrêt
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, statusFilter]);

  // Formules des titres/descriptions : rendues en place, sans masquer la
  // grille (avant, elle passait en opacité 0 à chaque mise à jour : clignotement).
  useKatexIn(gridRef, [loading, courses, searchTerm, currentFolderId]);

  // Fetch folders and courses for the current directory
  async function fetchContents(silent = false) {
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
        // Pas encore en cache : on vide la liste de l'ancien dossier (sinon
        // elle restait affichée) ; les sous-dossiers, déjà connus, restent.
        setCourses([]);
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
    } catch (error: unknown) {
      console.error("Error fetching contents:", errMessage(error) || error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

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
      setEstimatedTime(course.estimated_time ?? 15);
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
    } catch (error: unknown) {
      console.error("Error saving folder:", error);
      alert(
        "Erreur lors de l'enregistrement du dossier: " +
          (errMessage(error) || JSON.stringify(error)),
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
  // Ordre des dossiers du niveau courant, réglé avec les flèches : c'est celui que verra l'élève. Seulement sans recherche ni
  // filtre (déplacer dans une liste partielle n'aurait pas de sens). Mise à jour optimiste, annulée en cas d'échec.
  const canReorderFolders = !searchTerm && cycleFilter === "all" && statusFilter === "all";
  const moveFolder = async (folderId: number, direction: -1 | 1) => {
    const ordered = [...folders];
    const index = ordered.findIndex((f) => f.id === folderId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const ranks = new Map(ordered.map((f, i) => [f.id, (i + 1) * 10]));
    const previous = allFolders;
    setAllFolders((all) => all.map((f) => (ranks.has(f.id) ? { ...f, display_order: ranks.get(f.id)! } : f)));
    const ok = await reorderContentFolders("course", ordered.map((f) => f.id));
    if (ok) invalidateAdminCache("courses:");
    else setAllFolders(previous);
  };

  const filteredFolders = folders.filter(
    (folder) =>
      folder.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (cycleFilter === "all" ||
        currentFolderId !== null ||
        getLevelCycle(folder.grade_level) === cycleFilter),
  );

  const filteredCourses = courses.filter((course) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (course.title?.toLowerCase() || "").includes(searchLower) ||
      (course.description?.toLowerCase() || "").includes(searchLower) ||
      (course.subject?.toLowerCase() || "").includes(searchLower);
    const matchesCycle =
      cycleFilter === "all" || getLevelCycle(course.level) === cycleFilter;
    return matchesSearch && matchesCycle;
  }).sort(compareCourseOrder);

  // Réordonner les cours d'un dossier : l'ordre affiché ici est exactement
  // celui que verra l'élève. Mise à jour optimiste, annulée si l'enregistrement
  // échoue. Désactivé pendant une recherche : déplacer un cours dans une liste
  // filtrée n'aurait pas de sens.
  const canReorder = !searchTerm && cycleFilter === "all";
  const moveCourse = async (courseId: string, direction: -1 | 1) => {
    const ordered = [...courses].sort(compareCourseOrder);
    const index = ordered.findIndex((c) => c.id === courseId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const renumbered = ordered.map((c, i) => ({ ...c, chapter_order: (i + 1) * 10 }));
    const previous = courses;
    setCourses(renumbered);
    const res = await fetch("/api/admin/courses/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: renumbered.map((c) => c.id) }),
    });
    if (!res.ok) setCourses(previous);
  };

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
      <CourseGrid gridRef={gridRef} loading={loading} filteredFolders={filteredFolders} filteredCourses={filteredCourses} setIsFolderModalOpen={setIsFolderModalOpen} handleFolderDragStart={handleFolderDragStart} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave} handleDrop={handleDrop} setCurrentFolderId={setCurrentFolderId} setSearchTerm={setSearchTerm} dragOverFolderId={dragOverFolderId} canReorderFolders={canReorderFolders} folders={folders} moveFolder={moveFolder} setEditingFolder={setEditingFolder} setFolderFormData={setFolderFormData} handleDeleteFolder={handleDeleteFolder} currentFolderId={currentFolderId} subfolderCounts={subfolderCounts} handleDragStart={handleDragStart} setDraggedCourseId={setDraggedCourseId} draggedCourseId={draggedCourseId} getStatusBadge={getStatusBadge} canReorder={canReorder} moveCourse={moveCourse} getFullCourse={getFullCourse} handlePreview={handlePreview} handleOpenModal={handleOpenModal} handleDelete={handleDelete} />

      {/* Create Course Modal */}
      {isAreasEditorOpen && <SubjectAreasEditor areas={subjectAreas} onSaved={setSubjectAreas} onClose={() => setIsAreasEditorOpen(false)} />}

      {isModalOpen && <CourseEditorModal modalMode={modalMode} setIsModalOpen={setIsModalOpen} handleSubmit={handleSubmit} formData={formData} setFormData={setFormData} setIsAreasEditorOpen={setIsAreasEditorOpen} subjectAreas={subjectAreas} currentFolderLevel={currentFolderLevel} estimatedTime={estimatedTime} setEstimatedTime={setEstimatedTime} uploading={uploading} handleFileUpload={handleFileUpload} isSubmitting={isSubmitting} />}

      {/* Create Folder Modal */}
      {isFolderModalOpen && <CourseFolderModal editingFolder={editingFolder} setIsFolderModalOpen={setIsFolderModalOpen} setEditingFolder={setEditingFolder} setFolderFormData={setFolderFormData} handleSaveFolder={handleSaveFolder} folderFormData={folderFormData} />}

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
    <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-overlay">
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

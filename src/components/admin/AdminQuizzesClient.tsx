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
import { importFromJSONFile } from "@/lib/jsonIO";
import { QUIZ_JSON_TEMPLATE } from "@/lib/jsonTemplates";
import { compileHandAuthoredQuiz } from "@/lib/ai/handAuthoredContent";
import QuizGeneratorModal, { QuizGenParams } from "@/components/admin/QuizGeneratorModal";
import { useContentGenerations } from "@/contexts/ContentGenerationsContext";
import { Question } from "@/components/admin/QuizBuilder";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { getAdminCache, setAdminCache, invalidateAdminCache } from "@/lib/adminCache";
import { useConfirm } from "@/components/ConfirmDialog";
import { Plus, Search, X, FolderPlus, XCircle, FileText, Sparkles, Upload } from "lucide-react";
import ImportJsonModal from "@/components/admin/ImportJsonModal";
import { SCHOOL_CYCLES, getLevelCycle, getEffectiveFolderLevel } from "@/lib/constants";
import { errMessage } from "@/lib/safeError";
import { FOLDER_COLORS } from "@/components/admin/folderStyle";



import QuizEditorModal from "@/components/admin/QuizEditorModal";
import QuizFolderModal from "@/components/admin/QuizFolderModal";
import QuizGrid from "@/components/admin/QuizGrid";
export interface Quiz {
  id: string;
  display_order?: number | null;
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
  level?: string | null;
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
  initialFolderId,
  initialItems,
  initialAllFolders,
  initialCourses,
}: {
  initialFolderId: number | null;
  initialItems: Quiz[];
  initialAllFolders: ContentFolder[];
  initialCourses: Course[];
}) {
  const confirm = useConfirm();
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialItems);
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [allFolders, setAllFolders] = useState<ContentFolder[]>(initialAllFolders);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isFirstContentsFetch = useRef(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useSessionFolderId("admin_quizzes_folder", initialFolderId);
  // Dossiers, fil d'Ariane et compteurs DÉRIVÉS de la liste plate des
  // dossiers, déjà en mémoire : ils s'affichent au clic, sans attendre le
  // réseau. Avant, le fil d'Ariane n'était mis à jour qu'à la FIN du
  // chargement du dossier — d'où son décalage visible.
  const folders = useMemo(
    () =>
      allFolders.filter(
        (f) => (currentFolderId === null ? f.parent_id === null : f.parent_id === currentFolderId)
          && (statusFilter === "all" || f.status === statusFilter),
      ).sort(compareFolderOrder) as unknown as QuizFolder[],
    [allFolders, currentFolderId, statusFilter],
  );
  const breadcrumbs = useMemo(
    () =>
      (currentFolderId === null ? [] : buildBreadcrumbs(allFolders, currentFolderId)) as unknown as QuizFolder[],
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
    grade_level: "6eme" as string,
    icon: "",
  });

  const [showImportModal, setShowImportModal] = useState(false);

  const processImportFile = async (file: File) => {
    try {
      const data = await importFromJSONFile(file);
      if (data._type && data._type !== "quiz") { alert("Ce fichier n'est pas un quiz."); return; }
      let compiledContent = ((data.content_json as Question[] | undefined) || []) as Question[];
      try {
        const result = compileHandAuthoredQuiz(data);
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
        folder_id: data.folder_id ?? "",
        time_limit_minutes: data.time_limit_minutes || data.time_limit || 0,
        min_score_percent: data.min_score_percent || 0,
        difficulty_level: (data.difficulty_level || "medium") as "easy" | "medium" | "hard",
        type: data.type || "standard",
        level: data.level || "6eme",
        grading_type: data.grading_type || "auto",
        max_attempts: data.max_attempts || 0,
        status: data.status || "draft",
        thumbnail_filename: "",
        content_json: compiledContent,
      });
      setQuizEstimatedTime(data.estimated_time ?? 15);
      setEditingQuiz(data.id ? ({ id: data.id } as Quiz) : null);
      setIsModalOpen(true);
    } catch (err: unknown) { alert(errMessage(err)); }
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
  const { startGeneration, onContentCreated } = useContentGenerations();

  // Une génération lancée depuis cette page (ou une autre, ou avant un
  // rechargement) rafraîchit la liste dès qu'elle aboutit à un quiz créé.
  useEffect(() => {
    return onContentCreated("quiz", () => {
      invalidateAdminCache("quizzes:");
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
    const cacheKey = `quizzes:${currentFolderId}:${statusFilter}:${courseFilter}:${difficultyFilter}`;
    const cached = getAdminCache<{ items: Quiz[]; allFolders: ContentFolder[] }>(cacheKey);
    if (!silent) {
      if (cached) {
        // Affiche instantanément la dernière version connue — pas d'écran de
        // chargement — pendant qu'une requête fraîche part en arrière-plan.
        setQuizzes(cached.items);
        setAllFolders(cached.allFolders);
        setLoading(false);
      } else {
        // Pas encore en cache : la liste de l'ancien dossier ne doit pas rester affichée.
        setQuizzes([]);
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
      let url = `/api/admin/quizzes?folder=${currentFolderId ?? "root"}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (courseFilter !== "all") url += `&course_id=${courseFilter}`;
      const [freshFolders, response] = await Promise.all([listFolders("quiz"), fetch(url)]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch contents");

      let items = data as Quiz[];
      if (difficultyFilter !== "all") {
        items = items.filter((q) => q.difficulty_level === difficultyFilter);
      }
      setAllFolders(freshFolders);
      setQuizzes(items);
      setAdminCache(cacheKey, { items, allFolders: freshFolders });
    } catch (error: unknown) {
      console.error("Error fetching contents:", errMessage(error) || error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

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
        if (folderIsSelfOrDescendant(allFolders, Number(folderId), targetFolderId)) {
          alert("Impossible de déplacer un dossier dans lui-même ou un de ses sous-dossiers");
          return;
        }
        const { ok } = await updateFolder("quiz", Number(folderId), { parent_id: targetFolderId });
        if (!ok) throw new Error("Failed to move folder");
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
      const payload = {
        name: folderFormData.name,
        status: folderFormData.status,
        color: folderFormData.color,
        grade_level: folderFormData.grade_level || null,
        icon: folderFormData.icon || null,
      };
      const { ok, error } = editingFolder
        ? await updateFolder("quiz", editingFolder.id, payload)
        : await createFolder("quiz", { ...payload, parent_id: currentFolderId });
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
      invalidateAdminCache("quizzes:");
      fetchContents();
    } catch (error: unknown) {
      console.error("Error saving folder:", error);
      alert(
        "Erreur lors de l'enregistrement du dossier: " +
          (errMessage(error) || JSON.stringify(error))
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

    const { ok } = await deleteFolder("quiz", folder.id);
    if (!ok) {
      alert("Erreur lors de la suppression du dossier");
      return;
    }
    invalidateAdminCache("quizzes:");
    fetchContents();
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

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
    return { ...quiz, content_json: full.content_json ?? [] };
  };

  const handlePreview = async (quiz: Quiz, win?: Window | null) => {
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

    const res = await fetch("/api/admin/content-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "quiz", payload: previewData }),
    });
    const data = await res.json();
    if (!res.ok) {
      win?.close();
      return;
    }
    const url = `/child/quiz/preview?pid=${data.id}`;
    // `win` ouvert de façon synchrone AVANT tout await, sinon Safari mobile
    // bloque silencieusement le window.open (plus rattaché au geste utilisateur).
    if (win) win.location.href = url;
    else window.open(url, "_blank");
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
    fetchInitialData();
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
      (quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (quiz.description &&
          quiz.description.toLowerCase().includes(searchQuery.toLowerCase()))) &&
      (cycleFilter === "all" || getLevelCycle(quiz.level) === cycleFilter)
  ).sort(compareDisplayOrder);

  // Ordre du dossier, réglé avec les flèches : c'est exactement celui que verra
  // l'élève. Seulement sans recherche ni filtre (déplacer dans une liste
  // partielle n'aurait pas de sens). Mise à jour optimiste, annulée en cas d'échec.
  const canReorder = !searchQuery && cycleFilter === "all" && statusFilter === "all" && courseFilter === "all" && difficultyFilter === "all";
  const moveItem = async (itemId: string, direction: -1 | 1) => {
    const ordered = [...quizzes].sort(compareDisplayOrder);
    const index = ordered.findIndex((x) => x.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const renumbered = ordered.map((x, i) => ({ ...x, display_order: (i + 1) * 10 }));
    const previous = quizzes;
    setQuizzes(renumbered);
    const res = await fetch("/api/admin/quizzes/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: renumbered.map((x) => x.id) }),
    });
    if (!res.ok) setQuizzes(previous);
  };

  // Seuls les dossiers racine portent le niveau scolaire : une fois dans un
  // dossier de niveau, le cycle est deja determine.
  // Ordre des dossiers du niveau courant, réglé avec les flèches : c'est celui que verra l'élève. Seulement sans recherche ni
  // filtre (déplacer dans une liste partielle n'aurait pas de sens). Mise à jour optimiste, annulée en cas d'échec.
  const canReorderFolders = !searchQuery && cycleFilter === "all" && statusFilter === "all";
  const moveFolder = async (folderId: number, direction: -1 | 1) => {
    const ordered = [...folders];
    const index = ordered.findIndex((f) => f.id === folderId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const ranks = new Map(ordered.map((f, i) => [f.id, (i + 1) * 10]));
    const previous = allFolders;
    setAllFolders((all) => all.map((f) => (ranks.has(f.id) ? { ...f, display_order: ranks.get(f.id)! } : f)));
    const ok = await reorderContentFolders("quiz", ordered.map((f) => f.id));
    if (ok) invalidateAdminCache("quizzes:");
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
        icon={FileText}
        title="Gestion des Quiz"
        subtitle="Gérez les quiz, les questions et leur organisation"
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
            <GlassButton
              size="sm"
              variant="navy"
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
                fetchInitialData();
                setIsModalOpen(true);
              }}
            >
              <Plus size={18} />
              Nouveau Quiz
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
              placeholder="Rechercher un quiz..."
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

      {/* Quiz Grid */}
      <QuizGrid loading={loading} filteredFolders={filteredFolders} handleFolderDragStart={handleFolderDragStart} handleDragOver={handleDragOver} handleDragLeave={handleDragLeave} handleDrop={handleDrop} setCurrentFolderId={setCurrentFolderId} setSearchQuery={setSearchQuery} dragOverFolderId={dragOverFolderId} canReorderFolders={canReorderFolders} folders={folders} moveFolder={moveFolder} setEditingFolder={setEditingFolder} setFolderFormData={setFolderFormData} setIsFolderModalOpen={setIsFolderModalOpen} handleDeleteFolder={handleDeleteFolder} currentFolderId={currentFolderId} subfolderCounts={subfolderCounts} filteredQuizzes={filteredQuizzes} handleDragStart={handleDragStart} setDraggedQuizId={setDraggedQuizId} draggedQuizId={draggedQuizId} getStatusBadge={getStatusBadge} canReorder={canReorder} moveItem={moveItem} getFullQuiz={getFullQuiz} handlePreview={handlePreview} handleOpenModal={handleOpenModal} handleDelete={handleDelete} />

      {/* Folder Creation/Edit Modal */}
      {isFolderModalOpen && <QuizFolderModal editingFolder={editingFolder} setIsFolderModalOpen={setIsFolderModalOpen} setEditingFolder={setEditingFolder} setFolderFormData={setFolderFormData} handleSaveFolder={handleSaveFolder} folderFormData={folderFormData} />}

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
            size="sm"
            color="red"
            onClick={() => setAiError(null)}
            aria-label="Fermer"
          />
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
      {isModalOpen && <QuizEditorModal editingQuiz={editingQuiz} setIsModalOpen={setIsModalOpen} handleSubmit={handleSubmit} formData={formData} setFormData={setFormData} courses={courses} folders={folders} uploading={uploading} handleFileUpload={handleFileUpload} currentFolderLevel={currentFolderLevel} quizEstimatedTime={quizEstimatedTime} setQuizEstimatedTime={setQuizEstimatedTime} handlePreview={handlePreview} isSubmitting={isSubmitting} />}





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
